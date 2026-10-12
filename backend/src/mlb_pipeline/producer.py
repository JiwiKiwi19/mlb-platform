"""Poll the MLB Stats API and publish new pitches to Kafka.

Runs indefinitely as a schedule-driven loop:
  * no live game  → sleep ``idle_poll_interval_seconds`` and re-check the schedule
  * live game(s)  → poll each feed every ``live_poll_interval_seconds``
  * game goes Final → its dedup state is dropped on the next schedule check

Doubleheaders and games that cross midnight are handled because every live game
on yesterday's and today's schedule is polled.
"""

from __future__ import annotations

import sys
import threading

import requests
from confluent_kafka import Producer

from mlb_pipeline import health
from mlb_pipeline.config import Settings, get_settings
from mlb_pipeline.kafka import PitchPublisher, install_shutdown_handler, producer_config
from mlb_pipeline.log import configure_logging, get_logger
from mlb_pipeline.mlb_api import MLBStatsClient, extract_pitches

log = get_logger(__name__)


class LiveGamePoller:
    def __init__(self, client: MLBStatsClient, publisher: PitchPublisher, settings: Settings) -> None:
        self._client = client
        self._publisher = publisher
        self._settings = settings
        # Per-game memory of pitches already published; bounded by one game's pitch count.
        self._published: dict[int, set[str]] = {}

    def tick(self) -> bool:
        """Run one schedule check + feed poll. Returns True if any game is live."""
        games = self._client.games_for_team(self._settings.team_id)
        live = [g for g in games if g.is_live]

        for game_pk in set(self._published) - {g.game_pk for g in live}:
            log.info("game_tracking_stopped", game_pk=game_pk, pitches=len(self._published[game_pk]))
            del self._published[game_pk]

        for game in live:
            self._poll_game(game.game_pk)
        return bool(live)

    def _poll_game(self, game_pk: int) -> None:
        feed = self._client.live_feed(game_pk)
        seen = self._published.setdefault(game_pk, set())
        new = [p for p in extract_pitches(feed, game_pk, self._settings.team_abbreviation) if p.unique_id not in seen]
        for pitch in new:
            self._publisher.publish(pitch)
            seen.add(pitch.unique_id)
            log.info(
                "pitch_published",
                game_pk=game_pk,
                unique_id=pitch.unique_id,
                pitcher=pitch.pitcher_full_name,
                pitch_type=pitch.pitch_type,
                speed_mph=pitch.speed_mph,
            )


def run(settings: Settings, stop: threading.Event) -> None:
    publisher = PitchPublisher(
        Producer(producer_config(settings.kafka_bootstrap_servers, "mlb-live-producer")),
        settings.kafka_topic_pitches,
    )
    poller = LiveGamePoller(
        MLBStatsClient(settings.mlb_api_base_url, settings.http_timeout_seconds),
        publisher,
        settings,
    )
    log.info("producer_started", team=settings.team_abbreviation, topic=settings.kafka_topic_pitches)

    try:
        while not stop.is_set():
            try:
                any_live = poller.tick()
            except requests.RequestException as exc:
                # Transport-level retries already happened inside the session.
                log.warning("mlb_api_unavailable", error=str(exc))
                any_live = False
            health.beat(settings.heartbeat_path)
            interval = settings.live_poll_interval_seconds if any_live else settings.idle_poll_interval_seconds
            stop.wait(interval)
    finally:
        publisher.flush()
        log.info("producer_stopped", delivered=publisher.delivered, failed=publisher.failed)


def main() -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_format)
    run(settings, install_shutdown_handler())
    return 0


if __name__ == "__main__":
    sys.exit(main())
