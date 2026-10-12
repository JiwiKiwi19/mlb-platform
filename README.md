# ⚾ MLB StatCast Live Analytics Platform

> Event-driven, real-time MLB pitch intelligence — MLB Stats API → Kafka (Redpanda) → Python intelligence engine → Supabase → Next.js live dashboard.

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=next.js&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![Kafka](https://img.shields.io/badge/Redpanda_Kafka-E50695?style=flat-square&logo=apachekafka&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

---

## Architecture

```
MLB Stats API ──► producer ─┐                              ┌──► live-pitches.dlq (invalid messages)
                            ├──► Redpanda: live-pitches ──► consumer ──► Supabase Postgres ──► Realtime ──► Next.js
simulator (optional) ───────┘    (3 partitions,              • schema validation    (live_pitches,     (one WebSocket
                                  key = game:pitcher)         • zone classification   pitch_alerts)      channel per tab)
                                                              • fatigue detection
```

| Component | Responsibility                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producer  | Follows the team's schedule (yesterday + today, ET). Idles when no game is live; polls every live game's feed (doubleheaders included) and publishes each new pitch once.           |
| Consumer  | Validates each message against the `PitchEvent` contract, batch-upserts to Supabase, runs the fatigue detector, then commits offsets. Invalid messages go to the dead-letter topic. |
| Simulator | Synthetic pitches with chaos-injected fatigue episodes, for demos and local development.                                                                                           |
| Dashboard | Server-renders the latest 50 pitches, then keeps them live over a single Supabase Realtime channel shared by every widget.                                                          |

---

## Reliability model

**Delivery semantics: at-least-once, idempotent sink.**

- The producer is idempotent (`enable.idempotence`, `acks=all`). Delivery failures surface through delivery callbacks, and back-pressure is handled.
- The consumer commits offsets **only after** the batch is written. A crash re-delivers the batch.
- Writes upsert on `unique_id`, and alert IDs are deterministic (`fatigue:<pitch id>`), so a redelivered batch changes nothing.
- Messages are keyed by `game:pitcher`, so each pitcher's pitches stay ordered within a partition. The fatigue detector depends on that ordering.

**Failure handling**

| Failure                                            | Behaviour                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| MLB API errors / 429 / 5xx                         | urllib3 retries with backoff (honours `Retry-After`); the loop logs and tries again next tick |
| Supabase transient error (network, 5xx, timeout)   | Exponential backoff with jitter (tenacity), 8 attempts                                        |
| Supabase permanent error (schema drift, constraint) | Fails immediately and loudly; offsets are not committed                                      |
| Retries exhausted                                  | Consumer exits non-zero → Docker restarts it → batch is reprocessed                           |
| Malformed / unknown-version message                | Forwarded to `live-pitches.dlq` with the validation error in a header, then committed         |
| Worker loop stuck                                  | Heartbeat file goes stale → container healthcheck fails                                       |
| Consumer restart mid-game                          | Fatigue baselines are re-primed from the last 12h of `live_pitches`                           |

## Fatigue detector

For each **(game, pitcher, pitch type)** the detector works in three steps:

1. It freezes a baseline from the first 7 pitches of that pitch type in the outing.
2. It compares that baseline against a rolling mean of the latest 3 pitches.
3. It raises an alert when the drop is ≥ 1.5 mph. A drop of ≥ 3.0 mph is marked critical.

After an alert, a 10-pitch cooldown prevents repeat alerts while velocity stays down. Memory is bounded: each key keeps a fixed-size window, and the number of keys is capped with LRU eviction. All thresholds can be changed through environment variables (see [Configuration](#configuration)).

---

## Getting started

### Prerequisites

- Docker with Compose v2
- A [Supabase](https://supabase.com) project
- For local development: Node.js 20.18+ (22 LTS recommended) and Python 3.12

### 1. Create the database schema

Apply [`supabase/migrations/`](supabase/migrations/) with `supabase db push`, or paste the files into the SQL Editor in order.

The migration does three things:

- creates `live_pitches` and `pitch_alerts`
- adds both tables to the `supabase_realtime` publication
- enables Row Level Security, with **read-only** access for the `anon` role

> **Never disable RLS.** The anon key ships to every browser. Without RLS, anyone who has it can modify or delete data. Only the backend's service-role key can write.

### 2. Configure environment

Create `mlb-platform/.env`, which Docker Compose reads automatically:

```env
# Consumer: must be the service-role key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Frontend: inlined into the browser bundle at build time
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`.env` files are git-ignored and excluded from every Docker build context.

### 3. Run the stack

```bash
docker compose up -d --build                        # live MLB feed
docker compose --profile simulator up -d --build    # also stream synthetic pitches
```

| Service          | URL                    |
| ---------------- | ---------------------- |
| Dashboard        | http://localhost:3005  |
| Redpanda Console | http://localhost:8080  |
| Schema Registry  | http://localhost:18081 |

```bash
docker compose ps                 # health status of every service
docker compose logs -f consumer   # structured JSON logs
```

---

## Local development

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt && pip install -e .

export KAFKA_BOOTSTRAP_SERVERS=localhost:19092 LOG_FORMAT=console
python -m mlb_pipeline.simulator     # or: python -m mlb_pipeline.producer
python -m mlb_pipeline.consumer      # reads SUPABASE_URL / SUPABASE_KEY from backend/.env

pytest --cov                          # unit tests
ruff check src tests && ruff format --check src tests
python -m mlb_pipeline.schemas        # print the PitchEvent JSON Schema
```

### Frontend

```bash
cd frontend
npm ci
npm run dev            # http://localhost:3000, reads frontend/.env.local
npm test               # Vitest + React Testing Library
npm run lint && npm run typecheck && npm run format:check
```

CI runs all of these checks, plus Docker image builds, on every push and pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

---

## Configuration

Backend settings come from environment variables and are matched case-insensitively. They are defined in [`backend/src/mlb_pipeline/config.py`](backend/src/mlb_pipeline/config.py).

| Variable                        | Default                           | Used by            |
| ------------------------------- | --------------------------------- | ------------------ |
| `KAFKA_BOOTSTRAP_SERVERS`       | `localhost:19092`                 | all                |
| `KAFKA_TOPIC_PITCHES`           | `live-pitches`                    | all                |
| `KAFKA_TOPIC_DLQ`               | `live-pitches.dlq`                | consumer           |
| `KAFKA_CONSUMER_GROUP`          | `mlb-supabase-loader`             | consumer           |
| `SUPABASE_URL` / `SUPABASE_KEY` | —                                 | consumer           |
| `TEAM_ID` / `TEAM_ABBREVIATION` | `141` / `TOR`                     | producer, consumer |
| `LIVE_POLL_INTERVAL_SECONDS`    | `5`                               | producer           |
| `IDLE_POLL_INTERVAL_SECONDS`    | `120`                             | producer           |
| `CONSUMER_BATCH_SIZE`           | `100`                             | consumer           |
| `FATIGUE_BASELINE_PITCHES`      | `7`                               | consumer           |
| `FATIGUE_RECENT_PITCHES`        | `3`                               | consumer           |
| `FATIGUE_DROP_THRESHOLD_MPH`    | `1.5`                             | consumer           |
| `FATIGUE_CRITICAL_DROP_MPH`     | `3.0`                             | consumer           |
| `FATIGUE_COOLDOWN_PITCHES`      | `10`                              | consumer           |
| `CHAOS_MODE`                    | `random` (`off`, `deterministic`) | simulator          |
| `CHAOS_PROBABILITY`             | `0.05`                            | simulator          |
| `CHAOS_FATIGUE_DURATION`        | `12`                              | simulator          |
| `LOG_LEVEL` / `LOG_FORMAT`      | `INFO` / `json`                   | all                |

---

## Message contract

`PitchEvent` ([`schemas.py`](backend/src/mlb_pipeline/schemas.py)) is the schema for the `live-pitches` topic. Every message carries `schema_version` in both the payload and a Kafka header.

- **Breaking changes** bump the version. Consumers send versions they don't recognise to the DLQ instead of guessing at the format.
- **Legacy messages** from the older producer (epoch timestamps, `0` meaning "not measured") are still accepted.

| Field              | Type                 | Notes                                             |
| ------------------ | -------------------- | ------------------------------------------------- |
| `schema_version`   | `1`                  |                                                   |
| `game_id`          | int                  | MLB `gamePk`                                      |
| `unique_id`        | string               | `{gamePk}_{atBatIndex}_{pitchNumber}`; upsert key |
| `pitch_type`       | string               | e.g. Four-Seam Fastball                           |
| `speed_mph`        | float \| null        | `null` when not measured                          |
| `zone_x`, `zone_z` | float \| null        | plate location in feet (catcher's view)           |
| `pitcher_*`        | string               | id, team, full/first/last name                    |
| `inning`           | int \| null          |                                                   |
| `timestamp`        | ISO-8601 with offset | pitch start time from the MLB feed                |

The consumer adds `zone_eval` (`IN ZONE` / `OUT OF ZONE` / `Unknown`) before writing.

---

## Project structure

```
mlb-platform/
├── backend/
│   ├── src/mlb_pipeline/
│   │   ├── producer.py        # schedule-driven MLB API poller → Kafka
│   │   ├── consumer.py        # Kafka → validate → Supabase → alerts; DLQ; manual commits
│   │   ├── simulator.py       # synthetic stream + chaos fatigue episodes
│   │   ├── fatigue.py         # bounded, pure fatigue detector
│   │   ├── schemas.py         # PitchEvent / PitchAlert contracts
│   │   ├── mlb_api.py         # HTTP client + feed → PitchEvent mapping
│   │   ├── sink.py            # Supabase upserts with transient/permanent error split
│   │   ├── kafka.py           # client configs, publisher, shutdown handling
│   │   └── config.py · log.py · retry.py · health.py · zone.py
│   ├── tests/                 # pytest suite
│   ├── Dockerfile             # multi-stage, non-root, heartbeat healthcheck
│   └── pyproject.toml
├── frontend/
│   ├── app/                   # server components; layout hosts the realtime provider
│   ├── components/
│   │   ├── providers/live-pitches-provider.tsx  # single channel, backfill, status
│   │   ├── live.tsx, live-velocity-chart.tsx    # connected widgets
│   │   ├── pitch-table.tsx, velocity-chart.tsx, strike-zone.tsx  # presentational
│   │   └── connection-badge.tsx
│   ├── lib/
│   │   ├── types.ts           # row types mirroring the migration
│   │   ├── pitches.ts         # parsing, merge/dedupe, stats, formatting
│   │   └── supabase/          # browser + server clients
│   └── Dockerfile             # standalone output, non-root
├── supabase/migrations/       # schema, RLS, realtime publication
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## License
