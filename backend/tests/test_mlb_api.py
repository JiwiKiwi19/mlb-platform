from __future__ import annotations

from datetime import date

import pytest

from mlb_pipeline.mlb_api import MLBStatsClient, extract_pitches, parse_schedule


def pitch_event(number: int, speed: float | None = 95.1, *, is_pitch: bool = True) -> dict:
    return {
        "isPitch": is_pitch,
        "pitchNumber": number,
        "startTime": "2026-07-01T23:05:00.000Z",
        "details": {"type": {"description": "Four-Seam Fastball"}},
        "pitchData": {"startSpeed": speed, "coordinates": {"pX": 0.2, "pZ": 2.4}},
    }


def play(at_bat: int, half: str, pitcher_id: int, events: list[dict]) -> dict:
    return {
        "about": {"atBatIndex": at_bat, "halfInning": half, "inning": 3},
        "matchup": {"pitcher": {"id": pitcher_id, "fullName": f"Pitcher {pitcher_id}"}},
        "playEvents": events,
    }


@pytest.fixture
def feed() -> dict:
    return {
        "gameData": {
            "teams": {"home": {"abbreviation": "TOR"}, "away": {"abbreviation": "NYY"}},
            "players": {"ID592332": {"firstName": "Kevin", "lastName": "Gausman"}},
        },
        "liveData": {
            "plays": {
                "allPlays": [
                    # Top half: home team (TOR) pitches.
                    play(0, "top", 592332, [pitch_event(1), pitch_event(2, speed=0), pitch_event(3, is_pitch=False)]),
                    # Bottom half: away team (NYY) pitches — must be filtered out.
                    play(1, "bottom", 543037, [pitch_event(1)]),
                ]
            }
        },
    }


def test_extract_pitches_keeps_only_team_pitches(feed):
    pitches = extract_pitches(feed, 745123, "TOR")
    assert [p.unique_id for p in pitches] == ["745123_0_1", "745123_0_2"]


def test_extract_pitches_maps_fields(feed):
    first = extract_pitches(feed, 745123, "TOR")[0]
    assert first.game_id == 745123
    assert first.pitcher_id == "592332"
    assert first.pitcher_full_name == "Pitcher 592332"
    assert first.pitcher_last_name == "Gausman"
    assert first.speed_mph == 95.1
    assert (first.zone_x, first.zone_z) == (0.2, 2.4)
    assert first.inning == 3
    assert first.timestamp.isoformat() == "2026-07-01T23:05:00+00:00"


def test_unmeasured_speed_becomes_none(feed):
    assert extract_pitches(feed, 745123, "TOR")[1].speed_mph is None


def test_away_team_perspective(feed):
    pitches = extract_pitches(feed, 745123, "NYY")
    assert [p.pitcher_id for p in pitches] == ["543037"]


def test_empty_feed_yields_nothing():
    assert extract_pitches({}, 1, "TOR") == []


def test_parse_schedule_handles_doubleheaders():
    data = {
        "dates": [
            {
                "games": [
                    {"gamePk": 1, "status": {"abstractGameState": "Final", "detailedState": "Final"}},
                    {"gamePk": 2, "status": {"abstractGameState": "Live", "detailedState": "In Progress"}},
                ]
            }
        ]
    }
    games = parse_schedule(data)
    assert [(g.game_pk, g.is_live) for g in games] == [(1, False), (2, True)]


def test_schedule_query_spans_yesterday_and_today():
    class FakeResponse:
        def raise_for_status(self) -> None: ...
        def json(self) -> dict:
            return {"dates": []}

    class FakeSession:
        def get(self, url, params=None, timeout=None):
            self.url, self.params, self.timeout = url, params, timeout
            return FakeResponse()

    session = FakeSession()
    client = MLBStatsClient("https://statsapi.mlb.com/", timeout=7, session=session)
    assert client.games_for_team(141, today=date(2026, 7, 2)) == []
    assert session.url == "https://statsapi.mlb.com/api/v1/schedule"
    assert session.params["startDate"] == "2026-07-01"
    assert session.params["endDate"] == "2026-07-02"
    assert session.timeout == 7
