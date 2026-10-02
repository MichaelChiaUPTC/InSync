import json
import os
import time
from datetime import datetime, timezone

# Publicacion de eventos en Kafka.
# Si Kafka no esta disponible, el backend sigue funcionando sin eventos.

KAFKA_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TENANT_ID = os.environ.get("TENANT_ID", "A")

TOPIC_SEGURIDAD = "seguridad.accesos"
TOPIC_PRODUCTOS = "inventario.productos"
TOPIC_VENTAS = "ventas.registro"

REINTENTO_SEGUNDOS = 30

_producer = None
_proximo_intento = 0


def _obtener_producer():
    """Crea el producer en el primer evento (no al importar el modulo).
    Si falla, espera REINTENTO_SEGUNDOS antes de volver a intentar para
    no frenar cada peticion cuando Kafka esta apagado."""
    global _producer, _proximo_intento

    if _producer is not None:
        return _producer
    if time.time() < _proximo_intento:
        return None

    try:
        from kafka import KafkaProducer

        _producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS.split(","),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            request_timeout_ms=3000,
            max_block_ms=3000,
        )
    except Exception as e:
        _proximo_intento = time.time() + REINTENTO_SEGUNDOS
        print(f"Kafka no disponible ({KAFKA_SERVERS}): {e}")
        return None

    return _producer


def publicar_evento(topic: str, evento: dict):
    try:
        producer = _obtener_producer()
        if producer is None:
            return

        evento["tenant_id"] = TENANT_ID
        evento["timestamp"] = datetime.now(timezone.utc).isoformat()

        producer.send(topic, value=evento)
        producer.flush(timeout=3)
    except Exception as e:
        print(f"Error al publicar en '{topic}': {e}")
