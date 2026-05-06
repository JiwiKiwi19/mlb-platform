#!/bin/bash
# Run the MLB StatCast pipeline

set -e

# Change to backend directory
cd "$(dirname "$0")/.."

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run pipeline
echo "Running pipeline..."
python -m src.main

echo "Pipeline execution complete"
