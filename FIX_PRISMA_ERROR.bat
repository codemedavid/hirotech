@echo off
echo ========================================
echo PRISMA CLIENT FIX SCRIPT
echo ========================================
echo.
echo This script will:
echo 1. Stop all Node.js processes
echo 2. Clean Prisma client files
echo 3. Reinstall Prisma dependencies
echo 4. Generate new Prisma client
echo 5. Restart the dev server
echo.
echo ========================================
echo.

echo Step 1: Stopping all Node.js processes...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% == 0 (
    echo   ✓ Node processes stopped
) else (
    echo   ℹ No Node processes were running
)
echo.

echo Waiting 3 seconds for processes to fully release files...
timeout /t 3 /nobreak >nul
echo.

echo Step 2: Cleaning Prisma client files...
call npm run clean-prisma
if %errorlevel% == 0 (
    echo   ✓ Prisma files cleaned
) else (
    echo   ⚠ Warning: Clean failed, but continuing...
)
echo.

echo Step 3: Installing Prisma dependencies...
call npm install @prisma/client@6.19.0 prisma@6.19.0 @prisma/engines --force
if %errorlevel% == 0 (
    echo   ✓ Prisma dependencies installed
) else (
    echo   ✗ Failed to install dependencies
    goto :error
)
echo.

echo Step 4: Generating Prisma client...
call npx prisma generate
if %errorlevel% == 0 (
    echo   ✓ Prisma client generated successfully
) else (
    echo   ✗ Failed to generate Prisma client
    goto :error
)
echo.

echo Step 5: Verifying database sync...
call npx prisma db push
if %errorlevel% == 0 (
    echo   ✓ Database is in sync
) else (
    echo   ⚠ Warning: Database sync check failed
)
echo.

echo ========================================
echo ✅ PRISMA FIX COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Start your dev server: npm run dev
echo 2. Visit http://localhost:3000/team
echo 3. The error should be resolved
echo.
echo ========================================
pause
exit /b 0

:error
echo.
echo ========================================
echo ❌ ERROR OCCURRED
echo ========================================
echo.
echo The fix script encountered an error.
echo.
echo Manual steps to try:
echo 1. Close all terminals
echo 2. Restart your computer
echo 3. Run this script again
echo.
echo Or manually run:
echo   npm install --force
echo   npm run prisma:generate
echo.
echo ========================================
pause
exit /b 1

