@echo off
echo ========================================
echo System Services Check
echo ========================================
echo.

echo Checking Node.js...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
) else (
    echo [OK] Node.js installed
)
echo.

echo Checking npm...
npm --version
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm not found!
) else (
    echo [OK] npm installed
)
echo.

echo Checking PostgreSQL connection...
echo DATABASE_URL: %DATABASE_URL%
if "%DATABASE_URL%"=="" (
    echo [WARNING] DATABASE_URL not set
) else (
    echo [OK] DATABASE_URL is set
)
echo.

echo Checking Redis connection...
echo REDIS_URL: %REDIS_URL%
if "%REDIS_URL%"=="" (
    echo [WARNING] REDIS_URL not set
) else (
    echo [OK] REDIS_URL is set
)
echo.

echo Checking Next.js Dev Server...
curl -s http://localhost:3000/api/health 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Next.js Dev Server not responding on port 3000
) else (
    echo [OK] Next.js Dev Server is running
)
echo.

echo Checking environment variables...
if exist .env.local (
    echo [OK] .env.local file found
    echo.
    echo Key variables:
    findstr /i "DATABASE_URL REDIS_URL NEXT_PUBLIC_SUPABASE_URL FACEBOOK_APP_ID" .env.local 2>nul | findstr /v "PASSWORD TOKEN SECRET"
) else (
    echo [WARNING] .env.local file not found
)
echo.

echo Checking package.json...
if exist package.json (
    echo [OK] package.json found
    echo.
    echo Scripts available:
    findstr /i "\"dev\" \"build\" \"start\"" package.json
) else (
    echo [ERROR] package.json not found!
)
echo.

echo ========================================
echo Check Complete
echo ========================================
