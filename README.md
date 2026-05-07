# SunTran Transit Analysis Tool

A web application built for SunTran and Washington County to analyze bus route performance, explore ridership patterns, identify coverage gaps, and test proposed route changes before anything gets implemented. Built as a university research project at Utah Tech University in partnership with SunTran.

---

## What You Need

**Option A: Docker (easiest — one command)**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — that is all you need

**Option B: Without Docker**
- Python 3.11 or 3.12
- Node.js 18 or higher

---

## Getting Started

### Option A: Docker

```bash
git clone https://github.com/jstnbcrr/SunTran-Sim.git
cd SunTran-Sim
docker compose up --build
```

That is it. On the very first run, the app will generate a login password and print it in the terminal output:

```
====================================================
  SUNTRAN FIRST-RUN SETUP
  Default account created:
    Username : admin
    Password : suntran
  Log in at http://localhost:5173
====================================================
```

Open **http://localhost:5173** and use those credentials to log in.

---

### Option B: Without Docker

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

Open **http://localhost:5173**. The same first-run password will be printed in the backend terminal.

---

## Loading the Data

The app starts with the route and stop network already loaded. The ridership charts will be empty until the SunTran operational data files are imported.

1. Log in and click the **Import** tab
2. Click **Smart Import**
3. Drag in the four monthly vendor files (Average Passenger Counts, Stop Activity, Schedule Adherence, Route Performance)
4. The system auto-detects each file type and shows a preview
5. Click **Import** to confirm

The app validates the files before saving anything. If a file has a problem it will tell you before any data is changed. Every import automatically creates a backup of the previous data.

To add a new month of data later, repeat the same steps. New months are merged in without overwriting the existing history.

---

## What Each Tab Does

**Map**
Shows the full SunTran route network on an interactive map. Click any stop to see its boarding numbers. Toggle the coverage gap overlay to see which parts of the city are more than a quarter mile from any stop. Gold star markers show major employers and job centers.

**Simulate**
Build a proposed route change and test it against the real network. Add new stops, modify existing routes, or sketch entirely new ones. Run the simulation to get a before-and-after comparison showing how many employment hubs the network can reach.

**Metrics**
System-level performance dashboard. Shows on-time performance by route, route efficiency (boardings per mile and per stop), employment hub accessibility, and a full schedule reliability breakdown by stop.

**Ridership**
Detailed ridership charts broken down by route, stop, day of week, month, and hour of day. Use the period filter at the top to focus on a specific month or set of months. All charts update automatically.

**Import**
Upload new monthly data files from SunTran. Supports smart auto-detection of vendor file formats. Also lets you download current data, view backup history, and restore a previous version if something goes wrong.

**Instructions**
Built-in user guide covering every tab in plain English.

---

## Adding or Changing Users

The auto-generated password on first run is fine for initial access. To set your own password or add more users, use the built-in user management in the app settings, or edit `backend/users.json` directly.

Passwords are stored as bcrypt hashes — plain text passwords are never saved anywhere. Restart the backend after editing the file manually.

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
  App.jsx                  — Root component and data fetching
  api/client.js            — API client
  components/              — One file per tab

data/
  routes.csv               — Route definitions
  stops.csv                — Stop locations
  employment_hubs.csv      — Employer locations
  [ridership files]        — Provided separately, loaded via Import tab
```

---

## API Documentation

With the backend running, visit **http://localhost:8000/docs** for the full interactive API reference.

---

## Questions

Contact Justin Becerra — jstnbcrr@gmail.com
