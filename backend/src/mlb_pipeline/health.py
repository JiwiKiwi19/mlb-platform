"""File-based liveness heartbeat.

Workers call ``beat()`` once per loop iteration. The container healthcheck runs
``python -m mlb_pipeline.health --max-age 180`` which fails when the file is
missing or stale, i.e. the loop is stuck rather than merely the broker being up.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from mlb_pipeline.config import get_settings


def beat(path: Path | None = None) -> None:
    (path or get_settings().heartbeat_path).touch()


def is_healthy(path: Path, max_age_seconds: float) -> bool:
    try:
        return time.time() - path.stat().st_mtime <= max_age_seconds
    except FileNotFoundError:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-age", type=float, default=180.0)
    args = parser.parse_args()
    return 0 if is_healthy(get_settings().heartbeat_path, args.max_age) else 1


if __name__ == "__main__":
    sys.exit(main())
