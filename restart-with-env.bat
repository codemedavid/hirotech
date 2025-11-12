@echo off
echo ========================================
echo Restarting Development Server
echo ========================================
echo.

echo [1/5] Stopping any running dev servers...
taskkill /F /IM node.exe 2>nul || echo No dev server running
timeout /t 2 >nul

echo.
echo [2/5] Clearing Next.js cache...
if exist .next (
    rmdir /s /q .next
    echo Cache cleared
) else (
    echo No cache to clear
)

echo.
echo [3/5] Clearing Prisma cache...
if exist node_modules\.prisma (
    rmdir /s /q node_modules\.prisma
    echo Prisma cache cleared
) else (
    echo No Prisma cache to clear
)

echo.
echo [4/5] Verifying environment variables...
if not exist .env.local (
    echo ERROR: .env.local not found!
    pause
    exit /b 1
)
echo .env.local found

findstr /C:"DATABASE_URL=" .env.local >nul
if %ERRORLEVEL% EQU 0 (
    echo DATABASE_URL is set
) else (
    echo ERROR: DATABASE_URL not found!
    pause
    exit /b 1
)

findstr /C:"DIRECT_URL=" .env.local >nul
if %ERRORLEVEL% EQU 0 (
    echo DIRECT_URL is set
) else (
    echo ERROR: DIRECT_URL not found!
    pause
    exit /b 1
)

echo.
echo [5/5] Regenerating Prisma Client...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to generate Prisma Client
    pause
    exit /b 1
)
echo Prisma Client regenerated

echo.
echo ========================================
echo Setup Complete! Starting dev server...
echo ========================================
echo.
echo Environment variables loaded from .env.local
echo Database URL: Configured
echo Direct URL: Configured
echo.
echo Starting Next.js development server...
echo.

npm run dev

