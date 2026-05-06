"""Main ETL pipeline entry point."""
import logging
import sys
from datetime import datetime, timedelta
from pipeline.extract import fetch_statcast_data
from pipeline.transform import transform_pitch_data
from pipeline.load import load_to_supabase
from config.settings import LOG_LEVEL

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_pipeline():
    """Execute the full ETL pipeline."""
    try:
        logger.info("Starting MLB StatCast pipeline...")
        
        # Set date range (last 7 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=7)
        
        # Extract
        logger.info(f"Extracting data from {start_date} to {end_date}")
        raw_data = fetch_statcast_data(str(start_date), str(end_date))
        
        # Transform
        logger.info("Transforming data...")
        transformed_data = transform_pitch_data(raw_data)
        
        # Load
        logger.info("Loading data to Supabase...")
        load_to_supabase(transformed_data, "live_pitches")
        
        logger.info("Pipeline completed successfully")
        return 0
    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = run_pipeline()
    sys.exit(exit_code)
