# Start the backend from the repository root.
# This avoids running `poetry` from the repo root when there is no root pyproject.toml.
$repoRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$backendDir = Join-Path $repoRoot 'backend'
Set-Location -Path $backendDir

$pythonExe = Join-Path $backendDir 'venv\Scripts\python.exe'
if (Test-Path $pythonExe) {
    & $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} else {
    poetry --directory $backendDir run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}
