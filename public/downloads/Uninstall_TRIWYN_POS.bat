@echo off
setlocal enabledelayedexpansion
title TRIWYN POS — Desktop Application Uninstaller Launcher
color 0C

echo ===============================================================================
echo                   TRIWYN POS — APPLICATION UNINSTALLER
echo ===============================================================================
echo.
echo  This tool will launch the official uninstaller for TRIWYN POS.
echo  Your SQLite database (sales, inventory, settings) will be preserved safely.
echo.
echo ===============================================================================
echo.

:: 1. Close any running TRIWYN POS instances
echo [1/3] Closing any running TRIWYN POS processes...
taskkill /F /IM "TRIWYN POS.exe" >nul 2>&1
taskkill /F /IM "electron.exe" >nul 2>&1

:: 2. Locate the official NSIS uninstaller
echo [2/3] Searching for installed application...
set "UNINSTALLER="

if exist "%LOCALAPPDATA%\Programs\TRIWYN POS\Uninstall TRIWYN POS.exe" (
    set "UNINSTALLER=%LOCALAPPDATA%\Programs\TRIWYN POS\Uninstall TRIWYN POS.exe"
) else if exist "%ProgramFiles%\TRIWYN POS\Uninstall TRIWYN POS.exe" (
    set "UNINSTALLER=%ProgramFiles%\TRIWYN POS\Uninstall TRIWYN POS.exe"
) else if exist "%ProgramFiles(x86)%\TRIWYN POS\Uninstall TRIWYN POS.exe" (
    set "UNINSTALLER=%ProgramFiles(x86)%\TRIWYN POS\Uninstall TRIWYN POS.exe"
)

if defined UNINSTALLER (
    echo [OK] Found uninstaller: "!UNINSTALLER!"
    echo.
    echo [3/3] Launching official Windows Uninstallation Wizard...
    start "" "!UNINSTALLER!"
    echo.
    echo Follow the on-screen prompts to complete the uninstallation.
    timeout /t 5 >nul
    exit /b 0
) else (
    echo [INFO] TRIWYN POS does not appear to be installed in the standard program directory.
    echo.
    echo Opening Windows "Installed Apps" settings so you can uninstall from Windows...
    start ms-settings:appsfeatures
    pause
    exit /b 0
)
