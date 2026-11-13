#!/usr/bin/env bash
# ResearchMate AI — start/ensure the app server on port 3000.
# Prefers the production build (fast, stable); falls back to dev mode.
set -u
cd "$(dirname "$0")/.."

PORT=3000

if curl -s -o /dev/null --max-time 3 "http://localhost:${PORT}/api/health"; then
  echo "server already up on :${PORT}"
  exit 0
fi

# Stop any stale Next processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

if [ -f .next/standalone/server.js ]; then
  echo "starting production server (standalone)..."
  HOSTNAME=0.0.0.0 PORT="${PORT}" NODE_ENV=production \
    nohup node .next/standalone/server.js >> dev.log 2>&1 &
elif [ -f .next/BUILD_ID ]; then
  echo "starting production server (next start)..."
  nohup npx next start -p "${PORT}" >> dev.log 2>&1 &
else
  echo "no production build found — starting dev server..."
  nohup npx next dev -p "${PORT}" >> dev.log 2>&1 &
fi

# Wait until healthy (max ~30s)
for i in $(seq 1 30); do
  if curl -s -o /dev/null --max-time 3 "http://localhost:${PORT}/api/health"; then
    echo "server healthy on :${PORT}"
    exit 0
  fi
  sleep 1
done

echo "server failed to start; see dev.log"
exit 1
