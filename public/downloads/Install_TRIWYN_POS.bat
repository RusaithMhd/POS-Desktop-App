@echo off
setlocal enabledelayedexpansion
title TRIWYN POS — Commercial Desktop Installation ^& Setup Launcher
color 0A

echo ===============================================================================
echo                   TRIWYN POS — COMMERCIAL DESKTOP SUITE
echo               Offline Enterprise Point of Sale for Windows
echo ===============================================================================
echo.
echo  Target System: Windows 10 / Windows 11 (64-bit)
echo  Database Engine: Local Offline Embedded SQLite
echo  Hardware Support: 80mm/58mm Thermal Printers, USB Scanners, Cash Drawers
echo.
echo ===============================================================================
echo.

:: Check 64-bit architecture
if "%PROCESSOR_ARCHITECTURE%"=="x86" (
    if not defined PROCESSOR_ARCHITEW6432 (
        echo [ERROR] 32-bit Windows detected.
        echo TRIWYN POS Enterprise requires a 64-bit Windows operating system.
        pause
        exit /b 1
    )
)

echo [1/3] Locating installation binaries...
if exist "%~dp0POS-Setup.exe" (
    echo [OK] Found installer: "%~dp0POS-Setup.exe"
    echo.
    echo [2/3] Launching TRIWYN POS Windows Setup Wizard...
    echo       - Setup will install the desktop software
    echo       - Desktop shortcut will be created
    echo       - Start Menu shortcut will be registered
    echo.
    start "" "%~dp0POS-Setup.exe"
    echo [3/3] Installer running in background.
    echo.
    echo ===============================================================================
    echo Once installed, launch "TRIWYN POS" from your desktop.
    echo For assistance or activation, WhatsApp our support team:
    echo   Hotline 1: 0770802365
    echo   Hotline 2: 0750802353
    echo ===============================================================================
    timeout /t 5 >nul
    exit /b 0
) else (
    echo [WARNING] POS-Setup.exe was not found in the current folder.
    echo.
    echo Opening web-based POS application fallback...
    start "" "http://localhost:3000/login"
    pause
    exit /b 1
)
