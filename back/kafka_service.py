import json
import os
import socket
import time
from datetime import datetime, timezone

# Kafka es opcional: si no hay broker (o KAFKA_BOOTSTRAP_SERVERS esta vacio)
# la API sigue funcionando y los eventos simplemente se descartan.
BOOTSTRAP_SERVERS = os.environ.get(
    "KAFKA_BOOTSTRAP_SERVERS",
    "" if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else "localhost:9092",
)

# Topics
TOPIC_AUTENTICACION = "usuarios.autenticacion"
TOPIC_SEGURIDAD = "seguridad.accesos"
TOPIC_USUARIOS = "usuarios.gestion"
TOPIC_INVENTARIO = "inventario.eventos"
TOPIC_VENTAS = "ventas.eventos"

# Alternativa para la Lambda: en vez de hablar el protocolo Kafka (TCP), envia cada evento por HTTP
# a un Kafka REST Proxy (p. ej. el de docker-compose.yml expuesto con un tunel ngrok o cloudflared).
# Si esta definida, tiene prioridad sobre KAFKA_BOOTSTRAP_SERVERS.
REST_URL = os.environ.get("KAFKA_REST_URL", "").rstrip("/")

TIMEOUT_MS = 2000          # nunca bloquear una peticion mas de ~2 s
REST_TIMEOUT = 6           # la 1.a peticion al proxy crea su productor/topic y tarda unos segundos; las demas, ~50 ms
ESPERA_REINTENTO = 30      # segundos sin reintentar tras un fallo de conexion

_producer = None
_no_reintentar_antes_de = 0.0


def _broker_alcanzable():
    """Prueba rapida de conexion TCP; evita que KafkaProducer espere ~30 s
    cuando el broker esta apagado."""
    for servidor in BOOTSTRAP_SERVERS.split(","):
        host, _, puerto = servidor.strip().rpartition(":")
        try:
            with socket.create_connection((host or servidor, int(puerto or 9092)), timeout=1):
                return True
        except (OSError, ValueError):
            continue
    return False


def _obtener_productor():
    """Crea el KafkaProducer la primera vez que se necesita."""
    global _producer, _no_reintentar_antes_de

    if not BOOTSTRAP_SERVERS:
        return None
    if _producer is not None:
        return _producer
    if time.monotonic() < _no_reintentar_antes_de:
        return None

    try:
        if not _broker_alcanzable():
            raise ConnectionError("el broker no responde")

        from kafka import KafkaProducer

        _producer = KafkaProducer(
            bootstrap_servers=BOOTSTRAP_SERVERS.split(","),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            max_block_ms=TIMEOUT_MS,
            request_timeout_ms=TIMEOUT_MS,
            retries=0,
        )
    except Exception as e:
        print(f"Kafka no disponible ({BOOTSTRAP_SERVERS}): {e}")
        _no_reintentar_antes_de = time.monotonic() + ESPERA_REINTENTO
        _producer = None

    return _producer


def _tenant_actual():
    """Negocio de la peticion en curso (lo fija la ruta /tenantA o /tenantB)."""
    from flask import has_request_context, request
    return request.environ.get("tenant.id") if has_request_context() else None


def _publicar_rest(topic: str, evento: dict):
    """Envia el evento al REST Proxy por HTTP. Nunca lanza excepciones."""
    global _no_reintentar_antes_de

    if time.monotonic() < _no_reintentar_antes_de:
        return False
    try:
        import requests

        r = requests.post(
            f"{REST_URL}/topics/{topic}",
            json={"records": [{"value": evento}]},
            headers={"Content-Type": "application/vnd.kafka.json.v2+json"},
            timeout=REST_TIMEOUT,
        )
        r.raise_for_status()
        # El proxy responde 200 aunque un registro falle: el error viene en "offsets"
        errores = [o for o in r.json().get("offsets", []) if o.get("error_code")]
        if errores:
            raise RuntimeError(errores[0].get("error") or f"error_code {errores[0]['error_code']}")
        return True
    except Exception as e:
        print(f"Error al publicar en '{topic}' por REST ({REST_URL}): {e}")
        # Si el proxy contesta tarde, el broker suele haber recibido el evento: no se "apaga" Kafka por eso
        import requests
        if not isinstance(e, requests.exceptions.ReadTimeout):
            _no_reintentar_antes_de = time.monotonic() + ESPERA_REINTENTO
        return False


def publicar_evento(topic: str, evento: dict):
    """Publica un evento en Kafka. Nunca lanza excepciones.
    Devuelve True si se envio, False si se descarto."""
    global _producer, _no_reintentar_antes_de

    evento = {
        **evento,
        "tenant_id": _tenant_actual(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if REST_URL:
        return _publicar_rest(topic, evento)

    producer = _obtener_productor()
    if producer is None:
        return False

    try:
        producer.send(topic, value=evento)
        producer.flush(timeout=TIMEOUT_MS / 1000)
        return True
    except Exception as e:
        print(f"Error al publicar en '{topic}': {e}")
        _producer = None
        _no_reintentar_antes_de = time.monotonic() + ESPERA_REINTENTO
        return False
