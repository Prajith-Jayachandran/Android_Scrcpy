@echo off
setlocal enabledelayedexpansion
title Aether Mirror - Android Web Dashboard

cd /d "%~dp0"
set "PORT=3000"

echo.
echo ========================================================
echo   🚀 Starting Aether Mirror on Windows
echo   🌐 Dashboard: http://localhost:%PORT%
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js was not found in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Launch browser in locked-down App Window mode (no URL bar, DevTools disabled)
start "" cmd /c "timeout /t 2 /nobreak >nul & (start msedge.exe --app=http://localhost:%PORT% --disable-devtools 2>nul || start chrome.exe --app=http://localhost:%PORT% --disable-devtools 2>nul || start http://localhost:%PORT%)"

:: Start Next.js server
call npm start
if %ERRORLEVEL% neq 0 (
    echo Server exited with code %ERRORLEVEL%.
    pause
)
