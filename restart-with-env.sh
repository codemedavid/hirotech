#!/bin/bash

echo "🔄 Restarting Development Server with Environment Variables"
echo "=========================================================="
echo ""

# Step 1: Kill any running dev servers
echo "[1/5] Stopping any running dev servers..."
pkill -f "next dev" || echo "No dev server running"
sleep 2

# Step 2: Clear Next.js cache
echo ""
echo "[2/5] Clearing Next.js cache..."
rm -rf .next
echo "✓ Cache cleared"

# Step 3: Clear Prisma cache
echo ""
echo "[3/5] Clearing Prisma cache..."
rm -rf node_modules/.prisma
echo "✓ Prisma cache cleared"

# Step 4: Verify environment variables
echo ""
echo "[4/5] Verifying environment variables..."
if [ -f .env.local ]; then
    echo "✓ .env.local found"
    
    # Check DATABASE_URL
    if grep -q "^DATABASE_URL=" .env.local; then
        echo "✓ DATABASE_URL is set"
    else
        echo "❌ DATABASE_URL not found in .env.local"
        exit 1
    fi
    
    # Check DIRECT_URL
    if grep -q "^DIRECT_URL=" .env.local; then
        echo "✓ DIRECT_URL is set"
    else
        echo "❌ DIRECT_URL not found in .env.local"
        exit 1
    fi
else
    echo "❌ .env.local not found!"
    exit 1
fi

# Step 5: Regenerate Prisma Client
echo ""
echo "[5/5] Regenerating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✓ Prisma Client regenerated"

echo ""
echo "=========================================================="
echo "✅ Setup Complete! Starting dev server..."
echo "=========================================================="
echo ""
echo "Environment variables loaded from .env.local"
echo "Database URL: Configured ✓"
echo "Direct URL: Configured ✓"
echo ""
echo "Starting Next.js development server..."
echo ""

# Start dev server with explicit env loading
npm run dev

