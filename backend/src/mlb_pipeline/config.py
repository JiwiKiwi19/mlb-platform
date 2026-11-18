"""Single source of truth for runtime configuration.

Values come from environment variables (case-insensitive) and, for local runs,
an optional ``.env`` file in the working directory.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Kafka
    kafka_bootstrap_servers: str = "localhost:19092"
    kafka_topic_pitches: str = "live-pitches"
    kafka_topic_dlq: str = "live-pitches.dlq"
    kafka_consumer_group: str = "mlb-supabase-loader"
    # Local Redpanda needs no auth. Managed brokers (e.g. Redpanda Cloud) use
    # KAFKA_SECURITY_PROTOCOL=SASL_SSL plus a SASL username/password.
    kafka_security_protocol: Literal["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"] = "PLAINTEXT"
    kafka_sasl_mechanism: Literal["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"] = "SCRAM-SHA-256"
    kafka_sasl_username: str | None = None
    kafka_sasl_password: SecretStr | None = None

    # Supabase (consumer only). Must be a service-role key: RLS denies anon writes.
    supabase_url: str | None = None
    supabase_key: SecretStr | None = None
    supabase_timeout_seconds: float = 10.0

    # MLB Stats API
    mlb_api_base_url: str = "https://statsapi.mlb.com"
    team_id: int = 141
    team_abbreviation: str = "TOR"
    http_timeout_seconds: float = 10.0
    live_poll_interval_seconds: float = 5.0
    idle_poll_interval_seconds: float = 120.0

    # Consumer batching
    consumer_batch_size: int = Field(default=100, ge=1, le=10_000)
    consumer_batch_timeout_seconds: float = 1.0

    # Fatigue detector
    fatigue_baseline_pitches: int = Field(default=7, ge=1)
    fatigue_recent_pitches: int = Field(default=3, ge=1)
    fatigue_drop_threshold_mph: float = Field(default=1.5, gt=0)
    fatigue_critical_drop_mph: float = Field(default=3.0, gt=0)
    fatigue_cooldown_pitches: int = Field(default=10, ge=0)

    # Simulator chaos injection
    chaos_mode: Literal["off", "random", "deterministic"] = "random"
    chaos_probability: float = Field(default=0.05, ge=0, le=1)
    chaos_fatigue_interval: int = Field(default=12, ge=1)
    chaos_fatigue_duration: int = Field(default=12, ge=1)
    simulator_interval_seconds: float = 1.5

    # Observability
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "console"] = "json"
    heartbeat_path: Path = Path("/tmp/mlb-pipeline.heartbeat")

    def kafka_connection(self) -> dict[str, str]:
        """librdkafka settings shared by every producer and consumer: broker address and auth."""
        conn = {
            "bootstrap.servers": self.kafka_bootstrap_servers,
            "security.protocol": self.kafka_security_protocol,
        }
        if self.kafka_security_protocol.startswith("SASL_"):
            if not self.kafka_sasl_username or not self.kafka_sasl_password:
                raise RuntimeError(
                    f"KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD must be set when "
                    f"KAFKA_SECURITY_PROTOCOL={self.kafka_security_protocol}"
                )
            conn |= {
                "sasl.mechanism": self.kafka_sasl_mechanism,
                "sasl.username": self.kafka_sasl_username,
                "sasl.password": self.kafka_sasl_password.get_secret_value(),
            }
        return conn

    def require_supabase(self) -> tuple[str, str]:
        if not self.supabase_url or not self.supabase_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set for the consumer")
        return self.supabase_url, self.supabase_key.get_secret_value()


@lru_cache
def get_settings() -> Settings:
    return Settings()
