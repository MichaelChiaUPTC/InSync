# ERP SaaS — Documentación Técnica

**Stack:** Flask · AWS Lambda · API Gateway · Serverless Framework · Keycloak · Angular (ProyectoFront)

## 1. Descripción

API REST multi-tenant para un ERP (autenticación, usuarios, productos y ventas). Productos y ventas viven en **listas en memoria** dentro de la Lambda (no persisten entre reinicios). Los usuarios y la autenticación los maneja **Keycloak**.

## 2. Arquitectura

```
Angular (ProyectoFront) ── HTTPS ──> API Gateway ──> Lambda (Python 3.12)
                                                        │ serverless-wsgi
                                                        ▼
                                                   Flask (app.py)
                                          ┌─────────────┴─────────────┐
                                   listas en memoria            Keycloak (login,
                                (productos, ventas)            token, admin API)
```

**Tenants:** un tenant = un stage de Serverless. `--stage tenantA` / `--stage tenantB` define `TENANT_ID` (A / B). No existe CRUD de tenants; productos y ventas se filtran por `TENANT_ID`, y los usuarios de Keycloak se etiquetan con el atributo `tenant_id`.

## 3. Estructura

```
back/
├── app.py                # Flask: rutas y control de roles
├── keycloak_service.py   # Login, validación de token y admin API de Keycloak
├── Producto.py           # Modelo Producto
├── Venta.py              # Modelo Venta (detalle en "lineas")
├── requirements.txt      # Flask, Flask-Cors, Werkzeug, requests
├── serverless.yaml       # Despliegue
└── package.json          # serverless-wsgi, serverless-python-requirements
```

## 4. Roles (Keycloak)

| Rol | Acceso |
|---|---|
| `erp_admin` | Todo (incluye usuarios) |
| `erp_inventario` | Productos (leer, crear, actualizar, eliminar) |
| `erp_ventas` | Ventas (leer, registrar) y lectura de productos |

Todas las rutas excepto `/login` requieren `Authorization: Bearer <access_token>`. El token se valida contra el endpoint `userinfo` de Keycloak; `401` si falta/expiró, `403` si no tiene rol.

## 5. Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/login` | — | Body `{username, password}`. Devuelve token, roles y tenant |
| GET | `/usuarios` | admin | Usuarios del tenant en Keycloak |
| POST | `/usuarios` | admin | Body `{username, password, email?, nombre?, apellido?, rol?}` |
| DELETE | `/usuarios/{id}` | admin | Elimina el usuario |
| GET | `/productos` | inventario, ventas | Lista productos del tenant |
| POST | `/productos` | inventario | Body `{sku, nombre, precio_venta, costo_compra?, stock_actual?, stock_minimo?}` |
| PUT | `/productos/{id}` | inventario | Actualiza campos enviados (precio, stock, etc.) |
| DELETE | `/productos/{id}` | inventario | Elimina el producto |
| GET | `/ventas` | ventas | Lista ventas del tenant |
| POST | `/ventas` | ventas | Body `{lineas:[{producto_id, cantidad}], metodo_pago?}` |

`POST /ventas` toma el precio del producto, calcula subtotales y total, valida stock, lo descuenta y guarda el usuario del token. Cada venta devuelve `lineas` con `producto_id, nombre, cantidad, precio_unitario, subtotal`.

## 6. Variables de entorno

| Variable | Default |
|---|---|
| `KEYCLOAK_URL` | (obligatoria) |
| `KEYCLOAK_REALM` | `InSync` |
| `KEYCLOAK_CLIENT_ID` | `Beta0` |
| `KEYCLOAK_CLIENT_SECRET` | (obligatoria) |
| `TENANT_ID` | lo fija el stage |

El client de Keycloak debe tener *Direct access grants* y *Service accounts* activados; la cuenta de servicio necesita los roles `manage-users` y `view-users` de `realm-management`. Los roles `erp_admin`, `erp_inventario` y `erp_ventas` deben existir como realm roles.

## 7. Despliegue

```powershell
$env:KEYCLOAK_URL = "https://<keycloak>"
$env:KEYCLOAK_CLIENT_SECRET = "<secret>"
npm install
npx serverless deploy --stage tenantA
npx serverless deploy --stage tenantB
```

Requisitos: Node 18+, Python 3.12, credenciales AWS, Docker si se usa `dockerizePip`, y Modo Desarrollador de Windows para los symlinks de `serverless-wsgi`.

## 8. Limitaciones

1. Productos y ventas no persisten (memoria de la Lambda; cada instancia tiene su copia).
2. El token se valida con una llamada a Keycloak por petición.
3. No hay eventos Kafka.
