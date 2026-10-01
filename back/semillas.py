import uuid
from datetime import datetime, timedelta, timezone

from Producto import Producto
from Usuario import Usuario
from Venta import Venta

# Datos de prueba por tenant.
# productos: (id, sku, nombre, precio_venta, costo_compra, stock_actual, stock_minimo)
# ventas:    (dias_atras, metodo_pago, [(producto_id, cantidad), ...])
# usuarios:  (id, username, nombre, email, [roles])
SEMILLAS = {
    "A": {  # Supermercado El Ahorro
        "productos": [
            ("p-01", "ARR-01", "Arroz Diana 1kg", 4500, 3200, 100, 5),
            ("p-02", "ACE-01", "Aceite Girasol 1L", 9800, 7500, 60, 10),
            ("p-03", "AZU-01", "Azucar Manuelita 1kg", 4200, 3100, 80, 10),
            ("p-04", "LEC-01", "Leche Entera 1L", 3900, 2900, 120, 20),
            ("p-05", "CAF-01", "Cafe Sello Rojo 500g", 14500, 11000, 40, 8),
            ("p-06", "PAN-01", "Pan Tajado Bimbo", 6500, 4800, 30, 10),
            ("p-07", "HUE-01", "Huevos AA x30", 17000, 14000, 25, 5),
            ("p-08", "JAB-01", "Jabon Rey Barra", 2800, 1900, 90, 15),
            ("p-09", "PAP-01", "Papel Higienico x12", 21000, 16500, 35, 8),
            ("p-10", "SAL-01", "Sal Refisal 500g", 1800, 1100, 3, 10),
        ],
        "ventas": [
            (4, "efectivo", [("p-01", 2), ("p-02", 1)]),
            (3, "tarjeta", [("p-04", 6), ("p-06", 2)]),
            (2, "efectivo", [("p-05", 1), ("p-03", 3)]),
            (1, "tarjeta", [("p-07", 2), ("p-09", 1), ("p-08", 4)]),
            (0, "efectivo", [("p-01", 5), ("p-10", 2)]),
        ],
        "usuarios": [
            ("u-01", "admin", "Marta Rincon", "marta@elahorro.co", ["erp_admin"]),
            ("u-02", "laura", "Laura Gomez", "laura@elahorro.co", ["erp_ventas"]),
            ("u-03", "andres", "Andres Perez", "andres@elahorro.co", ["erp_ventas", "erp_inventario"]),
            ("u-04", "camilo", "Camilo Suarez", "camilo@elahorro.co", ["erp_inventario"]),
        ],
    },
    "B": {  # Pasteleria Dulce Aroma
        "productos": [
            ("p-01", "TOR-01", "Torta de Chocolate (porcion)", 7500, 3800, 40, 8),
            ("p-02", "TOR-02", "Torta Tres Leches (porcion)", 7000, 3500, 35, 8),
            ("p-03", "CUP-01", "Cupcake de Vainilla", 4500, 2000, 60, 12),
            ("p-04", "CRO-01", "Croissant de Mantequilla", 4000, 1800, 50, 10),
            ("p-05", "PAN-01", "Pan de Bono x6", 6000, 3000, 45, 10),
            ("p-06", "GAL-01", "Galletas de Avena x6", 5500, 2600, 70, 15),
            ("p-07", "BRO-01", "Brownie con Nueces", 5000, 2300, 55, 10),
            ("p-08", "PIE-01", "Pie de Limon (porcion)", 6800, 3300, 25, 6),
            ("p-09", "EMP-01", "Empanada de Pollo", 3500, 1700, 80, 15),
            ("p-10", "CAF-01", "Cafe Americano", 3000, 900, 8, 10),
        ],
        "ventas": [
            (4, "efectivo", [("p-01", 2), ("p-09", 3)]),
            (3, "tarjeta", [("p-03", 6), ("p-04", 4)]),
            (2, "efectivo", [("p-02", 1), ("p-10", 2)]),
            (1, "tarjeta", [("p-05", 2), ("p-07", 3), ("p-06", 1)]),
            (0, "efectivo", [("p-08", 2), ("p-10", 3)]),
        ],
        "usuarios": [
            ("u-01", "admin", "Sofia Herrera", "sofia@dulcearoma.co", ["erp_admin"]),
            ("u-02", "valeria", "Valeria Mora", "valeria@dulcearoma.co", ["erp_ventas"]),
            ("u-03", "mateo", "Mateo Rojas", "mateo@dulcearoma.co", ["erp_ventas", "erp_inventario"]),
            ("u-04", "daniela", "Daniela Castro", "daniela@dulcearoma.co", ["erp_inventario"]),
        ],
    },
}


def cargar(tenant_id):
    """Devuelve (productos, ventas, usuarios) como listas de dicts,
    construidas a partir de las clases Producto, Venta y Usuario."""
    datos = SEMILLAS.get(tenant_id, SEMILLAS["A"])

    productos = [
        Producto(pid, tenant_id, sku, nombre, precio, costo, stock, minimo).to_json()
        for pid, sku, nombre, precio, costo, stock, minimo in datos["productos"]
    ]

    usuarios = [
        Usuario(uid, tenant_id, username, nombre, email, roles).to_json()
        for uid, username, nombre, email, roles in datos["usuarios"]
    ]

    ventas = []
    ahora = datetime.now(timezone.utc)
    for dias, pago, items in datos["ventas"]:
        lineas = []
        for pid, cant in items:
            p = next(x for x in productos if x["id"] == pid)
            p["stock_actual"] -= cant  # una venta real descuenta stock
            lineas.append({
                "producto_id": pid,
                "nombre": p["nombre"],
                "cantidad": cant,
                "precio_unitario": p["precio_venta"],
                "subtotal": p["precio_venta"] * cant
            })
        ventas.append(Venta(
            str(uuid.uuid4()),
            tenant_id,
            "admin",
            lineas,
            sum(l["subtotal"] for l in lineas),
            pago,
            (ahora - timedelta(days=dias)).isoformat()
        ).to_json())

    return productos, ventas, usuarios
