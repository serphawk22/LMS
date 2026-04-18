from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend/app can be imported as a top-level package when the project
# is started from the repository root using `uvicorn backend.app.main:app`.
# When running from inside the backend directory, use `uvicorn app.main:app` instead.
sys.path.insert(0, str(Path(__file__).resolve().parent))
