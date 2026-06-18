#!/bin/bash
# Run from a terminal:  ./Launch-AutoTrader-Linux.sh   (or double-click if your file manager allows)
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  Bill Street - ASX200 ORB Auto-Trader"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed. Install it (https://nodejs.org or your package manager) and re-run."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First-time setup: installing dependencies (about 1-2 minutes)..."
  npm install || { echo "Install failed - check your internet."; exit 1; }
fi

echo "  Starting the app... opening http://localhost:3000/autopilot"
( sleep 6; xdg-open "http://localhost:3000/autopilot" >/dev/null 2>&1 ) &
npm run dev
