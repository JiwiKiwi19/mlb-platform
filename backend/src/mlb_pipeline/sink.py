"""Supabase persistence with retries for transient failures."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from postgrest.exceptions import APIError
from supabase import ClientOptions, create_client

from mlb_pipeline.log import get_logger
from mlb_pipeline.retry import backoff
from mlb_pipeline.schemas import PitchAlert, PitchEvent

log = get_logger(__name__)

PITCHES_TABLE = "live_pitches"
ALERTS_TABLE = "pitch_alerts"

# SQLSTATE classes that will never succeed on retry: data exceptions (22),
# integrity violations (23), syntax/undefined object (42). PGRST* codes are
# PostgREST request/schema errors such as an unknown column.
_PERMANENT_SQLSTATE_CLASSES = {"22", "23", "42"}


def is_transient(exc: BaseException) -> bool:
    if isinstance(exc, APIError):
        code = str(exc.code or "")
        return not (code[:2] in _PERMANENT_SQLSTATE_CLASSES or code.startswith("PGRST"))
    return True


class PitchSink(Protocol):
    def upsert_pitches(self, pitches: Sequence[PitchEvent]) -> None: ...
    def upsert_alerts(self, alerts: Sequence[PitchAlert]) -> None: ...


class SupabaseSink:
    def __init__(self, url: str, key: str, timeout: float, attempts: int = 8) -> None:
        self._client = create_client(url, key, options=ClientOptions(postgrest_client_timeout=timeout))
        self._attempts = attempts

    def upsert_pitches(self, pitches: Sequence[PitchEvent]) -> None:
        self._upsert(PITCHES_TABLE, [p.to_row() for p in pitches])

    def upsert_alerts(self, alerts: Sequence[PitchAlert]) -> None:
        self._upsert(ALERTS_TABLE, [a.to_row() for a in alerts])

    def recent_pitches(self, since: timedelta, limit: int = 5000) -> list[dict[str, Any]]:
        """Pitches from the recent past, oldest first, for warming the fatigue detector."""
        cutoff = (datetime.now(UTC) - since).isoformat()
        for attempt in backoff("supabase.select", attempts=self._attempts, retry_if=is_transient):
            with attempt:
                response = (
                    self._client.table(PITCHES_TABLE)
                    .select("*")
                    .gte("created_at", cutoff)
                    .order("created_at")
                    .limit(limit)
                    .execute()
                )
        return list(response.data or [])

    def _upsert(self, table: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        for attempt in backoff(f"supabase.upsert.{table}", attempts=self._attempts, retry_if=is_transient):
            with attempt:
                self._client.table(table).upsert(rows, on_conflict="unique_id", returning="minimal").execute()
        log.debug("rows_upserted", table=table, count=len(rows))
