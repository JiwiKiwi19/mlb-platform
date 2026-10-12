from __future__ import annotations

import os
import random
import time

from mlb_pipeline.fatigue import FatigueDetector
from mlb_pipeline.health import beat, is_healthy
from mlb_pipeline.simulator import FATIGUE_DROP_MPH, ChaosEngine, generate_pitch


def chaos(mode: str, **kw) -> ChaosEngine:
    params = {"probability": 0.0, "interval": 5, "duration": 4, "rng": random.Random(0)}
    params.update(kw)
    return ChaosEngine(mode=mode, **params)


def test_chaos_off_never_changes_speed():
    engine = chaos("off")
    assert all(engine.adjust("1", 95.0) == 95.0 for _ in range(50))


def test_deterministic_episode_hits_one_pitcher_for_duration():
    engine = chaos("deterministic", interval=3, duration=2)
    speeds = [engine.adjust(pid, 95.0) for pid in ["a", "a", "b", "a", "b"]]
    # Episode starts on the 3rd pitch (pitcher b) and covers b's 2 pitches only.
    assert speeds == [95.0, 95.0, 95.0 - FATIGUE_DROP_MPH, 95.0, 95.0 - FATIGUE_DROP_MPH]


def test_simulated_stream_with_chaos_triggers_fatigue_alert():
    """End-to-end: the default simulator settings must actually exercise the detector."""
    rng = random.Random(42)
    engine = ChaosEngine(mode="deterministic", probability=0, interval=60, duration=12, rng=rng)
    detector = FatigueDetector(team="TOR")

    alerts = [a for i in range(200) if (a := detector.observe(generate_pitch(rng, engine, inning=1 + i // 15)))]
    assert alerts, "chaos fatigue episodes should produce at least one alert"


def test_heartbeat(tmp_path):
    path = tmp_path / "hb"
    assert not is_healthy(path, 60)
    beat(path)
    assert is_healthy(path, 60)
    stale = time.time() - 120
    os.utime(path, (stale, stale))
    assert not is_healthy(path, 60)
