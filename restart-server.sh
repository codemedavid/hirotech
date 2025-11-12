#!/bin/bash

echo "🔄 Restarting Next.js Development Server..."
echo ""

# Kill any running Next.js processes
echo "⏹️  Stopping current dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Clear Next.js cache (optional but recommended)
echo "🧹 Clearing Next.js cache..."
rm -rf .next

# Regenerate Prisma client
echo "🔧 Regenerating Prisma client..."
npx prisma generate --no-engine

echo ""
echo "✅ Ready! Starting dev server..."
echo "🚀 Running: npm run dev"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the dev server
npm run dev

