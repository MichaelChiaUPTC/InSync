import base64
import json
import os

import requests

# Keycloak: local (localhost:8080) o en otra maquina. Los secrets NO van en el codigo.
# Cualquier valor se puede sobreescribir con variables de entorno.
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
                "client_secret": cfg["secret"],
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
