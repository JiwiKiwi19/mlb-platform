"""Unit tests for transform module."""
from pipeline.transform import classify_pitch_zone, STRIKE_ZONE_X_MIN, STRIKE_ZONE_X_MAX, STRIKE_ZONE_Z_MIN, STRIKE_ZONE_Z_MAX


def test_classify_pitch_zone_in_zone():
    """Test pitch classification for strike zone."""
    # Center of strike zone
    assert classify_pitch_zone(0, 2.5) == True


def test_classify_pitch_zone_out_zone():
    """Test pitch classification outside strike zone."""
    # Outside horizontal bounds
    assert classify_pitch_zone(1.5, 2.5) == False
    # Outside vertical bounds
    assert classify_pitch_zone(0, 0.5) == False


def test_classify_pitch_zone_boundaries():
    """Test pitch classification at boundaries."""
    # At boundaries (should be in zone)
    assert classify_pitch_zone(STRIKE_ZONE_X_MIN, 2.5) == True
    assert classify_pitch_zone(STRIKE_ZONE_X_MAX, 2.5) == True
    assert classify_pitch_zone(0, STRIKE_ZONE_Z_MIN) == True
    assert classify_pitch_zone(0, STRIKE_ZONE_Z_MAX) == True
