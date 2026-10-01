import os
import uuid
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, request, jsonify, g
from flask_cors import CORS

import keycloak_service as keycloak
from Producto import Producto
from Venta import Venta

app = Flask(__name__)
CORS(app)

# Cada tenant es un stage de Serverless (tenantA / tenantB)
TENANT_ID = os.environ.get("TENANT_ID", "A")


# ==========================================
# LISTAS TEMPORALES (en memoria)
# ==========================================

productos = []
ventas = []

productos.append(Producto(
    "p-01", TENANT_ID, "ARR-01", "Arroz Diana 1kg", 4500, 3200, 100
).to_json())


# ==========================================
# AUTENTICACION / ROLES
# ==========================================

def requiere_roles(*roles):
    """Exige token valido de Keycloak y al menos uno de los roles.
    erp_admin siempre tiene acceso."""

    def decorador(f):
        @wraps(f)
        def envoltura(*args, **kwargs):
            cabecera = request.headers.get("Authorization", "")
            if not cabecera.startswith("Bearer "):
                return jsonify({"mensaje": "Token requerido"}), 401

            try:
                g.usuario = keycloak.validar_token(cabecera[7:])
            except keycloak.KeycloakError as e:
                return jsonify({"mensaje": e.mensaje}), e.status

            permitidos = set(roles) | {"erp_admin"}
            if not permitidos & set(g.usuario["roles"]):
                return jsonify({"mensaje": "Sin permisos"}), 403

            return f(*args, **kwargs)
        return envoltura
    return decorador


@app.errorhandler(keycloak.KeycloakError)
def error_keycloak(e):
    return jsonify({"mensaje": e.mensaje}), e.status


def cuerpo():
    return request.get_json(silent=True) or {}


def faltan(datos, *campos):
    faltantes = [c for c in campos if datos.get(c) in (None, "")]
    if faltantes:
        return jsonify({
            "mensaje": "Campos requeridos: " + ", ".join(faltantes)
        }), 400
    return None


# ==========================================
# AUTH
# ==========================================

@app.route('/login', methods=['POST'])
def login():

    datos = cuerpo()
    error = faltan(datos, "username", "password")
    if error:
        return error

    return jsonify(keycloak.login(datos["username"], datos["password"]))


# ==========================================
# USUARIOS (Keycloak)
# ==========================================

@app.route('/usuarios', methods=['GET'])
@requiere_roles()
def listar_usuarios():
    return jsonify(keycloak.listar_usuarios())


@app.route('/usuarios', methods=['POST'])
@requiere_roles()
def agregar_usuario():

    datos = cuerpo()
    error = faltan(datos, "username", "password")
    if error:
        return error

    return jsonify(keycloak.crear_usuario(datos)), 201


@app.route('/usuarios/<id>', methods=['DELETE'])
@requiere_roles()
def eliminar_usuario(id):
    keycloak.eliminar_usuario(id)
    return jsonify({"mensaje": "Usuario eliminado"})


# ==========================================
# PRODUCTOS
# ==========================================

def buscar_producto(id):
    for p in productos:
        if p["id"] == id and p["tenant_id"] == TENANT_ID:
            return p
    return None


@app.route('/productos', methods=['GET'])
@requiere_roles("erp_inventario", "erp_ventas")
def listar_productos():
    return jsonify([p for p in productos if p["tenant_id"] == TENANT_ID])


@app.route('/productos', methods=['POST'])
@requiere_roles("erp_inventario")
def agregar_producto():

    datos = cuerpo()
    error = faltan(datos, "sku", "nombre", "precio_venta")
    if error:
        return error

    nuevo = Producto(
        datos.get("id") or str(uuid.uuid4()),
        TENANT_ID,
        datos["sku"],
        datos["nombre"],
        datos["precio_venta"],
        datos.get("costo_compra", 0),
        datos.get("stock_actual", 0),
        datos.get("stock_minimo", 5)
    )

    productos.append(nuevo.to_json())

    return jsonify(nuevo.to_json()), 201


@app.route('/productos/<id>', methods=['PUT'])
@requiere_roles("erp_inventario")
def actualizar_producto(id):

    producto = buscar_producto(id)
    if not producto:
        return jsonify({"mensaje": "Producto no encontrado"}), 404

    datos = cuerpo()
    for campo in ("sku", "nombre", "precio_venta", "costo_compra",
                  "stock_actual", "stock_minimo"):
        if campo in datos:
            producto[campo] = datos[campo]

    return jsonify(producto)


@app.route('/productos/<id>', methods=['DELETE'])
@requiere_roles("erp_inventario")
def eliminar_producto(id):

    producto = buscar_producto(id)
    if not producto:
        return jsonify({"mensaje": "Producto no encontrado"}), 404

    productos.remove(producto)
    return jsonify({"mensaje": "Producto eliminado"})


# ==========================================
# VENTAS (el detalle va dentro de "lineas")
# ==========================================

@app.route('/ventas', methods=['GET'])
@requiere_roles("erp_ventas")
def listar_ventas():
    return jsonify([v for v in ventas if v["tenant_id"] == TENANT_ID])


@app.route('/ventas', methods=['POST'])
@requiere_roles("erp_ventas")
def agregar_venta():

    datos = cuerpo()
    entradas = datos.get("lineas")
    if not isinstance(entradas, list) or not entradas:
        return jsonify({"mensaje": "La venta requiere al menos una linea"}), 400

    # Validar todo antes de descontar stock
    lineas = []
    for entrada in entradas:
        producto = buscar_producto(entrada.get("producto_id"))
        if not producto:
            return jsonify({
                "mensaje": f"Producto {entrada.get('producto_id')} no encontrado"
            }), 404

        cantidad = entrada.get("cantidad")
        if not isinstance(cantidad, int) or cantidad <= 0:
            return jsonify({"mensaje": "Cantidad invalida"}), 400

        pedido = sum(
            l["cantidad"] for l in lineas if l["producto_id"] == producto["id"]
        ) + cantidad
        if pedido > producto["stock_actual"]:
            return jsonify({
                "mensaje": f"Stock insuficiente para {producto['nombre']}"
            }), 409

        lineas.append({
            "producto_id": producto["id"],
            "nombre": producto["nombre"],
            "cantidad": cantidad,
            "precio_unitario": producto["precio_venta"],
            "subtotal": producto["precio_venta"] * cantidad
        })

    for linea in lineas:
        buscar_producto(linea["producto_id"])["stock_actual"] -= linea["cantidad"]

    nueva = Venta(
        str(uuid.uuid4()),
        TENANT_ID,
        g.usuario["username"],
        lineas,
        sum(l["subtotal"] for l in lineas),
        datos.get("metodo_pago", "efectivo"),
        datetime.now(timezone.utc).isoformat()
    )

    ventas.append(nueva.to_json())

    return jsonify(nueva.to_json()), 201


# ==========================================

if __name__ == '__main__':
    app.run(debug=True)
