# SunTran Transit Analysis Tool

A web application built for SunTran and Washington County to analyze bus route performance, explore ridership patterns, identify coverage gaps, and test proposed route changes before anything gets implemented. Built as a university research project at Utah Tech University in partnership with SunTran.

---

## Quick Start (Docker — recommended)

**Step 1 — Install Docker Desktop** (one time only)
Download and install from: https://www.docker.com/products/docker-desktop/
Open it and wait for it to finish starting before continuing.

**Step 2 — Download the app**
Click the green **Code** button on this page → **Download ZIP** → unzip it anywhere on your computer.

**Step 3 — Launch**
- **Windows:** double-click `START.bat`
- **Mac:** double-click `START.command`

The app opens in your browser automatically at `http://localhost:5176`.
Default login: **admin / suntran**

To stop the app, come back to the terminal window and press **Enter** (or any key on Windows).

---

## Alternative: No Docker (Python + Node)

If you prefer not to use Docker, you can run the app directly.

**Requirements**
- Python 3.11 or 3.12
- Node.js 18 or higher

**Backend** — open a terminal in the project folder:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** — open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The default login will be printed in the backend terminal on first run.

---

## Loading the Data

The app starts with the route and stop network already loaded. The ridership charts will be empty until the SunTran operational data files are imported.

1. Log in and click the **Import** tab
2. Under **Raw AVL/APC Vendor Files**, upload each of the four monthly files from SunTran:
   - Average Passenger Counts
   - Trip OTP by Route and Stop
   - Hourly APC Counts
   - Raw Stop Arrival Times (optional)
3. Each card shows a preview before saving anything
4. Click **Import** to confirm

To add a new month of data later, repeat the same steps. New months are merged in without overwriting existing history. Every import automatically creates a backup of the previous data.

---

## What Each Tab Does

**Map**
Shows the full SunTran route network on an interactive map. Click any stop to see its boarding numbers. Toggle the coverage gap overlay to see which parts of the city are more than a quarter mile from any stop. Gold star markers show major employers and job centers.

**Simulate**
Build a proposed route change and test it against the real network. Add new stops, modify existing routes, or sketch entirely new ones. Run the simulation to get a before-and-after comparison showing how many employment hubs the network can reach.

**Metrics**
System-level performance dashboard. Shows on-time performance by route, route efficiency (boardings per mile and per stop), employment hub accessibility, and a full schedule reliability breakdown by stop. Use the period selector above the OTP charts to switch between uploaded months.

**Ridership**
Detailed ridership charts broken down by route, stop, day of week, month, and hour of day. All charts update automatically.

**Import**
Upload new monthly data files from SunTran. Also lets you download current data, view backup history, and restore a previous version if something goes wrong.

**Instructions**
Built-in user guide covering every tab in plain English.

---

## Adding or Changing Users

To set your own password or add more users, use the built-in user management in the app settings, or edit `backend/users.json` directly.

Passwords are stored as bcrypt hashes. Restart the backend after editing the file manually.

---

## Project Structure

```
backend/
  main.py                  — API routes and data import pipeline
  simulation_engine.py     — Network graph and accessibility analysis
  metrics.py               — Performance reports
  route_loader.py          — CSV loaders
  auth.py                  — Login and JWT handling
  requirements.txt

frontend/src/
  App.jsx                  — Root component and tab navigation
  api/client.js            — API client
  components/              — One file per tab

data/
  routes.csv               — Route definitions
  stops.csv                — Stop locations
  employment_hubs.csv      — Employer locations
  [ridership files]        — Loaded via Import tab
```

---

## API Documentation

With the backend running, visit **http://localhost:8000/docs** for the full interactive API reference.

---

## Questions

Contact Justin Becerra — jstnbcrr@gmail.com
