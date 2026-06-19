@echo off
setlocal enabledelayedexpansion
title Android Mirroring Setup Tool

echo.
echo  ======================================================
echo   📱 Android Mirroring Setup ^& Installation Tool
echo  ======================================================
echo.

:: Check for Node.js / npm
where npm >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js ^& npm are not installed or not in your system PATH.
    echo Please install Node.js from https://nodejs.org/ first.
    echo.
    pause
    exit /b 1
)

:: Download Scrcpy ZIP
echo [1/5] Downloading native Scrcpy binaries (v4.0 x64)...
if exist "scrcpy_temp.zip" del /f "scrcpy_temp.zip"
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; echo 'Downloading...'; Invoke-WebRequest -Uri 'https://github.com/Genymobile/scrcpy/releases/download/v4.0/scrcpy-win64-v4.0.zip' -OutFile 'scrcpy_temp.zip'"
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to download Scrcpy. Please check your internet connection.
    pause
    exit /b 1
)

:: Extract ZIP
echo.
echo [2/5] Extracting Scrcpy engine files...
if exist "temp_unzip" rmdir /s /q "temp_unzip"
powershell -Command "echo 'Extracting...'; Expand-Archive -Path 'scrcpy_temp.zip' -DestinationPath 'temp_unzip' -Force"
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to extract the downloaded ZIP.
    pause
    exit /b 1
)

:: Copy Scrcpy files to root
echo Copying binaries to root folder...
xcopy /e /y /i /h "temp_unzip\scrcpy-win64-v4.0\*" "." >nul

:: Rename scrcpy.exe to scrcpy-engine.exe
if exist "scrcpy.exe" (
    if exist "scrcpy-engine.exe" del /f "scrcpy-engine.exe"
    rename "scrcpy.exe" "scrcpy-engine.exe"
)

:: Cleanup Scrcpy zip/unzip folders
if exist "scrcpy_temp.zip" del /f "scrcpy_temp.zip"
if exist "temp_unzip" rmdir /s /q "temp_unzip"

:: Install node_modules
echo.
echo [3/5] Installing Electron ^& package dependencies...
call npm install
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to install Node dependencies.
    pause
    exit /b 1
)

:: Package Electron App
echo.
echo [4/5] Building the standalone launcher executable...
if exist "dist" rmdir /s /q "dist"
call npm run package
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Packaging failed.
    pause
    exit /b 1
)

:: Copy compiled files from dist to root
echo.
echo [5/5] Finalizing application setup...
xcopy /e /y /i /h "dist\AndroidScreenCopy-win32-x64\*" "." >nul

:: Rename the compiled launcher to scrcpy.exe
if exist "AndroidScreenCopy.exe" (
    if exist "scrcpy.exe" del /f "scrcpy.exe"
    rename "AndroidScreenCopy.exe" "scrcpy.exe"
)

:: Clean up the build dist folder
if exist "dist" rmdir /s /q "dist"

echo.
echo ======================================================
echo   🎉 Installation Successful!
echo   Double-click "scrcpy.exe" to launch the app anytime.
echo   Starting the application...
echo ======================================================
echo.

:: Start the application once
start "" "scrcpy.exe"

:: Self-deletion command
(goto) 2>nul & del "%~f0"
