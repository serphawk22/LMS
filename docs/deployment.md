# Deployment Guide

## Backend

- Deploy the FastAPI app with Uvicorn or Gunicorn behind a load balancer.
- Use environment variables for database connection, JWT secret, AWS credentials, and payment provider keys.
- Configure Neon Postgres as the primary relational database.

## Frontend

- Build with `npm run build` and deploy the `.next` output to Vercel, Netlify, or any Node-compatible host.
- Set `NEXT_PUBLIC_API_URL` to the backend URL.

## Infrastructure

- Use Terraform or CloudFormation in `infrastructure/` to provision the Neon database, AWS S3 bucket, IAM roles, and payments secrets.
- Keep secrets in a secure vault or managed service instead of storing them directly in repo.
