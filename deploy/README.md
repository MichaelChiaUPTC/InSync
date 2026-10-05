# Despliegue distribuido

```
 Navegador ──> CloudFront + S3 (front Angular)
     │
     └──> API Gateway + Lambda (back Flask) ──> Keycloak  (EC2 #1, HTTPS)
                                           └──> Kafka     (EC2 #2, opcional)
```

| # | Componente | Dónde | Carpeta |
|---|---|---|---|
| 1 | Keycloak + Postgres + Caddy | EC2 (t3.small) | `deploy/keycloak` |
| 2 | Kafka + Kafka UI | EC2 (t3.small) o la misma EC2 #1 | `deploy/kafka` |
| 3 | Backend serverless | Lambda + API Gateway | `back` |
| 4 | Frontend | S3 + CloudFront | `front` |

## 1. Keycloak (EC2 #1)

1. Lanza una EC2 con Ubuntu e instala Docker. Asígnale una IP elástica.
2. Security Group: entrada 80 y 443 desde cualquier IP, 22 solo desde tu IP.
3. Copia `deploy/keycloak` a la máquina:
   ```bash
   echo "KC_DOMAIN=keycloak.<ip-con-guiones>.sslip.io" > .env    # lo único obligatorio (o tu dominio)
   docker compose up -d     # usuario y contraseña de Keycloak: admin / admin
   ```
4. Entra a `https://<KC_DOMAIN>`, crea los realms `tenantA` y `tenantB`, el cliente `Beta0` (confidential), los roles `erp_*` y los usuarios. Copia el *client secret* de cada realm.
   (Los realms no se migran solos: puedes exportarlos desde el Keycloak local con *Realm settings → Action → Partial export* e importarlos en el nuevo.)
5. En el cliente `Beta0` de cada realm, pon *Web origins* = el dominio del front.

## 2. Kafka (EC2 #2)

1. Security Group: 9092 solo desde las IPs que lo usen, 8083 (Kafka UI) solo desde tu IP.
2. En la máquina, desde `deploy/kafka`:
   ```bash
   cp .env.example .env     # KAFKA_PUBLIC_HOST = IP elástica de esta EC2
   docker compose up -d
   ```
3. Kafka UI: `http://<ip>:8083`.

> Lambda no tiene IP fija, y el broker usa PLAINTEXT sin autenticación. Abrir 9092 al mundo no es seguro, así que lo recomendable es dejar `KAFKA_BOOTSTRAP_SERVERS` vacío (Kafka desactivado) o poner Lambda y Kafka en la misma VPC y usar la IP privada.

## 3. Backend (Lambda)

```powershell
cd back
$env:KEYCLOAK_URL = "https://<KC_DOMAIN>"
$env:KEYCLOAK_CLIENT_SECRET_A = "<secret realm tenantA>"
$env:KEYCLOAK_CLIENT_SECRET_B = "<secret realm tenantB>"
$env:KAFKA_BOOTSTRAP_SERVERS = ""          # o "<ip-privada>:9092"
npx serverless deploy
```

Copia el endpoint resultante (`https://xxxx.execute-api.us-east-1.amazonaws.com/dev`) a `BASE` en `front/src/environments/environment.aws.ts`.

## 4. Frontend (S3 + CloudFront)

```powershell
cd front
npx ng build --configuration aws
aws s3 sync dist/<proyecto>/browser s3://<bucket> --delete
```

Crea el bucket privado y una distribución CloudFront con *Origin Access Control*. Configura el error 403/404 → `/index.html` (200) para que funcione el router de Angular.
Si usas el dominio de CloudFront o propio, ponlo en los *Web origins* de Keycloak (paso 1.5).

## Verificación

1. `curl https://<KC_DOMAIN>/realms/tenantA/.well-known/openid-configuration` responde JSON.
2. `curl -X POST <API>/tenantA/login -H "Content-Type: application/json" -d '{"username":"..","password":".."}'` devuelve `access_token`.
3. Abre el front, haz login y comprueba que listas productos.
4. (Con Kafka) los topics aparecen en Kafka UI.
