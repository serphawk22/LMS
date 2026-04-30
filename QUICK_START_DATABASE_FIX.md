# Quick Start - Database Connection Fix

## 🚀 Get Running in 5 Minutes

### Step 1: Create .env File
```bash
cd backend
cp .env.example .env
```

### Step 2: Set Your Database URL

**For Local PostgreSQL**:
```bash
# Edit backend/.env and set:
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/lms_db
```

**For Neon (Serverless)**:
```bash
# Edit backend/.env and set (copy from Neon dashboard):
DATABASE_URL=postgresql+psycopg://user:password@ep-xxx.us-east-1.aws.neon.tech/database?sslmode=require
```

### Step 3: Verify Connection
```bash
cd backend
python -c "from app.database import test_db_connection; success, msg = test_db_connection(); print(f'Connection: {'✓ OK' if success else '✗ FAILED'}\n{msg}')"
```

### Step 4: Start Backend
```bash
python -m uvicorn app.main:app --reload
```

**Expected Output**:
```
================================================================================
APPLICATION STARTUP INITIATED
================================================================================
Testing database connectivity...
Database connection test passed: Database connection successful
Initializing database schema...
...
DATABASE INITIALIZATION COMPLETED SUCCESSFULLY
================================================================================
```

### Step 5: Verify Health
```bash
curl http://localhost:8000/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "message": "Application is running with database connected",
  "environment": "development"
}
```

---

## ⚠️ Common Issues & Fixes

### Issue: "connection refused"
```bash
# Make sure PostgreSQL is running
sudo systemctl start postgresql        # Linux
brew services start postgresql         # Mac
# or via Services (Windows)

# Test with psql
psql -U postgres -h localhost
```

### Issue: "authentication failed"
```bash
# Verify credentials in .env
# Make sure user/password are correct

# Reset PostgreSQL password (Linux):
sudo -u postgres psql
ALTER USER your_user WITH PASSWORD 'new_password';
\q
```

### Issue: "database does not exist"
```bash
# Create database (PostgreSQL):
sudo -u postgres createdb -U your_user lms_db

# Or via psql:
sudo -u postgres psql
CREATE DATABASE lms_db OWNER your_user;
\q
```

### Issue: "timeout during startup"
```bash
# Increase timeout in .env:
DATABASE_CONNECT_TIMEOUT=120
DATABASE_INIT_RETRY_DELAY=5
```

---

## 🔍 Verification Checklist

- [ ] `.env` file exists in `backend/` directory
- [ ] `DATABASE_URL` is set in `.env`
- [ ] Database server is running
- [ ] Connection test passes: `python -c "..."`
- [ ] Backend starts without errors
- [ ] `/health` endpoint returns `"status": "healthy"`
- [ ] `/api/v1/health/detailed` shows database connected

---

## 📊 Check Detailed Status

```bash
# Detailed health check
curl http://localhost:8000/api/v1/health/detailed | python -m json.tool

# Expected output:
# {
#   "status": "healthy",
#   "database_status": "connected",
#   "database_message": "Database connection successful",
#   "environment": "development",
#   "skip_db_init": false
# }
```

---

## 🛠️ Environment Variables Reference

```env
# Required - Database connection string
DATABASE_URL=postgresql+psycopg://user:password@host:port/database

# Optional - Timeouts (seconds)
DATABASE_CONNECT_TIMEOUT=60
DATABASE_POOL_TIMEOUT=30

# Optional - Connection Pool (tune for performance)
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
DATABASE_POOL_RECYCLE=300

# Optional - Retry on startup
DATABASE_INIT_RETRIES=5
DATABASE_INIT_RETRY_DELAY=3

# Optional - Skip initialization (for development)
SKIP_DB_INIT_ON_STARTUP=false
```

---

## 📚 More Info

- **Full Troubleshooting**: See [DATABASE_CONNECTION_FIX.md](DATABASE_CONNECTION_FIX.md)
- **Implementation Details**: See [DATABASE_FIX_IMPLEMENTATION.md](DATABASE_FIX_IMPLEMENTATION.md)
- **Setup Guides**: Step-by-step instructions in DATABASE_CONNECTION_FIX.md

---

## 🎯 Next Steps After Getting Running

1. ✅ Verify database connection works
2. 📝 Set environment variables for production
3. 🔐 Use strong passwords and move to secrets manager
4. 🚀 Deploy to production with configured .env

---

## 💡 Pro Tips

1. **For Development**: 
   ```env
   DEBUG=true
   SKIP_DB_INIT_ON_STARTUP=false
   ```

2. **For Production**:
   ```env
   DEBUG=false
   DATABASE_POOL_SIZE=20
   DATABASE_MAX_OVERFLOW=40
   DATABASE_POOL_RECYCLE=300
   ```

3. **For CI/CD**: Store DATABASE_URL as secret, let app read from environment

4. **For Testing**:
   ```bash
   python -c "from app.database import test_db_connection; test_db_connection()"
   ```

---

## ❓ Getting Help

1. Check backend logs for detailed error messages
2. Run connection test: `python -c "from app.database import test_db_connection; test_db_connection()"`
3. Verify database is running and accessible
4. Check `DATABASE_URL` format is correct
5. See [DATABASE_CONNECTION_FIX.md](DATABASE_CONNECTION_FIX.md) for detailed troubleshooting

---

**Status**: ✅ Ready to use  
**Last Updated**: 2024  
**Compatibility**: Python 3.12+, PostgreSQL 12+, Neon
