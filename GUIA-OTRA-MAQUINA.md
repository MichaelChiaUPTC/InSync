# Correr el proyecto desde otra máquina

Arquitectura que se levanta:

```
Navegador ─> Front (Vercel, o npm start)
                └─> API Gateway + Lambda (AWS)  ──>  Keycloak (esta máquina + túnel cloudflared)
```

Keycloak corre en la máquina nueva y se publica con un túnel, porque Lambda no alcanza `localhost`.
**El túnel cambia de URL cada vez que se reinicia**, y esa URL hay que repartirla al backend (paso 4).

## 0. Requisitos en la máquina nueva

| Herramienta | Para qué | Instalación (PowerShell) |
|---|---|---|
| Git | Clonar el repo | `winget install Git.Git` |
| Node.js 20+ | Front y Serverless | `winget install OpenJS.NodeJS.LTS` |
| Python 3.12+ | Backend local (opcional si solo despliegas) | `winget install Python.Python.3.12` |
| Java 21 | Keycloak (si usas el ZIP) | `winget install EclipseAdoptium.Temurin.21.JDK` |
| cloudflared | Túnel | `winget install Cloudflare.cloudflared` |
| AWS CLI | Credenciales para `serverless deploy` | `winget install Amazon.AWSCLI` |

Cierra y abre la terminal después de instalar, para que reconozca los comandos.

```powershell
git clone https://github.com/MichaelChiaUPTC/InSync.git
cd InSync
git checkout feat/front-integracion        # o main, según dónde esté lo último
```

## 1. Keycloak

Descarga el ZIP de Keycloak 26 (https://www.keycloak.org/downloads), descomprímelo y entra a `bin`.

**1.1 Datos (realms y usuarios).** La máquina nueva arranca vacía. Elige una:

- **Copiar la carpeta de datos** (lo más fácil, misma versión de Keycloak en ambas): en la máquina vieja, con Keycloak apagado, copia `keycloak-XX\data` y pégala en el mismo lugar de la nueva.
- **Exportar e importar**, con Keycloak apagado en cada máquina:
  ```powershell
  .\kc.bat export --dir C:\export --users realm_file     # máquina vieja
  .\kc.bat import --dir C:\export                         # máquina nueva (copia antes la carpeta)
  ```
- **Crear todo a mano**, según la sección 2 de [README.md](README.md): realms `tenantA` y `tenantB`, roles `erp_*`, cliente `Beta0` y usuarios.

**1.2 Arrancar Keycloak** (solo la primera vez crea el usuario `admin`):

```powershell
$env:KC_BOOTSTRAP_ADMIN_USERNAME = "admin"
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = "admin"
.\kc.bat start-dev
```

Cuando diga `Listening on: http://0.0.0.0:8080`, entra a http://localhost:8080 y comprueba que existen los realms `tenantA` y `tenantB`.

## 2. Abrir el túnel

En otra terminal:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Copia la URL que aparece, con forma `https://palabra-palabra-palabra-palabra.trycloudflare.com`. Es la **URL del túnel**. Deja esta terminal abierta.

## 3. Reiniciar Keycloak con la URL del túnel

Keycloak debe conocer su dirección pública, o los tokens salen con un emisor (`iss`) incorrecto y el backend los rechaza.

En la terminal de Keycloak: `Ctrl+C` y después

```powershell
.\kc.bat start-dev --hostname=https://<url-del-tunel> --http-enabled=true --proxy-headers=xforwarded
```

Comprueba, desde cualquier terminal:

```powershell
curl.exe https://<url-del-tunel>/realms/tenantA/.well-known/openid-configuration
```

Debe devolver JSON. Si no, el túnel o Keycloak no están bien.

## 4. Actualizar URL y secrets en el backend

**4.1 Obtener los secrets.** Si importaste los realms, normalmente son los mismos de antes; si los creaste a mano, son nuevos. Compruébalo siempre: consola de Keycloak (`https://<url-del-tunel>`, `admin` / `admin`) → elige el realm → *Clients* → `Beta0` → *Credentials* → *Client secret*. Haz esto en `tenantA` y en `tenantB`.

**4.2 Dárselos al backend**, de una de estas dos formas.

*Opción A, variables de entorno (recomendada: no hay que editar archivos, y sirve para el backend local y para `serverless deploy`).* En una terminal en `back`:

```powershell
cd back
$env:KEYCLOAK_URL = "https://<url-del-tunel>"                # sin barra final
$env:KEYCLOAK_CLIENT_SECRET_A = "<secret de tenantA>"
$env:KEYCLOAK_CLIENT_SECRET_B = "<secret de tenantB>"
```

Valen solo para esa terminal: si la cierras, hay que repetirlas.

*Opción B, editar los archivos* (para no volver a escribir variables). Cambia los mismos tres valores en:

| Archivo | Qué cambiar |
|---|---|
| [back/keycloak_service.py](back/keycloak_service.py) | La URL de `KEYCLOAK_URL` (línea 9) y los secrets A y B (líneas 15 y 19) |
| [back/serverless.yaml](back/serverless.yaml) | Los mismos tres valores, en `provider.environment` |

Si cambias la URL del túnel en el futuro, hay que repetir este paso.

## 5. Elegir dónde corre el backend

**5.1 Backend local (lo más rápido para probar).** En la misma terminal del paso 4:

```powershell
npm install
pip install -r requirements.txt
npx serverless wsgi serve --stage dev
```

Queda en http://127.0.0.1:5000 y atiende `/tenantA/...` y `/tenantB/...`. Si el front va a usar este backend, en [front/src/environments/environment.ts](front/src/environments/environment.ts) pon `const BASE = 'http://localhost:5000';`.

**5.2 Backend en AWS (Lambda).** Es lo que usa el front desplegado en Vercel. Una sola vez en la máquina:

```powershell
aws configure                # Access Key y Secret de tu cuenta AWS, región us-east-1
npx serverless login         # el archivo serverless.yaml usa la organización "maikolkolchia"
```

Luego, en la terminal con las variables del paso 4:

```powershell
cd back
npm install
npx serverless deploy
```

Al terminar muestra los endpoints. Si despliegas en la **misma cuenta AWS y la misma organización** que antes, se actualiza la misma API y el URL base no cambia (`https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev`). Si cambia, copia el nuevo valor a `BASE` en [environment.ts](front/src/environments/environment.ts) y en [environment.aws.ts](front/src/environments/environment.aws.ts).

## 6. Probar

```powershell
$API = "https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev"     # o http://127.0.0.1:5000

$login = Invoke-RestMethod -Method Post -Uri "$API/tenantA/login" -ContentType "application/json" -Body '{"username":"estebanquito","password":"1234"}'
$login.roles

Invoke-RestMethod -Uri "$API/tenantA/productos" -Headers @{ Authorization = "Bearer $($login.access_token)" } | Select-Object nombre, precio_venta, stock_actual | Format-Table
```

Debe salir el rol `erp_admin` y la tabla de productos. El token dura 5 minutos. Para tenant B, usa `/tenantB/...` y un usuario del realm `tenantB`.

## 7. Front

```powershell
cd front
npm install
npm start                      # http://localhost:4200
```

Abre http://localhost:4200 e inicia sesión. El front usa la API que indique `BASE` en [environment.ts](front/src/environments/environment.ts).

**Front en Vercel.** Se despliega solo desde GitHub: *Root Directory* `front`, y el [vercel.json](front/vercel.json) ya trae el build (`ng build --configuration aws`). Si cambias `BASE`, haz commit y push; Vercel vuelve a desplegar. Para el login desde la web de Vercel, el túnel y Keycloak deben estar encendidos.

## 8. Kafka (opcional, desactivado por defecto en Lambda)

En otra PC de la misma red que el backend local:

```powershell
cd deploy\kafka
"KAFKA_PUBLIC_HOST=<ip-de-esa-pc>" | Out-File -Encoding ascii .env
docker compose up -d
```

En la terminal del backend local: `$env:KAFKA_BOOTSTRAP_SERVERS = "<ip-de-esa-pc>:9092"`. Kafka UI: `http://<ip-de-esa-pc>:8083`. Con Lambda déjalo vacío (explicación en [deploy/README.md](deploy/README.md)).

## 9. Cada vez que reinicies el túnel

La URL cambia, así que repite en este orden:

1. Abrir el túnel y copiar la URL nueva (paso 2).
2. Reiniciar Keycloak con `--hostname=<url nueva>` (paso 3).
3. Actualizar `KEYCLOAK_URL` en el backend (paso 4).
4. Si usas Lambda: `npx serverless deploy` otra vez. Si es local: reiniciar `serverless wsgi serve`.

## 10. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| Login 502 o "No se pudo contactar Keycloak" | El túnel está cerrado o cambió de URL | Pasos 2 a 4, y redespliega si usas Lambda |
| Login 401 "Usuario o contraseña incorrectos" | Usuario, clave o secret incorrectos | Revisa el usuario en el realm correcto y el *Client secret* en *Credentials* |
| `Token invalido o expirado` en `/productos` | Token vencido (5 min), o Keycloak arrancó sin `--hostname` | Repite el login; revisa el paso 3 |
| `Realm does not exist` | La máquina nueva no tiene los realms | Paso 1.1 |
| `Missing Authentication Token` al abrir un link en el navegador | Ruta inexistente o método no permitido (por ejemplo abrir `/login`, que es POST) | Es normal en esas rutas; usa los comandos del paso 6 |
| `serverless deploy` pide login o no encuentra credenciales | Falta `serverless login` o `aws configure` | Paso 5.2 |
| El front muestra datos viejos o vacíos | `BASE` apunta a otra API, o el backend se reinició | Revisa `BASE`; los datos están en memoria y se regeneran |
| La URL del túnel dejó de abrir | `trycloudflare` es temporal | Paso 9 |

Los secrets de este archivo y del código son de un proyecto de clase. En un proyecto real irían en variables de entorno o en un gestor de secretos.
