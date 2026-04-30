# Start the FastAPI backend from the backend directory.
# Run this from the repository root as: & .\backend\start.ps1

$backendDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
Set-Location -Path $backendDir

if (Test-Path ".\venv\Scripts\python.exe") {
    & ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
} else {
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}
