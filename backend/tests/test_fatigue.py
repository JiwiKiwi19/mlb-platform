from __future__ import annotations

import pytest

from mlb_pipeline.fatigue import FatigueConfig, FatigueDetector

BASELINE = [95.0, 95.2, 94.8, 95.1, 94.9, 95.0, 95.0]  # mean 95.0


def feed(detector, make_pitch, speeds, **kw):
    return [detector.observe(make_pitch(speed_mph=s, **kw)) for s in speeds]


def test_no_alert_while_baseline_is_filling(make_pitch):
    detector = FatigueDetector()
    assert feed(detector, make_pitch, [90.0] * 7) == [None] * 7


def test_sustained_drop_raises_warning(make_pitch):
    detector = FatigueDetector()
    results = feed(detector, make_pitch, [*BASELINE, 93.2, 93.3, 93.1])

    assert results[:-1] == [None] * 9
    alert = results[-1]
    assert alert is not None
    assert alert.severity == "warning"
    assert alert.alert_type == "Fatigue Risk"
    assert alert.baseline_mph == pytest.approx(95.0)
    assert alert.recent_mph == pytest.approx(93.2)
    assert alert.delta_mph == pytest.approx(-1.8)
    assert "Four-Seam Fastball" in alert.message


def test_large_drop_is_critical(make_pitch):
    detector = FatigueDetector()
    alert = feed(detector, make_pitch, [*BASELINE, 91.5, 91.5, 91.5])[-1]
    assert alert is not None and alert.severity == "critical"


def test_single_dip_does_not_alert(make_pitch):
    detector = FatigueDetector()
    assert not any(feed(detector, make_pitch, [*BASELINE, 92.5, 95.0, 95.0, 95.1]))


def test_drop_below_threshold_does_not_alert(make_pitch):
    detector = FatigueDetector()
    assert not any(feed(detector, make_pitch, [*BASELINE, 93.8, 93.8, 93.8]))


def test_cooldown_suppresses_repeat_alerts_then_rearms(make_pitch):
    detector = FatigueDetector(FatigueConfig(cooldown_pitches=3))
    results = feed(detector, make_pitch, [*BASELINE] + [92.0] * 7)
    fired = [i for i, r in enumerate(results) if r is not None]
    # First alert once the recent window is full, then again after 3 cooldown pitches.
    assert fired == [9, 12]


def test_alert_id_is_deterministic_per_triggering_pitch(make_pitch):
    detector = FatigueDetector()
    feed(detector, make_pitch, [*BASELINE, 92.0, 92.0])
    alert = detector.observe(make_pitch(unique_id="trigger", speed_mph=92.0))
    assert alert is not None
    assert alert.unique_id == "fatigue:trigger"
    assert alert.pitch_unique_id == "trigger"


def test_replayed_pitch_is_ignored(make_pitch):
    detector = FatigueDetector()
    pitches = [make_pitch(speed_mph=s) for s in BASELINE]
    for p in pitches:
        detector.observe(p)
    # Replaying slow duplicates of baseline pitches must not count as recent pitches.
    for p in pitches[:3]:
        assert detector.observe(p.model_copy(update={"speed_mph": 90.0})) is None


def test_pitch_types_are_tracked_independently(make_pitch):
    detector = FatigueDetector()
    feed(detector, make_pitch, BASELINE, pitch_type="Four-Seam Fastball")
    # Sliders are naturally slower; they must not be compared to the fastball baseline.
    assert not any(feed(detector, make_pitch, [85.0] * 10, pitch_type="Slider"))


def test_each_game_gets_a_fresh_baseline(make_pitch):
    detector = FatigueDetector()
    feed(detector, make_pitch, BASELINE, game_id=1)
    assert not any(feed(detector, make_pitch, [92.0] * 9, game_id=2))


def test_other_teams_are_ignored_when_team_is_set(make_pitch):
    detector = FatigueDetector(team="TOR")
    assert not any(feed(detector, make_pitch, [*BASELINE, 90.0, 90.0, 90.0], pitcher_team="NYY"))
    assert detector.tracked_keys == 0


def test_pitches_without_speed_are_skipped(make_pitch):
    detector = FatigueDetector()
    feed(detector, make_pitch, BASELINE)
    assert detector.observe(make_pitch(speed_mph=None)) is None


def test_tracked_keys_are_bounded(make_pitch):
    detector = FatigueDetector(FatigueConfig(max_tracked_keys=5))
    for pitcher in range(20):
        detector.observe(make_pitch(pitcher_id=str(pitcher)))
    assert detector.tracked_keys == 5


def test_prime_restores_state_without_emitting(make_pitch):
    detector = FatigueDetector()
    detector.prime([make_pitch(speed_mph=s) for s in [*BASELINE, 92.0, 92.0]])
    alert = detector.observe(make_pitch(speed_mph=92.0))
    assert alert is not None
