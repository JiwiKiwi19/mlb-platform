"""Exponential backoff with jitter for network calls."""

from __future__ import annotations

from collections.abc import Callable

from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

from mlb_pipeline.log import get_logger

log = get_logger(__name__)


def _log_retry(operation: str) -> Callable[[RetryCallState], None]:
    def before_sleep(state: RetryCallState) -> None:
        exc = state.outcome.exception() if state.outcome else None
        log.warning(
            "retrying",
            operation=operation,
            attempt=state.attempt_number,
            sleep_seconds=round(state.next_action.sleep, 2) if state.next_action else None,
            error=repr(exc),
        )

    return before_sleep


def backoff(
    operation: str,
    *,
    attempts: int = 6,
    initial: float = 0.5,
    maximum: float = 30.0,
    retry_if: Callable[[BaseException], bool] = lambda _: True,
) -> Retrying:
    """Usage: ``for attempt in backoff("op"): with attempt: do_call()``."""
    return Retrying(
        stop=stop_after_attempt(attempts),
        wait=wait_exponential_jitter(initial=initial, max=maximum),
        retry=retry_if_exception(retry_if),
        before_sleep=_log_retry(operation),
        reraise=True,
    )
