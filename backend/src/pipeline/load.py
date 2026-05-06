"""Data loading module."""
import logging
from supabase import create_client
from config.settings import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)


def load_to_supabase(df, table_name: str):
    """
    Load transformed data to Supabase.
    
    Args:
        df: DataFrame with pitch data
        table_name: Target table name in Supabase
    """
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Convert DataFrame to list of dicts
        records = df.to_dict('records')
        
        # Insert in batches
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            response = supabase.table(table_name).insert(batch).execute()
            logger.info(f"Loaded batch {i // batch_size + 1}")
        
        logger.info(f"Successfully loaded {len(records)} records to {table_name}")
    except Exception as e:
        logger.error(f"Error loading data to Supabase: {str(e)}")
        raise
