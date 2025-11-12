@echo off
cls
echo ============================================
echo 🔍 HIRO - Complete System Status Check
echo ============================================
echo.

REM Initialize status variables
set ENV_STATUS=❌
set DB_STATUS=❌
set NEXTAUTH_STATUS=❌
set SERVER_STATUS=❌
set REDIS_STATUS=❌

echo [1/6] Checking Environment Variables...
echo ----------------------------------------
if exist .env.local (
    echo ✅ .env.local file exists
    set ENV_STATUS=✅
    
    REM Check for required variables
    findstr /C:"DATABASE_URL" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ DATABASE_URL configured
    ) else (
        echo ❌ DATABASE_URL missing
        set ENV_STATUS=❌
    )
    
    findstr /C:"NEXTAUTH_SECRET" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ NEXTAUTH_SECRET configured
        set NEXTAUTH_STATUS=✅
    ) else (
        echo ❌ NEXTAUTH_SECRET missing
        set NEXTAUTH_STATUS=❌
    )
    
    findstr /C:"NEXTAUTH_URL" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ NEXTAUTH_URL configured
    ) else (
        echo ❌ NEXTAUTH_URL missing
        set NEXTAUTH_STATUS=❌
    )
) else (
    echo ❌ .env.local file NOT found
    echo    This is the PRIMARY cause of "Failed to fetch" error!
)
echo.

echo [2/6] Checking Next.js Dev Server...
echo ----------------------------------------
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Dev server is running on port 3000
    set SERVER_STATUS=✅
    
    REM Get PID
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo    PID: %%a
        set SERVER_PID=%%a
    )
) else (
    echo ❌ Dev server is NOT running
    echo    Start with: npm run dev
)
echo.

echo [3/6] Checking Database Connection...
echo ----------------------------------------
if exist .env.local (
    call npx prisma db execute --stdin < nul >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Database connection successful
        set DB_STATUS=✅
    ) else (
        echo ❌ Database connection failed
        echo    Check your DATABASE_URL in .env.local
    )
) else (
    echo ⚠️  Cannot check database (no .env.local)
)
echo.

echo [4/6] Checking Prisma Client...
echo ----------------------------------------
if exist node_modules\.prisma\client (
    echo ✅ Prisma client generated
) else (
    echo ❌ Prisma client NOT generated
    echo    Run: npx prisma generate
)

if exist prisma\schema.prisma (
    echo ✅ Prisma schema found
) else (
    echo ❌ Prisma schema missing
)
echo.

echo [5/6] Checking Redis (Optional)...
echo ----------------------------------------
redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Redis is running
    set REDIS_STATUS=✅
) else (
    echo ⚠️  Redis is NOT running
    echo    This is OPTIONAL for login functionality
    echo    Required only for campaign processing
)
echo.

echo [6/6] Checking Node Modules...
echo ----------------------------------------
if exist node_modules (
    echo ✅ node_modules directory exists
    
    if exist node_modules\next (
        echo ✅ Next.js installed
    ) else (
        echo ❌ Next.js NOT installed
    )
    
    if exist node_modules\next-auth (
        echo ✅ NextAuth installed
    ) else (
        echo ❌ NextAuth NOT installed
    )
    
    if exist node_modules\@prisma\client (
        echo ✅ Prisma client installed
    ) else (
        echo ❌ Prisma client NOT installed
    )
) else (
    echo ❌ node_modules NOT found
    echo    Run: npm install
)
echo.

echo ============================================
echo 📊 System Status Summary
echo ============================================
echo Environment File:    %ENV_STATUS%
echo NextAuth Config:     %NEXTAUTH_STATUS%
echo Database:            %DB_STATUS%
echo Dev Server:          %SERVER_STATUS%
echo Redis (Optional):    %REDIS_STATUS%
echo ============================================
echo.

REM Determine overall status
if "%ENV_STATUS%" == "❌" (
    echo 🚨 CRITICAL: Environment variables missing
    echo.
    echo This is causing the "Failed to fetch" login error!
    echo.
    echo 🔧 Quick Fix:
    echo    1. Run: copy .env.template .env.local
    echo    2. Edit .env.local with your actual database credentials
    echo    3. Run: fix-login-error.bat
    echo.
) else if "%NEXTAUTH_STATUS%" == "❌" (
    echo ⚠️  WARNING: NextAuth configuration incomplete
    echo    Add NEXTAUTH_SECRET and NEXTAUTH_URL to .env.local
    echo.
) else if "%DB_STATUS%" == "❌" (
    echo ⚠️  WARNING: Database connection issues
    echo    Verify DATABASE_URL in .env.local
    echo    Make sure PostgreSQL is running
    echo.
) else if "%SERVER_STATUS%" == "❌" (
    echo ℹ️  INFO: Dev server not running
    echo    Start with: npm run dev
    echo.
) else (
    echo ✅ All systems operational!
    echo.
    echo 🎯 Next Steps:
    echo    1. Open: http://localhost:3000/login
    echo    2. Try logging in
    echo    3. Check browser console for errors
    echo.
    echo 📝 Create test user if needed:
    echo    npx tsx create-test-user.ts
    echo.
)

echo ============================================
echo 📚 Helpful Commands
echo ============================================
echo Fix login error:       fix-login-error.bat
echo Create test user:      npx tsx create-test-user.ts
echo Start dev server:      npm run dev
echo Push database schema:  npx prisma db push
echo Generate Prisma:       npx prisma generate
echo Kill dev server:       taskkill /F /IM node.exe
echo ============================================
echo.

pause

