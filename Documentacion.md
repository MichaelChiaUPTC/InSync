# ERP SaaS — Documentación Técnica

**Stack:** Flask · AWS Lambda · API Gateway · Serverless Framework · Keycloak · Angular (ProyectoFront)

## 1. Descripción

API REST multi-tenant para un ERP (autenticación, usuarios, productos y ventas). Productos, ventas y usuarios viven en **listas en memoria** dentro de la Lambda (no persisten entre reinicios) y se llenan con datos de prueba por tenant (`semillas.py`). Solo el **login** y la validación del token usan **Keycloak**; los usuarios de la lista son de prueba y no inician sesión.

## 2. Arquitectura

```
Angular (ProyectoFront) ── HTTPS ──> API Gateway ──> Lambda (Python 3.12)
                                                        │ serverless-wsgi
                                                        ▼
                                                   Flask (app.py)
                                          ┌─────────────┴─────────────┐
                                   listas en memoria            Keycloak (login,
                                (productos, ventas, usuarios)   token)
```

**Tenants:** un tenant = un stage de Serverless. `--stage tenantA` / `--stage tenantB` define `TENANT_ID` (A / B). No existe CRUD de tenants; productos, ventas y usuarios se filtran por `TENANT_ID`.

## 3. Estructura

```
back/
├── app.py                # Flask: rutas y control de roles
├── keycloak_service.py   # Login y validación de token con Keycloak
├── semillas.py           # Datos de prueba por tenant
├── Producto.py           # Modelo Producto
├── Usuario.py            # Modelo Usuario
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
| GET | `/usuarios` | admin | Lista los usuarios del tenant |
| POST | `/usuarios` | admin | Body `{username, nombre, email?, roles[], activo?}` |
| PUT | `/usuarios/{id}` | admin | Actualiza `nombre, email, roles, activo, username` |
| DELETE | `/usuarios/{id}` | admin | Elimina el usuario (no el propio) |
| GET | `/productos` | inventario, ventas | Lista productos del tenant |
| POST | `/productos` | inventario | Body `{sku, nombre, precio_venta, costo_compra?, stock_actual?, stock_minimo?}` |
| PUT | `/productos/{id}` | inventario | Actualiza los campos enviados (precio, stock, etc.) |
| DELETE | `/productos/{id}` | inventario | Elimina el producto |
| GET | `/ventas` | ventas | Lista ventas del tenant |
| POST | `/ventas` | ventas | Body `{lineas:[{producto_id, cantidad}], metodo_pago?}` |
| PUT | `/ventas/{id}` | ventas | Corrige solo `metodo_pago` (`efectivo`, `tarjeta`, `transferencia`) |
| DELETE | `/ventas/{id}` | admin | Anula la venta y devuelve el stock |

Errores: `400` datos inválidos, `401` sin token o vencido, `403` sin rol, `404` no existe, `409` conflicto (código o usuario repetido, stock insuficiente).

`POST /ventas` toma el precio del producto, calcula subtotales y total, valida stock, lo descuenta y guarda el usuario del token. Cada venta devuelve `lineas` con `producto_id, nombre, cantidad, precio_unitario, subtotal`.

## 6. Variables de entorno

| Variable | Default |
|---|---|
| `KEYCLOAK_URL` | (obligatoria) |
| `KEYCLOAK_REALM` | `InSync` |
| `KEYCLOAK_CLIENT_ID` | `Beta0` |
| `KEYCLOAK_CLIENT_SECRET` | (obligatoria) |
| `TENANT_ID` | lo fija el stage |

El client de Keycloak debe tener *Direct access grants* activado. Los roles `erp_admin`, `erp_inventario` y `erp_ventas` deben existir como realm roles.

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
