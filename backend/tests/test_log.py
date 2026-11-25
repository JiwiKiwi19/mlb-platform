from __future__ import annotations

import json

import structlog

from mlb_pipeline.log import configure_logging


def test_json_tracebacks_do_not_include_local_variables(capsys):
    structlog.reset_defaults()
    configure_logging("INFO", "json")
    log = structlog.get_logger("test")

    def fail(key: str) -> None:
        raise RuntimeError("boom")

    try:
        fail(key="sb_secret_do_not_log")
    except RuntimeError:
        log.exception("crashed")

    line = capsys.readouterr().out.strip().splitlines()[-1]
    assert "sb_secret_do_not_log" not in line
    record = json.loads(line)
    assert record["exception"][0]["exc_value"] == "boom"
    structlog.reset_defaults()
