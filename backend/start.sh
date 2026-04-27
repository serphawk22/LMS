#!/bin/bash
set -e

echo "Starting LMS Backend on Render..."

# Run database migrations if needed
python -m alembic upgrade head || echo "No migrations to run"

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT