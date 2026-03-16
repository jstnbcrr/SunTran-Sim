"""Loads and parses transit data from CSV files."""

import os
import pandas as pd
from typing import Optional


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def load_stops(path: Optional[str] = None) -> pd.DataFrame:
    """Load stops CSV. Columns: stop_id, stop_name, latitude, longitude."""
    path = path or os.path.join(DATA_DIR, "stops.csv")
    df = pd.read_csv(path, dtype={"stop_id": str})
    df["latitude"] = df["latitude"].astype(float)
    df["longitude"] = df["longitude"].astype(float)
    return df


def load_routes(path: Optional[str] = None) -> pd.DataFrame:
    """Load routes CSV. stop_ids column is pipe-separated string of stop_ids."""
    path = path or os.path.join(DATA_DIR, "routes.csv")
    df = pd.read_csv(path, dtype={"route_id": str})
    df["stop_ids"] = df["stop_ids"].apply(
        lambda x: [s.strip() for s in str(x).split("|") if s.strip()]
    )
    return df


def load_ridership(path: Optional[str] = None) -> pd.DataFrame:
    """Load ridership CSV. Columns: route_id, stop_id, hour, hourly_boardings, hourly_alightings."""
    path = path or os.path.join(DATA_DIR, "ridership.csv")
    df = pd.read_csv(
        path,
        dtype={"route_id": str, "stop_id": str},
    )
    return df


def load_employment_hubs(path: Optional[str] = None) -> pd.DataFrame:
    """Load employment hubs CSV. Columns: hub_name, latitude, longitude, estimated_workers."""
    path = path or os.path.join(DATA_DIR, "employment_hubs.csv")
    df = pd.read_csv(path)
    df["latitude"] = df["latitude"].astype(float)
    df["longitude"] = df["longitude"].astype(float)
    df["estimated_workers"] = df["estimated_workers"].astype(int)
    return df


def routes_to_dict(routes_df: pd.DataFrame) -> list[dict]:
    """Convert routes DataFrame to list of dicts (JSON-serialisable)."""
    records = []
    for _, row in routes_df.iterrows():
        records.append(
            {
                "route_id": row["route_id"],
                "route_name": row["route_name"],
                "color": row.get("color", "#3388ff"),
                "stop_ids": row["stop_ids"],
            }
        )
    return records


def stops_to_dict(stops_df: pd.DataFrame) -> list[dict]:
    """Convert stops DataFrame to list of dicts (JSON-serialisable)."""
    return stops_df.to_dict(orient="records")
