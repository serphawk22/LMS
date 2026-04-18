# LMS Platform Monorepo

This repository contains a production-ready monorepo architecture for a multi-tenant SaaS Learning Management System.

## Structure

- `frontend/` — Next.js 14 App Router frontend with TypeScript and TailwindCSS
- `backend/` — FastAPI backend with SQLAlchemy, JWT auth, and multi-tenant scaffolding
- `infrastructure/` — Deployment and infrastructure-as-code startup files
- `docs/` — Architecture, onboarding, and deployment guidance

## Getting Started

### Backend

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Note: when running from inside `backend/`, use `app.main:app` as the import path.
If you are in the repository root, use the root startup helper instead:

```powershell
& .\run-backend.ps1
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
