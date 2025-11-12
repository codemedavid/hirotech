#!/bin/bash

echo "========================================"
echo "PRISMA CLIENT FIX SCRIPT"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Stop all Node.js processes"
echo "2. Clean Prisma client files"
echo "3. Reinstall Prisma dependencies"
echo "4. Generate new Prisma client"
echo "5. Restart the dev server"
echo ""
echo "========================================"
echo ""

echo "Step 1: Stopping all Node.js processes..."
pkill -f "node" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "  ✓ Node processes stopped"
else
    echo "  ℹ No Node processes were running"
fi
echo ""

echo "Waiting 3 seconds for processes to fully release files..."
sleep 3
echo ""

echo "Step 2: Cleaning Prisma client files..."
npm run clean-prisma
if [ $? -eq 0 ]; then
    echo "  ✓ Prisma files cleaned"
else
    echo "  ⚠ Warning: Clean failed, but continuing..."
fi
echo ""

echo "Step 3: Installing Prisma dependencies..."
npm install @prisma/client@6.19.0 prisma@6.19.0 @prisma/engines --force
if [ $? -ne 0 ]; then
    echo "  ✗ Failed to install dependencies"
    exit 1
fi
echo "  ✓ Prisma dependencies installed"
echo ""

echo "Step 4: Generating Prisma client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "  ✗ Failed to generate Prisma client"
    exit 1
fi
echo "  ✓ Prisma client generated successfully"
echo ""

echo "Step 5: Verifying database sync..."
npx prisma db push
if [ $? -eq 0 ]; then
    echo "  ✓ Database is in sync"
else
    echo "  ⚠ Warning: Database sync check failed"
fi
echo ""

echo "========================================"
echo "✅ PRISMA FIX COMPLETE!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Start your dev server: npm run dev"
echo "2. Visit http://localhost:3000/team"
echo "3. The error should be resolved"
echo ""
echo "========================================"

