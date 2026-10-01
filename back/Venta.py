class Venta:

    def __init__(
        self,
        id,
        tenant_id,
        usuario,
        lineas,
        total,
        metodo_pago="efectivo",
        fecha=None
    ):
        self.id = id
        self.tenant_id = tenant_id
        self.usuario = usuario
        self.lineas = lineas
        self.total = total
        self.metodo_pago = metodo_pago
        self.fecha = fecha

    def to_json(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "usuario": self.usuario,
            "lineas": self.lineas,
            "total": self.total,
            "metodo_pago": self.metodo_pago,
            "fecha": self.fecha
        }
