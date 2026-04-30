# Infrastructure

This folder contains infrastructure-as-code scaffolding for the LMS platform.

## Suggested setup

- Use Terraform to provision Neon PostgreSQL, AWS S3 storage, and any network resources.
- Keep secrets in a secret manager or environment variables.
- Store Stripe and Razorpay credentials securely.
