# 🔄 How to Restart the Next.js Dev Server

## The Problem
The dev server cached an old version of `package.json` with merge conflict markers. The file has been fixed, but the server needs to reload.

## Solution Options

### Option 1: Kill and Restart (Recommended)
```bash
# Kill the dev server
# On Windows:
taskkill /F /PID 38260

# Or use Ctrl+C in the terminal where it's running

# Then restart:
npm run dev
```

### Option 2: Kill All Node Processes (Nuclear Option)
```bash
# Windows:
taskkill /F /IM node.exe

# Then restart everything:
npm run dev
```

### Option 3: Restart from Task Manager
1. Open Task Manager (Ctrl+Shift+Esc)
2. Find node.exe processes
3. End the one using ~3.4GB RAM (PID 38260)
4. Restart: `npm run dev`

## After Restart
The error should disappear and you should see:
```
✓ Ready in Xs
○ Local: http://localhost:3000
```

## If Error Persists
1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `npm install`
3. Restart: `npm run dev`

