# MLB StatCast Pipeline Backend

Python-based ETL pipeline for processing MLB StatCast pitch data.

## Setup

```bash
pip install -r requirements.txt
```

## Usage

Run the pipeline:

```bash
bash scripts/run_pipeline.sh
```

## Structure

- `src/` - Main pipeline code
  - `main.py` - Entry point
  - `config/` - Configuration
  - `pipeline/` - ETL stages (extract, transform, load)
  - `streaming/` - Real-time data consumers/producers
  - `utils/` - Helper utilities
- `data/` - Data storage (raw and processed)
- `tests/` - Unit tests
- `scripts/` - Utility scripts
