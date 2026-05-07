# SunTran Transit Analysis Tool

A web application built for SunTran and Washington County to analyze bus route performance, explore ridership patterns, identify coverage gaps, and test proposed route changes before anything gets implemented. Built as a university research project at Utah Tech University in partnership with SunTran.

---

## What You Need

**Option A: Docker (easiest)**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — that is all you need

**Option B: Run without Docker**
- Python 3.11 or 3.12
- Node.js 18 or higher
- npm

---

## Getting Started from a Fresh Clone

### Option A: Docker

```bash
git clone https://github.com/jstnbcrr/SunTran-Sim.git
cd SunTran-Sim
```

Copy the example credentials file and set a password:

```bash
cp backend/users.json.example backend/users.json
```

Open `backend/users.json` and replace the placeholder hash with a real bcrypt hash. You can generate one at https://bcrypt-generator.com (use 12 rounds). The format is:

```json
{
  "your_username": "$2b$12$your_bcrypt_hash_here"
}
```

Then start the app:

```bash
docker compose up --build
```

Open your browser to **http://localhost:5173** and log in with the username and password you just set.

---

### Option B: Without Docker

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (open a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

---

## Loading the Data

The app starts with route and stop definitions already loaded but the ridership charts will be empty until you import the SunTran operational data files.

1. Log in and click the **Import** tab
2. Click **Smart Import**
3. Drag in the four monthly vendor files (Average Passenger Counts, Stop Activity, Schedule Adherence, Route Performance)
4. The system will auto-detect each file type and show you a preview
5. Click **Import** to confirm

The app validates the files before saving anything. If something is wrong with a file it will tell you before any data is changed. Every import automatically creates a backup of the previous data.

To add a new month of data, repeat the same process. New months are merged in without overwriting the history.

---

## What Each Tab Does

**Map**
Shows the full SunTran route network on an interactive map. Click any stop to see its boarding numbers. Toggle the coverage gap overlay to see which parts of the city are more than a quarter mile from any stop. Gold star markers show major employers and job centers.

**Simulate**
Build a proposed route change and see how it would affect the network. You can add new stops, modify existing routes, or sketch entirely new routes. When you are ready, run the simulation to get a before-and-after comparison of how many employment hubs the network can reach.

**Metrics**
System-level performance dashboard. Shows on-time performance by route, route efficiency (boardings per mile and per stop), employment hub accessibility, and a full schedule reliability breakdown by stop. The on-time performance data covers January 2025 through February 2026.

**Ridership**
Detailed ridership charts broken down by route, stop, day of week, month, and hour of day. Use the period filter at the top to focus on a specific month or range of months. Charts update automatically.

**Import**
Upload new monthly data files from SunTran. Supports smart auto-detection of vendor file formats. Also lets you download the current data, view backup history, and restore a previous version if something goes wrong.

**Instructions**
Built-in user guide covering every tab in plain English.

---

## Adding or Changing Users

User accounts are stored in `backend/users.json` as bcrypt-hashed passwords. Plain text passwords are never stored anywhere.

To add a user, generate a bcrypt hash of their password (12 rounds) at https://bcrypt-generator.com and add a line to `users.json`:

```json
{
  "existing_user": "$2b$12$existinghash",
  "new_user": "$2b$12$newhashere"
}
```

Restart the backend after editing the file.

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
  [ridership files]        — Loaded via Import tab, not included in repo
```

---

## API Documentation

With the backend running, visit **http://localhost:8000/docs** for the full interactive API reference.

---

## Questions

Contact Justin Becerra — jstnbcrr@gmail.com
