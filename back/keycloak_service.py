import base64
import json
import os
import time

import requests

# La URL de Keycloak y los secrets son de cada maquina: llegan por variables de entorno
# (back/.env, que serverless carga solo; plantilla en back/env.ejemplo). No van en el codigo.
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "Beta0")

# Un realm por negocio (tenant). El negocio lo define la ruta (/tenantA, /tenantB).
REALMS = {
    "A": {
        "realm": os.environ.get("KEYCLOAK_REALM_A", "tenantA"),
        "secret": os.environ.get("KEYCLOAK_CLIENT_SECRET_A", ""),
    },
    "B": {
        "realm": os.environ.get("KEYCLOAK_REALM_B", "tenantB"),
        "secret": os.environ.get("KEYCLOAK_CLIENT_SECRET_B", ""),
    },
}

ROLES_ERP = ["erp_admin", "erp_inventario", "erp_ventas"]
TIMEOUT = 10


class KeycloakError(Exception):
    def __init__(self, mensaje, status=502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _secreto(tenant_id):
    secreto = REALMS[tenant_id]["secret"]
    if not secreto:
        raise KeycloakError(f"Falta KEYCLOAK_CLIENT_SECRET_{tenant_id} en el backend (back/.env)", 500)
    return secreto


def _url(tenant_id):
    return f"{KEYCLOAK_URL}/realms/{REALMS[tenant_id]['realm']}/protocol/openid-connect"


def _payload(token):
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


def _roles_de_token(token):
    """Extrae los roles ERP del payload del access token."""
    datos = _payload(token)
    roles = datos.get("realm_access", {}).get("roles", [])
    roles += datos.get("resource_access", {}).get(CLIENT_ID, {}).get("roles", [])
    return [r for r in set(roles) if r in ROLES_ERP]


def _tenant_del_token(token):
    """Deduce el negocio a partir del emisor (iss) del token.
    Solo acepta los realms configurados en REALMS."""
    try:
        emisor = _payload(token).get("iss", "")
    except (IndexError, ValueError):
        raise KeycloakError("Token invalido o expirado", 401)
    for tenant_id, cfg in REALMS.items():
        if emisor.rstrip("/").endswith(f"/realms/{cfg['realm']}"):
            return tenant_id
    raise KeycloakError("Token invalido o expirado", 401)


def login(username, password, tenant_id):
    """Valida las credenciales contra el realm del negocio indicado."""
    cfg = REALMS[tenant_id]
    try:
        r = requests.post(
            f"{_url(tenant_id)}/token",
            data={
                "grant_type": "password",
                "scope": "openid",
                "client_id": CLIENT_ID,
                "client_secret": _secreto(tenant_id),
                "username": username,
                "password": password,
            },
            timeout=TIMEOUT,
        )
    except requests.RequestException:
        raise KeycloakError("Keycloak no disponible", 502)
    if r.status_code != 200:
        raise KeycloakError("Credenciales invalidas", 401)
    datos = r.json()
    return {
        "access_token": datos["access_token"],
        "refresh_token": datos.get("refresh_token"),
        "expires_in": datos.get("expires_in"),
        "username": username,
        "roles": _roles_de_token(datos["access_token"]),
        "tenant_id": tenant_id,
        "realm": cfg["realm"],
    }


def validar_token(token):
    """Valida el token contra el realm que lo emitio (userinfo).
    Devuelve usuario, roles y negocio."""
    tenant_id = _tenant_del_token(token)
    try:
        r = requests.get(
            f"{_url(tenant_id)}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT,
        )
    except requests.RequestException:
        raise KeycloakError("Keycloak no disponible", 502)
    if r.status_code != 200:
        raise KeycloakError("Token invalido o expirado", 401)
    info = r.json()
    return {
        "username": info.get("preferred_username"),
        "email": info.get("email"),
        "roles": _roles_de_token(token),
        "tenant_id": tenant_id,
    }


# ==========================================
# ADMINISTRACION DE USUARIOS (API de administracion de Keycloak)
# Usa la cuenta de servicio del cliente Beta0 de cada realm
# (Service accounts roles + roles de realm-management: manage-users, view-users, query-users, view-realm).
# ==========================================

_tokens_admin = {}  # tenant_id -> (token, expira)


def _token_admin(tenant_id):
    cache = _tokens_admin.get(tenant_id)
    if cache and cache[1] > time.time() + 30:
        return cache[0]
    try:
        r = requests.post(
            f"{_url(tenant_id)}/token",
            data={
                "grant_type": "client_credentials",
                "client_id": CLIENT_ID,
                "client_secret": _secreto(tenant_id),
            },
            timeout=TIMEOUT,
        )
    except requests.RequestException:
        raise KeycloakError("Keycloak no disponible", 502)
    if r.status_code != 200:
        raise KeycloakError("Keycloak rechazo la cuenta de servicio de Beta0 (revisa 'Service accounts roles')", 502)
    datos = r.json()
    _tokens_admin[tenant_id] = (datos["access_token"], time.time() + datos.get("expires_in", 60))
    return datos["access_token"]


def _admin(tenant_id, metodo, ruta, **kwargs):
    base = f"{KEYCLOAK_URL}/admin/realms/{REALMS[tenant_id]['realm']}"
    for intento in (1, 2):
        try:
            r = requests.request(
                metodo, base + ruta,
                headers={"Authorization": f"Bearer {_token_admin(tenant_id)}"},
                timeout=TIMEOUT, **kwargs,
            )
        except requests.RequestException:
            raise KeycloakError("Keycloak no disponible", 502)
        if r.status_code == 401 and intento == 1:
            _tokens_admin.pop(tenant_id, None)  # token vencido: pedir otro y reintentar
            continue
        break
    if r.status_code == 403:
        raise KeycloakError("Beta0 no tiene permisos para administrar usuarios (roles de realm-management)", 502)
    return r


def _detalle(r, defecto):
    try:
        d = r.json()
        return d.get("errorMessage") or d.get("error_description") or d.get("error") or defecto
    except ValueError:
        return defecto


def _exigir(r, mensaje):
    if r.status_code == 404:
        raise KeycloakError("Usuario no encontrado", 404)
    if r.status_code == 409:
        raise KeycloakError("El usuario ya existe", 409)
    if r.status_code >= 400:
        raise KeycloakError(_detalle(r, mensaje), 400 if r.status_code < 500 else 502)


def _partir_nombre(nombre):
    partes = nombre.split()
    return partes[0], " ".join(partes[1:])


def _a_usuario(tenant_id, u, roles):
    nombre = f"{u.get('firstName') or ''} {u.get('lastName') or ''}".strip() or u["username"]
    return {
        "id": u["id"],
        "tenant_id": tenant_id,
        "username": u["username"],
        "nombre": nombre,
        "email": u.get("email") or "",
        "roles": sorted(roles),
        "activo": u.get("enabled", True),
    }


def _roles_de(tenant_id, user_id):
    r = _admin(tenant_id, "GET", f"/users/{user_id}/role-mappings/realm")
    _exigir(r, "No se pudieron leer los roles")
    return [x for x in r.json() if x["name"] in ROLES_ERP]


def _fijar_roles(tenant_id, user_id, roles):
    actuales = _roles_de(tenant_id, user_id)
    nombres = {x["name"] for x in actuales}
    quitar = [x for x in actuales if x["name"] not in roles]
    if quitar:
        _exigir(_admin(tenant_id, "DELETE", f"/users/{user_id}/role-mappings/realm", json=quitar),
                "No se pudieron quitar roles")
    agregar = []
    for nombre in roles:
        if nombre in nombres:
            continue
        r = _admin(tenant_id, "GET", f"/roles/{nombre}")
        if r.status_code == 404:
            raise KeycloakError(f"El rol {nombre} no existe en el realm", 400)
        _exigir(r, "No se pudo leer el rol")
        agregar.append(r.json())
    if agregar:
        _exigir(_admin(tenant_id, "POST", f"/users/{user_id}/role-mappings/realm", json=agregar),
                "No se pudieron asignar roles")


def listar_usuarios(tenant_id):
    r = _admin(tenant_id, "GET", "/users", params={"max": 500})
    _exigir(r, "No se pudieron listar los usuarios")
    usuarios = [u for u in r.json() if not u["username"].startswith("service-account-")]

    # Una consulta por rol (3) en vez de una por usuario
    roles_por_id = {}
    for rol in ROLES_ERP:
        rr = _admin(tenant_id, "GET", f"/roles/{rol}/users", params={"max": 500})
        if rr.status_code == 404:
            continue  # el rol no existe en este realm
        _exigir(rr, "No se pudieron leer los roles")
        for x in rr.json():
            roles_por_id.setdefault(x["id"], []).append(rol)

    return [_a_usuario(tenant_id, u, roles_por_id.get(u["id"], [])) for u in usuarios]


def obtener_usuario(tenant_id, user_id):
    r = _admin(tenant_id, "GET", f"/users/{user_id}")
    _exigir(r, "No se pudo leer el usuario")
    roles = [x["name"] for x in _roles_de(tenant_id, user_id)]
    return _a_usuario(tenant_id, r.json(), roles)


def crear_usuario(tenant_id, username, nombre, email, password, roles):
    nombre_pila, apellido = _partir_nombre(nombre)
    r = _admin(tenant_id, "POST", "/users", json={
        "username": username,
        "email": email,
        "firstName": nombre_pila,
        "lastName": apellido,
        "enabled": True,
        "emailVerified": True,
        # temporary=False: con la contrasena temporal Keycloak rechaza el login por API
        "credentials": [{"type": "password", "value": password, "temporary": False}],
    })
    _exigir(r, "No se pudo crear el usuario")
    user_id = r.headers["Location"].rsplit("/", 1)[1]
    try:
        _fijar_roles(tenant_id, user_id, roles)
    except KeycloakError:
        _admin(tenant_id, "DELETE", f"/users/{user_id}")  # no dejar un usuario a medias
        raise
    return obtener_usuario(tenant_id, user_id)


def actualizar_usuario(tenant_id, user_id, datos):
    r = _admin(tenant_id, "GET", f"/users/{user_id}")
    _exigir(r, "No se pudo leer el usuario")
    u = r.json()
    if "nombre" in datos:
        u["firstName"], u["lastName"] = _partir_nombre(datos["nombre"])
    if "email" in datos:
        u["email"] = datos["email"]
    if "activo" in datos:
        u["enabled"] = bool(datos["activo"])
    _exigir(_admin(tenant_id, "PUT", f"/users/{user_id}", json=u), "No se pudo actualizar el usuario")
    if datos.get("password"):
        _exigir(_admin(tenant_id, "PUT", f"/users/{user_id}/reset-password",
                       json={"type": "password", "value": datos["password"], "temporary": False}),
                "No se pudo cambiar la contrasena")
    if "roles" in datos:
        _fijar_roles(tenant_id, user_id, datos["roles"])
    return obtener_usuario(tenant_id, user_id)


def eliminar_usuario(tenant_id, user_id):
    _exigir(_admin(tenant_id, "DELETE", f"/users/{user_id}"), "No se pudo eliminar el usuario")
