class Usuario:

    def __init__(
        self,
        id,
        tenant_id,
        username,
        nombre,
        email,
        roles,
        activo=True
    ):
        self.id = id
        self.tenant_id = tenant_id
        self.username = username
        self.nombre = nombre
        self.email = email
        self.roles = roles
        self.activo = activo

    def to_json(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "username": self.username,
            "nombre": self.nombre,
            "email": self.email,
            "roles": self.roles,
            "activo": self.activo
        }
