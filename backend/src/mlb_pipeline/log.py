"""Structured logging setup shared by every entry point."""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]
    if fmt == "json":
        processors += [structlog.processors.dict_tracebacks, structlog.processors.JSONRenderer()]
    else:
        processors += [structlog.dev.ConsoleRenderer()]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level)),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Third-party libraries log through stdlib; keep them quiet unless something is wrong.
    logging.basicConfig(level=logging.WARNING, stream=sys.stdout, format="%(levelname)s %(name)s %(message)s")


def get_logger(name: str) -> structlog.typing.FilteringBoundLogger:
    return structlog.get_logger(name)
