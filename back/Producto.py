class Producto:

    def __init__(
        self,
        id,
        tenant_id,
        sku,
        nombre,
        precio_venta,
        costo_compra=0,
        stock_actual=0,
        stock_minimo=5
    ):
        self.id = id
        self.tenant_id = tenant_id
        self.sku = sku
        self.nombre = nombre
        self.precio_venta = precio_venta
        self.costo_compra = costo_compra
        self.stock_actual = stock_actual
        self.stock_minimo = stock_minimo

    def to_json(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "sku": self.sku,
            "nombre": self.nombre,
            "precio_venta": self.precio_venta,
            "costo_compra": self.costo_compra,
            "stock_actual": self.stock_actual,
            "stock_minimo": self.stock_minimo
        }
