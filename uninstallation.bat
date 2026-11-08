@echo off
setlocal enabledelayedexpansion
title Uninstall Aether Mirror

echo.
echo ========================================================
echo   🗑️ Uninstalling Aether Mirror from Windows...
echo ========================================================
echo.

set "INSTALL_DIR=%~dp0"
:: Strip trailing backslash
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

:: 1. Terminate server if running on port 3000
echo [1/3] Terminating active server processes...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 2. Remove Desktop & Start Menu Shortcuts
echo [2/3] Removing desktop and start menu shortcuts...
if exist "%USERPROFILE%\Desktop\Aether Mirror.lnk" (
    del /f /q "%USERPROFILE%\Desktop\Aether Mirror.lnk"
    echo       Removed: %USERPROFILE%\Desktop\Aether Mirror.lnk
)
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Aether Mirror.lnk" (
    del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Aether Mirror.lnk"
    echo       Removed: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Aether Mirror.lnk
)

:: 3. Remove application installation directory
echo [3/3] Purging application folder (%INSTALL_DIR%)...
cd /d "%USERPROFILE%"
rmdir /s /q "%INSTALL_DIR%" >nul 2>&1

echo.
echo ========================================================
echo   ✔ Aether Mirror uninstalled successfully!
echo ========================================================
echo.
pause
