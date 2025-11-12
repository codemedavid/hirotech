@echo off
echo ============================================
echo 🚀 Fixing Login "Failed to Fetch" Error
echo ============================================
echo.

echo Step 1: Checking environment file...
if not exist .env.local (
    echo ❌ .env.local not found!
    if exist .env.template (
        echo ✅ Creating from template...
        copy .env.template .env.local
    ) else (
        echo ⚠️  Creating minimal .env.local...
        (
            echo # HIRO Environment Configuration
            echo NEXT_PUBLIC_APP_URL=http://localhost:3000
            echo NODE_ENV=development
            echo.
            echo # Database - UPDATE THIS WITH YOUR CREDENTIALS!
            echo DATABASE_URL="postgresql://postgres:password@localhost:5432/hiro"
            echo DIRECT_URL="postgresql://postgres:password@localhost:5432/hiro"
            echo.
            echo # NextAuth - REQUIRED FOR LOGIN
            echo NEXTAUTH_SECRET="hiro-super-secret-key-for-jwt-signing-change-this-in-production-123456789012"
            echo NEXTAUTH_URL="http://localhost:3000"
            echo.
            echo # Optional: Supabase
            echo NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
            echo NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
            echo.
            echo # Optional: Facebook
            echo FACEBOOK_APP_ID="your-facebook-app-id"
            echo FACEBOOK_APP_SECRET="your-facebook-app-secret"
            echo FACEBOOK_WEBHOOK_VERIFY_TOKEN="your-webhook-verify-token"
            echo.
            echo # Optional: Redis
            echo REDIS_URL="redis://localhost:6379"
        ) > .env.local
    )
    echo.
    echo ⚠️  IMPORTANT: Edit .env.local and add your actual DATABASE_URL
    echo    Example: postgresql://user:pass@localhost:5432/dbname
    echo.
    pause
) else (
    echo ✅ .env.local found!
)
echo.

echo Step 2: Stopping existing dev servers...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo ✅ Stopped existing processes
    timeout /t 2 /nobreak >nul
) else (
    echo ℹ️  No running processes found
)
echo.

echo Step 3: Cleaning Next.js cache...
if exist .next (
    rmdir /s /q .next 2>nul
    echo ✅ Cleaned .next directory
) else (
    echo ℹ️  No cache to clean
)
echo.

echo Step 4: Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ❌ Prisma generate failed!
    echo    Check your DATABASE_URL in .env.local
    pause
    exit /b 1
)
echo ✅ Prisma client generated
echo.

echo Step 5: Pushing database schema...
echo ⚠️  This will create/update tables in your database
call npx prisma db push
if %errorlevel% neq 0 (
    echo ❌ Database push failed!
    echo    Possible issues:
    echo    - Database not running
    echo    - Wrong DATABASE_URL in .env.local
    echo    - Connection timeout
    echo.
    echo    Fix the database connection and run this script again
    pause
    exit /b 1
)
echo ✅ Database schema pushed
echo.

echo ============================================
echo ✅ Fix Complete! Starting dev server...
echo ============================================
echo.
echo 📝 Test Login:
echo    1. Open http://localhost:3000/login
echo    2. Try logging in
echo    3. Check console for errors
echo.
echo ⚠️  If login still fails:
echo    - Check browser console for specific error
echo    - Verify DATABASE_URL in .env.local
echo    - Make sure you have a user in the database
echo.
pause
echo.
call npm run dev

