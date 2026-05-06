"""Pitch data extraction module."""
import requests
import pandas as pd
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def fetch_statcast_data(start_date: str, end_date: str) -> pd.DataFrame:
    """
    Fetch StatCast data from public API.
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        DataFrame with StatCast data
    """
    try:
        url = f"https://baseballsavant.mlb.com/api/v1/statcast"
        params = {
            "team": "",
            "player_type": "pitcher",
            "group_by": "name",
            "min_pitches": "0",
            "min_results": "0",
            "min_abs": "0",
            "sort_by": "whiffs",
            "sort_order": "desc",
            "chaining": "off",
            "startDate": start_date,
            "endDate": end_date,
            "pageIndex": "0"
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        df = pd.DataFrame(data.get("data", []))
        
        logger.info(f"Fetched {len(df)} records from {start_date} to {end_date}")
        return df
    except Exception as e:
        logger.error(f"Error fetching StatCast data: {str(e)}")
        raise
