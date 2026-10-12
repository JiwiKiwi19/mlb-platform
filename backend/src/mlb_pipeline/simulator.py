"""Synthetic pitch stream for local development and demos.

Chaos injection lives here only; the live producer never mutates real data.
A fatigue episode subtracts velocity from one pitcher for several consecutive
pitches, which is what the detector's rolling mean is designed to catch.
"""

from __future__ import annotations

import random
import sys
import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from confluent_kafka import Producer

from mlb_pipeline import health
from mlb_pipeline.config import Settings, get_settings
from mlb_pipeline.kafka import PitchPublisher, install_shutdown_handler, producer_config
from mlb_pipeline.log import configure_logging, get_logger
from mlb_pipeline.schemas import PitchEvent

log = get_logger(__name__)

SIMULATED_GAME_ID = 999_999
FATIGUE_DROP_MPH = 2.5

PITCHERS = [
    {"id": "592332", "full": "Kevin Gausman", "first": "Kevin", "last": "Gausman"},
    {"id": "621244", "full": "José Berríos", "first": "José", "last": "Berríos"},
]
BASE_VELOCITY = {"Four-Seam Fastball": 94.5, "Slider": 84.0, "Curveball": 81.0}


@dataclass
class ChaosEngine:
    mode: str
    probability: float
    interval: int
    duration: int
    rng: random.Random
    _count: int = 0
    _episode_pitcher: str | None = None
    _episode_left: int = 0

    def adjust(self, pitcher_id: str, speed: float) -> float:
        self._count += 1
        if self._episode_left == 0 and self._should_start():
            self._episode_pitcher, self._episode_left = pitcher_id, self.duration
            log.info("chaos_fatigue_episode_started", pitcher_id=pitcher_id, pitches=self.duration)
        if self._episode_left and pitcher_id == self._episode_pitcher:
            self._episode_left -= 1
            return speed - FATIGUE_DROP_MPH
        return speed

    def _should_start(self) -> bool:
        if self.mode == "deterministic":
            return self._count % self.interval == 0
        if self.mode == "random":
            return self.rng.random() < self.probability
        return False


def generate_pitch(rng: random.Random, chaos: ChaosEngine, inning: int) -> PitchEvent:
    pitcher = rng.choice(PITCHERS)
    pitch_type = rng.choice(list(BASE_VELOCITY))
    speed = chaos.adjust(pitcher["id"], BASE_VELOCITY[pitch_type] + rng.uniform(-0.5, 0.5))
    return PitchEvent(
        game_id=SIMULATED_GAME_ID,
        unique_id=f"sim_{uuid.uuid4().hex}",
        pitch_type=pitch_type,
        speed_mph=round(speed, 1),
        zone_x=round(rng.uniform(-1.5, 1.5), 3),
        zone_z=round(rng.uniform(1.0, 4.0), 3),
        pitcher_team="TOR",
        pitcher_id=pitcher["id"],
        pitcher_full_name=pitcher["full"],
        pitcher_first_name=pitcher["first"],
        pitcher_last_name=pitcher["last"],
        inning=inning,
        timestamp=datetime.now(UTC),
    )


def run(settings: Settings, stop: threading.Event, seed: int | None = None) -> None:
    rng = random.Random(seed)
    chaos = ChaosEngine(
        mode=settings.chaos_mode,
        probability=settings.chaos_probability,
        interval=settings.chaos_fatigue_interval,
        duration=settings.chaos_fatigue_duration,
        rng=rng,
    )
    publisher = PitchPublisher(
        Producer(producer_config(settings.kafka_bootstrap_servers, "mlb-simulator")),
        settings.kafka_topic_pitches,
    )
    log.info("simulator_started", chaos_mode=settings.chaos_mode)
    count = 0
    try:
        while not stop.is_set():
            pitch = generate_pitch(rng, chaos, inning=count // 15 + 1)
            publisher.publish(pitch)
            log.info(
                "pitch_simulated",
                pitcher=pitch.pitcher_full_name,
                pitch_type=pitch.pitch_type,
                speed_mph=pitch.speed_mph,
            )
            count += 1
            health.beat(settings.heartbeat_path)
            stop.wait(settings.simulator_interval_seconds)
    finally:
        publisher.flush()


def main() -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_format)
    run(settings, install_shutdown_handler())
    return 0


if __name__ == "__main__":
    sys.exit(main())
