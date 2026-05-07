#!/bin/bash
# Double-clickable launcher for macOS

echo ""
echo " ========================================="
echo "  SunTran Transit Analysis Tool"
echo "  Starting up, please wait..."
echo " ========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo " ERROR: Docker Desktop is not running."
    echo ""
    echo " Please open Docker Desktop from your Applications"
    echo " folder, wait for it to finish starting (the whale"
    echo " icon in the menu bar stops animating), then"
    echo " double-click START again."
    echo ""
    read -p " Press Enter to close..."
    exit 1
fi

echo " Docker is running. Starting the app..."
echo ""

# Move to the folder this script lives in
cd "$(dirname "$0")"

# Start the app
docker compose up --build -d

if [ $? -ne 0 ]; then
    echo ""
    echo " Something went wrong. Make sure Docker Desktop"
    echo " is fully started and try again."
    read -p " Press Enter to close..."
    exit 1
fi

echo ""
echo " ========================================="
echo "  App is running!"
echo "  Opening browser to http://localhost:5176"
echo " ========================================="
echo ""

# Wait for server to be ready then open browser
sleep 5
open http://localhost:5176

echo " Press Enter to STOP the app when you are done."
read

echo ""
echo " Stopping the app..."
docker compose down
echo " Done. Goodbye!"
sleep 2
