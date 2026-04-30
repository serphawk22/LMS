# Deployment Guide

## Backend Deployment to Render

### Prerequisites
- A Render account
- A PostgreSQL database (can be created on Render or use an external one like Neon)
- Your database URL

### Steps to Deploy Backend

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin main
   ```

2. **Create a new Web Service on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository
   - Configure the following:
     - **Name**: `lms-backend`
     - **Environment**: `Python`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. **Set Environment Variables**:
   Add the following environment variables in the Render dashboard:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure secret key for JWT tokens
   - `ENVIRONMENT`: `production`
   - `DEBUG`: `false`
   - `ALLOWED_ORIGINS`: Your Netlify frontend URL

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for the build and deployment to complete
   - Note your backend URL (e.g., `https://lms-backend.onrender.com`)

---

## Frontend Deployment to Netlify

### Prerequisites
- A Netlify account
- Your frontend code pushed to GitHub

### Steps to Deploy Frontend

1. **Update the API Base URL**:
   Before deploying, update the API base URL in your frontend to point to your Render backend:
   
   Edit `frontend/lib/api.ts` (or similar configuration file) and update the API base URL:
   ```typescript
   const API_BASE_URL = 'https://lms-backend.onrender.com';
   ```

2. **Connect to Netlify**:
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Select your GitHub repository
   - Configure the following:
     - **Base directory**: `frontend`
     - **Build command**: `npm run build`
     - **Publish directory**: `.next`

3. **Set Environment Variables**:
   Add the following environment variables:
   - `NEXT_TELEMETRY_DISABLED`: `1`

4. **Deploy**:
   - Click "Deploy site"
   - Wait for the build to complete
   - Note your frontend URL (e.g., `https://lms-frontend.netlify.app`)

5. **Configure CORS on Backend**:
   After deployment, update the `ALLOWED_ORIGINS` environment variable on Render to include your Netlify frontend URL:
   ```
   https://lms-frontend.netlify.app
   ```

---

## Configuration Files Created

### 1. `render.yaml`
Render service configuration for automated deployment.

### 2. `frontend/netlify.toml`
Netlify configuration for Next.js build and redirects.

### 3. `backend/start.sh`
Startup script for the Render container.

### 4. `Dockerfile`
Optimized multi-stage Docker build for production.

---

## Troubleshooting

### Backend Issues
- **Database Connection**: Ensure your `DATABASE_URL` is correct and the database is accessible from Render's IP ranges.
- **CORS Errors**: Add your Netlify URL to `ALLOWED_ORIGINS` in the backend config.
- **Missing Environment Variables**: Check the "Environment Variables" section in Render dashboard.

### Frontend Issues
- **API Errors**: Verify the API base URL points to your Render backend.
- **Build Failures**: Check the build logs in Netlify for specific errors.
- **404 Errors**: Ensure the redirect rules in `netlify.toml` are correct.

---

## Security Notes

1. **JWT Secret**: Use a strong, unique secret for `JWT_SECRET`.
2. **Database URL**: Use a secure connection string with SSL.
3. **Environment**: Set `DEBUG` to `false` in production.
4. **CORS**: Restrict `ALLOWED_ORIGINS` to your specific frontend URL.