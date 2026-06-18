#!/bin/bash
# Double-click to launch (macOS). First time: right-click > Open to bypass Gatekeeper.
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  Bill Street - ASX200 ORB Auto-Trader"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed."
  echo "  Install the LTS version from https://nodejs.org then run this again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First-time setup: installing dependencies (about 1-2 minutes)..."
  npm install || { echo "Install failed - check your internet."; read -n 1 -s -r; exit 1; }
fi

echo "  Starting the app... browser will open at http://localhost:3000/autopilot"
echo "  (Leave this window open while you use it. Close it to stop.)"
( sleep 6; open "http://localhost:3000/autopilot" ) &
npm run dev
