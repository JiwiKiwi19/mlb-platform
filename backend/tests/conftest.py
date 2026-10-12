from __future__ import annotations

import itertools
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest

from mlb_pipeline.schemas import PitchEvent

_ids = itertools.count()


@pytest.fixture
def make_pitch() -> Callable[..., PitchEvent]:
    def factory(**overrides: Any) -> PitchEvent:
        fields: dict[str, Any] = {
            "game_id": 1,
            "unique_id": f"p{next(_ids)}",
            "pitch_type": "Four-Seam Fastball",
            "speed_mph": 95.0,
            "zone_x": 0.0,
            "zone_z": 2.5,
            "pitcher_team": "TOR",
            "pitcher_id": "100",
            "pitcher_full_name": "Test Pitcher",
            "timestamp": datetime(2026, 7, 1, 23, 0, tzinfo=UTC),
        }
        fields.update(overrides)
        return PitchEvent(**fields)

    return factory
