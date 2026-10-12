"""Wire contract for the ``live-pitches`` topic and the rows written to Supabase.

``PitchEvent`` is the message schema. Bump ``SCHEMA_VERSION`` (and add a new
Literal member) for any breaking change; consumers route unknown versions to
the dead-letter topic instead of guessing.

Run ``python -m mlb_pipeline.schemas`` to print the JSON Schema, e.g. to
register it with a schema registry.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from mlb_pipeline.zone import classify_zone

SCHEMA_VERSION = 1


class PitchEvent(BaseModel):
    """One pitch as published by the producer or simulator."""

    model_config = ConfigDict(frozen=True, extra="ignore")

    schema_version: Literal[1] = SCHEMA_VERSION
    game_id: int
    unique_id: str = Field(min_length=1, max_length=128)
    pitch_type: str = Field(min_length=1)
    speed_mph: float | None = Field(default=None, gt=0, le=115)
    zone_x: float | None = None
    zone_z: float | None = None
    pitcher_team: str = Field(min_length=1)
    pitcher_id: str = Field(min_length=1)
    pitcher_full_name: str
    pitcher_first_name: str | None = None
    pitcher_last_name: str | None = None
    inning: int | None = Field(default=None, ge=1)
    timestamp: AwareDatetime

    @field_validator("speed_mph", mode="before")
    @classmethod
    def _zero_speed_is_missing(cls, value: Any) -> Any:
        # The MLB feed (and older producers) use 0 for "not measured".
        return None if value in (0, 0.0) else value

    @field_validator("timestamp", mode="before")
    @classmethod
    def _epoch_to_utc(cls, value: Any) -> Any:
        # Pre-v1 producers sent a raw Unix epoch float.
        if isinstance(value, int | float):
            return datetime.fromtimestamp(value, tz=UTC)
        return value

    def to_row(self) -> dict[str, Any]:
        """Row for ``public.live_pitches``, enriched with the zone evaluation."""
        row = self.model_dump(mode="json")
        row["zone_eval"] = classify_zone(self.zone_x, self.zone_z).value
        return row


class PitchAlert(BaseModel):
    """Row for ``public.pitch_alerts``."""

    model_config = ConfigDict(frozen=True)

    unique_id: str
    pitch_unique_id: str
    game_id: int
    pitcher_id: str
    pitcher_name: str
    team: str
    pitch_type: str
    alert_type: Literal["Fatigue Risk"]
    severity: Literal["info", "warning", "critical"]
    message: str
    baseline_mph: float
    recent_mph: float
    delta_mph: float

    def to_row(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


if __name__ == "__main__":
    print(json.dumps(PitchEvent.model_json_schema(), indent=2))
