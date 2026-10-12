"""Consume pitches from Kafka, persist them to Supabase, and raise fatigue alerts.

Delivery semantics are at-least-once: offsets are committed synchronously only
after the batch is written. Writes are idempotent upserts on ``unique_id`` and
alert IDs are deterministic, so redelivery after a crash is harmless.

Messages that fail schema validation are forwarded to the dead-letter topic
with the error in a header, then committed so they don't block the partition.
If Supabase stays unavailable past the retry budget the process exits non-zero
without committing; the orchestrator restarts it and the batch is reprocessed.
"""

from __future__ import annotations

import sys
import threading
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Protocol

from confluent_kafka import Consumer, KafkaError, KafkaException, Producer
from pydantic import ValidationError

from mlb_pipeline import health
from mlb_pipeline.config import Settings, get_settings
from mlb_pipeline.fatigue import FatigueConfig, FatigueDetector
from mlb_pipeline.kafka import consumer_config, install_shutdown_handler, producer_config
from mlb_pipeline.log import configure_logging, get_logger
from mlb_pipeline.schemas import PitchAlert, PitchEvent
from mlb_pipeline.sink import PitchSink, SupabaseSink

log = get_logger(__name__)


class KafkaMessage(Protocol):
    def error(self) -> KafkaError | None: ...
    def value(self) -> bytes | None: ...
    def topic(self) -> str | None: ...
    def partition(self) -> int | None: ...
    def offset(self) -> int | None: ...


@dataclass
class BatchResult:
    pitches: list[PitchEvent] = field(default_factory=list)
    alerts: list[PitchAlert] = field(default_factory=list)
    dead_letters: list[tuple[KafkaMessage, str]] = field(default_factory=list)


def decode_batch(messages: Sequence[KafkaMessage]) -> BatchResult:
    """Validate messages; later duplicates of a ``unique_id`` win."""
    result = BatchResult()
    by_id: dict[str, PitchEvent] = {}
    for msg in messages:
        err = msg.error()
        if err is not None:
            if err.fatal():
                raise KafkaException(err)
            log.warning("kafka_message_error", error=str(err))
            continue
        try:
            event = PitchEvent.model_validate_json(msg.value() or b"")
        except ValidationError as exc:
            result.dead_letters.append((msg, exc.json(include_url=False)))
            continue
        by_id.pop(event.unique_id, None)
        by_id[event.unique_id] = event
    result.pitches = list(by_id.values())
    return result


def process_batch(messages: Sequence[KafkaMessage], sink: PitchSink, detector: FatigueDetector) -> BatchResult:
    result = decode_batch(messages)
    sink.upsert_pitches(result.pitches)
    result.alerts = [alert for pitch in result.pitches if (alert := detector.observe(pitch))]
    sink.upsert_alerts(result.alerts)
    return result


def send_dead_letters(producer: Producer, topic: str, dead_letters: list[tuple[KafkaMessage, str]]) -> None:
    for msg, error in dead_letters:
        producer.produce(
            topic,
            value=msg.value(),
            headers={
                "error": error[:4096],
                "source_topic": msg.topic() or "",
                "source_partition": str(msg.partition()),
                "source_offset": str(msg.offset()),
            },
        )
        log.warning("message_dead_lettered", partition=msg.partition(), offset=msg.offset())
    if dead_letters and producer.flush(30) > 0:
        raise RuntimeError("Failed to deliver dead letters; refusing to commit offsets")


def build_detector(settings: Settings) -> FatigueDetector:
    return FatigueDetector(
        FatigueConfig(
            baseline_pitches=settings.fatigue_baseline_pitches,
            recent_pitches=settings.fatigue_recent_pitches,
            drop_threshold_mph=settings.fatigue_drop_threshold_mph,
            critical_drop_mph=settings.fatigue_critical_drop_mph,
            cooldown_pitches=settings.fatigue_cooldown_pitches,
        ),
        team=settings.team_abbreviation,
    )


def warm_start(detector: FatigueDetector, sink: SupabaseSink) -> None:
    """Rebuild detector baselines from today's pitches so a restart doesn't reset them."""
    events = []
    for row in sink.recent_pitches(since=timedelta(hours=12)):
        try:
            events.append(PitchEvent.model_validate(row))
        except ValidationError:
            continue
    detector.prime(events)
    log.info("detector_warmed", pitches=len(events), tracked_keys=detector.tracked_keys)


def run(settings: Settings, stop: threading.Event) -> None:
    url, key = settings.require_supabase()
    sink = SupabaseSink(url, key, settings.supabase_timeout_seconds)
    detector = build_detector(settings)
    warm_start(detector, sink)

    dlq_producer = Producer(producer_config(settings.kafka_bootstrap_servers, "mlb-consumer-dlq"))
    consumer = Consumer(consumer_config(settings.kafka_bootstrap_servers, settings.kafka_consumer_group))
    consumer.subscribe([settings.kafka_topic_pitches])
    log.info("consumer_started", topic=settings.kafka_topic_pitches, group=settings.kafka_consumer_group)

    try:
        while not stop.is_set():
            messages = consumer.consume(settings.consumer_batch_size, settings.consumer_batch_timeout_seconds)
            health.beat(settings.heartbeat_path)
            if not messages:
                continue

            result = process_batch(messages, sink, detector)
            send_dead_letters(dlq_producer, settings.kafka_topic_dlq, result.dead_letters)
            consumer.commit(asynchronous=False)

            log.info(
                "batch_committed",
                messages=len(messages),
                pitches=len(result.pitches),
                alerts=len(result.alerts),
                dead_letters=len(result.dead_letters),
            )
            for alert in result.alerts:
                log.warning("fatigue_alert", pitcher=alert.pitcher_name, message=alert.message, severity=alert.severity)
    finally:
        consumer.close()
        dlq_producer.flush(10)
        log.info("consumer_stopped")


def main() -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_format)
    try:
        run(settings, install_shutdown_handler())
    except Exception:
        log.exception("consumer_crashed")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
