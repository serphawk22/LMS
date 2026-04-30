# Database Connection Troubleshooting Guide

## Overview
This guide helps resolve database connection issues in the LMS Backend. The main error typically appears as:
```
psycopg OperationalError: server closed the connection unexpectedly
```

---

## Quick Diagnostic Checklist

### 1. Check Database Server Status
- **Local PostgreSQL**: Verify PostgreSQL service is running
  - Windows: Check Services (services.msc) for PostgreSQL
  - Linux: `sudo systemctl status postgresql`
  - Mac: `brew services list | grep postgres`

- **Neon (Remote)**: Check at https://console.neon.tech for any service alerts

- **Other Remote Database**: Verify via provider's dashboard/console

### 2. Verify Connection String
- Copy your DATABASE_URL from `.env` file
- Format must be: `postgresql+psycopg://user:password@host:port/database`
- For Neon, ensure URL includes: `?sslmode=require`
- Verify no typos in credentials or hostname

### 3. Test Connection Manually
Run this Python command in the backend directory (with activated venv):
```bash
python -c "from app.database import test_db_connection; success, msg = test_db_connection(); print('✓' if success else '✗', msg)"
```

If this fails, your connection settings are incorrect.

### 4. Check Environment Variables
Verify `.env` file exists in `backend/` directory and contains:
```
DATABASE_URL=your_connection_string
DATABASE_CONNECT_TIMEOUT=60
DATABASE_POOL_SIZE=10
DATABASE_POOL_RECYCLE=300
```

---

## Troubleshooting by Error Type

### Error: "connection refused"
**Cause**: Database server not running or unreachable

**Fix**:
1. Start your database server
2. Verify firewall allows connection
3. Check host and port are correct in DATABASE_URL
4. For local: try `localhost` vs `127.0.0.1`
5. For remote: verify network/VPN access

### Error: "authentication failed for user"
**Cause**: Invalid credentials

**Fix**:
1. Verify username in DATABASE_URL
2. Verify password in DATABASE_URL (special chars need URL encoding)
3. Ensure user exists in database
4. Reset password if needed and update DATABASE_URL

### Error: "database does not exist"
**Cause**: Database name is wrong or needs creation

**Fix**:
1. Verify database name in DATABASE_URL
2. For local PostgreSQL, create database:
   ```bash
   createdb -U postgres your_database_name
   ```
3. For Neon, verify database exists in console

### Error: "SSL connection error" or "FATAL: no pg_hba.conf entry"
**Cause**: SSL/TLS issues or connection policy

**Fix**:
1. For Neon, ensure `?sslmode=require` is in DATABASE_URL
2. For local, remove `?sslmode=require` if using `localhost`
3. Check database SSL configuration

### Error: "server closed the connection unexpectedly" (pool timeout)
**Cause**: Connection pool exhausted or idle timeout

**Fix**:
1. Increase DATABASE_POOL_SIZE in `.env`:
   ```
   DATABASE_POOL_SIZE=15
   DATABASE_MAX_OVERFLOW=25
   ```
2. Ensure DATABASE_POOL_RECYCLE is set (e.g., 300 seconds)
3. Check for connection leaks in application code
4. Verify database server connection limits not exceeded

### Error: "timeout during startup"
**Cause**: Database taking too long to respond

**Fix**:
1. Increase DATABASE_CONNECT_TIMEOUT in `.env`:
   ```
   DATABASE_CONNECT_TIMEOUT=120
   ```
2. Increase DATABASE_INIT_RETRY_DELAY:
   ```
   DATABASE_INIT_RETRY_DELAY=5
   ```
3. Check database server performance/load
4. Try skip_db_init on first run: `SKIP_DB_INIT_ON_STARTUP=true`

---

## Step-by-Step Setup

### For Local PostgreSQL

1. **Install PostgreSQL**:
   - Windows: Download from postgresql.org
   - Linux: `sudo apt-get install postgresql postgresql-contrib`
   - Mac: `brew install postgresql`

2. **Start PostgreSQL**:
   - Windows: Start service via Services
   - Linux: `sudo systemctl start postgresql`
   - Mac: `brew services start postgresql`

3. **Create Database and User**:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE lms_db;
   CREATE USER lms_user WITH PASSWORD 'secure_password';
   ALTER ROLE lms_user SET client_encoding TO 'utf8';
   ALTER ROLE lms_user SET default_transaction_isolation TO 'read committed';
   GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;
   \q
   ```

4. **Create `.env` file**:
   ```bash
   cp backend/.env.example backend/.env
   ```

5. **Update `.env`**:
   ```
   DATABASE_URL=postgresql+psycopg://lms_user:secure_password@localhost:5432/lms_db
   ```

6. **Start Backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

### For Neon (Serverless PostgreSQL)

1. **Create Neon Project**:
   - Visit https://console.neon.tech
   - Create new project
   - Copy connection string

2. **Create `.env` file**:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Update `.env`** with Neon connection string:
   ```
   DATABASE_URL=postgresql+psycopg://user:password@ep-xxx.aws.neon.tech/database?sslmode=require
   ```

4. **Test Connection**:
   ```bash
   python -c "from app.database import test_db_connection; success, msg = test_db_connection(); print('✓' if success else '✗', msg)"
   ```

5. **Start Backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

### For Docker

1. **Add to docker-compose.yml**:
   ```yaml
   postgres:
     image: postgres:15
     environment:
       POSTGRES_DB: lms_db
       POSTGRES_USER: lms_user
       POSTGRES_PASSWORD: secure_password
     ports:
       - "5432:5432"
     volumes:
       - postgres_data:/var/lib/postgresql/data
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Update `.env`**:
   ```
   DATABASE_URL=postgresql+psycopg://lms_user:secure_password@postgres:5432/lms_db
   ```

---

## Health Check Endpoints

After starting the backend, verify database connectivity:

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/api/v1/health/detailed
```

Expected response (when database is connected):
```json
{
  "status": "healthy",
  "database": "connected",
  "message": "Application is running with database connected",
  "environment": "development"
}
```

---

## Log Analysis

When troubleshooting, check application logs for:

1. **"Connection test: Database connection successful"** ✓
   - Connection is working

2. **"Database action 'create_all' succeeded"** ✓
   - Schema created successfully

3. **"STARTUP FAILED: Cannot connect to database"** ✗
   - Check connection string and database status

4. **"All 5 attempts failed for 'create_all'"** ✗
   - Connection works but database initialization fails
   - Check database permissions

---

## Performance Tuning

### Connection Pool Settings
```env
# Small deployments
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10

# Medium deployments
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Large deployments
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40
```

### Timeout Settings
```env
# Development (lenient)
DATABASE_CONNECT_TIMEOUT=60
DATABASE_INIT_RETRY_DELAY=3

# Production (stricter)
DATABASE_CONNECT_TIMEOUT=30
DATABASE_INIT_RETRY_DELAY=1
```

---

## Additional Resources

- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **PostgreSQL Connection Strings**: https://www.postgresql.org/docs/current/libpq-connect-string.html
- **Neon Documentation**: https://neon.tech/docs/
- **psycopg3 Documentation**: https://www.psycopg.org/psycopg3/docs/

---

## Still Having Issues?

1. **Enable Debug Logging**:
   ```env
   DEBUG=true
   ```

2. **Check Application Logs**:
   Look for error messages starting with "Database action" or "Connection test"

3. **Test Connectivity Directly**:
   ```bash
   psql "postgresql://user:password@host:port/database"
   ```

4. **Review Configuration**:
   - Verify `.env` exists in `backend/` directory
   - Verify all required fields are set
   - Verify no typos in DATABASE_URL

5. **Reset and Retry**:
   ```bash
   # Remove all connection pools (forces recreation)
   rm -rf backend/uploads/*
   python -c "from sqlalchemy import create_engine; create_engine('postgresql+psycopg://...', pool_pre_ping=True).dispose()"
   ```

---

## Key Improvements Made

✓ **Environment Variables**: Moved hardcoded credentials to .env  
✓ **Connection Validation**: Added test_db_connection() function  
✓ **Better Retries**: Handles more error types with exponential backoff  
✓ **Improved Logging**: Detailed startup messages showing each step  
✓ **Health Checks**: Multiple endpoints to verify database status  
✓ **Better Error Messages**: Clear guidance when connection fails  
✓ **Connection Pool**: Optimized settings for production use  
✓ **Pool Recycling**: Prevents idle connection timeouts  
✓ **Documentation**: Comprehensive setup and troubleshooting guide
