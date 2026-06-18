# One-click launch

There's no single `.exe` (a Next.js app can't be honestly compiled into one), but
these launchers are the next best thing — double-click and the app opens in your
browser. They check Node, install dependencies on first run, start the app, and
open **http://localhost:3000/autopilot**.

| Your computer | File to use | How |
|---------------|-------------|-----|
| **Windows** | `Launch-AutoTrader-Windows.bat` | Double-click it |
| **macOS** | `Launch-AutoTrader-Mac.command` | First time: **right-click → Open** (to bypass Gatekeeper), then double-click after |
| **Linux** | `Launch-AutoTrader-Linux.sh` | `./Launch-AutoTrader-Linux.sh` in a terminal |

## First time only
1. Install **Node.js LTS** from https://nodejs.org (the launcher tells you if it's missing).
2. Download this project (green **Code → Download ZIP** on GitHub, then unzip — or `git clone`).
3. Double-click the launcher for your OS. First run installs dependencies (~1–2 min); after that it's a few seconds.

## To stop
Close the black terminal window the launcher opened.

## Notes
- Keep that window open while you use the app — it *is* the app's engine.
- **Run it locally**, especially for Live — don't put live broker credentials on a hosted site.
- Auto-run only works while the browser tab + this window stay open. For genuine
  24/7 trading you need the CLI bot on an always-on machine/VPS — see `AUTOMATION.md`.
