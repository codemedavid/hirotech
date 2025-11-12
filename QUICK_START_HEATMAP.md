# Quick Start: Activity Heat Map

## 🎯 See Your Heat Map in 30 Seconds

### Step 1: Start Dev Server (if not running)
```bash
npm run dev
```

### Step 2: Open Your Browser
```
http://localhost:3000/teams/[your-team-id]
```

### Step 3: Click "Activity Heatmap" Tab

**That's it!** 🎉

---

## 🎨 What You'll See

A beautiful GitHub-style heat map showing:

- **Grid**: 7 days (Sun-Sat) × 24 hours
- **Colors**: 5 intensity levels (lighter = less, darker = more)
- **Tooltips**: Hover over any cell to see exact activity count
- **Stats**: Total activities, peak hour, busiest day, average per day

---

## 📊 Example View

```
Activity Heatmap
Busiest times for team activity over the last 30 days

Less ░▒▓█ More

       0h   6h   12h  18h  24h
Sun   [░][░][▓][█][█][▓][░][░]
Mon   [░][▒][█][█][▓][▒][░][░]
Tue   [░][▓][█][█][▓][▒][░][░]
Wed   [░][▒][▓][█][█][▓][▒][░]
Thu   [░][░][▓][█][▓][▒][░][░]
Fri   [░][▒][█][█][█][▒][░][░]
Sat   [░][░][▒][▓][▓][░][░][░]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Activities: 847
Peak Hour: 14:00
Busiest Day: Tuesday
Avg per Day: 28
```

---

## 🐛 Troubleshooting

### "No activity data available"
**Reason**: No team activities logged yet  
**Solution**: Use the team (view pages, send messages), then refresh

### Tooltips not showing
**Reason**: Tooltip component not loaded  
**Solution**: Restart dev server (`npm run dev`)

### Grid looks weird on mobile
**Reason**: Browser cache  
**Solution**: Hard refresh (Ctrl+Shift+R)

---

## ✅ System Status

Run this anytime to check system health:
```bash
npx tsx scripts/system-status-check.ts
```

Output:
```
✅ PostgreSQL Database    → RUNNING
✅ Next.js Dev Server     → RUNNING (port 3000)
✅ Ngrok Tunnel          → RUNNING
⚠️ Redis                 → Not configured (optional)
```

---

## 📝 Notes

- Heat map shows last 30 days of activity
- Updates when you refresh the page
- No Redis needed for this feature
- Works offline (local data only)

---

## 🚀 Deploy to Production

The heat map is production-ready! Just deploy as normal:

```bash
# Build
npm run build

# Deploy to Vercel
vercel deploy

# Or push to your hosting platform
git push
```

---

**Enjoy your new activity heat map!** 🎉

