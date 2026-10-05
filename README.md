# InSync — ERP multi-tenant

API en Flask (Serverless Framework) + frontend Angular, con login y roles en Keycloak.
Hay dos negocios de ejemplo (tenants). **Un solo backend y un solo front** los atienden: el negocio va en la ruta de la API y se deduce del realm del usuario al hacer login.

| Tenant | Negocio | Ruta API | Realm Keycloak | Tema |
|---|---|---|---|---|
| A | Supermercado El Ahorro | `/tenantA/...` | `tenantA` | morado |
| B | Pastelería Dulce Aroma | `/tenantB/...` | `tenantB` | rosa |

```
back/     Flask + serverless.yaml (rutas /tenantX/login, /usuarios, /productos, /ventas) + kafka_service.py
front/    Angular (módulos por gestión: inventarios, usuarios, ventas; login; layout)
deploy/   docker-compose de Keycloak y Kafka para EC2 (ver deploy/README.md)
docker-compose.yml   Kafka + Zookeeper + Kafka UI para uso local
```

El login del front prueba el usuario contra la API de cada tenant; la que lo reconoce define su negocio, su tema (colores/logo) y la API que usará después.

## 1. Requisitos

- Node.js 18+ y npm
- Python 3.12+ y pip
- Keycloak en ejecución (local `http://localhost:8080`, o uno remoto)
- Docker Desktop (Keycloak local con Docker, y/o Kafka)

## 2. Configurar Keycloak (una sola vez)

Se necesitan **dos realms**: `tenantA` y `tenantB`. En **cada uno**:

1. **Realm roles:** `erp_admin`, `erp_inventario`, `erp_ventas`.
2. **Client** `Beta0`: *Client authentication* activado y *Direct access grants* activado. Copia el secret de la pestaña *Credentials* (hay uno por realm).
3. **Usuario** (por ejemplo `admin`): contraseña con *Temporary* apagado, rol `erp_admin`, y email, nombre y apellido rellenos (si no, Keycloak rechaza el login con "Account is not fully set up").

Keycloak local rápido con Docker:

```powershell
docker run -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev
```

Los usuarios de la pantalla *Usuarios* del ERP son datos de prueba del backend y **no** inician sesión; el acceso real son los usuarios de Keycloak.

## 3. Backend (`:5000`)

Desde `back/`, en PowerShell:

```powershell
cd back
npm install
pip install -r requirements.txt

$env:KEYCLOAK_URL = "http://localhost:8080"          # sin barra final
$env:KEYCLOAK_CLIENT_SECRET_A = "<secret de Beta0 en realm tenantA>"
$env:KEYCLOAK_CLIENT_SECRET_B = "<secret de Beta0 en realm tenantB>"
# opcionales (valores por defecto): KEYCLOAK_REALM_A=tenantA, KEYCLOAK_REALM_B=tenantB, KEYCLOAK_CLIENT_ID=Beta0

npx serverless wsgi serve --stage dev
```

Una sola instancia sirve ambos negocios: `http://127.0.0.1:5000/tenantA/...` y `/tenantB/...`.
Las variables `$env:` valen solo para esa terminal. **No guardes secrets en archivos del repo.**

Prueba rápida:

```powershell
$r = Invoke-RestMethod -Method Post http://127.0.0.1:5000/tenantA/login -ContentType "application/json" -Body '{"username":"admin","password":"TU_CLAVE"}'
Invoke-RestMethod http://127.0.0.1:5000/tenantA/productos -Headers @{Authorization="Bearer $($r.access_token)"}
```

El token dura 5 minutos; si da 401, repite el login.

## 4. Frontend (`:4200`)

Por defecto `front/src/environments/environment.ts` apunta a la API desplegada en AWS. Para usar tu backend local, cámbialo:

```ts
const BASE = 'http://localhost:5000';
// apiUrls: { A: `${BASE}/tenantA`, B: `${BASE}/tenantB` }
```

```powershell
cd front
npm install
npm start                      # http://localhost:4200
```

Colores y logos por tenant: `front/src/environments/environmentTienda.ts` y `environmentPasteleria.ts`, logos en `front/public/logos/`. La selección se hace en `front/src/app/core/tema.ts`.

Tests y build:

```powershell
npm test -- --watch=false
npx ng build --configuration aws     # build para S3/CloudFront/Vercel (usa environment.aws.ts)
```

## 5. Kafka (opcional)

Registra eventos de la aplicación (accesos, login, inventario, ventas) para verlos en Kafka UI. Si Kafka no está encendido, la API funciona igual y los eventos se descartan.

```powershell
# 1. Encender Docker Desktop y levantar Kafka (desde la raíz del repo)
docker compose up -d

# 2. Reiniciar el backend (ya instalado con pip install -r requirements.txt)
#    Usa localhost:9092 por defecto; para cambiarlo: $env:KAFKA_BOOTSTRAP_SERVERS = "host:9092"
#    Para desactivarlo: $env:KAFKA_BOOTSTRAP_SERVERS = ""
```

Kafka UI: http://localhost:8083 → *Topics*. Los topics se crean solos al publicar el primer evento.

| Topic | Eventos (`tipo`) |
|---|---|
| `seguridad.accesos` | `acceso_sin_token`, `token_invalido`, `acceso_denegado` |
| `usuarios.autenticacion` | `login_exitoso`, `login_fallido` |
| `usuarios.gestion` | `usuario_creado`, `usuario_actualizado`, `usuario_eliminado` |
| `inventario.eventos` | `producto_creado`, `producto_actualizado`, `producto_eliminado`, `stock_bajo` |
| `ventas.eventos` | `venta_registrada`, `venta_anulada` |

Cada evento lleva `tenant_id` y `timestamp`. Nunca se publican contraseñas ni tokens. Para ver uno rápido: haz una petición sin token (`curl.exe http://127.0.0.1:5000/tenantA/productos`) y revisa `seguridad.accesos`.

Ambos tenants publican en los mismos topics y se distinguen por `tenant_id`.

## 6. Qué hay en cada rol

| Rol | Ve | Puede |
|---|---|---|
| `erp_admin` | Inventario, Ventas, Usuarios | Todo (incluye anular ventas y gestionar usuarios) |
| `erp_inventario` | Inventario | Crear, editar y eliminar productos |
| `erp_ventas` | Inventario (solo lectura), Ventas | Registrar ventas y corregir su método de pago |

## 7. Datos

Productos, ventas y usuarios (por tenant) viven en memoria y se regeneran con datos de prueba (`back/semillas.py`) cada vez que arranca el backend. Nada persiste entre reinicios.

## 8. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| Login: "Usuario o contraseña incorrectos" y en Keycloak `Account is not fully set up` | Usuario con perfil incompleto o acciones pendientes | Completa email, nombre y apellido; quita *Required user actions* |
| `/productos` responde "Token invalido o expirado" | Token vencido (5 min) o `KEYCLOAK_URL` mal | Haz login de nuevo; revisa la URL (sin barra final) |
| El front no carga datos | Backend apagado o `environment.ts` apunta a otra API | Backend en `:5000`; revisa `BASE` en `environment.ts` |
| Login falla con 502/500 | Falta `KEYCLOAK_URL` o `KEYCLOAK_CLIENT_SECRET_A/B` | Defínelas en esa terminal |
| El puerto 5000 está ocupado | Otro proceso (por ejemplo un `python app.py` abierto) | Ciérralo con `Ctrl+C` |
| Los datos desaparecen | El backend se reinició | Es esperado (memoria) |
| No aparecen eventos en Kafka UI | Docker apagado, o el backend arrancó antes que Kafka | Enciende `docker compose up -d` y espera ~30 s (la API reintenta cada 30 s) |

## 9. Despliegue a AWS (opcional)

La Lambda no alcanza `localhost`: necesita un Keycloak con URL pública. Para el despliegue en máquinas separadas (Keycloak, Kafka, Lambda y front) sigue [deploy/README.md](deploy/README.md).

Las variables `KEYCLOAK_URL`, `KEYCLOAK_CLIENT_SECRET_A` y `KEYCLOAK_CLIENT_SECRET_B` ya no tienen valor por defecto: defínelas antes de arrancar el backend o de hacer `serverless deploy`.
