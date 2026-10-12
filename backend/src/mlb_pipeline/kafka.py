"""Kafka client configuration and a reliable publishing wrapper."""

from __future__ import annotations

import signal
import threading
from typing import Any

from confluent_kafka import KafkaError, Message, Producer

from mlb_pipeline.log import get_logger
from mlb_pipeline.schemas import PitchEvent

log = get_logger(__name__)


def producer_config(bootstrap_servers: str, client_id: str) -> dict[str, Any]:
    return {
        "bootstrap.servers": bootstrap_servers,
        "client.id": client_id,
        # Exactly-once per partition from the producer's side: no duplicates or
        # reordering on broker retries. Implies acks=all.
        "enable.idempotence": True,
        "acks": "all",
        # Pitches arrive in small bursts per poll; a short linger lets them batch.
        "linger.ms": 20,
        "compression.type": "zstd",
        "delivery.timeout.ms": 120_000,
    }


def consumer_config(bootstrap_servers: str, group_id: str) -> dict[str, Any]:
    return {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        # Offsets are committed only after rows are durably written to Supabase.
        "enable.auto.commit": False,
        "auto.offset.reset": "earliest",
        "session.timeout.ms": 45_000,
        "max.poll.interval.ms": 600_000,
    }


def partition_key(event: PitchEvent) -> bytes:
    # Keying by pitcher keeps each pitcher's pitches ordered within one partition,
    # which the fatigue detector relies on.
    return f"{event.game_id}:{event.pitcher_id}".encode()


class PitchPublisher:
    """Asynchronous producer with delivery tracking and back-pressure handling."""

    def __init__(self, producer: Producer, topic: str) -> None:
        self._producer = producer
        self._topic = topic
        self.delivered = 0
        self.failed = 0

    def publish(self, event: PitchEvent) -> None:
        payload = event.model_dump_json().encode()
        while True:
            try:
                self._producer.produce(
                    self._topic,
                    key=partition_key(event),
                    value=payload,
                    headers={"schema_version": str(event.schema_version)},
                    on_delivery=self._on_delivery,
                )
                break
            except BufferError:
                # Local queue full: serve delivery callbacks to drain it, then retry.
                log.warning("producer_queue_full", topic=self._topic)
                self._producer.poll(1.0)
        self._producer.poll(0)

    def flush(self, timeout: float = 30.0) -> int:
        remaining = self._producer.flush(timeout)
        if remaining:
            log.error("producer_flush_incomplete", undelivered=remaining)
        return remaining

    def _on_delivery(self, err: KafkaError | None, msg: Message) -> None:
        if err is not None:
            self.failed += 1
            log.error("delivery_failed", topic=msg.topic(), key=_decode(msg.key()), error=str(err))
        else:
            self.delivered += 1


def _decode(value: bytes | None) -> str | None:
    return value.decode(errors="replace") if value is not None else None


def install_shutdown_handler() -> threading.Event:
    """Return an event that is set on SIGINT/SIGTERM so loops can exit cleanly."""
    stop = threading.Event()

    def handler(signum: int, _frame: object) -> None:
        log.info("shutdown_requested", signal=signal.Signals(signum).name)
        stop.set()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    return stop
