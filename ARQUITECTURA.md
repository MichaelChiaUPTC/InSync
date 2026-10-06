# Arquitectura de InSync

InSync es un ERP multi-tenant pequeño (inventario, ventas, usuarios y estadísticas) para dos negocios de ejemplo: **tenant A** (Supermercado El Ahorro) y **tenant B** (Pastelería Dulce Aroma). Está repartido en piezas independientes que corren en máquinas distintas y se comunican solo por red.

> Los diagramas usan [Mermaid](https://mermaid.js.org/). GitHub los dibuja directamente. En VS Code hace falta la extensión *Markdown Preview Mermaid Support*.

## 1. Vista general

```mermaid
flowchart LR
    subgraph USR["Cada persona (su PC)"]
        NAV["Navegador"]
        FRONT["Front Angular<br/>npm start :4200 o Vercel"]
    end

    subgraph AWS["Nube AWS"]
        APIGW["API Gateway<br/>/dev/tenantA/... y /dev/tenantB/..."]
        LAMBDA["Lambda · Flask<br/>serverless-wsgi"]
    end

    subgraph PCKC["PC del dueño de Keycloak"]
        NGK1["ngrok<br/>dominio fijo"]
        KC["Keycloak :8080<br/>realms tenantA y tenantB"]
    end

    subgraph PCKF["PC del dueño de Kafka (Docker)"]
        NGK2["ngrok<br/>dominio fijo"]
        REST["Kafka REST Proxy :8082"]
        KAFKA["Kafka :9092"]
        ZK["Zookeeper :2181"]
        UI["Kafka UI :8083"]
    end

    NAV --> FRONT
    FRONT -->|"HTTPS + token Bearer"| APIGW
    APIGW --> LAMBDA
    LAMBDA -->|"HTTPS: login, userinfo, API admin"| NGK1
    NGK1 --> KC
    LAMBDA -->|"HTTPS: POST /topics/..."| NGK2
    NGK2 --> REST
    REST --> KAFKA
    ZK --- KAFKA
    KAFKA --> UI
```

**Por qué ngrok:** la Lambda vive en AWS y no puede abrir conexiones hacia `localhost` de una PC. ngrok publica Keycloak y el proxy HTTP de Kafka con un dominio fijo por servicio (cada cuenta gratuita incluye uno, por eso cada servicio usa la cuenta de una persona distinta).

## 2. Inicio de sesión

El Front no sabe a qué negocio pertenece el usuario: prueba el login contra la API de cada negocio, en orden, y el primero que lo reconoce define su negocio, su tema y la API que usará después.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant F as Front (Angular)
    participant L as Lambda (Flask)
    participant K as Keycloak (ngrok)

    U->>F: usuario y contraseña
    loop por cada negocio, hasta que uno lo reconozca
        F->>L: POST /tenantX/login
        L->>K: token del realm tenantX (password grant, cliente Beta0)
        alt credenciales válidas en ese realm
            K-->>L: access_token y refresh_token
            L-->>F: token, roles y tenant_id
        else el usuario no existe en ese realm
            K-->>L: 401
            L-->>F: 401 (el Front prueba el siguiente negocio)
        end
    end
    F->>F: guarda la sesión y aplica el tema del negocio
```

## 3. Petición protegida y evento a Kafka

Ejemplo: registrar una venta. El Front agrega el token a cada petición con un interceptor; si la API responde 401, cierra la sesión.

```mermaid
sequenceDiagram
    autonumber
    participant F as Front
    participant L as Lambda (Flask)
    participant K as Keycloak
    participant N as ngrok (Kafka)
    participant R as REST Proxy
    participant KF as Kafka

    F->>L: POST /tenantA/ventas + Bearer token
    L->>K: userinfo del realm que emitió el token
    K-->>L: usuario válido
    L->>L: comprueba que el token es de ese negocio y que tiene rol erp_ventas o erp_admin
    L->>L: guarda la venta (memoria)
    L->>N: POST /topics/ventas.eventos
    N->>R: reenvía la petición
    R->>KF: escribe el evento
    KF-->>R: ok
    R-->>L: 200
    L-->>F: 201 venta creada
    Note over L,N: Si el proxy no responde, el evento se descarta y la venta se registra igual.<br/>La Lambda deja de intentarlo durante 30 segundos.
```

## 4. Gestión de usuarios reales

La pantalla Usuarios lee y escribe los usuarios del realm de cada negocio en Keycloak. Para eso el backend usa la **cuenta de servicio** del cliente `Beta0` (no el usuario `admin` de Keycloak).

```mermaid
sequenceDiagram
    autonumber
    participant F as Front
    participant L as Lambda (Flask)
    participant K as Keycloak

    F->>L: POST /tenantA/usuarios + Bearer token
    L->>K: userinfo (valida el token)
    K-->>L: usuario con rol erp_admin
    L->>K: token de servicio (client_credentials, Beta0)
    K-->>L: token de administración
    L->>K: POST /admin/realms/tenantA/users
    L->>K: asigna roles erp_* al usuario nuevo
    K-->>L: 201
    L-->>F: 201 usuario creado
```

Solo `erp_admin` puede usar estas rutas. Un administrador de un negocio nunca ve ni modifica usuarios del otro, porque cada llamada usa el realm del negocio de la ruta.

## 5. Multi-tenant

```mermaid
flowchart LR
    RA["Ruta /tenantA/..."] --> TA["Negocio A<br/>Supermercado El Ahorro"]
    RB["Ruta /tenantB/..."] --> TB["Negocio B<br/>Pastelería Dulce Aroma"]
    TA --> REA["Realm tenantA<br/>en Keycloak"]
    TB --> REB["Realm tenantB<br/>en Keycloak"]
    TA --> DA["Datos con tenant_id = A"]
    TB --> DB["Datos con tenant_id = B"]
```

- Un solo backend atiende ambos negocios; el prefijo de la ruta (`/tenantA` o `/tenantB`) decide cuál.
- Cada negocio tiene su propio realm, con sus usuarios y roles (`erp_admin`, `erp_inventario`, `erp_ventas`).
- Un token emitido por un realm solo sirve para las rutas de su negocio; en otro caso la API responde 403.

## 6. Estructura del Front

```mermaid
flowchart TD
    APP["AppComponent"] --> RUTAS["Rutas con guard por rol"]
    RUTAS --> LOGIN["Login"]
    RUTAS --> SHELL["Shell<br/>menú lateral y tema por negocio"]
    SHELL --> INV["Inventario<br/>erp_admin, erp_ventas, erp_inventario"]
    SHELL --> VEN["Ventas<br/>erp_admin, erp_ventas"]
    SHELL --> EST["Estadísticas<br/>erp_admin, erp_ventas"]
    SHELL --> USU["Usuarios<br/>erp_admin"]

    subgraph CORE["Núcleo compartido"]
        STORE["Store<br/>sesión y datos en señales"]
        AUTH["Auth<br/>login por negocio"]
        INT["Interceptor<br/>agrega el token Bearer"]
    end

    LOGIN --> AUTH
    AUTH -->|"guarda la sesión"| STORE
    INV --> INT
    VEN --> INT
    EST --> INT
    USU --> INT
    INT --> API["API de AWS"]
```

Cada sección (inventario, ventas, estadísticas, usuarios) es un módulo que se carga solo cuando se entra a ella. Las estadísticas se calculan **en el navegador** a partir de `GET /ventas`; no leen de Kafka.

## 7. Componentes y puertos

| Componente | Tecnología | Dónde corre | Puerto | Cómo se alcanza |
|---|---|---|---|---|
| Front | Angular | PC de cada persona, o Vercel | 4200 | `http://localhost:4200` |
| Backend (API) | Flask en AWS Lambda con Serverless Framework | AWS (API Gateway + Lambda) | HTTPS | `https://<id>.execute-api.us-east-1.amazonaws.com/dev` |
| Keycloak | Keycloak 26 (ZIP) | PC del dueño de Keycloak | 8080 | dominio fijo de ngrok |
| Kafka REST Proxy | `confluentinc/cp-kafka-rest` | PC del dueño de Kafka (Docker) | 8082 | dominio fijo de ngrok |
| Kafka | `confluentinc/cp-kafka` | PC del dueño de Kafka (Docker) | 9092 | solo local |
| Zookeeper | `confluentinc/cp-zookeeper` | PC del dueño de Kafka (Docker) | 2181 | solo local |
| Kafka UI | `provectuslabs/kafka-ui` | PC del dueño de Kafka (Docker) | 8083 | `http://localhost:8083` |

## 8. Topics de Kafka

| Topic | Eventos (`tipo`) |
|---|---|
| `usuarios.autenticacion` | `login_exitoso`, `login_fallido` |
| `seguridad.accesos` | `acceso_sin_token`, `token_invalido`, `token_de_otro_negocio`, `acceso_denegado` |
| `usuarios.gestion` | `usuario_creado`, `usuario_actualizado`, `usuario_eliminado` |
| `inventario.eventos` | `producto_creado`, `producto_actualizado`, `producto_eliminado`, `stock_bajo` |
| `ventas.eventos` | `venta_registrada`, `venta_anulada` |

Cada evento lleva `tenant_id` y `timestamp`. Nunca se publican contraseñas ni tokens. Los topics se crean solos con el primer evento.

## 9. Configuración por máquina

La URL de Keycloak y los secrets son propios de cada máquina y **no van en el código**. Viven en `back/.env`, que no se sube a git (plantilla: `back/env.ejemplo`).

```mermaid
flowchart LR
    ENV["back/.env<br/>no se sube a git"] -->|"serverless deploy"| LAMBDA["Variables de entorno de la Lambda"]
    LAMBDA --> KCURL["KEYCLOAK_URL"]
    LAMBDA --> SEC["KEYCLOAK_CLIENT_SECRET_A y _B"]
    LAMBDA --> KREST["KAFKA_REST_URL"]
    KREST -.->|"vacío: Kafka desactivado,<br/>la API sigue funcionando"| NADA["los eventos se descartan"]
```

Cuando se cambia algo del `.env`, hay que volver a ejecutar `npx serverless deploy`: la Lambda guarda los valores del momento del despliegue.

## 10. Notas de diseño

- **Datos en memoria:** productos y ventas viven en la memoria del backend y se regeneran con datos de prueba cuando AWS recicla el contenedor. Los usuarios, en cambio, son reales y viven en Keycloak.
- **Kafka es opcional:** si no hay proxy o no responde, la API funciona igual y los eventos se descartan. Hoy solo se consultan en Kafka UI; ningún servicio los consume.
- **Dependencia de PCs encendidas:** el login funciona solo mientras Keycloak y su túnel estén corriendo en la PC del dueño. Los eventos llegan a Kafka solo mientras el proxy y su túnel estén encendidos.
- **Cómo arrancar todo:** ver [GUIA-OTRA-MAQUINA.md](GUIA-OTRA-MAQUINA.md) (guía técnica) y `GUIA-COMPANEROS-FRONT-Y-KAFKA.pdf` (guía paso a paso para compañeros).
