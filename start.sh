#!/usr/bin/env bash
# Starts the FoundIt backend (http://localhost:3000) and frontend (http://localhost:5173).
# Usage:  ./start.sh        Press Ctrl+C once to stop both.
set -e
cd "$(dirname "$0")"

[ -d backend/node_modules ]  || (echo "Installing backend deps..."  && cd backend  && npm install)
[ -d frontend/node_modules ] || (echo "Installing frontend deps..." && cd frontend && npm install)

# Kill both when this script exits
cleanup() { kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM

(cd backend  && npm run dev) &
(cd frontend && npm run dev) &

echo ""
echo "  backend   -> http://localhost:3000"
echo "  frontend  -> http://localhost:5173   <- open this"
echo ""
wait
