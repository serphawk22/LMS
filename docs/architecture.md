# Architecture Overview

## Goal

Build a production-grade multi-tenant SaaS Learning Management System with a clean monorepo architecture for frontend, backend, infrastructure, and docs.

## Key design principles

- Shared monorepo with explicit workspace boundaries
- Tenant-aware backend request pipeline
- Clear separation of concerns between API, domain models, services, and middleware
- Frontend built on Next.js App Router with strong TypeScript contracts
- Infrastructure ready for AWS S3, Neon Postgres, Stripe, and Razorpay

## Multi-tenant approach

- Tenant ID is passed in request headers (`x-tenant-id`) and made available through middleware
- Data models include `tenant_id` for shared schema partitioning
- Authentication tokens encode tenant context and role information

## Scalability considerations

- Use connection pool sizing and schema migrations for Neon Postgres
- Keep business logic in services for reusable domain operations
- Use stateless JWT for authentication and session management
- Integrate S3 for file and media storage

## Deployment readiness

- Backend supports environment-based configuration using Pydantic settings
- Frontend is ready for Vercel or any modern Node.js deployment
- Infrastructure folder contains placeholders for Terraform-managed cloud resources
