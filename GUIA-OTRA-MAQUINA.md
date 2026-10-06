# Correr el proyecto desde otra máquina

Arquitectura que se levanta (cada servicio puede estar en una máquina o con una persona distinta):

```
Navegador ─> Front (Vercel, o npm start)
                └─> API Gateway + Lambda (AWS) ──> https://dense-overbuilt-unnoticed.ngrok-free.dev  (ngrok) ─> Keycloak    :8080
                                               └─> https://<dominio-kafka>   (ngrok) ─> Kafka REST :8082 ─> Kafka
```

Lambda no alcanza `localhost`, así que Keycloak y Kafka se publican con **ngrok**. Cada cuenta gratuita de ngrok incluye **un dominio fijo** (no cambia al reiniciar), por eso hay un dominio por servicio.

**Dominio de Keycloak del proyecto: `https://dense-overbuilt-unnoticed.ngrok-free.dev`.** Es el dominio de ngrok del dueño de Keycloak y se usa siempre. Lo que sigue importa mucho:

- Ese dominio solo responde mientras **Keycloak y su túnel de ngrok estén corriendo en la máquina del dueño** (o en la que la haya reemplazado: ver "Si Keycloak debe correr en otra máquina" en el paso 9).
- **Las demás máquinas no instalan ni corren Keycloak ni ngrok.** Solo despliegan el backend, corren el front o hacen pruebas, apuntando a ese dominio con su propio `back/.env` (paso 4).

## Quién hace qué

| Rol | Qué corre | Pasos de esta guía |
|---|---|---|
| **Dueño de Keycloak** (dueño del dominio de arriba) | Keycloak y el túnel de ngrok de Keycloak | 0, 0.1, 1, 2 |
| **Dueño de Kafka** (otra persona, con su propio dominio de ngrok) | Docker con Kafka y el túnel de ngrok del proxy | 0, 0.1, 8 |
| **Cualquier otra máquina** (desplegar el backend, correr el front, probar) | Nada de lo anterior | 0 (solo Git, Node y AWS CLI), 4, 5, 6, 7 |

Si solo vas a desplegar el backend o correr el front, **salta directo al paso 4**: necesitas que el dueño de Keycloak tenga todo encendido y que te dé los dos *client secrets*.

## Las terminales

Cada paso indica en qué terminal se ejecuta. **No mezcles terminales**: las variables `$env:` solo existen en la terminal donde se escribieron, y `serverless deploy` o el backend local deben ejecutarse en esa misma. Si usas otra, la Lambda se despliega con valores vacíos o viejos y el login falla con `Keycloak no disponible`. (Los valores del archivo `back/.env` no tienen este problema: valen para cualquier terminal.)

| Terminal | Se queda abierta con | Máquina | Pasos |
|---|---|---|---|
| **KEYCLOAK** | Keycloak corriendo | La del dueño de Keycloak | 1 |
| **TÚNEL KEYCLOAK** | `ngrok` hacia el puerto 8080 | La del dueño de Keycloak | 2 |
| **TÚNEL KAFKA** | `ngrok` hacia el puerto 8082, solo si usas Kafka con Lambda | La del dueño de Kafka | 8 |
| **BACK** | Deploy o backend local y pruebas | Cualquiera | 4, 5, 6 |
| **FRONT** | `npm start` | Cualquiera | 7 |

Las terminales KEYCLOAK, TÚNEL KEYCLOAK, TÚNEL KAFKA y FRONT quedan ocupadas con su proceso y no se pueden usar para otra cosa. Si cierras una, ese servicio se apaga. Ciérralas con `Ctrl+C`. La terminal BACK es la única en la que escribes comandos sueltos.

## 0. Requisitos

| Herramienta | Para qué | Instalación (PowerShell) |
|---|---|---|
| Git | Clonar el repo | `winget install Git.Git` |
| Node.js 20+ | Front y Serverless | `winget install OpenJS.NodeJS.LTS` |
| Python 3.12+ | Backend local (opcional si solo despliegas) | `winget install Python.Python.3.12` |
| Java 21 | Keycloak (si usas el ZIP) | `winget install EclipseAdoptium.Temurin.21.JDK` |
| Docker Desktop | Kafka (opcional) | `winget install Docker.DockerDesktop` |
| ngrok | Túnel con dominio fijo | `winget install Ngrok.Ngrok` |
| AWS CLI | Credenciales para `serverless deploy` | `winget install Amazon.AWSCLI` |

No todas las máquinas necesitan todo: **Java** y **ngrok** solo en la del dueño de Keycloak; **Docker** y **ngrok** solo en la del dueño de Kafka; Git, Node.js y AWS CLI en quien despliegue el backend o corra el front. Cierra y abre la terminal después de instalar, para que reconozca los comandos.

```powershell
git clone https://github.com/MichaelChiaUPTC/InSync.git
cd InSync
git checkout feat/front-integracion        # o main, según dónde esté lo último
```

**0.1 Configurar ngrok** (una sola vez, solo quien publique un servicio: el dueño de Keycloak y el dueño de Kafka):

1. Crea una cuenta gratuita en https://dashboard.ngrok.com y copia tu *authtoken* (sección *Your Authtoken*).
2. Guárdalo en tu máquina:
   ```powershell
   ngrok config add-authtoken <tu-authtoken>
   ```
3. En el panel de ngrok, sección **Domains**, copia tu dominio fijo (ngrok te asigna uno, con forma `palabras-palabras-palabras.ngrok-free.dev`; no se puede elegir el nombre). Úsalo **sin** `https://` en el comando del túnel y **con** `https://` en las URLs de los pasos siguientes.

La cuenta gratuita incluye un solo dominio, por eso cada servicio que publiques con un dominio distinto necesita una cuenta distinta (la de otra persona o tuya aparte). El authtoken es personal: no lo subas al repositorio.

## 1. Keycloak

Descarga el ZIP de Keycloak 26 (https://www.keycloak.org/downloads), descomprímelo y entra a `bin`.

**1.1 Datos (realms y usuarios).** La máquina nueva arranca vacía. Elige una:

- **Copiar la carpeta de datos** (lo más fácil, misma versión de Keycloak en ambas): en la máquina vieja, con Keycloak apagado, copia `keycloak-XX\data` y pégala en el mismo lugar de la nueva.
- **Exportar e importar**, con Keycloak apagado en cada máquina:
  ```powershell
  .\kc.bat export --dir C:\export --users realm_file     # máquina vieja
  .\kc.bat import --dir C:\export                         # máquina nueva (copia antes la carpeta)
  ```
- **Crear todo a mano**, en cada uno de los realms `tenantA` y `tenantB`: los roles `erp_admin`, `erp_inventario` y `erp_ventas`; el cliente `Beta0` con *Client authentication* y *Direct access grants* activados (copia su secret de *Credentials*); y un usuario con contraseña no temporal, rol `erp_admin`, y email, nombre y apellido rellenos (si no, Keycloak rechaza el login con "Account is not fully set up"). Después haz el paso 1.3.

**1.2 Arrancar Keycloak** (terminal **KEYCLOAK**; solo la primera vez crea el usuario `admin`). Al ser el dominio fijo, se arranca ya con su dirección pública:

```powershell
$env:KC_BOOTSTRAP_ADMIN_USERNAME = "admin"
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = "admin"
.\kc.bat start-dev --hostname=https://dense-overbuilt-unnoticed.ngrok-free.dev --http-enabled=true --proxy-headers=xforwarded
```

Cuando diga `Listening on: http://0.0.0.0:8080`, entra a http://localhost:8080 y comprueba que existen los realms `tenantA` y `tenantB`. Keycloak debe conocer su dirección pública, o los tokens salen con un emisor (`iss`) incorrecto y el backend los rechaza.

**1.3 Cuenta de servicio para la pantalla Usuarios** (una vez por realm; si importaste o copiaste los datos de la otra máquina, ya viene hecho). La pantalla *Usuarios* crea, edita y borra usuarios reales de Keycloak, y para eso el cliente `Beta0` necesita permisos. En `tenantA` y en `tenantB`:

1. Cambia de realm (desplegable arriba a la izquierda) y entra a *Clients → Beta0 → Settings*.
2. En *Capability config* activa **Service accounts roles** y pulsa **Save**.
3. Aparece la pestaña **Service accounts roles**: pulsa *Assign role*, cambia el filtro a **Filter by clients** y marca de `realm-management`: `manage-users`, `view-users`, `query-users` y `view-realm`. Pulsa *Assign*.

No hay secrets nuevos: se usa el mismo de `Beta0`. Los usuarios que se crean desde la pantalla pueden iniciar sesión, con la contraseña que se escriba al crearlos (no temporal).

## 2. Abrir el túnel de Keycloak

En una terminal nueva, la terminal **TÚNEL KEYCLOAK** (con Keycloak ya arrancado):

```powershell
ngrok http --url=https://dense-overbuilt-unnoticed.ngrok-free.dev 8080
```

(En versiones antiguas de ngrok el parámetro se llama `--domain=dense-overbuilt-unnoticed.ngrok-free.dev`.) Deja la terminal abierta. Comprueba desde la terminal **BACK**:

```powershell
curl.exe https://dense-overbuilt-unnoticed.ngrok-free.dev/realms/tenantA/.well-known/openid-configuration
```

Debe devolver JSON. Si no, el túnel o Keycloak no están bien.

Al abrir la consola de Keycloak **en el navegador** por primera vez, ngrok muestra una página de aviso: pulsa *Visit Site*. Esa página no afecta al backend ni a las llamadas de Lambda.

## 3. (Ya hecho en 1.2) Keycloak con su dirección pública

Con un dominio fijo, el `--hostname` se pone una sola vez en el paso 1.2. Solo hay que repetirlo si algún día cambia el dominio.

## 4. Dar la URL y los secrets al backend

La URL de Keycloak y los secrets **son de cada máquina** (otro dominio de ngrok, otros realms, otros secrets), así que no están en el código. Se guardan en un archivo `back/.env` de esa máquina, que está en `.gitignore` y **no se sube a git**. Serverless lo carga solo, tanto en `serverless deploy` como en `serverless wsgi serve`: no hay que escribir variables en ninguna terminal.

**4.1 Obtener los secrets.** Los tiene el dueño de Keycloak: consola de Keycloak (`https://dense-overbuilt-unnoticed.ngrok-free.dev`, con su usuario administrador) → elige el realm → *Clients* → `Beta0` → *Credentials* → *Client secret*, en `tenantA` y en `tenantB`. Si no eres el dueño, pídeselos (son datos de acceso: pásenlos por un canal privado, no por el repositorio).

**4.2 Crear `back/.env`** copiando la plantilla [back/env.ejemplo](back/env.ejemplo) y rellenando tus valores (en la terminal **BACK**):

```powershell
cd back
Copy-Item env.ejemplo .env
notepad .env
```

```
KEYCLOAK_URL=https://dense-overbuilt-unnoticed.ngrok-free.dev
KEYCLOAK_CLIENT_SECRET_A=<secret de tenantA>
KEYCLOAK_CLIENT_SECRET_B=<secret de tenantB>
```

Sin comillas, sin espacios alrededor del `=` y sin barra al final de la URL. Se hace **una sola vez por máquina**. Si el archivo falta o le falta una variable, `serverless deploy` se detiene con un error que nombra lo que falta (no despliega una Lambda a medias).

Cada vez que cambies algo de este archivo (otro dominio, otro secret), vuelve a ejecutar `npx serverless deploy`: la Lambda guarda los valores del momento del deploy.

*Alternativa sin archivo:* variables de entorno en la terminal **BACK** (`$env:KEYCLOAK_URL = "..."`, etc.). Valen solo para esa terminal y tienen prioridad sobre el `.env`.

## 5. Elegir dónde corre el backend

**5.1 Backend local (lo más rápido para probar).** En la misma terminal **BACK** del paso 4. Este comando deja la terminal ocupada; para las pruebas del paso 6 abre otra terminal, o usa 5.2:

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

Luego, en la terminal **BACK**, con `back/.env` ya creado (paso 4):

```powershell
cd back
npm install
npx serverless deploy
```

Al terminar muestra los endpoints. Si despliegas en la **misma cuenta AWS y la misma organización** que antes, se actualiza la misma API y el URL base no cambia (`https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev`). Si cambia, copia el nuevo valor a `BASE` en [environment.ts](front/src/environments/environment.ts) y en [environment.aws.ts](front/src/environments/environment.aws.ts).

## 6. Probar

En la terminal **BACK** (con Lambda no queda ocupada tras el deploy):

```powershell
$API = "https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev"     # o http://127.0.0.1:5000

$login = Invoke-RestMethod -Method Post -Uri "$API/tenantA/login" -ContentType "application/json" -Body '{"username":"estebanquito","password":"1234"}'
$login.roles

Invoke-RestMethod -Uri "$API/tenantA/productos" -Headers @{ Authorization = "Bearer $($login.access_token)" } | Select-Object nombre, precio_venta, stock_actual | Format-Table
```

Debe salir el rol `erp_admin` y la tabla de productos. El token dura 5 minutos. Para tenant B, usa `/tenantB/...` y un usuario del realm `tenantB`.

## 7. Front

En la terminal **FRONT**, que es una terminal aparte (no la reutilices para nada más):

```powershell
cd front
npm install
npm start                      # http://localhost:4200
```

Abre http://localhost:4200 e inicia sesión. El front usa la API que indique `BASE` en [environment.ts](front/src/environments/environment.ts).

**Front en Vercel.** Se despliega solo desde GitHub: *Root Directory* `front`, y el [vercel.json](front/vercel.json) ya trae el build (`ng build --configuration aws`). Si cambias `BASE`, haz commit y push; Vercel vuelve a desplegar. Para el login desde la web de Vercel, el túnel y Keycloak deben estar encendidos.

## 8. Kafka (opcional)

Los eventos (logins, ventas, inventario, usuarios) se publican en Kafka. Si Kafka no está, la API funciona igual y los descarta.

**8.1 Levantar Kafka** (en la máquina de Kafka, que puede ser otra persona). Desde la raíz del repo levanta Kafka, Kafka UI y el proxy HTTP `rest-proxy`:

```powershell
docker compose up -d
```

Kafka UI queda en http://localhost:8083 → *Topics*. Los topics se crean solos con el primer evento.

**8.2 Con el backend en AWS (Lambda).** Lambda no puede abrir una conexión Kafka hacia esa PC, pero sí llamar a una URL pública. Por eso publica los eventos por HTTP al `rest-proxy`, expuesto con ngrok **con el dominio de quien corre Kafka** (paso 0.1 con su cuenta):

1. Terminal **TÚNEL KAFKA** (en la máquina de Kafka, déjala abierta):
   ```powershell
   ngrok http --url=https://<dominio-kafka> 8082
   ```
2. Comprueba desde la terminal **BACK** que responde (debe listar los topics en JSON):
   ```powershell
   curl.exe https://<dominio-kafka>/topics
   ```
3. Añade a `back/.env` la línea `KAFKA_REST_URL=https://<dominio-kafka>` y despliega desde la terminal **BACK**:
   ```powershell
   npx serverless deploy
   ```
4. Usa la app (login, crear un producto, una venta) y mira los mensajes en Kafka UI → *Topics*.

Como el dominio es fijo, esto se hace una vez: si apagas y vuelves a abrir el túnel, no hay que redesplegar. La primera publicación después de arrancar el proxy tarda unos 2 segundos; las siguientes, milisegundos. Si el túnel o el proxy se caen, la API sigue funcionando y deja de intentar durante 30 segundos.

El túnel de Kafka es público y el proxy no tiene autenticación: cualquiera que conozca el dominio podría publicar eventos. Para un proyecto de clase es aceptable; en producción habría que protegerlo.

**8.3 Con el backend local** (`serverless wsgi serve`) no hace falta túnel: usa `localhost:9092` por defecto y reintenta solo cada 30 s, sin reiniciar nada.

**8.4 Kafka en otra PC de la misma red** (sin Lambda): en esa PC, `cd deploy\kafka`, `"KAFKA_PUBLIC_HOST=<ip-de-esa-pc>" | Out-File -Encoding ascii .env` y `docker compose up -d`. En la terminal del backend local: `$env:KAFKA_BOOTSTRAP_SERVERS = "<ip-de-esa-pc>:9092"`.

## 9. Cuando algo se apague

Con dominios fijos casi nunca hay que redesplegar. Solo vuelve a abrir lo que se cerró:

| Se apagó | Qué haces | ¿Redesplegar? |
|---|---|---|
| El túnel de Keycloak (o ngrok) | Repites el paso 2 | No |
| Keycloak | Repites el paso 1.2 | No |
| El túnel de Kafka | Repites el paso 8.2.1 | No |
| Docker o Kafka | `docker compose up -d` | No (la API se recupera sola en ~30 s) |
| Cambió un dominio, un secret o algo de `back/.env` | Editas `back/.env` y `npx serverless deploy` | Sí |

Cierra cada túnel con `Ctrl+C` en su terminal. No uses `taskkill /IM ngrok.exe` (ni `cloudflared.exe`): cierra todos los túneles de la máquina a la vez.

### Si Keycloak debe correr en otra máquina

El dominio de ngrok pertenece a la cuenta de su dueño, y un dominio solo puede estar en línea desde **un** `ngrok` a la vez. Si Keycloak tiene que correr en otra PC:

1. **Datos:** copia los realms y usuarios a esa máquina (paso 1.1) y arranca Keycloak con el mismo `--hostname=https://dense-overbuilt-unnoticed.ngrok-free.dev` (paso 1).
2. **Túnel:** el `ngrok` debe estar en esa misma máquina y autenticado con una cuenta que pueda usar ese dominio. En el panel de ngrok el dueño puede crear un *authtoken* aparte para esa persona y revocarlo después, en vez de compartir el principal. Antes de abrirlo en la nueva máquina, el dueño cierra el suyo con `Ctrl+C`.
3. **Nada más cambia:** como el dominio es el mismo, no hay que redesplegar ni tocar los `back/.env` de los demás. Los *client secrets* siguen siendo los mismos si se copiaron los datos tal cual.

La alternativa que quita la dependencia de una PC encendida es correr Keycloak en un servidor (por ejemplo una EC2) con el mismo ngrok o con un dominio propio.

*Alternativa sin cuenta:* `cloudflared tunnel --url http://localhost:8080` también sirve, pero su URL cambia en cada arranque y entonces sí hay que repetir los pasos 1.2, 4 y el deploy cada vez.

## 10. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| Login 502 o "No se pudo contactar Keycloak" | El túnel o Keycloak están cerrados | Pasos 1.2 y 2 |
| Login `{"mensaje":"Keycloak no disponible"}` aunque el túnel responde 200 | La Lambda se desplegó con otra URL (el `.env` tenía el dominio viejo, o se editó y no se redesplegó) | Revisa `KEYCLOAK_URL` en `back/.env` y ejecuta `npx serverless deploy` |
| `serverless deploy` dice `Cannot resolve '${env:KEYCLOAK_URL}'` (o un secret) | Falta `back/.env` o le falta esa variable | Paso 4.2 |
| Login con `Falta KEYCLOAK_CLIENT_SECRET_A en el backend` | La Lambda se desplegó con el secret vacío | Rellena `back/.env` y vuelve a desplegar |
| La pantalla Usuarios da `Keycloak rechazo la cuenta de servicio de Beta0` o `Beta0 no tiene permisos para administrar usuarios` | Falta el paso 1.3 en ese realm | Activa *Service accounts roles* y asigna los 4 roles de `realm-management` |
| Login `Token requerido` justo después | Es consecuencia de que el login anterior falló, no un error aparte | Arregla el login primero |
| Login 401 "Usuario o contraseña incorrectos" | Usuario, clave o secret incorrectos | Revisa el usuario en el realm correcto y el *Client secret* en *Credentials* |
| `Token invalido o expirado` en `/productos` | Token vencido (5 min), o Keycloak arrancó sin `--hostname` | Repite el login; revisa el paso 1.2 |
| `Realm does not exist` | La máquina nueva no tiene los realms | Paso 1.1 |
| `Missing Authentication Token` al abrir un link en el navegador | Ruta inexistente o método no permitido (por ejemplo abrir `/login`, que es POST) | Es normal en esas rutas; usa los comandos del paso 6 |
| `serverless deploy` pide login o no encuentra credenciales | Falta `serverless login` o `aws configure` | Paso 5.2 |
| El front muestra datos viejos o vacíos | `BASE` apunta a otra API, o el backend se reinició | Revisa `BASE`; los datos están en memoria y se regeneran |
| ngrok dice que el endpoint o el dominio ya está en línea | Hay otro `ngrok` abierto con ese mismo dominio | Ciérralo con `Ctrl+C` en su terminal y vuelve a abrirlo |
| ngrok dice que falta el authtoken o que la cuenta no es válida | No hiciste el paso 0.1 en esa máquina | `ngrok config add-authtoken <tu-authtoken>` |
| En el navegador, la consola de Keycloak muestra una página de ngrok | Es el aviso de ngrok para navegadores | Pulsa *Visit Site*; no afecta al backend |

Los secrets de este archivo y del código son de un proyecto de clase. En un proyecto real irían en variables de entorno o en un gestor de secretos.
