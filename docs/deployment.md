# Deployment Guide

This project is a monorepo with:

- `backend/`: FastAPI + SQLAlchemy + PostgreSQL
- `frontend/`: Next.js 14 App Router
- `infrastructure/`: Terraform scaffolding

This guide documents a practical production deployment for the current codebase.

## Recommended Architecture

- Deploy the frontend on Vercel.
- Deploy the backend on Railway.
- Use PostgreSQL for the application database.
- Use AWS S3 for uploaded files in production. Avoid relying on local disk for long-term storage.
- Use the platform-provided HTTPS URLs for both frontend and backend.

## Current App Behavior To Account For

- The backend creates tables automatically on startup with `Base.metadata.create_all(...)`.
- The backend also attempts to add missing columns on startup.
- Uploaded files are served from `/uploads` when local storage is used.
- The frontend calls the backend through `NEXT_PUBLIC_API_URL`.
- CORS is controlled by the backend `allowed_origins` setting, so production frontend URLs must be added there.

## Prerequisites

- Python 3.12
- Node.js 20 or newer
- PostgreSQL database
- A production domain for the frontend
- A production domain or subdomain for the backend
- Optional:
  - AWS S3 bucket for uploads
  - Stripe keys for billing
  - OpenAI API key for AI features

## Environment Variables

Do not reuse development secrets in production. Generate new values for every production environment.

### Backend

These variables are read from `backend/.env` by `backend/app/config.py`.

Required:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ALLOWED_ORIGINS=["https://your-frontend-domain.com"]
TENANT_HEADER=x-tenant-id
ENVIRONMENT=production
DEBUG=false
```

Optional but recommended depending on enabled features:

```env
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRES_MINUTES=10080
JWT_EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES=1440
JWT_PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=30
SESSION_TIMEOUT_MINUTES=60
VIDEO_STREAM_PRESIGNED_URL_EXPIRES_SECONDS=600

STRIPE_API_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

AWS_S3_BUCKET=your-bucket-name
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

OPENAI_API_KEY=your-openai-key
```

Notes:

- `ALLOWED_ORIGINS` should include the exact production frontend origin, for example `https://lms.example.com`.
- If you do not configure S3, uploads stay on local disk under `backend/uploads`. That is fine for local development, but risky on ephemeral or autoscaled hosts.
- `DATABASE_URL` should point to PostgreSQL with SSL enabled when using managed providers.

### Frontend

Create `frontend/.env.production` or configure equivalent host-managed environment variables:

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1
NEXT_PUBLIC_TENANT_ID=optional-default-tenant-id
```

Notes:

- `NEXT_PUBLIC_API_URL` must include `/api/v1` because the frontend code uses that as the base API path.
- `NEXT_PUBLIC_TENANT_ID` is optional and mainly useful when you want a default tenant in environments without tenant selection logic.

## Backend Deployment On Railway

Railway is a good fit for this backend because it can run the FastAPI service directly and manage environment variables for you.

### 1. Install dependencies

In Railway:

- Create a new service from this GitHub repository.
- Either set the service root directory to `backend/`, or keep the repo root and use the included `railway.json`.
- Railway can detect Python automatically from the backend files.

Recommended start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Why `main:app`:

- `backend/main.py` re-exports the FastAPI app from `app.main`
- Railway injects the listening port through `$PORT`

If Railway asks for a build command, use:

```bash
pip install -r requirements.txt
```

If you deploy from the repository root and Railway shows an error like `Script start.sh not found` or says it cannot determine how to build the app:

- keep the project at the repo root
- make sure [railway.json](/abs/path/c:/Users/RACHANA/LMS/railway.json) is present
- redeploy so Railway uses the explicit backend build and start commands

### 2. Configure environment variables in Railway

Add these in the Railway service Variables tab:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ALLOWED_ORIGINS=["https://your-vercel-domain.vercel.app"]
TENANT_HEADER=x-tenant-id
ENVIRONMENT=production
DEBUG=false
```

Optional variables:

```env
STRIPE_API_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key
```

Notes:

- Replace `ALLOWED_ORIGINS` with your real Vercel frontend URL.
- If you later add a custom frontend domain, include that origin too.
- Railway provides HTTPS automatically, so your backend URL will look like `https://your-backend.up.railway.app`.

### 3. Add PostgreSQL

You have two options:

- Use Railway Postgres
- Use an external provider like Neon

If using Railway Postgres:

- Add a PostgreSQL service in the same Railway project
- Copy the generated connection string into `DATABASE_URL`
- Make sure the connection string uses the `postgresql+psycopg://` SQLAlchemy format

Example:

```bash
postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME
```

If using Neon instead, keep `?sslmode=require` in the URL.

### 4. Deploy and verify

After deploy:

- Open the Railway-generated backend URL
- Verify the health endpoint:

```text
https://your-backend.up.railway.app/api/v1/health
```

Expected response:

```json
{"status":"ok"}
```

### 5. Railway caveats

- Railway containers can be ephemeral, so do not rely on `backend/uploads` for important production files.
- Use S3 for uploads in production.
- The app performs schema creation on startup, so the database must be available when the service boots.

## Frontend Deployment On Vercel

Vercel is the best fit for the current Next.js frontend.

### 1. Install dependencies

In Vercel:

- Import the same GitHub repository
- Set the project root directory to `frontend/`
- Framework preset should detect as Next.js

### 2. Configure environment

Add this environment variable in Vercel:

```env
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app/api/v1
```

Optional:

```env
NEXT_PUBLIC_TENANT_ID=optional-default-tenant-id
```

### 3. Build settings

Recommended Vercel settings:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave default for Next.js

### 4. Deploy and verify

After Vercel deploys:

- Open the frontend URL
- Verify that API calls are going to Railway
- Test login and course pages
- Check the browser console for CORS or mixed-content errors

### 5. Vercel domain note

Your initial URL will usually look like:

```text
https://your-project.vercel.app
```

That exact origin should be included in the Railway backend `ALLOWED_ORIGINS`.

## File Storage Strategy

### Recommended for production

Use S3-compatible object storage and configure:

```env
AWS_S3_BUCKET=your-bucket
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

Why:

- Local disk storage can be lost on redeploys
- Multiple backend instances cannot safely share instance-local uploads
- Object storage is a better fit for course assets, recordings, and attachments

### If using local uploads temporarily

- Persist the `backend/uploads` directory using a mounted volume
- Make sure your reverse proxy exposes `/uploads`
- Back up uploaded files separately from the app code

## Database Notes

- The backend currently manages schema creation on startup instead of using a formal migration workflow.
- For a production team setup, adding Alembic migrations later would be safer and more predictable.
- Until then, deploy carefully and test schema-affecting changes against a staging database first.

## Vercel + Railway Deployment Order

1. Create the Railway backend service from the `backend/` directory.
2. Add database and backend environment variables in Railway.
3. Deploy Railway and verify `GET /api/v1/health`.
4. Create the Vercel frontend project from the `frontend/` directory.
5. Set `NEXT_PUBLIC_API_URL` in Vercel to the Railway backend URL plus `/api/v1`.
6. Add the Vercel frontend origin to Railway `ALLOWED_ORIGINS`.
7. Redeploy if needed and test the full app flow.

## Post-Deployment Checklist

- Backend health check works:

```text
GET https://api.your-domain.com/api/v1/health
```

- Frontend can load without CORS errors
- Authentication works
- Tenant header flow works
- Database reads and writes succeed
- File upload works
- Uploaded file URLs are reachable
- Stripe webhook endpoint is configured if billing is used
- OpenAI-backed features work if AI endpoints are enabled

## Production Recommendations

- Use separate environments for development, staging, and production
- Rotate all secrets before going live
- Never commit `.env` files with real keys
- Enable database backups
- Enable centralized logging and error monitoring
- Restrict CORS to trusted frontend domains only
- Put the backend behind HTTPS only

## Example Production Setup

- Frontend: Vercel
- Backend: Railway
- Database: Railway Postgres or Neon
- File storage: AWS S3

That is the cleanest hosted setup for this repo with minimal code changes.
