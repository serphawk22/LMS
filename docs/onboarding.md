# Onboarding

## Local development

1. Install Python and Node.js.
2. Create a Python virtual environment or use Poetry in `backend/`.
3. Install frontend dependencies with `npm install`.
4. Copy `backend/.env.example` to `.env` and fill in database and secret values.
5. Copy `frontend/.env.local.example` to `.env.local` and configure `NEXT_PUBLIC_API_URL`.

## Running locally

- Backend: `poetry run uvicorn app.main:app --reload --port 8000`
- Frontend: `npm run dev`

## Useful endpoints

- `GET /api/v1/health`
- `POST /api/v1/auth/token`
- `GET /api/v1/courses`
- `GET /api/v1/billing/plans`
