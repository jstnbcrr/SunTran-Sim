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
def _startup():
    """Bootstrap admin users then load data."""
    import json, bcrypt
    users_file = os.path.join(os.path.dirname(__file__), "users.json")
    users = {}
    if os.path.exists(users_file):
        try:
            with open(users_file) as f:
                users = json.load(f)
        except Exception:
            pass
    changed = False
    for suffix in ["", "2", "3", "4", "5"]:
        username = os.environ.get(f"ADMIN_USER{suffix}")
        password = os.environ.get(f"ADMIN_PASSWORD{suffix}")
        if username and password and username not in users:
            users[username] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
            print(f"Created admin user '{username}'")
            changed = True
    if changed or not os.path.exists(users_file):
        with open(users_file, "w") as f:
            json.dump(users, f, indent=2)
    _load_data()


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
    highway_speed_mph: float = 55.0
    highway_threshold_miles: float = 1.0


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


# ── Boardings / OTP merge config ───────────────────────────────────────────────

BOARDINGS_FILES: dict[str, dict] = {
    "boardings_by_month": {
        "filename": "boardings_by_month.csv",
        "key_cols": ["month"],
        "date_col": "month",
    },
    "boardings_by_route": {
        "filename": "boardings_by_route.csv",
        "key_cols": ["route"],
        "date_col": None,
    },
    "boardings_by_route_stop": {
        "filename": "boardings_by_route_stop.csv",
        "key_cols": ["route", "address"],
        "date_col": None,
    },
    "boardings_by_stop": {
        "filename": "boardings_by_stop.csv",
        "key_cols": ["route", "stop_id"],
        "date_col": None,
    },
    "boardings_by_dow": {
        "filename": "boardings_by_dow.csv",
        "key_cols": ["day_num"],
        "date_col": None,
    },
    "boardings_by_route_dow": {
        "filename": "boardings_by_route_dow.csv",
        "key_cols": ["route", "day_num"],
        "date_col": None,
    },
    "boardings_by_route_month": {
        "filename": "boardings_by_route_month.csv",
        "key_cols": ["route", "month"],
        "date_col": "month",
    },
    "otp": {
        "filename": "otp.csv",
        "key_cols": ["route_name", "stop_name"],
        "date_col": None,
    },
}


def _boardings_file_info(file_type: str) -> dict:
    """Return metadata (row count, date range, last modified) for a boardings file."""
    cfg = BOARDINGS_FILES.get(file_type, {})
    path = os.path.join(DATA_DIR, cfg.get("filename", ""))
    if not os.path.exists(path):
        return {"exists": False, "rows": 0, "date_range": None, "last_modified": None}
    df = pd.read_csv(path)
    info: dict = {
        "exists": True,
        "rows": len(df),
        "date_range": None,
        "last_modified": os.path.getmtime(path),
    }
    date_col = cfg.get("date_col")
    if date_col and date_col in df.columns:
        vals = df[date_col].dropna().astype(str)
        if not vals.empty:
            info["date_range"] = {"min": str(vals.min()), "max": str(vals.max())}
    return info


def _merge_boardings_df(
    existing: pd.DataFrame,
    incoming: pd.DataFrame,
    key_cols: list[str],
) -> tuple[pd.DataFrame, int, int]:
    """Upsert incoming into existing using key_cols.  Returns (merged, added, updated)."""
    if existing.empty:
        return incoming.copy(), len(incoming), 0

    valid_keys = [k for k in key_cols if k in existing.columns and k in incoming.columns]
    if not valid_keys:
        merged = pd.concat([existing, incoming], ignore_index=True)
        return merged, len(incoming), 0

    def make_key(df: pd.DataFrame) -> "pd.Series[str]":
        return df[valid_keys].astype(str).agg("|".join, axis=1)

    existing_key = make_key(existing)
    incoming_key = make_key(incoming)

    is_new = ~incoming_key.isin(existing_key)
    is_update = incoming_key.isin(existing_key)
    keep_existing = ~existing_key.isin(incoming_key[is_update])

    merged = pd.concat(
        [existing[keep_existing], incoming[is_update], incoming[is_new]],
        ignore_index=True,
    )
    return merged, int(is_new.sum()), int(is_update.sum())


def _parse_otp_excel(content: bytes) -> pd.DataFrame:
    """Parse OTP Excel (Route_OTP_By_Route format) into otp.csv column layout."""
    import re

    xls = pd.read_excel(io.BytesIO(content), sheet_name="COMBINED")
    xls.columns = [str(c).strip() for c in xls.columns]

    def route_id(name: str) -> str:
        m = re.search(r"Route\s+(\d+)", str(name), re.IGNORECASE)
        return f"R{m.group(1)}" if m else ""

    def direction(name: str) -> str:
        m = re.search(r"\(([^)]+)\)\s*$", str(name))
        return m.group(1) if m else ""

    col_map = {
        "Route Name": "route_name",
        "Stop Name": "stop_name",
        "Early%": "early_pct",
        "On-Time%": "ontime_pct",
        "Late%": "late_pct",
        "Average Schedule Deviation (minutes)": "avg_deviation",
        "Total Trips": "total_trips",
        "Order": "order",
    }
    available = {k: v for k, v in col_map.items() if k in xls.columns}
    df = xls.rename(columns=available)[list(available.values())].copy()
    df["route_id"] = df["route_name"].apply(route_id)
    df["direction"] = df["route_name"].apply(direction)

    out_cols = [
        "route_id", "route_name", "direction", "stop_name", "order",
        "early_pct", "ontime_pct", "late_pct", "avg_deviation", "total_trips",
    ]
    for c in out_cols:
        if c not in df.columns:
            df[c] = None
    return df[out_cols]


# ── Smart auto-detection ───────────────────────────────────────────────────────

# Detection rules: ordered most-specific → least-specific.
# Each entry: (file_type, required_cols_set, display_label)
_DETECT_RULES: list[tuple[str, set[str], str]] = [
    ("boardings_by_route_month", {"route", "month", "total_in"},             "Boardings by Route × Month"),
    ("boardings_by_route_stop",  {"route", "address", "total_in"},           "Boardings by Route × Stop"),
    ("boardings_by_route_dow",   {"route", "day_num", "day_name"},           "Boardings by Route × Day of Week"),
    ("boardings_by_month",       {"month", "total_in", "unique_days"},       "Boardings by Month"),
    ("boardings_by_stop",        {"stop_id", "address", "total_in"},         "Boardings by Stop"),
    ("boardings_by_dow",         {"day_num", "day_name", "total_in"},        "Boardings by Day of Week"),
    ("boardings_by_route",       {"route", "total_in", "unique_days"},       "Boardings by Route"),
    ("ridership",                {"hourly_boardings", "hourly_alightings"},  "Hourly Ridership"),
    ("stops",                    {"stop_id", "stop_name", "latitude", "longitude"}, "Bus Stops"),
    ("routes",                   {"route_id", "route_name", "stop_ids"},     "Routes"),
    ("employment_hubs",          {"hub_name", "estimated_workers"},          "Employment Hubs"),
    ("otp",                      {"early_pct", "ontime_pct", "late_pct"},    "On-Time Performance"),
]

_NETWORK_TYPES = {"stops", "routes", "ridership", "employment_hubs"}


def _detect_csv_type(cols: set[str]) -> tuple[Optional[str], str]:
    """Return (file_type, display_label) or (None, 'Unknown') for a CSV column set."""
    for file_type, required, label in _DETECT_RULES:
        if required.issubset(cols):
            return file_type, label
    return None, "Unknown — could not identify"


def _smart_import_file(content: bytes, filename: str, mode: str = "merge") -> dict:
    """
    Auto-detect and import a single file (CSV or XLSX).
    Returns a result dict describing what happened.
    """
    lower = filename.lower()

    # ── Excel → try OTP parse ──────────────────────────────────────────────────
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        try:
            incoming = _parse_otp_excel(content)
            file_type = "otp"
            label = "On-Time Performance (Excel)"
        except Exception as e:
            return {"filename": filename, "status": "error", "error": str(e),
                    "detected_as": "Excel", "label": "Excel"}

        path = os.path.join(DATA_DIR, "otp.csv")
        backup_name = _backup_file("otp") if os.path.exists(path) else None
        if mode == "replace":
            final_df, added, updated = incoming, len(incoming), 0
        else:
            existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
            cfg = BOARDINGS_FILES["otp"]
            final_df, added, updated = _merge_boardings_df(existing, incoming, cfg["key_cols"])
        final_df.to_csv(path, index=False)
        _load_otp()
        return {"filename": filename, "status": "imported", "detected_as": file_type,
                "label": label, "rows_added": added, "rows_updated": updated,
                "total_rows": len(final_df), "backup": backup_name}

    # ── CSV ────────────────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        return {"filename": filename, "status": "error", "error": f"Could not parse CSV: {e}",
                "detected_as": None, "label": "Unknown"}

    cols = set(df.columns)
    file_type, label = _detect_csv_type(cols)

    if file_type is None:
        return {"filename": filename, "status": "skipped",
                "detected_as": None, "label": "Unknown — could not identify",
                "rows": len(df), "columns": sorted(cols)}

    # Network core files (stops, routes, ridership, employment_hubs)
    if file_type in _NETWORK_TYPES:
        backup_name = _backup_file(file_type)
        dest = os.path.join(DATA_DIR, f"{file_type}.csv")
        with open(dest, "wb") as f:
            f.write(content)
        _load_data()
        return {"filename": filename, "status": "imported", "detected_as": file_type,
                "label": label, "rows_added": len(df), "rows_updated": 0,
                "total_rows": len(df), "backup": backup_name}

    # Boardings / OTP CSV files (merge mode)
    cfg = BOARDINGS_FILES.get(file_type, {})
    path = os.path.join(DATA_DIR, cfg.get("filename", f"{file_type}.csv"))
    backup_name = _backup_file(file_type) if os.path.exists(path) else None
    if mode == "replace":
        final_df, added, updated = df, len(df), 0
    else:
        existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
        final_df, added, updated = _merge_boardings_df(existing, df, cfg.get("key_cols", []))
    final_df.to_csv(path, index=False)
    _load_boardings()
    return {"filename": filename, "status": "imported", "detected_as": file_type,
            "label": label, "rows_added": added, "rows_updated": updated,
            "total_rows": len(final_df), "backup": backup_name}


@protected.post("/api/upload/smart/preview")
async def smart_import_preview(files: list[UploadFile] = File(...)):
    """Identify each file without writing anything to disk."""
    results = []
    for upload in files:
        content = await upload.read()
        lower = upload.filename.lower()
        if lower.endswith(".xlsx") or lower.endswith(".xls"):
            try:
                df = _parse_otp_excel(content)
                results.append({
                    "filename": upload.filename,
                    "detected_as": "otp",
                    "label": "On-Time Performance (Excel)",
                    "incoming_rows": len(df),
                    "status": "ready",
                })
            except Exception as e:
                results.append({"filename": upload.filename, "detected_as": None,
                                 "label": "Excel parse error", "status": "error", "error": str(e)})
        else:
            try:
                df = pd.read_csv(io.BytesIO(content))
            except Exception as e:
                results.append({"filename": upload.filename, "detected_as": None,
                                 "label": "CSV parse error", "status": "error", "error": str(e)})
                continue
            cols = set(df.columns)
            file_type, label = _detect_csv_type(cols)
            entry: dict = {
                "filename": upload.filename,
                "detected_as": file_type,
                "label": label,
                "incoming_rows": len(df),
                "status": "ready" if file_type else "unknown",
            }
            # For boardings files, add merge preview numbers
            if file_type and file_type not in _NETWORK_TYPES and file_type in BOARDINGS_FILES:
                cfg = BOARDINGS_FILES[file_type]
                path = os.path.join(DATA_DIR, cfg["filename"])
                existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
                _, added, updated = _merge_boardings_df(existing, df, cfg["key_cols"])
                entry["rows_to_add"] = added
                entry["rows_to_update"] = updated
                entry["existing_rows"] = len(existing)
                if cfg["date_col"] and cfg["date_col"] in df.columns:
                    vals = df[cfg["date_col"]].dropna().astype(str)
                    if not vals.empty:
                        entry["date_range"] = {"min": str(vals.min()), "max": str(vals.max())}
            results.append(entry)
    return {"files": results}


@protected.post("/api/upload/smart")
async def smart_import(files: list[UploadFile] = File(...), mode: str = "merge"):
    """Auto-detect and import all uploaded files in one request."""
    results = []
    for upload in files:
        content = await upload.read()
        result = _smart_import_file(content, upload.filename, mode)
        results.append(result)
    imported = sum(1 for r in results if r["status"] == "imported")
    skipped  = sum(1 for r in results if r["status"] == "skipped")
    errors   = sum(1 for r in results if r["status"] == "error")
    return {"status": "done", "imported": imported, "skipped": skipped,
            "errors": errors, "files": results}


# ── Boardings file info ─────────────────────────────────────────────────────────

@protected.get("/api/data/boardings/{file_type}/info")
def get_boardings_file_info(file_type: str):
    if file_type not in BOARDINGS_FILES:
        raise HTTPException(400, f"Unknown boardings file type: {file_type}")
    return _boardings_file_info(file_type)


@protected.get("/api/data/boardings/{file_type}/download")
def download_boardings_file(file_type: str):
    """Download the current CSV for a boardings/otp file type."""
    if file_type not in BOARDINGS_FILES:
        raise HTTPException(400, f"Unknown boardings file type: {file_type}")
    cfg = BOARDINGS_FILES[file_type]
    path = os.path.join(DATA_DIR, cfg["filename"])
    if not os.path.exists(path):
        raise HTTPException(404, f"No {cfg['filename']} found")
    return StreamingResponse(
        open(path, "rb"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={cfg['filename']}"},
    )


# ── Boardings merge preview ─────────────────────────────────────────────────────

@protected.post("/api/upload/boardings/{file_type}/preview")
async def preview_boardings_upload(file_type: str, file: UploadFile = File(...)):
    """Dry-run: return change summary without writing to disk."""
    if file_type not in BOARDINGS_FILES:
        raise HTTPException(400, f"Unknown boardings file type: {file_type}")
    content = await file.read()
    try:
        incoming = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    cfg = BOARDINGS_FILES[file_type]
    path = os.path.join(DATA_DIR, cfg["filename"])
    existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
    _, added, updated = _merge_boardings_df(existing, incoming, cfg["key_cols"])

    new_date_range = None
    if cfg["date_col"] and cfg["date_col"] in incoming.columns:
        vals = incoming[cfg["date_col"]].dropna().astype(str)
        if not vals.empty:
            new_date_range = {"min": str(vals.min()), "max": str(vals.max())}

    return {
        "file_type": file_type,
        "existing_rows": len(existing),
        "incoming_rows": len(incoming),
        "rows_to_add": added,
        "rows_to_update": updated,
        "new_date_range": new_date_range,
    }


# ── Boardings merge upload ──────────────────────────────────────────────────────

@protected.post("/api/upload/boardings/{file_type}")
async def upload_boardings(
    file_type: str, file: UploadFile = File(...), mode: str = "merge"
):
    """Upload boardings CSV.  mode=merge (upsert) or mode=replace (overwrite)."""
    if file_type not in BOARDINGS_FILES:
        raise HTTPException(400, f"Unknown boardings file type: {file_type}")
    content = await file.read()
    try:
        incoming = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    cfg = BOARDINGS_FILES[file_type]
    path = os.path.join(DATA_DIR, cfg["filename"])
    backup_name = _backup_file(file_type) if os.path.exists(path) else None

    if mode == "replace":
        final_df, added, updated = incoming, len(incoming), 0
    else:
        existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
        final_df, added, updated = _merge_boardings_df(existing, incoming, cfg["key_cols"])

    final_df.to_csv(path, index=False)
    _load_boardings()

    return {
        "status": "uploaded",
        "file_type": file_type,
        "mode": mode,
        "rows_added": added,
        "rows_updated": updated,
        "total_rows": len(final_df),
        "backup": backup_name,
    }


# ── OTP Excel upload ────────────────────────────────────────────────────────────

@protected.post("/api/upload/otp-excel")
async def upload_otp_excel(file: UploadFile = File(...), mode: str = "merge"):
    """Accept OTP .xlsx (Route_OTP_By_Route format) and merge into otp.csv."""
    content = await file.read()
    try:
        incoming = _parse_otp_excel(content)
    except Exception as e:
        raise HTTPException(400, f"Could not parse OTP Excel: {e}")
    if incoming.empty:
        raise HTTPException(400, "No data found in COMBINED sheet")

    path = os.path.join(DATA_DIR, "otp.csv")
    backup_name = _backup_file("otp") if os.path.exists(path) else None

    if mode == "replace":
        final_df, added, updated = incoming, len(incoming), 0
    else:
        existing = pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()
        cfg = BOARDINGS_FILES["otp"]
        final_df, added, updated = _merge_boardings_df(existing, incoming, cfg["key_cols"])

    final_df.to_csv(path, index=False)
    _load_otp()

    return {
        "status": "uploaded",
        "rows_added": added,
        "rows_updated": updated,
        "total_rows": len(final_df),
        "backup": backup_name,
    }


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
        highway_speed_mph=params.highway_speed_mph,
        highway_threshold_miles=params.highway_threshold_miles,
    )
    proposed_graph = build_transit_graph(
        proposed_routes, merged_stops,
        speed_mph=params.average_speed_mph,
        dwell_time=params.dwell_time_minutes,
        transfer_penalty=params.transfer_penalty_minutes,
        highway_speed_mph=params.highway_speed_mph,
        highway_threshold_miles=params.highway_threshold_miles,
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


@protected.get("/api/route-shapes")
def get_route_shapes():
    """Return GTFS shape coordinates for each route."""
    import json
    shapes_path = os.path.join(DATA_DIR, "route_shapes.json")
    if not os.path.exists(shapes_path):
        return {}
    with open(shapes_path) as f:
        return json.load(f)


# ── Register protected router ──────────────────────────────────────────────────
app.include_router(protected)

# ── Serve built React frontend (production) ────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
