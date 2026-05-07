@echo off
title SunTran Transit Analysis Tool

echo.
echo  =========================================
echo   SunTran Transit Analysis Tool
echo   Starting up, please wait...
echo  =========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Docker Desktop is not running.
    echo.
    echo  Please open Docker Desktop and wait for it
    echo  to finish starting, then run this again.
    echo.
    pause
    exit /b 1
)

echo  Docker is running. Starting the app...
echo.

REM Start the app
docker compose up --build -d

if errorlevel 1 (
    echo.
    echo  Something went wrong starting the app.
    echo  Make sure Docker Desktop is fully started and try again.
    pause
    exit /b 1
)

echo.
echo  =========================================
echo   App is running!
echo   Opening browser to http://localhost:5176
echo  =========================================
echo.

REM Wait a moment for the server to be ready then open browser
timeout /t 5 /nobreak >nul
start http://localhost:5176

echo  Press any key to STOP the app when you are done.
pause >nul

echo.
echo  Stopping the app...
docker compose down
echo  Done. Goodbye!
timeout /t 2 /nobreak >nul
