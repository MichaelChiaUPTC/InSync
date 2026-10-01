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
