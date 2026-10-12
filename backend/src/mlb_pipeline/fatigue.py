"""Velocity-based fatigue detection.

For each (game, pitcher, pitch type) the detector freezes a baseline from the
first ``baseline_pitches`` of the outing, then compares it with a rolling mean
of the most recent ``recent_pitches``. A drop at or above the threshold raises
a ``PitchAlert``; a cooldown suppresses repeats while the drop persists.

Memory is bounded: each key holds at most baseline + recent velocities, and
the number of tracked keys is capped with LRU eviction.
"""

from __future__ import annotations

from collections import OrderedDict, deque
from collections.abc import Iterable
from dataclasses import dataclass, field
from statistics import fmean

from mlb_pipeline.schemas import PitchAlert, PitchEvent


@dataclass(frozen=True)
class FatigueConfig:
    baseline_pitches: int = 7
    recent_pitches: int = 3
    drop_threshold_mph: float = 1.5
    critical_drop_mph: float = 3.0
    cooldown_pitches: int = 10
    max_tracked_keys: int = 1024


@dataclass
class _PitchTypeState:
    baseline: list[float] = field(default_factory=list)
    recent: deque[float] = field(default_factory=deque)
    seen_ids: set[str] = field(default_factory=set)
    cooldown: int = 0


_Key = tuple[int, str, str]


class FatigueDetector:
    def __init__(self, config: FatigueConfig | None = None, team: str | None = None) -> None:
        self.config = config or FatigueConfig()
        self.team = team
        self._states: OrderedDict[_Key, _PitchTypeState] = OrderedDict()

    @property
    def tracked_keys(self) -> int:
        return len(self._states)

    def prime(self, events: Iterable[PitchEvent]) -> None:
        """Rebuild state from history (e.g. after a restart) without emitting alerts."""
        for event in events:
            self._update(event)

    def observe(self, event: PitchEvent) -> PitchAlert | None:
        state = self._update(event)
        if state is None or len(state.recent) < self.config.recent_pitches:
            return None

        baseline_mph = fmean(state.baseline)
        recent_mph = fmean(state.recent)
        drop = baseline_mph - recent_mph

        if state.cooldown > 0 or drop < self.config.drop_threshold_mph:
            return None

        state.cooldown = self.config.cooldown_pitches
        severity = "critical" if drop >= self.config.critical_drop_mph else "warning"
        return PitchAlert(
            unique_id=f"fatigue:{event.unique_id}",
            pitch_unique_id=event.unique_id,
            game_id=event.game_id,
            pitcher_id=event.pitcher_id,
            pitcher_name=event.pitcher_full_name,
            team=event.pitcher_team,
            pitch_type=event.pitch_type,
            alert_type="Fatigue Risk",
            severity=severity,
            message=f"{event.pitch_type} velo down {drop:.1f} mph ({baseline_mph:.1f} → {recent_mph:.1f})",
            baseline_mph=round(baseline_mph, 2),
            recent_mph=round(recent_mph, 2),
            delta_mph=round(-drop, 2),
        )

    def _update(self, event: PitchEvent) -> _PitchTypeState | None:
        """Record the pitch; returns the state only when it is ready to evaluate."""
        if event.speed_mph is None:
            return None
        if self.team is not None and event.pitcher_team != self.team:
            return None

        state = self._state_for((event.game_id, event.pitcher_id, event.pitch_type))
        if event.unique_id in state.seen_ids:
            return None  # replayed message; don't double-count
        state.seen_ids.add(event.unique_id)

        if state.cooldown > 0:
            state.cooldown -= 1

        if len(state.baseline) < self.config.baseline_pitches:
            state.baseline.append(event.speed_mph)
            return None

        state.recent.append(event.speed_mph)
        return state

    def _state_for(self, key: _Key) -> _PitchTypeState:
        state = self._states.get(key)
        if state is None:
            state = _PitchTypeState(recent=deque(maxlen=self.config.recent_pitches))
            self._states[key] = state
            while len(self._states) > self.config.max_tracked_keys:
                self._states.popitem(last=False)
        else:
            self._states.move_to_end(key)
        return state
