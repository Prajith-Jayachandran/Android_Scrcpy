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
echo [1/4] Downloading native Scrcpy binaries (v4.0 x64)...
if exist "scrcpy_temp.zip" del /f "scrcpy_temp.zip"
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; echo 'Downloading...'; Invoke-WebRequest -Uri 'https://github.com/Genymobile/scrcpy/releases/download/v4.0/scrcpy-win64-v4.0.zip' -OutFile 'scrcpy_temp.zip'"
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to download Scrcpy. Please check your internet connection.
    pause
    exit /b 1
)

:: Extract ZIP
echo.
echo [2/4] Extracting Scrcpy engine files...
if exist "temp_unzip" rmdir /s /q "temp_unzip"
powershell -Command "echo 'Extracting...'; Expand-Archive -Path 'scrcpy_temp.zip' -DestinationPath 'temp_unzip' -Force"
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to extract the downloaded ZIP.
    pause
    exit /b 1
)

:: Copy & Reorganize
echo Copying binaries to root folder...
xcopy /e /y "temp_unzip\scrcpy-win64-v4.0\*" "." >nul

:: Rename scrcpy.exe to scrcpy-engine.exe
if exist "scrcpy.exe" (
    if exist "scrcpy-engine.exe" del /f "scrcpy-engine.exe"
    rename "scrcpy.exe" "scrcpy-engine.exe"
)

:: Cleanup
echo Cleaning up temporary folders...
if exist "scrcpy_temp.zip" del /f "scrcpy_temp.zip"
if exist "temp_unzip" rmdir /s /q "temp_unzip"

:: Install node_modules
echo.
echo [3/4] Installing Electron ^& developer dependencies...
call npm install
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Failed to install Node dependencies.
    pause
    exit /b 1
)

:: Run Application
echo.
echo [4/4] Setup complete! Starting Android Mirroring...
echo.
call npm start
