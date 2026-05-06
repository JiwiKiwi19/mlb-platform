# MLB StatCast Pipeline

A full-stack real-time MLB StatCast pitch data visualization platform.

## Architecture

- **Frontend**: Next.js 14 with React, TailwindCSS - Real-time pitch visualization dashboard
- **Backend**: Python ETL pipeline with Flask API - Data extraction, transformation, loading
- **Streaming**: Apache Kafka - Real-time event streaming
- **Database**: Supabase (PostgreSQL) - Pitch data storage and real-time subscriptions

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.10+ (for local backend development)
- Supabase project (for database)

### Environment Setup

Create a `.env.local` file in the project root:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
KAFKA_BROKERS=kafka:9092
```

### Running with Docker Compose

```bash
docker-compose up --build
```

Access the application at `http://localhost:3000`

### Local Development

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Backend:**

```bash
cd backend
pip install -r requirements.txt
python -m src.main
```

## Project Structure

```
mlb-platform/
├── frontend/              # Next.js dashboard
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and types
│   └── package.json
├── backend/              # Python ETL pipeline
│   ├── src/              # Pipeline source code
│   │   ├── config/       # Configuration
│   │   ├── pipeline/     # ETL stages
│   │   ├── streaming/    # Kafka producers/consumers
│   │   └── main.py       # Entry point
│   ├── tests/            # Unit tests
│   ├── scripts/          # Utility scripts
│   └── requirements.txt
├── docker-compose.yml    # Service orchestration
└── README.md
```

## Key Features

- **Real-time Pitch Visualization**: Live strike zone display with pitch location accuracy
- **Statistical Dashboard**: Velocity, zone effectiveness, pitch type distributions
- **Data Pipeline**: Automated StatCast data extraction and transformation
- **Streaming Architecture**: Kafka-based event streaming for scalability
- **Responsive UI**: Mobile-friendly web interface

## Data Model

### Pitch Schema

| Field             | Type      | Description                       |
| ----------------- | --------- | --------------------------------- |
| pitch_id          | string    | Unique pitch identifier           |
| pitch_type        | string    | Type of pitch (FF, SL, etc.)      |
| release_speed     | float     | Pitch velocity (mph)              |
| plate_x           | float     | Horizontal position at plate (ft) |
| plate_z           | float     | Vertical position at plate (ft)   |
| is_in_strike_zone | boolean   | Classification result             |
| created_at        | timestamp | Data creation time                |

## API Endpoints

### GET /api/pitches

Fetch latest pitches from database

### GET /api/stats

Get aggregated pitcher statistics

### POST /api/stream

WebSocket endpoint for real-time pitch updates

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT
