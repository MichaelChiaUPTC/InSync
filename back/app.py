import os
import uuid
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, request, jsonify, g
from flask_cors import CORS

import kafka_service as eventos
import keycloak_service as keycloak
import semillas
from Producto import Producto
from Usuario import Usuario
from Venta import Venta

app = Flask(__name__)
CORS(app)

# El negocio va en la ruta: /tenantA/productos, /tenantB/productos...
PREFIJOS = {"tenantA": "A", "tenantB": "B"}


class PrefijoTenant:
    """Quita el prefijo /tenantX de la ruta y deja el negocio en environ."""

    def __init__(self, wsgi):
        self.wsgi = wsgi

    def __call__(self, environ, start_response):
        partes = environ.get("PATH_INFO", "").split("/", 2)  # ['', 'tenantA', 'productos']
        if len(partes) > 1 and partes[1] in PREFIJOS:
            environ["tenant.id"] = PREFIJOS[partes[1]]
            environ["PATH_INFO"] = "/" + (partes[2] if len(partes) > 2 else "")
        return self.wsgi(environ, start_response)


app.wsgi_app = PrefijoTenant(app.wsgi_app)


@app.before_request
def exigir_tenant():
    if "tenant.id" not in request.environ:
        return jsonify({"mensaje": "Ruta no encontrada. Use /tenantA/... o /tenantB/..."}), 404

# ==========================================
# LISTAS TEMPORALES (en memoria)
# Se llenan con datos de prueba de ambos negocios (ver semillas.py);
# cada registro lleva su tenant_id y se filtra por el del usuario.
# ==========================================

productos, ventas, usuarios = [], [], []
for _tenant in keycloak.REALMS:
    _p, _v, _u = semillas.cargar(_tenant)
    productos += _p
    ventas += _v
    usuarios += _u


def tenant():
    """Negocio de la ruta (/tenantA -> A, /tenantB -> B)."""
    return request.environ["tenant.id"]


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
                eventos.publicar_evento(eventos.TOPIC_SEGURIDAD, {
                    "tipo": "acceso_sin_token",
                    "endpoint": request.path,
                    "metodo": request.method,
                    "ip": request.remote_addr
                })
                return jsonify({"mensaje": "Token requerido"}), 401

            try:
                g.usuario = keycloak.validar_token(cabecera[7:])
            except keycloak.KeycloakError as e:
                if e.status == 401:
                    eventos.publicar_evento(eventos.TOPIC_SEGURIDAD, {
                        "tipo": "token_invalido",
                        "endpoint": request.path,
                        "metodo": request.method,
                        "ip": request.remote_addr
                    })
                return jsonify({"mensaje": e.mensaje}), e.status

            if g.usuario["tenant_id"] != tenant():
                eventos.publicar_evento(eventos.TOPIC_SEGURIDAD, {
                    "tipo": "token_de_otro_negocio",
                    "usuario": g.usuario["username"],
                    "endpoint": request.path,
                    "ip": request.remote_addr
                })
                return jsonify({"mensaje": "Token de otro negocio"}), 403

            permitidos = set(roles) | {"erp_admin"}
            if not permitidos & set(g.usuario["roles"]):
                eventos.publicar_evento(eventos.TOPIC_SEGURIDAD, {
                    "tipo": "acceso_denegado",
                    "usuario": g.usuario["username"],
                    "roles": g.usuario["roles"],
                    "endpoint": request.path,
                    "metodo": request.method,
                    "ip": request.remote_addr
                })
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


def error(mensaje, codigo=400):
    return jsonify({"mensaje": mensaje}), codigo


def es_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def es_entero(v):
    return isinstance(v, int) and not isinstance(v, bool)


def evento_usuario(tipo, usuario):
    eventos.publicar_evento(eventos.TOPIC_USUARIOS, {
        "tipo": tipo,
        "usuario_id": usuario["id"],
        "username": usuario["username"],
        "roles": usuario["roles"],
        "por": g.usuario["username"]
    })


def evento_producto(tipo, producto):
    eventos.publicar_evento(eventos.TOPIC_INVENTARIO, {
        "tipo": tipo,
        "producto_id": producto["id"],
        "sku": producto["sku"],
        "nombre": producto["nombre"],
        "stock_actual": producto["stock_actual"],
        "por": g.usuario["username"]
    })


def avisar_stock_bajo(producto):
    if producto["stock_actual"] <= producto["stock_minimo"]:
        evento_producto("stock_bajo", producto)


def buscar(lista, id):
    for x in lista:
        if x["id"] == id and x["tenant_id"] == tenant():
            return x
    return None


# ==========================================
# AUTH
# ==========================================

@app.route('/login', methods=['POST'])
def login():

    datos = cuerpo()
    falta = faltan(datos, "username", "password")
    if falta:
        return falta

    try:
        sesion = keycloak.login(datos["username"], datos["password"], tenant())
    except keycloak.KeycloakError as e:
        if e.status == 401:
            eventos.publicar_evento(eventos.TOPIC_AUTENTICACION, {
                "tipo": "login_fallido",
                "usuario": datos["username"],
                "ip": request.remote_addr
            })
        raise

    eventos.publicar_evento(eventos.TOPIC_AUTENTICACION, {
        "tipo": "login_exitoso",
        "usuario": sesion["username"],
        "roles": sesion["roles"],
        "ip": request.remote_addr
    })
    return jsonify(sesion)


# ==========================================
# USUARIOS (datos de prueba en memoria, solo admin)
# ==========================================

def validar_roles(roles):
    if not isinstance(roles, list) or not roles:
        return "Asigna al menos un rol"
    if any(r not in keycloak.ROLES_ERP for r in roles):
        return "Rol invalido. Use: " + ", ".join(keycloak.ROLES_ERP)
    return None


def username_en_uso(username, excepto_id=None):
    return any(
        u["username"].lower() == username.lower() and u["id"] != excepto_id
        for u in usuarios if u["tenant_id"] == tenant()
    )


@app.route('/usuarios', methods=['GET'])
@requiere_roles()
def listar_usuarios():
    return jsonify([u for u in usuarios if u["tenant_id"] == tenant()])


@app.route('/usuarios', methods=['POST'])
@requiere_roles()
def agregar_usuario():

    datos = cuerpo()
    falta = faltan(datos, "username", "nombre")
    if falta:
        return falta

    problema = validar_roles(datos.get("roles"))
    if problema:
        return error(problema)

    if username_en_uso(datos["username"]):
        return error("El usuario ya existe", 409)

    nuevo = Usuario(
        str(uuid.uuid4()),
        tenant(),
        datos["username"],
        datos["nombre"],
        datos.get("email", ""),
        datos["roles"],
        datos.get("activo", True)
    )

    usuarios.append(nuevo.to_json())
    evento_usuario("usuario_creado", nuevo.to_json())

    return jsonify(nuevo.to_json()), 201


@app.route('/usuarios/<id>', methods=['PUT'])
@requiere_roles()
def actualizar_usuario(id):

    usuario = buscar(usuarios, id)
    if not usuario:
        return error("Usuario no encontrado", 404)

    datos = cuerpo()

    if "roles" in datos:
        problema = validar_roles(datos["roles"])
        if problema:
            return error(problema)

    if "username" in datos and username_en_uso(datos["username"], id):
        return error("El usuario ya existe", 409)

    for campo in ("username", "nombre", "email", "roles", "activo"):
        if campo in datos:
            usuario[campo] = datos[campo]

    evento_usuario("usuario_actualizado", usuario)
    return jsonify(usuario)


@app.route('/usuarios/<id>', methods=['DELETE'])
@requiere_roles()
def eliminar_usuario(id):

    usuario = buscar(usuarios, id)
    if not usuario:
        return error("Usuario no encontrado", 404)

    if usuario["username"] == g.usuario["username"]:
        return error("No puedes eliminar tu propio usuario", 409)

    usuarios.remove(usuario)
    evento_usuario("usuario_eliminado", usuario)
    return jsonify({"mensaje": "Usuario eliminado"})


# ==========================================
# PRODUCTOS
# ==========================================

def sku_en_uso(sku, excepto_id=None):
    return any(
        p["sku"].lower() == sku.lower() and p["id"] != excepto_id
        for p in productos if p["tenant_id"] == tenant()
    )


def validar_producto(datos):
    if "precio_venta" in datos and (not es_numero(datos["precio_venta"]) or datos["precio_venta"] <= 0):
        return "El precio debe ser mayor que cero"
    if "costo_compra" in datos and (not es_numero(datos["costo_compra"]) or datos["costo_compra"] < 0):
        return "El costo no puede ser negativo"
    for campo in ("stock_actual", "stock_minimo"):
        if campo in datos and (not es_entero(datos[campo]) or datos[campo] < 0):
            return "El stock debe ser un entero, cero o mas"
    return None


@app.route('/productos', methods=['GET'])
@requiere_roles("erp_inventario", "erp_ventas")
def listar_productos():
    return jsonify([p for p in productos if p["tenant_id"] == tenant()])


@app.route('/productos', methods=['POST'])
@requiere_roles("erp_inventario")
def agregar_producto():

    datos = cuerpo()
    falta = faltan(datos, "sku", "nombre", "precio_venta")
    if falta:
        return falta

    problema = validar_producto(datos)
    if problema:
        return error(problema)

    if sku_en_uso(datos["sku"]):
        return error(f"El codigo {datos['sku']} ya existe", 409)

    nuevo = Producto(
        str(uuid.uuid4()),
        tenant(),
        datos["sku"],
        datos["nombre"],
        datos["precio_venta"],
        datos.get("costo_compra", 0),
        datos.get("stock_actual", 0),
        datos.get("stock_minimo", 5)
    )

    productos.append(nuevo.to_json())
    evento_producto("producto_creado", nuevo.to_json())
    avisar_stock_bajo(nuevo.to_json())

    return jsonify(nuevo.to_json()), 201


@app.route('/productos/<id>', methods=['PUT'])
@requiere_roles("erp_inventario")
def actualizar_producto(id):

    producto = buscar(productos, id)
    if not producto:
        return error("Producto no encontrado", 404)

    datos = cuerpo()

    problema = validar_producto(datos)
    if problema:
        return error(problema)

    if "sku" in datos and sku_en_uso(datos["sku"], id):
        return error(f"El codigo {datos['sku']} ya existe", 409)

    for campo in ("sku", "nombre", "precio_venta", "costo_compra",
                  "stock_actual", "stock_minimo"):
        if campo in datos:
            producto[campo] = datos[campo]

    evento_producto("producto_actualizado", producto)
    avisar_stock_bajo(producto)
    return jsonify(producto)


@app.route('/productos/<id>', methods=['DELETE'])
@requiere_roles("erp_inventario")
def eliminar_producto(id):

    producto = buscar(productos, id)
    if not producto:
        return error("Producto no encontrado", 404)

    productos.remove(producto)
    evento_producto("producto_eliminado", producto)
    return jsonify({"mensaje": "Producto eliminado"})


# ==========================================
# VENTAS (el detalle va dentro de "lineas")
# ==========================================

METODOS_PAGO = ("efectivo", "tarjeta", "transferencia")


@app.route('/ventas', methods=['GET'])
@requiere_roles("erp_ventas")
def listar_ventas():
    return jsonify([v for v in ventas if v["tenant_id"] == tenant()])


@app.route('/ventas', methods=['POST'])
@requiere_roles("erp_ventas")
def agregar_venta():

    datos = cuerpo()
    entradas = datos.get("lineas")
    if not isinstance(entradas, list) or not entradas:
        return error("La venta requiere al menos una linea")

    metodo = datos.get("metodo_pago", "efectivo")
    if metodo not in METODOS_PAGO:
        return error("Metodo de pago invalido. Use: " + ", ".join(METODOS_PAGO))

    # Validar todo antes de descontar stock
    lineas = []
    for entrada in entradas:
        producto = buscar(productos, entrada.get("producto_id"))
        if not producto:
            return error(f"Producto {entrada.get('producto_id')} no encontrado", 404)

        cantidad = entrada.get("cantidad")
        if not es_entero(cantidad) or cantidad <= 0:
            return error("Cantidad invalida")

        pedido = sum(
            l["cantidad"] for l in lineas if l["producto_id"] == producto["id"]
        ) + cantidad
        if pedido > producto["stock_actual"]:
            return error(f"Stock insuficiente para {producto['nombre']}", 409)

        lineas.append({
            "producto_id": producto["id"],
            "nombre": producto["nombre"],
            "cantidad": cantidad,
            "precio_unitario": producto["precio_venta"],
            "subtotal": producto["precio_venta"] * cantidad
        })

    for linea in lineas:
        producto = buscar(productos, linea["producto_id"])
        producto["stock_actual"] -= linea["cantidad"]
        avisar_stock_bajo(producto)

    nueva = Venta(
        str(uuid.uuid4()),
        tenant(),
        g.usuario["username"],
        lineas,
        sum(l["subtotal"] for l in lineas),
        metodo,
        datetime.now(timezone.utc).isoformat()
    )

    ventas.append(nueva.to_json())
    eventos.publicar_evento(eventos.TOPIC_VENTAS, {
        "tipo": "venta_registrada",
        "venta_id": nueva.id,
        "usuario": nueva.usuario,
        "total": nueva.total,
        "metodo_pago": nueva.metodo_pago,
        "lineas": len(lineas)
    })

    return jsonify(nueva.to_json()), 201


@app.route('/ventas/<id>', methods=['PUT'])
@requiere_roles("erp_ventas")
def actualizar_venta(id):
    """Solo se puede corregir el metodo de pago; las lineas y el total
    son un registro contable y no se editan (para eso se anula la venta)."""

    venta = buscar(ventas, id)
    if not venta:
        return error("Venta no encontrada", 404)

    metodo = cuerpo().get("metodo_pago")
    if metodo not in METODOS_PAGO:
        return error("Metodo de pago invalido. Use: " + ", ".join(METODOS_PAGO))

    venta["metodo_pago"] = metodo
    return jsonify(venta)


@app.route('/ventas/<id>', methods=['DELETE'])
@requiere_roles()
def anular_venta(id):
    """Anula la venta (solo admin) y devuelve el stock a los productos."""

    venta = buscar(ventas, id)
    if not venta:
        return error("Venta no encontrada", 404)

    for linea in venta["lineas"]:
        producto = buscar(productos, linea["producto_id"])
        if producto:  # puede haberse eliminado despues de la venta
            producto["stock_actual"] += linea["cantidad"]

    ventas.remove(venta)
    eventos.publicar_evento(eventos.TOPIC_VENTAS, {
        "tipo": "venta_anulada",
        "venta_id": venta["id"],
        "total": venta["total"],
        "por": g.usuario["username"]
    })
    return jsonify({"mensaje": "Venta anulada y stock devuelto"})


# ==========================================

if __name__ == '__main__':
    app.run(debug=True)
