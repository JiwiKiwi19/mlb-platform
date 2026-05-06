"""Pipeline configuration and settings."""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Streaming
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092").split(",")
KAFKA_TOPIC_PITCHES = os.getenv("KAFKA_TOPIC_PITCHES", "mlb-pitches")

# API
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 5000))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
