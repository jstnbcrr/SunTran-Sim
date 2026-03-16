# SunTran Transit Simulation Tool — CLAUDE.md

## Project Overview
A public transit analysis tool for university research analyzing the SunTran bus system in St. George, Utah. Researchers can simulate bus route changes and evaluate impact on rider access to employment hubs and essential destinations.

## Architecture
- **Backend**: Python 3.12 + FastAPI, runs on port 8000
- **Frontend**: React 18 + Vite, runs on port 5173
- **Data**: CSV files in `/data/`
- **Containerized**: Docker Compose spins up both services

## Key File Locations
```
/backend/
  main.py              — FastAPI app, all API routes
  simulation_engine.py — NetworkX graph builder, travel time, coverage analysis
  metrics.py           — Accessibility reports, CSV export, coverage gaps
  route_loader.py      — Pandas CSV loaders
  requirements.txt

/frontend/src/
  App.jsx                       — Root component, tab navigation, data fetching
  api/client.js                 — All axios API calls
  components/MapView.jsx        — react-leaflet map with routes/stops/hubs/coverage
  components/RouteEditor.jsx    — CRUD for routes, CSV upload
  components/SimulationControls.jsx — Build proposed routes, simulation params
  components/MetricsPanel.jsx   — Stats, comparison tables, CSV export

/data/
  stops.csv            — Bus stops (stop_id, stop_name, latitude, longitude)
  routes.csv           — Routes (route_id, route_name, color, stop_ids pipe-separated)
  ridership.csv        — Hourly boardings/alightings per route+stop
  employment_hubs.csv  — Hub name, lat, lon, estimated_workers
```

## Running the App

### With Docker (recommended)
```bash
docker compose up --build
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
# API docs: http://localhost:8000/docs
```

### Without Docker
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install
npm run dev
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/stops | All stops |
| GET | /api/routes | All routes |
| GET | /api/employment-hubs | Employment hubs |
| GET | /api/metrics | Full accessibility report |
| GET | /api/metrics/export | Download metrics CSV |
| POST | /api/routes | Add route |
| PUT | /api/routes/{id} | Update route |
| DELETE | /api/routes/{id} | Delete route |
| POST | /api/simulate | Run current vs proposed comparison |
| POST | /api/upload/{type} | Upload CSV (stops/routes/ridership/employment_hubs) |
| GET | /api/simulate/coverage-gaps | Geographic coverage gap points |

## Data Conventions
- `routes.csv`: `stop_ids` field is pipe-separated (`S001|S002|S003`)
- Route colors: hex strings like `#e74c3c`
- Coordinates: WGS84 decimal degrees (latitude, longitude)
- Travel time: calculated via haversine distance at 15 mph avg + 0.5 min dwell

## Simulation Logic
- NetworkX `DiGraph`: stops = nodes, consecutive stops on route = directed edges
- Edge weight = travel time in minutes (distance/speed + dwell_time)
- Bidirectional edges added for each route segment
- Shortest path via Dijkstra (`nx.shortest_path_length`)
- Employment hub accessibility: find nearest stop within 0.5mi walking radius, then count stops that can reach it within 30 min

## Dev Notes
- Backend state is in-memory (reloads from CSV on startup or POST /api/reload)
- Frontend proxies `/api` → `http://backend:8000` via Vite config
- For production, replace the Vite proxy target and add a proper reverse proxy
- Coverage gap grid uses `resolution=0.005°` (~0.3mi cells); response is capped at 500 points
