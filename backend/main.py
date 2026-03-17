"""FastAPI backend for the SunTran Transit Simulation Tool."""

import io
import os
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import authenticate_user, create_access_token, get_current_user
from route_loader import (
    load_stops,
    load_routes,
    load_ridership,
    load_employment_hubs,
    routes_to_dict,
    stops_to_dict,
)
from simulation_engine import build_transit_graph, compare_networks
from metrics import generate_accessibility_report, export_metrics_csv

app = FastAPI(title="SunTran Simulation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes on this router require a valid JWT token
protected = APIRouter(dependencies=[Depends(get_current_user)])

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

REQUIRED_CSV_COLUMNS = {
    "stops": {"stop_id", "stop_name", "latitude", "longitude"},
    "routes": {"route_id", "route_name", "stop_ids"},
    "ridership": {"route_id", "stop_id", "hour", "hourly_boardings", "hourly_alightings"},
    "employment_hubs": {"hub_name", "latitude", "longitude", "estimated_workers"},
}

# ── In-memory state ────────────────────────────────────────────────────────────
_stops: pd.DataFrame = pd.DataFrame()
_routes: list[dict] = []
_ridership: pd.DataFrame = pd.DataFrame()
_employment_hubs: pd.DataFrame = pd.DataFrame()
_otp: pd.DataFrame = pd.DataFrame()
_boardings_stop:        pd.DataFrame = pd.DataFrame()
_boardings_route:       pd.DataFrame = pd.DataFrame()
_boardings_dow:         pd.DataFrame = pd.DataFrame()
_boardings_month:       pd.DataFrame = pd.DataFrame()
_boardings_route_dow:   pd.DataFrame = pd.DataFrame()
_boardings_route_month: pd.DataFrame = pd.DataFrame()
_boardings_route_stop:  pd.DataFrame = pd.DataFrame()


def _save_routes():
    """Persist in-memory routes back to routes.csv so edits survive restarts."""
    import csv as csv_mod
    path = os.path.join(DATA_DIR, "routes.csv")
    with open(path, "w", newline="") as f:
        writer = csv_mod.DictWriter(f, fieldnames=["route_id", "route_name", "color", "stop_ids"])
        writer.writeheader()
        for r in _routes:
            writer.writerow({
                "route_id": r["route_id"],
                "route_name": r["route_name"],
                "color": r.get("color", "#3388ff"),
                "stop_ids": "|".join(r["stop_ids"]),
            })


def _load_boardings():
    global _boardings_stop, _boardings_route, _boardings_dow, _boardings_month
    for attr, fname in [
        ("_boardings_stop",        "boardings_by_stop.csv"),
        ("_boardings_route",       "boardings_by_route.csv"),
        ("_boardings_dow",         "boardings_by_dow.csv"),
        ("_boardings_month",       "boardings_by_month.csv"),
        ("_boardings_route_dow",   "boardings_by_route_dow.csv"),
        ("_boardings_route_month", "boardings_by_route_month.csv"),
        ("_boardings_route_stop",  "boardings_by_route_stop.csv"),
    ]:
        path = os.path.join(DATA_DIR, fname)
        globals()[attr] = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()


def _load_otp():
    global _otp
    otp_path = os.path.join(DATA_DIR, "otp.csv")
    if os.path.exists(otp_path):
        _otp = pd.read_csv(otp_path)
    else:
        _otp = pd.DataFrame()


@app.on_event("startup")
def _bootstrap_admin():
    """Create admin user from env vars if users.json is missing or empty."""
    import json, bcrypt
    users_file = os.path.join(os.path.dirname(__file__), "users.json")
    username = os.environ.get("ADMIN_USER")
    password = os.environ.get("ADMIN_PASSWORD")
    if not username or not password:
        return
    users = {}
    if os.path.exists(users_file):
        try:
            with open(users_file) as f:
                users = json.load(f)
        except Exception:
            pass
    if username not in users:
        users[username] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
        with open(users_file, "w") as f:
            json.dump(users, f, indent=2)
        print(f"Created admin user '{username}'")


@app.on_event("startup")
def _load_data():
    global _stops, _routes, _ridership, _employment_hubs
    try:
        _stops = load_stops()
    except Exception as e:
        print(f"WARNING: could not load stops.csv: {e}")
        _stops = pd.DataFrame(columns=["stop_id", "stop_name", "latitude", "longitude"])
    try:
        _routes = routes_to_dict(load_routes())
    except Exception as e:
        print(f"WARNING: could not load routes.csv: {e}")
        _routes = []
    try:
        _ridership = load_ridership()
    except Exception as e:
        print(f"WARNING: could not load ridership.csv: {e}")
        _ridership = pd.DataFrame()
    try:
        _employment_hubs = load_employment_hubs()
    except Exception as e:
        print(f"WARNING: could not load employment_hubs.csv: {e}")
        _employment_hubs = pd.DataFrame()
    _load_otp()
    _load_boardings()


# ── Pydantic models ────────────────────────────────────────────────────────────

class StopModel(BaseModel):
    stop_id: str
    stop_name: str
    latitude: float
    longitude: float


class RouteModel(BaseModel):
    route_id: str
    route_name: str
    color: str = "#3388ff"
    stop_ids: list[str]


class SimulationParams(BaseModel):
    proposed_routes: list[RouteModel]
    proposed_stops: Optional[list[StopModel]] = None
    walking_radius_miles: float = 0.25
    max_travel_minutes: float = 30.0
    average_speed_mph: float = 15.0
    dwell_time_minutes: float = 0.5
    transfer_penalty_minutes: float = 5.0


# ── Public endpoints (no auth required) ───────────────────────────────────────

@app.post("/api/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    """Exchange username + password for a JWT access token."""
    username = authenticate_user(form.username, form.password)
    if not username:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(username)
    return {"access_token": token, "token_type": "bearer", "username": username}


@app.get("/health")
def health():
    return {"status": "ok", "stops": len(_stops), "routes": len(_routes)}


# ── Protected endpoints ────────────────────────────────────────────────────────

@protected.get("/api/stops")
def get_stops():
    return stops_to_dict(_stops)


@protected.get("/api/routes")
def get_routes():
    return _routes


@protected.get("/api/employment-hubs")
def get_employment_hubs():
    return _employment_hubs.to_dict(orient="records")


@protected.get("/api/ridership")
def get_ridership():
    return _ridership.to_dict(orient="records")


@protected.get("/api/boardings/by-stop")
def get_boardings_by_stop():
    return [] if _boardings_stop.empty else _boardings_stop.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-route")
def get_boardings_by_route():
    return [] if _boardings_route.empty else _boardings_route.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-dow")
def get_boardings_by_dow():
    return [] if _boardings_dow.empty else _boardings_dow.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-month")
def get_boardings_by_month():
    return [] if _boardings_month.empty else _boardings_month.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-route-dow")
def get_boardings_by_route_dow():
    return [] if _boardings_route_dow.empty else _boardings_route_dow.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-route-month")
def get_boardings_by_route_month():
    return [] if _boardings_route_month.empty else _boardings_route_month.fillna("").to_dict(orient="records")

@protected.get("/api/boardings/by-route-stop")
def get_boardings_by_route_stop():
    return [] if _boardings_route_stop.empty else _boardings_route_stop.fillna("").to_dict(orient="records")


@protected.get("/api/otp")
def get_otp():
    if _otp.empty:
        return []
    return _otp.fillna("").to_dict(orient="records")


@protected.post("/api/reload")
def reload_data():
    """Re-read all CSV files from disk."""
    _load_data()
    return {"status": "reloaded"}


# ── Data management helpers ────────────────────────────────────────────────────

def _backup_file(file_type: str) -> Optional[str]:
    """Copy the current CSV to backups/ with a timestamp. Returns backup filename or None."""
    src = os.path.join(DATA_DIR, f"{file_type}.csv")
    if not os.path.exists(src):
        return None
    from datetime import datetime
    import shutil
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{file_type}_{ts}.csv"
    shutil.copy2(src, os.path.join(BACKUP_DIR, backup_name))
    return backup_name


def _list_backups(file_type: str) -> list[dict]:
    """Return backup metadata for a given file type, newest first."""
    import glob as glob_mod
    pattern = os.path.join(BACKUP_DIR, f"{file_type}_*.csv")
    files = sorted(glob_mod.glob(pattern), reverse=True)
    result = []
    for path in files:
        fname = os.path.basename(path)
        stat = os.stat(path)
        result.append({
            "filename": fname,
            "size_bytes": stat.st_size,
            "created_at": stat.st_mtime,
        })
    return result


# ── CSV Upload ─────────────────────────────────────────────────────────────────

@protected.post("/api/upload/{file_type}")
async def upload_csv(file_type: str, file: UploadFile = File(...)):
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")

    content = await file.read()

    # Validate the CSV structure before writing to disk
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    required = REQUIRED_CSV_COLUMNS[file_type]
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            400,
            f"CSV is missing required columns: {sorted(missing)}. "
            f"Expected: {sorted(required)}",
        )

    # Back up the current file before overwriting
    backup_name = _backup_file(file_type)

    dest = os.path.join(DATA_DIR, f"{file_type}.csv")
    with open(dest, "wb") as f:
        f.write(content)

    _load_data()
    return {"status": "uploaded", "file_type": file_type, "rows": len(df), "backup": backup_name}


@protected.get("/api/data/{file_type}/download")
def download_current(file_type: str):
    """Download the current CSV for a file type."""
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")
    path = os.path.join(DATA_DIR, f"{file_type}.csv")
    if not os.path.exists(path):
        raise HTTPException(404, f"No {file_type}.csv found")
    return StreamingResponse(
        open(path, "rb"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={file_type}.csv"},
    )


@protected.get("/api/data/{file_type}/backups")
def list_backups(file_type: str):
    """List available backups for a file type."""
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")
    return {"file_type": file_type, "backups": _list_backups(file_type)}


@protected.post("/api/data/{file_type}/restore/{filename}")
def restore_backup(file_type: str, filename: str):
    """Restore a backup file as the active CSV."""
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")
    # Safety: only allow filenames that match the expected pattern
    if not filename.startswith(f"{file_type}_") or not filename.endswith(".csv"):
        raise HTTPException(400, "Invalid backup filename")
    import shutil
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(404, f"Backup {filename} not found")
    # Back up the current file before restoring
    _backup_file(file_type)
    dest = os.path.join(DATA_DIR, f"{file_type}.csv")
    shutil.copy2(backup_path, dest)
    _load_data()
    return {"status": "restored", "file_type": file_type, "from": filename}


@protected.delete("/api/data/{file_type}/backup/{filename}")
def delete_backup(file_type: str, filename: str):
    """Delete a specific backup file."""
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")
    if not filename.startswith(f"{file_type}_") or not filename.endswith(".csv"):
        raise HTTPException(400, "Invalid backup filename")
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(404, f"Backup {filename} not found")
    os.remove(backup_path)
    return {"status": "deleted", "filename": filename}


@protected.get("/api/data/{file_type}/backup/{filename}/download")
def download_backup(file_type: str, filename: str):
    """Download a specific backup file."""
    allowed = {"stops", "routes", "ridership", "employment_hubs"}
    if file_type not in allowed:
        raise HTTPException(400, f"file_type must be one of {allowed}")
    if not filename.startswith(f"{file_type}_") or not filename.endswith(".csv"):
        raise HTTPException(400, "Invalid backup filename")
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(404, f"Backup {filename} not found")
    return StreamingResponse(
        open(backup_path, "rb"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Route CRUD ─────────────────────────────────────────────────────────────────

@protected.post("/api/routes")
def add_route(route: RouteModel):
    global _routes
    if any(r["route_id"] == route.route_id for r in _routes):
        raise HTTPException(409, f"Route {route.route_id} already exists")
    _routes.append(route.model_dump())
    _save_routes()
    return route


@protected.put("/api/routes/{route_id}")
def update_route(route_id: str, route: RouteModel):
    global _routes
    for i, r in enumerate(_routes):
        if r["route_id"] == route_id:
            _routes[i] = route.model_dump()
            _save_routes()
            return route
    raise HTTPException(404, f"Route {route_id} not found")


@protected.delete("/api/routes/{route_id}")
def delete_route(route_id: str):
    global _routes
    before = len(_routes)
    _routes = [r for r in _routes if r["route_id"] != route_id]
    if len(_routes) == before:
        raise HTTPException(404, f"Route {route_id} not found")
    _save_routes()
    return {"deleted": route_id}


# ── Metrics ────────────────────────────────────────────────────────────────────

@protected.get("/api/metrics")
def get_metrics():
    G = build_transit_graph(_routes, _stops)
    report = generate_accessibility_report(
        G, _stops, _employment_hubs, _routes, _ridership
    )
    return report


@protected.get("/api/metrics/export")
def export_metrics():
    G = build_transit_graph(_routes, _stops)
    report = generate_accessibility_report(
        G, _stops, _employment_hubs, _routes, _ridership
    )
    csv_content = export_metrics_csv(report)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transit_metrics.csv"},
    )


# ── Simulation ─────────────────────────────────────────────────────────────────

@protected.post("/api/simulate")
def run_simulation(params: SimulationParams):
    if params.proposed_stops:
        extra = pd.DataFrame([s.model_dump() for s in params.proposed_stops])
        merged_stops = pd.concat([_stops, extra], ignore_index=True).drop_duplicates(
            subset="stop_id"
        )
    else:
        merged_stops = _stops.copy()

    known_stop_ids = set(merged_stops["stop_id"].astype(str))

    # Validate proposed routes before building the graph
    for route in params.proposed_routes:
        if len(route.stop_ids) < 2:
            raise HTTPException(
                400, f"Route '{route.route_id}' must have at least 2 stops."
            )
        unknown = [sid for sid in route.stop_ids if sid not in known_stop_ids]
        if unknown:
            raise HTTPException(
                400,
                f"Route '{route.route_id}' references unknown stop IDs: {unknown}. "
                "Add them via proposed_stops or upload a new stops.csv.",
            )

    proposed_routes = [r.model_dump() for r in params.proposed_routes]

    current_graph = build_transit_graph(
        _routes, _stops,
        speed_mph=params.average_speed_mph,
        dwell_time=params.dwell_time_minutes,
        transfer_penalty=params.transfer_penalty_minutes,
    )
    proposed_graph = build_transit_graph(
        proposed_routes, merged_stops,
        speed_mph=params.average_speed_mph,
        dwell_time=params.dwell_time_minutes,
        transfer_penalty=params.transfer_penalty_minutes,
    )

    return compare_networks(
        current_graph, proposed_graph, merged_stops, _employment_hubs,
        max_travel_minutes=params.max_travel_minutes,
        walking_radius=params.walking_radius_miles,
    )


@protected.get("/api/simulate/coverage-gaps")
def get_coverage_gaps():
    from metrics import identify_coverage_gaps
    gaps = identify_coverage_gaps(_stops)
    return {"gap_count": len(gaps), "gaps": gaps}


# ── Register protected router ──────────────────────────────────────────────────
app.include_router(protected)

# ── Serve built React frontend (production) ────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
