import base64
import json
import os

import requests

KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "").rstrip("/")
REALM = os.environ.get("KEYCLOAK_REALM", "InSync")
CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "Beta0")
CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET", "")
TENANT_ID = os.environ.get("TENANT_ID", "A")

ROLES_ERP = ["erp_admin", "erp_inventario", "erp_ventas"]
TIMEOUT = 10

_realm_url = f"{KEYCLOAK_URL}/realms/{REALM}"
_admin_url = f"{KEYCLOAK_URL}/admin/realms/{REALM}"


class KeycloakError(Exception):
    def __init__(self, mensaje, status=502):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status


def _roles_de_token(token):
    """Extrae los roles ERP del payload del access token."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    datos = json.loads(base64.urlsafe_b64decode(payload))
    roles = datos.get("realm_access", {}).get("roles", [])
    roles += datos.get("resource_access", {}).get(CLIENT_ID, {}).get("roles", [])
    return [r for r in set(roles) if r in ROLES_ERP]


def login(username, password):
    r = requests.post(
        f"{_realm_url}/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "scope": "openid",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "username": username,
            "password": password,
        },
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise KeycloakError("Credenciales invalidas", 401)
    datos = r.json()
    return {
        "access_token": datos["access_token"],
        "refresh_token": datos.get("refresh_token"),
        "expires_in": datos.get("expires_in"),
        "username": username,
        "roles": _roles_de_token(datos["access_token"]),
        "tenant_id": TENANT_ID,
    }


def validar_token(token):
    """Valida el token contra Keycloak (userinfo). Devuelve usuario y roles."""
    r = requests.get(
        f"{_realm_url}/protocol/openid-connect/userinfo",
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise KeycloakError("Token invalido o expirado", 401)
    info = r.json()
    return {
        "username": info.get("preferred_username"),
        "email": info.get("email"),
        "roles": _roles_de_token(token),
    }


# ---------- Admin API (service account del client) ----------

def _admin_headers():
    r = requests.post(
        f"{_realm_url}/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise KeycloakError("No se pudo autenticar el servicio ante Keycloak")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _usuario_json(u, roles):
    return {
        "id": u["id"],
        "username": u.get("username"),
        "email": u.get("email"),
        "nombre": u.get("firstName"),
        "apellido": u.get("lastName"),
        "activo": u.get("enabled", True),
        "roles": roles,
    }


def _roles_usuario(headers, user_id):
    r = requests.get(
        f"{_admin_url}/users/{user_id}/role-mappings/realm",
        headers=headers,
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        return []
    return [x["name"] for x in r.json() if x["name"] in ROLES_ERP]


def listar_usuarios():
    headers = _admin_headers()
    r = requests.get(
        f"{_admin_url}/users",
        headers=headers,
        params={"q": f"tenant_id:{TENANT_ID}", "max": 200},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise KeycloakError("No se pudieron listar los usuarios")
    return [_usuario_json(u, _roles_usuario(headers, u["id"])) for u in r.json()]


def crear_usuario(datos):
    headers = _admin_headers()
    rol = datos.get("rol", "erp_ventas")
    if rol not in ROLES_ERP:
        raise KeycloakError(f"Rol invalido. Use: {', '.join(ROLES_ERP)}", 400)

    r = requests.post(
        f"{_admin_url}/users",
        headers=headers,
        json={
            "username": datos["username"],
            "email": datos.get("email"),
            "firstName": datos.get("nombre"),
            "lastName": datos.get("apellido"),
            "enabled": True,
            "attributes": {"tenant_id": [TENANT_ID]},
            "credentials": [
                {"type": "password", "value": datos["password"], "temporary": False}
            ],
        },
        timeout=TIMEOUT,
    )
    if r.status_code == 409:
        raise KeycloakError("El usuario ya existe", 409)
    if r.status_code != 201:
        raise KeycloakError("No se pudo crear el usuario")

    user_id = r.headers["Location"].rstrip("/").split("/")[-1]

    rol_rep = requests.get(
        f"{_admin_url}/roles/{rol}", headers=headers, timeout=TIMEOUT
    )
    if rol_rep.status_code != 200:
        raise KeycloakError(f"El rol {rol} no existe en Keycloak")
    requests.post(
        f"{_admin_url}/users/{user_id}/role-mappings/realm",
        headers=headers,
        json=[rol_rep.json()],
        timeout=TIMEOUT,
    )

    return {
        "id": user_id,
        "username": datos["username"],
        "email": datos.get("email"),
        "nombre": datos.get("nombre"),
        "apellido": datos.get("apellido"),
        "activo": True,
        "roles": [rol],
    }


def eliminar_usuario(user_id):
    headers = _admin_headers()
    r = requests.delete(
        f"{_admin_url}/users/{user_id}", headers=headers, timeout=TIMEOUT
    )
    if r.status_code == 404:
        raise KeycloakError("Usuario no encontrado", 404)
    if r.status_code != 204:
        raise KeycloakError("No se pudo eliminar el usuario")
