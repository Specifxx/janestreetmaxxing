@echo off
title Bill Street - ASX ORB Auto-Trader
cd /d "%~dp0"

echo ============================================
echo   Bill Street - ASX200 ORB Auto-Trader
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed.
  echo.
  echo  1. Go to https://nodejs.org
  echo  2. Download and install the LTS version
  echo  3. Double-click this file again
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  First-time setup: installing dependencies (about 1-2 minutes)...
  echo.
  call npm install
  if errorlevel 1 (
    echo  Install failed - check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo  Starting the app...
echo  Your browser will open at http://localhost:3000/autopilot
echo  (Leave this window open while you use it. Close it to stop.)
echo.

rem open the browser a few seconds after the server starts
start "" cmd /c "timeout /t 6 >nul & start "" http://localhost:3000/autopilot"

call npm run dev
pause
