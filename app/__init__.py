from __future__ import annotations

import os
from pathlib import Path

# Allow using `uvicorn app.main:app` from the repository root by aliasing
# the backend app package path into the root package path.
PACKAGE_ROOT = Path(__file__).resolve().parent.parent
BACKEND_APP_PATH = PACKAGE_ROOT / "backend" / "app"

if BACKEND_APP_PATH.exists():
    __path__.append(str(BACKEND_APP_PATH))
