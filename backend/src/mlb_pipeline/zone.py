"""Rule-book strike zone classification (catcher's view, feet)."""

from __future__ import annotations

from enum import StrEnum

STRIKE_ZONE_X_MIN = -0.83
STRIKE_ZONE_X_MAX = 0.83
STRIKE_ZONE_Z_MIN = 1.5
STRIKE_ZONE_Z_MAX = 3.5


class ZoneEval(StrEnum):
    IN_ZONE = "IN ZONE"
    OUT_OF_ZONE = "OUT OF ZONE"
    UNKNOWN = "Unknown"


def classify_zone(px: float | None, pz: float | None) -> ZoneEval:
    if px is None or pz is None:
        return ZoneEval.UNKNOWN
    in_zone = STRIKE_ZONE_X_MIN <= px <= STRIKE_ZONE_X_MAX and STRIKE_ZONE_Z_MIN <= pz <= STRIKE_ZONE_Z_MAX
    return ZoneEval.IN_ZONE if in_zone else ZoneEval.OUT_OF_ZONE
