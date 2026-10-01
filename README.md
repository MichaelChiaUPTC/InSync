# InSync — ERP multi-tenant

API en Flask (Serverless Framework) + frontend en Angular, con login y roles en Keycloak.
Hay dos tenants de ejemplo, cada uno es un stage de Serverless con sus propios datos y su propio estilo:

| Tenant | Negocio | Stage | API | Front |
|---|---|---|---|---|
| A | Supermercado El Ahorro (verde) | `tenantA` | `:5000` | `:4200` |
| B | Pastelería Dulce Aroma (rosa) | `tenantB` | `:5001` | `:4201` |

```
back/    Flask + serverless.yaml   (ver Documentacion.md para las rutas)
front/   Angular (un environment por tenant)
```

## 1. Requisitos

- Node.js 18+ y npm
- Python 3.12 (o la versión que tengas; Flask no exige una específica en local)
- Keycloak en ejecución (aquí: `http://localhost:8080`)

## 2. Configurar Keycloak (una sola vez)

1. Crea el realm **InSync**.
2. **Realm roles:** `erp_admin`, `erp_inventario`, `erp_ventas`.
3. **Client** `Beta0`: *Client authentication* activado y *Direct access grants* activado. Copia el secret de la pestaña *Credentials*.
4. **Usuario** (por ejemplo `admin`): ponle contraseña con *Temporary* apagado, asígnale el rol `erp_admin` y rellena email, nombre y apellido (si no, Keycloak rechaza el login con "Account is not fully set up").

Los usuarios que ves en la pantalla *Usuarios* son datos de prueba del backend y **no** inician sesión; el acceso real son los usuarios de Keycloak.

## 3. Backend

Todo desde `back/`, en PowerShell.

```powershell
cd back
npm install
pip install -r requirements.txt

$env:KEYCLOAK_URL = "http://localhost:8080"
$env:KEYCLOAK_CLIENT_SECRET = "<secret de Beta0>"
# opcionales (estos son los valores por defecto):
# $env:KEYCLOAK_REALM = "InSync"
# $env:KEYCLOAK_CLIENT_ID = "Beta0"

npx serverless wsgi serve --stage tenantA          # tenant A en :5000
```

Para el tenant B, en **otra terminal** (con las mismas variables):

```powershell
npx serverless wsgi serve --stage tenantB -p 5001
```

Las variables `$env:` valen solo para la terminal donde las defines. **No guardes el secret en archivos del repo.**

Prueba rápida:

```powershell
$r = curl.exe -s -X POST http://127.0.0.1:5000/login -H "Content-Type: application/json" -d '{\"username\":\"admin\",\"password\":\"TU_CLAVE\"}' | ConvertFrom-Json
curl.exe http://127.0.0.1:5000/productos -H "Authorization: Bearer $($r.access_token)"
```

El token dura 5 minutos; si da 401, repite el login. Para JSON con espacios usa `Invoke-RestMethod` en vez de `curl.exe`.

## 4. Frontend

Desde `front/`:

```powershell
cd front
npm install

npm start                                                       # tenant A en http://localhost:4200
npm run ng -- serve --configuration tenantB --port 4201         # tenant B en http://localhost:4201
```

Cada tenant usa su `environment` (`front/src/environments/`): URL de la API, nombre, colores y logo (`front/public/logos/`). Para cambiar la imagen de un tenant edita `temas.ts` y reemplaza su logo.

Tests y build:

```powershell
npm test -- --watch=false
npx ng build --configuration tenantA
```

## 5. Qué hay en cada rol

| Rol | Ve | Puede |
|---|---|---|
| `erp_admin` | Inventario, Ventas, Usuarios | Todo (incluye anular ventas y gestionar usuarios) |
| `erp_inventario` | Inventario | Crear, editar y eliminar productos |
| `erp_ventas` | Inventario (solo lectura), Ventas | Registrar ventas y corregir su método de pago |

## 6. Datos

Productos, ventas y usuarios viven en memoria y se regeneran con datos de prueba (`back/semillas.py`) cada vez que arranca el backend. Nada persiste entre reinicios.

## 7. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| Login: "Usuario o contraseña incorrectos" y en Keycloak `Account is not fully set up` | Usuario con perfil incompleto o acciones pendientes | Completa email, nombre y apellido; quita *Required user actions* |
| `/productos` responde "Token invalido o expirado" | Token vencido (5 min) o `KEYCLOAK_URL` mal | Haz login de nuevo; revisa la URL (sin barra final) |
| El front no carga datos | Backend apagado o puerto distinto | A usa `:5000`, B usa `:5001` |
| Error de variable al arrancar Serverless | Falta `KEYCLOAK_URL` o `KEYCLOAK_CLIENT_SECRET` | Defínelas en esa terminal |
| El puerto 5000 está ocupado | Otro proceso (por ejemplo un `python app.py` abierto) | Ciérralo con `Ctrl+C` |
| Los datos desaparecen | El backend se reinició | Es esperado (memoria) |

## 8. Despliegue a AWS (opcional)

La Lambda no alcanza `localhost`: necesita un Keycloak con URL pública.

```powershell
cd back
$env:KEYCLOAK_URL = "<url pública de Keycloak>"
$env:KEYCLOAK_CLIENT_SECRET = "<secret>"
npx serverless deploy --stage tenantA
```

Después actualiza `apiUrl` en `front/src/environments/environment.aws.ts` con el endpoint resultante.
