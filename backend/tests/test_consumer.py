from __future__ import annotations

import pytest
from confluent_kafka import KafkaError, KafkaException
from postgrest.exceptions import APIError

from mlb_pipeline.consumer import decode_batch, process_batch
from mlb_pipeline.fatigue import FatigueDetector
from mlb_pipeline.sink import is_transient


class FakeMessage:
    def __init__(self, value: bytes | None, *, error: KafkaError | None = None, offset: int = 0) -> None:
        self._value, self._error, self._offset = value, error, offset

    def error(self):
        return self._error

    def value(self):
        return self._value

    def topic(self):
        return "live-pitches"

    def partition(self):
        return 0

    def offset(self):
        return self._offset


class RecordingSink:
    def __init__(self, fail_with: Exception | None = None) -> None:
        self.pitches: list = []
        self.alerts: list = []
        self.fail_with = fail_with

    def upsert_pitches(self, pitches):
        if self.fail_with:
            raise self.fail_with
        self.pitches.extend(pitches)

    def upsert_alerts(self, alerts):
        self.alerts.extend(alerts)


def msg(pitch, **kw) -> FakeMessage:
    return FakeMessage(pitch.model_dump_json().encode(), **kw)


def test_decode_batch_separates_valid_and_dead_letters(make_pitch):
    good = make_pitch()
    batch = [msg(good), FakeMessage(b"{not json"), FakeMessage(b'{"game_id": 1}')]

    result = decode_batch(batch)

    assert result.pitches == [good]
    assert len(result.dead_letters) == 2
    assert all(isinstance(err, str) and err for _, err in result.dead_letters)


def test_decode_batch_deduplicates_by_unique_id_keeping_latest(make_pitch):
    first = make_pitch(unique_id="same", speed_mph=94.0)
    second = make_pitch(unique_id="same", speed_mph=95.5)
    result = decode_batch([msg(first), msg(second)])
    assert result.pitches == [second]


def test_non_fatal_kafka_errors_are_skipped(make_pitch):
    error = KafkaError(KafkaError._PARTITION_EOF)
    result = decode_batch([FakeMessage(None, error=error), msg(make_pitch())])
    assert len(result.pitches) == 1


def test_fatal_kafka_errors_raise():
    error = KafkaError(KafkaError._FATAL, fatal=True)
    with pytest.raises(KafkaException):
        decode_batch([FakeMessage(None, error=error)])


def test_process_batch_writes_pitches_then_alerts(make_pitch):
    speeds = [95.0] * 7 + [92.0] * 3
    sink = RecordingSink()
    result = process_batch([msg(make_pitch(speed_mph=s)) for s in speeds], sink, FatigueDetector())

    assert len(sink.pitches) == 10
    assert len(sink.alerts) == 1
    assert result.alerts == sink.alerts


def test_sink_failure_propagates_and_detector_is_untouched(make_pitch):
    detector = FatigueDetector()
    sink = RecordingSink(fail_with=ConnectionError("supabase down"))

    with pytest.raises(ConnectionError):
        process_batch([msg(make_pitch())], sink, detector)

    # The batch will be redelivered; the detector must not have counted it yet.
    assert detector.tracked_keys == 0
    assert sink.alerts == []


@pytest.mark.parametrize(
    ("exc", "transient"),
    [
        (ConnectionError("reset"), True),
        (APIError({"code": "57014", "message": "statement timeout"}), True),
        (APIError({"message": "bad gateway"}), True),
        (APIError({"code": "PGRST204", "message": "Could not find the 'x' column"}), False),
        (APIError({"code": "23502", "message": "not-null violation"}), False),
        (APIError({"code": "42P01", "message": "relation does not exist"}), False),
    ],
)
def test_is_transient(exc, transient):
    assert is_transient(exc) is transient
