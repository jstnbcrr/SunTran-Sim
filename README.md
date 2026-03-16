# SunTran Transit Simulation Tool

A public transit analysis tool for university research analyzing the SunTran bus system in St. George, Utah. Researchers can simulate bus route changes and evaluate their impact on rider access to employment hubs and essential destinations.

---

## Quick Start (Docker — recommended)

```bash
docker compose up --build
```

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:8000        |
| API docs | http://localhost:8000/docs   |

## Quick Start (without Docker)

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (separate terminal)
```bash
cd frontend
cp .env.example .env          # then add your Mapbox token
npm install
npm run dev
```

---

## Configuration

### Mapbox token (required for road-segment map routing)

1. Create a free account at https://account.mapbox.com/
2. Copy your public token
3. In `frontend/`, copy `.env.example` → `.env` and paste the token

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

### Adding users

User credentials are stored in `backend/users.json` as bcrypt hashes. To add a new user:

```bash
python - <<'EOF'
import bcrypt, json, pathlib
pw = input("Password: ").encode()
hashed = bcrypt.hashpw(pw, bcrypt.gensalt()).decode()
p = pathlib.Path("backend/users.json")
users = json.loads(p.read_text()) if p.exists() else {}
users[input("Username: ")] = hashed
p.write_text(json.dumps(users, indent=2))
print("Done.")
EOF
```

---

## Data files (`/data/`)

| File | Description |
|------|-------------|
| `stops.csv` | Bus stops — `stop_id, stop_name, latitude, longitude` |
| `routes.csv` | Routes — `route_id, route_name, color, stop_ids` (pipe-separated) |
| `employment_hubs.csv` | Hubs — `hub_name, latitude, longitude, estimated_workers` |
| `ridership.csv` | Hourly boardings — `route_id, stop_id, hour, hourly_boardings, hourly_alightings` |
| `boardings_by_*.csv` | Pre-aggregated ridership views (stop, route, day-of-week, month) |
| `otp.csv` | Origin-to-provider accessibility matrix |

All files can be replaced via the **Upload Data** section in the Route Editor tab or via `POST /api/upload/{type}`. Uploaded files are schema-validated before being saved.

---

## Simulation logic

- Transit network is a **NetworkX directed graph** using an expanded line-graph to correctly model route transfers.
- Travel time = `(distance_miles / speed_mph) × 60 + dwell_time_minutes` (haversine distance).
- **Transfer penalty** is applied when a shortest path requires switching routes at a shared stop.
- Employment hub accessibility = number of stops that can reach the hub's nearest stop within `max_travel_minutes`.
- Coverage gaps are computed on a `0.005°` grid (~0.3 mi cells) using vectorized NumPy operations.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/stops` | All stops |
| GET | `/api/routes` | All routes |
| GET | `/api/employment-hubs` | Employment hubs |
| GET | `/api/metrics` | Full accessibility report |
| GET | `/api/metrics/export` | Download metrics as CSV |
| POST | `/api/routes` | Add route |
| PUT | `/api/routes/{id}` | Update route |
| DELETE | `/api/routes/{id}` | Delete route |
| POST | `/api/simulate` | Run current vs proposed comparison |
| GET | `/api/simulate/coverage-gaps` | Geographic coverage gap points |
| POST | `/api/upload/{type}` | Replace a data file (stops/routes/ridership/employment_hubs) |
| POST | `/api/reload` | Reload all data from disk |
| GET | `/health` | Health check |

Full interactive docs: http://localhost:8000/docs

---

## Architecture

```
/backend/
  main.py              — FastAPI app, all API routes
  simulation_engine.py — NetworkX graph builder, travel time, coverage analysis
  metrics.py           — Accessibility reports, CSV export, coverage gaps
  route_loader.py      — Pandas CSV loaders
  auth.py              — JWT authentication
  requirements.txt

/frontend/src/
  App.jsx                       — Root component, tab navigation, data fetching
  api/client.js                 — Axios API client with JWT interceptor
  components/MapView.jsx        — Leaflet map with routes/stops/hubs/coverage
  components/RouteEditor.jsx    — Route CRUD + CSV upload
  components/SimulationControls.jsx — Propose routes, run simulations
  components/MetricsPanel.jsx   — Comparison tables, CSV export
  components/RidershipPanel.jsx — Ridership charts (Recharts)
  components/Login.jsx          — Authentication screen

/data/                — CSV data files (see table above)
docker-compose.yml    — Spins up both services
```
# SunTran-Sim
