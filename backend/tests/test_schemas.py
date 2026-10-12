from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from mlb_pipeline.schemas import PitchEvent
from mlb_pipeline.zone import (
    STRIKE_ZONE_X_MAX,
    STRIKE_ZONE_X_MIN,
    STRIKE_ZONE_Z_MAX,
    STRIKE_ZONE_Z_MIN,
    ZoneEval,
    classify_zone,
)

LEGACY_MESSAGE = {
    "game_id": 745123,
    "unique_id": "745123_10_3",
    "pitch_type": "Slider",
    "speed_mph": 86.4,
    "zone_x": 0.1,
    "zone_z": 2.2,
    "pitcher_team": "TOR",
    "pitcher_id": "592332",
    "pitcher_full_name": "Kevin Gausman",
    "pitcher_first_name": "Kevin",
    "pitcher_last_name": "Gausman",
    "timestamp": 1777957271.5,
}


@pytest.mark.parametrize(
    ("px", "pz", "expected"),
    [
        (0.0, 2.5, ZoneEval.IN_ZONE),
        (STRIKE_ZONE_X_MIN, STRIKE_ZONE_Z_MIN, ZoneEval.IN_ZONE),
        (STRIKE_ZONE_X_MAX, STRIKE_ZONE_Z_MAX, ZoneEval.IN_ZONE),
        (1.5, 2.5, ZoneEval.OUT_OF_ZONE),
        (0.0, 0.5, ZoneEval.OUT_OF_ZONE),
        (None, 2.5, ZoneEval.UNKNOWN),
        (0.0, None, ZoneEval.UNKNOWN),
    ],
)
def test_classify_zone(px, pz, expected):
    assert classify_zone(px, pz) is expected


def test_legacy_message_is_accepted_and_upgraded():
    event = PitchEvent.model_validate_json(json.dumps(LEGACY_MESSAGE))
    assert event.schema_version == 1
    assert event.timestamp == datetime.fromtimestamp(1777957271.5, tz=UTC)


def test_zero_speed_means_not_measured():
    event = PitchEvent.model_validate({**LEGACY_MESSAGE, "speed_mph": 0})
    assert event.speed_mph is None


@pytest.mark.parametrize(
    "patch",
    [
        {"schema_version": 2},
        {"unique_id": ""},
        {"speed_mph": 180},
        {"game_id": "not-a-number"},
        {"timestamp": "2026-07-01T23:00:00"},  # naive datetimes are ambiguous
    ],
)
def test_invalid_messages_are_rejected(patch):
    with pytest.raises(ValidationError):
        PitchEvent.model_validate({**LEGACY_MESSAGE, **patch})


def test_missing_required_field_is_rejected():
    payload = dict(LEGACY_MESSAGE)
    del payload["pitcher_id"]
    with pytest.raises(ValidationError):
        PitchEvent.model_validate(payload)


def test_unknown_fields_are_ignored():
    event = PitchEvent.model_validate({**LEGACY_MESSAGE, "spin_rpm": 2400})
    assert "spin_rpm" not in event.model_dump()


def test_to_row_adds_zone_eval_and_iso_timestamp():
    row = PitchEvent.model_validate(LEGACY_MESSAGE).to_row()
    assert row["zone_eval"] == "IN ZONE"
    assert row["timestamp"].startswith("2026-")
    assert row["timestamp"].endswith("Z")
    json.dumps(row)  # must be JSON-serialisable for PostgREST


def test_round_trip_through_json(make_pitch):
    event = make_pitch()
    assert PitchEvent.model_validate_json(event.model_dump_json()) == event
