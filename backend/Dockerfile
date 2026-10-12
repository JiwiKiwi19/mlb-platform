# syntax=docker/dockerfile:1

# ---- builder: resolve and install dependencies into an isolated venv ----
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Dependencies first so source edits don't invalidate this layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY pyproject.toml .
COPY src ./src
RUN pip install --no-deps .

# ---- runtime: venv only, no build tooling, non-root ----
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    LOG_FORMAT=json \
    HEARTBEAT_PATH=/tmp/mlb-pipeline.heartbeat

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

USER app
WORKDIR /home/app

# Fails when the worker loop stops beating, not merely when the broker is reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-m", "mlb_pipeline.health", "--max-age", "300"]

# Override per service: mlb_pipeline.producer | mlb_pipeline.consumer | mlb_pipeline.simulator
CMD ["python", "-m", "mlb_pipeline.consumer"]
