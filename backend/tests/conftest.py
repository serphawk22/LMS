import sys
from pathlib import Path

# Ensure the backend package directory is on PYTHONPATH when tests are run
# from the repository root or another working directory.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
