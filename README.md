# ⚾ MLB StatCast Live Analytics Platform

> A production-grade, event-driven data lakehouse for real-time MLB pitch intelligence — built on Kafka, Supabase, and Next.js.

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=next.js&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Kafka](https://img.shields.io/badge/Redpanda_Kafka-E50695?style=flat-square&logo=apachekafka&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

---

## Overview

The MLB StatCast Live Analytics Platform is a full-stack, real-time data engineering project that ingests live pitch data from the MLB Stats API, streams it through a Kafka-based message bus, enriches it with a Python intelligence engine, and delivers it to a live web dashboard — all with sub-second latency.

This project demonstrates end-to-end data engineering across the full lakehouse stack: event streaming, real-time transformation, analytical storage, and live UI delivery via WebSockets.

---

## Architecture

```
MLB Stats API / Fake Simulator
        │
        ▼
  Redpanda (Kafka)          ← topic: live-pitches
  [Producer]
        │
        ▼
  Python Consumer           ← Real-time enrichment & analytics
  - Strike zone classification
  - Velocity anomaly detection (fatigue alerts)
  - Timestamp normalization
        │
        ▼
  Supabase (PostgreSQL)     ← Persistent storage + Realtime engine
        │
        ▼
  Next.js 14 Dashboard      ← Server-side fetch + WebSocket subscriptions
  - Live strike zone SVG
  - Pitch velocity trend chart
  - Real-time pitch table
  - KPI metric cards
```

---

## Features

### 🔴 Real-Time Event Streaming
- **Redpanda (Kafka-compatible)** message broker ingesting live MLB pitch events at ~1 pitch/1.5 seconds
- Stateful Python producer polling the MLB Stats API every 5 seconds, deduplicating pitches in memory to guarantee exactly-once delivery
- Fake simulator for local development that injects synthetic pitch data with chaos engineering — controlled fatigue anomalies and velocity spikes to stress-test the intelligence engine

### 🧠 Intelligence Engine
- Real-time strike zone classification using official MLB rulebook coordinates (`±0.83 ft` horizontal, `1.5–3.5 ft` vertical)
- Velocity anomaly detection: tracks rolling pitch velocity history per pitcher per pitch type, fires fatigue alerts when a >1.5 mph drop is detected across a 10-pitch window
- Safe upsert pattern with automatic column introspection — dynamically retries on schema mismatch without crashing the consumer

### 🗄️ Data Lakehouse (Supabase)
- PostgreSQL backend with structured `live_pitches` schema storing spatial coordinates, pitch metadata, and enriched zone evaluations
- Supabase Realtime WebSocket subscriptions push `INSERT` events directly to the frontend — zero polling
- Idempotent upsert strategy on `unique_id` prevents duplicate rows from replayed Kafka offsets

### 📊 Live Dashboard (Next.js 14)
- **Strike zone visualizer**: SVG-based catcher's-view diagram accumulating pitch history, color-coded red (strikes) and blue (balls), with the latest pitch glowing
- **Velocity trend chart**: Recharts area chart tracking pitch speed across the session, dynamically scaled per pitch type
- **Live pitch table**: Real-time prepending rows via Supabase WebSocket subscription — no page refresh required
- **KPI cards**: Top velocity, zone accuracy %, total pitches processed, ingestion latency
- **Stream presence detection**: Live feed section appears/disappears automatically based on consumer heartbeat — 10-second timeout with "Stream Offline" fallback state

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Recharts |
| **Realtime** | Supabase WebSockets (`postgres_changes`) |
| **Database** | Supabase PostgreSQL |
| **Message Broker** | Redpanda (Kafka-compatible) |
| **Stream Producer** | Python 3.10, `confluent-kafka`, MLB Stats API |
| **Stream Consumer** | Python 3.10, `confluent-kafka`, `supabase-py` |
| **Intelligence** | NumPy — rolling velocity stats, anomaly detection |
| **Containerization** | Docker, Docker Compose |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com) project

### 1. Clone the repo

```bash
git clone https://github.com/your-username/mlb-stat-pipeline.git
cd mlb-stat-pipeline
```

### 2. Configure environment variables

Create `mlb-platform/frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `mlb-platform/backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

### 3. Set up Supabase

Run this in your Supabase SQL Editor to create the `live_pitches` table:

```sql
CREATE TABLE live_pitches (
  id              BIGSERIAL PRIMARY KEY,
  game_id         INTEGER,
  unique_id       TEXT UNIQUE,
  pitch_type      TEXT,
  speed_mph       FLOAT,
  zone_x          FLOAT,
  zone_z          FLOAT,
  zone_eval       TEXT,
  pitcher_id      TEXT,
  pitcher_full_name TEXT,
  pitcher_first_name TEXT,
  pitcher_last_name  TEXT,
  pitcher_team    TEXT,
  timestamp       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE live_pitches DISABLE ROW LEVEL SECURITY;
```

Then enable Realtime: **Supabase Dashboard → Database → Replication → toggle `live_pitches` ON**.

### 4. Start the frontend

```bash
cd mlb-platform/frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

### 5. Start the streaming pipeline

In one terminal, start the Redpanda broker (via Docker):

```bash
docker-compose up kafka
```

In another terminal, start the fake simulator:

```bash
cd mlb-platform/backend
pip install -r requirements.txt
python -m src.streaming.fake_simulator
```

In another terminal, start the consumer:

```bash
python -m src.streaming.consumer
```

Watch pitches appear on the dashboard in real time.

### Live game mode (Blue Jays only)

On a day the Blue Jays are playing, swap the simulator for the live producer:

```bash
python -m src.streaming.producer
```

The producer auto-detects today's game, filters for Toronto pitching appearances, and streams live StatCast pitch events.

---

## Data Schema

| Field | Type | Description |
|---|---|---|
| `unique_id` | `TEXT` | Deduplication key (game + at-bat + pitch index) |
| `pitch_type` | `TEXT` | Four-Seam Fastball, Slider, Curveball, etc. |
| `speed_mph` | `FLOAT` | Release velocity in mph |
| `zone_x` | `FLOAT` | Horizontal plate position (ft, catcher's view) |
| `zone_z` | `FLOAT` | Vertical plate position (ft) |
| `zone_eval` | `TEXT` | `IN ZONE` or `OUT OF ZONE` |
| `pitcher_full_name` | `TEXT` | Pitcher display name |
| `pitcher_team` | `TEXT` | Team abbreviation |
| `timestamp` | `TIMESTAMPTZ` | Event time (UTC) |

---

## Project Structure

```
mlb-platform/
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Server component — SSR data fetch
│   │   └── globals.css
│   ├── components/
│   │   ├── live-feed.tsx         # Realtime WebSocket consumer + stream presence
│   │   ├── strike-zone.tsx       # SVG pitch location visualizer
│   │   ├── pitch-table.tsx       # Live-updating pitch log
│   │   ├── velocity-chart.tsx    # Recharts area chart
│   │   └── metric-card.tsx       # KPI cards
│   └── lib/types.ts
├── backend/
│   └── src/
│       ├── streaming/
│       │   ├── producer.py       # MLB Stats API → Kafka
│       │   ├── consumer.py       # Kafka → Supabase + intelligence engine
│       │   └── fake_simulator.py # Synthetic data + chaos injection
│       └── pipeline/
│           ├── extract.py        # StatCast batch extraction
│           ├── transform.py      # Strike zone classification
│           └── load.py           # Supabase batch loader
└── docker-compose.yml
```

---

## Key Engineering Decisions

**Why Kafka (Redpanda)?** Decouples the producer from the consumer, enabling the intelligence engine to process, enrich, and route events independently. Redpanda was chosen for its Kafka API compatibility with zero ZooKeeper overhead.

**Why Supabase Realtime over a REST polling loop?** WebSocket push eliminates client polling entirely. The dashboard reacts to database `INSERT` events in under 100ms — matching the latency profile of a real sports broadcast.

**Why server components for the initial fetch?** Next.js 14 App Router server components load the historical pitch snapshot at request time, avoiding a loading flash on first paint. Client components then take over for live updates.

**Why idempotent upserts?** The MLB Stats API occasionally returns the same pitch across polling cycles. Upserting on `unique_id` guarantees the database stays consistent regardless of how many times the producer fires the same event.

---

## License

MIT
