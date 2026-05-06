"""Data transformation module."""
import pandas as pd
import logging
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

# Strike zone boundaries (from MLB rule book)
STRIKE_ZONE_X_MIN = -0.83
STRIKE_ZONE_X_MAX = 0.83
STRIKE_ZONE_Z_MIN = 1.5
STRIKE_ZONE_Z_MAX = 3.5


def classify_pitch_zone(px: float, pz: float) -> bool:
    """
    Classify if a pitch is in the strike zone.
    
    Args:
        px: Horizontal position (from catcher's view)
        pz: Vertical position (height)
    
    Returns:
        True if pitch is in strike zone, False otherwise
    """
    return (
        STRIKE_ZONE_X_MIN <= px <= STRIKE_ZONE_X_MAX
        and STRIKE_ZONE_Z_MIN <= pz <= STRIKE_ZONE_Z_MAX
    )


def transform_pitch_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform and clean pitch data.
    
    Args:
        df: Raw pitch DataFrame
    
    Returns:
        Transformed DataFrame
    """
    try:
        # Select relevant columns
        required_cols = ['pitch_type', 'release_speed', 'release_spin_rate', 'pfx_x', 'pfx_z', 'plate_x', 'plate_z']
        df = df[required_cols].copy()
        
        # Add strike zone classification
        df['is_in_strike_zone'] = df.apply(
            lambda row: classify_pitch_zone(row['plate_x'], row['plate_z']),
            axis=1
        )
        
        # Clean null values
        df = df.dropna()
        
        logger.info(f"Transformed {len(df)} records")
        return df
    except Exception as e:
        logger.error(f"Error transforming data: {str(e)}")
        raise
