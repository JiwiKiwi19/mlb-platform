"""MLB Stats API client and live-feed → ``PitchEvent`` mapping."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import requests
from pydantic import ValidationError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from mlb_pipeline.log import get_logger
from mlb_pipeline.schemas import PitchEvent

log = get_logger(__name__)

# MLB schedules by Eastern time; a 10pm PT start is still "yesterday" after midnight ET.
MLB_TIMEZONE = ZoneInfo("America/New_York")


@dataclass(frozen=True)
class GameRef:
    game_pk: int
    abstract_state: str  # "Preview" | "Live" | "Final"
    detailed_state: str

    @property
    def is_live(self) -> bool:
        return self.abstract_state == "Live"


def build_session(total_retries: int = 4) -> requests.Session:
    retry = Retry(
        total=total_retries,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers["User-Agent"] = "mlb-stat-pipeline/1.0"
    return session


class MLBStatsClient:
    def __init__(self, base_url: str, timeout: float, session: requests.Session | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._session = session or build_session()

    def games_for_team(self, team_id: int, today: date | None = None) -> list[GameRef]:
        """Games for yesterday and today (ET), so late games survive midnight."""
        today = today or datetime.now(MLB_TIMEZONE).date()
        data = self._get(
            "/api/v1/schedule",
            params={
                "sportId": 1,
                "teamId": team_id,
                "startDate": (today - timedelta(days=1)).isoformat(),
                "endDate": today.isoformat(),
            },
        )
        return parse_schedule(data)

    def live_feed(self, game_pk: int) -> dict[str, Any]:
        return self._get(f"/api/v1.1/game/{game_pk}/feed/live")

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self._session.get(f"{self._base_url}{path}", params=params, timeout=self._timeout)
        response.raise_for_status()
        return response.json()


def parse_schedule(data: dict[str, Any]) -> list[GameRef]:
    games: list[GameRef] = []
    for day in data.get("dates", []):
        for game in day.get("games", []):
            status = game.get("status", {})
            games.append(
                GameRef(
                    game_pk=int(game["gamePk"]),
                    abstract_state=status.get("abstractGameState", "Unknown"),
                    detailed_state=status.get("detailedState", "Unknown"),
                )
            )
    return games


def extract_pitches(feed: dict[str, Any], game_pk: int, team_abbreviation: str) -> list[PitchEvent]:
    """All pitches thrown by ``team_abbreviation`` in a live-feed payload, in order."""
    game_data = feed.get("gameData", {})
    teams = game_data.get("teams", {})
    home = teams.get("home", {}).get("abbreviation")
    away = teams.get("away", {}).get("abbreviation")
    players = game_data.get("players", {})

    events: list[PitchEvent] = []
    for play in feed.get("liveData", {}).get("plays", {}).get("allPlays", []):
        about = play.get("about", {})
        # The home team pitches in the top half.
        pitching_team = home if about.get("halfInning", "top").lower() == "top" else away
        if pitching_team != team_abbreviation:
            continue

        pitcher = play.get("matchup", {}).get("pitcher", {})
        pitcher_id = pitcher.get("id")
        if pitcher_id is None:
            continue
        profile = players.get(f"ID{pitcher_id}", {})

        for pitch in play.get("playEvents", []):
            if not pitch.get("isPitch"):
                continue
            pitch_data = pitch.get("pitchData", {})
            coordinates = pitch_data.get("coordinates", {})
            unique_id = f"{game_pk}_{about.get('atBatIndex', 0)}_{pitch.get('pitchNumber', 0)}"
            try:
                events.append(
                    PitchEvent(
                        game_id=game_pk,
                        unique_id=unique_id,
                        pitch_type=pitch.get("details", {}).get("type", {}).get("description") or "Unknown",
                        speed_mph=pitch_data.get("startSpeed"),
                        zone_x=coordinates.get("pX"),
                        zone_z=coordinates.get("pZ"),
                        pitcher_team=pitching_team,
                        pitcher_id=str(pitcher_id),
                        pitcher_full_name=pitcher.get("fullName") or "Unknown",
                        pitcher_first_name=profile.get("firstName"),
                        pitcher_last_name=profile.get("lastName"),
                        inning=about.get("inning"),
                        timestamp=pitch.get("startTime") or datetime.now(UTC),
                    )
                )
            except ValidationError as exc:
                log.warning("pitch_skipped_invalid", unique_id=unique_id, errors=exc.errors(include_url=False))
    return events
