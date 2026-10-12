from __future__ import annotations

from mlb_pipeline.config import Settings
from mlb_pipeline.kafka import PitchPublisher, partition_key
from mlb_pipeline.mlb_api import GameRef
from mlb_pipeline.producer import LiveGamePoller
from mlb_pipeline.schemas import PitchEvent


class FakeProducer:
    def __init__(self, buffer_errors: int = 0) -> None:
        self.produced: list[dict] = []
        self.polls = 0
        self._buffer_errors = buffer_errors

    def produce(self, topic, key=None, value=None, headers=None, on_delivery=None):
        if self._buffer_errors:
            self._buffer_errors -= 1
            raise BufferError
        self.produced.append({"topic": topic, "key": key, "value": value, "headers": headers, "cb": on_delivery})

    def poll(self, _timeout):
        self.polls += 1

    def flush(self, _timeout):
        return 0


class FakeMsg:
    def topic(self):
        return "live-pitches"

    def key(self):
        return b"k"


def test_publish_uses_pitcher_key_and_schema_header(make_pitch):
    producer = FakeProducer()
    pitch = make_pitch(game_id=7, pitcher_id="42")
    PitchPublisher(producer, "live-pitches").publish(pitch)

    sent = producer.produced[0]
    assert sent["key"] == b"7:42" == partition_key(pitch)
    assert sent["headers"] == {"schema_version": "1"}
    assert PitchEvent.model_validate_json(sent["value"]) == pitch


def test_publish_retries_when_local_queue_is_full(make_pitch):
    producer = FakeProducer(buffer_errors=2)
    PitchPublisher(producer, "t").publish(make_pitch())
    assert len(producer.produced) == 1
    assert producer.polls >= 3  # two drain polls + the post-produce poll


def test_delivery_callback_counts_outcomes(make_pitch):
    producer = FakeProducer()
    publisher = PitchPublisher(producer, "t")
    publisher.publish(make_pitch())
    callback = producer.produced[0]["cb"]

    callback(None, FakeMsg())
    callback("broker down", FakeMsg())
    assert (publisher.delivered, publisher.failed) == (1, 1)


class FakeClient:
    def __init__(self, games: list[GameRef], feeds: dict[int, list[PitchEvent]]) -> None:
        self.games = games
        self.feeds = feeds

    def games_for_team(self, _team_id):
        return self.games

    def live_feed(self, game_pk):
        return {"pitches": self.feeds.get(game_pk, [])}


class RecordingPublisher:
    def __init__(self) -> None:
        self.published: list[PitchEvent] = []

    def publish(self, event):
        self.published.append(event)


def make_poller(monkeypatch, client, publisher):
    monkeypatch.setattr("mlb_pipeline.producer.extract_pitches", lambda feed, _pk, _team: feed["pitches"])
    return LiveGamePoller(client, publisher, Settings(_env_file=None))


def test_poller_publishes_only_new_pitches(monkeypatch, make_pitch):
    p1, p2 = make_pitch(game_id=1), make_pitch(game_id=1)
    client = FakeClient([GameRef(1, "Live", "In Progress")], {1: [p1]})
    publisher = RecordingPublisher()
    poller = make_poller(monkeypatch, client, publisher)

    assert poller.tick() is True
    client.feeds[1] = [p1, p2]
    poller.tick()

    assert publisher.published == [p1, p2]


def test_poller_idles_without_live_games_and_polls_doubleheaders(monkeypatch, make_pitch):
    a, b = make_pitch(game_id=1), make_pitch(game_id=2)
    client = FakeClient([GameRef(1, "Preview", "Scheduled")], {1: [a], 2: [b]})
    publisher = RecordingPublisher()
    poller = make_poller(monkeypatch, client, publisher)

    assert poller.tick() is False
    assert publisher.published == []

    client.games = [GameRef(1, "Live", "In Progress"), GameRef(2, "Live", "In Progress")]
    poller.tick()
    assert {p.game_id for p in publisher.published} == {1, 2}


def test_finished_games_release_dedup_state(monkeypatch, make_pitch):
    pitch = make_pitch(game_id=1)
    client = FakeClient([GameRef(1, "Live", "In Progress")], {1: [pitch]})
    poller = make_poller(monkeypatch, client, RecordingPublisher())
    poller.tick()
    assert poller._published

    client.games = [GameRef(1, "Final", "Final")]
    poller.tick()
    assert poller._published == {}
