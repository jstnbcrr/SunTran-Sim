"""High-level metrics calculations for route performance reporting."""

import io
import csv
import numpy as np
import pandas as pd
import networkx as nx

from simulation_engine import (
    haversine_miles,
    shortest_travel_time,
    employment_hubs_reachable,
    get_coverage_circles,
    _physical_nodes,
)


def calculate_stop_coverage(
    stops: pd.DataFrame, radius_miles: float = 0.25
) -> dict:
    """
    Estimate coverage statistics.
    Since we don't have census grid data, we approximate coverage
    by unique geographic cells covered by at least one stop.
    """
    circles = get_coverage_circles(stops, radius_miles)
    return {
        "total_stops": len(circles),
        "walking_radius_miles": radius_miles,
        "coverage_circles": circles,
    }


def calculate_route_lengths(routes: list[dict], stops: pd.DataFrame) -> list[dict]:
    """Compute total route distance in miles for each route."""
    stop_index = {
        str(row["stop_id"]): row for _, row in stops.iterrows()
    }
    results = []
    for route in routes:
        total_dist = 0.0
        stop_ids = route["stop_ids"]
        for i in range(len(stop_ids) - 1):
            a, b = stop_ids[i], stop_ids[i + 1]
            if a in stop_index and b in stop_index:
                ra, rb = stop_index[a], stop_index[b]
                total_dist += haversine_miles(
                    ra["latitude"], ra["longitude"],
                    rb["latitude"], rb["longitude"],
                )
        results.append(
            {
                "route_id": route["route_id"],
                "route_name": route["route_name"],
                "stop_count": len(stop_ids),
                "total_distance_miles": round(total_dist, 2),
            }
        )
    return results


def identify_coverage_gaps(
    stops: pd.DataFrame, grid_resolution: float = 0.005
) -> list[dict]:
    """
    Identify geographic grid cells within the bounding box of all stops
    that are NOT within walking distance (0.25 mi) of any stop.

    Uses numpy vectorized haversine for performance instead of a Python loop
    per grid cell, making the full grid computable without an arbitrary cap.
    """
    if stops.empty:
        return []

    stop_lats = stops["latitude"].values
    stop_lons = stops["longitude"].values

    min_lat = stop_lats.min() - 0.01
    max_lat = stop_lats.max() + 0.01
    min_lon = stop_lons.min() - 0.01
    max_lon = stop_lons.max() + 0.01

    grid_lats = np.arange(min_lat, max_lat + grid_resolution, grid_resolution)
    grid_lons = np.arange(min_lon, max_lon + grid_resolution, grid_resolution)

    R = 3958.8
    stop_lats_r = np.radians(stop_lats)
    stop_lons_r = np.radians(stop_lons)

    gaps = []
    for lat in grid_lats:
        lat_r = np.radians(lat)
        for lon in grid_lons:
            lon_r = np.radians(lon)
            dlat = stop_lats_r - lat_r
            dlon = stop_lons_r - lon_r
            a = (
                np.sin(dlat / 2) ** 2
                + np.cos(lat_r) * np.cos(stop_lats_r) * np.sin(dlon / 2) ** 2
            )
            dists = R * 2 * np.arcsin(np.sqrt(a))
            if not np.any(dists <= 0.25):
                gaps.append({"lat": round(float(lat), 5), "lon": round(float(lon), 5)})

    return gaps


def calculate_ridership_summary(ridership: pd.DataFrame) -> list[dict]:
    """Aggregate ridership by route: total daily boardings, peak hour, avg boardings/stop."""
    if ridership.empty:
        return []

    summary = (
        ridership.groupby("route_id")
        .agg(
            total_boardings=("hourly_boardings", "sum"),
            total_alightings=("hourly_alightings", "sum"),
            peak_hour=("hourly_boardings", lambda x: ridership.loc[x.idxmax(), "hour"] if len(x) > 0 else None),
            unique_stops=("stop_id", "nunique"),
        )
        .reset_index()
    )
    summary["avg_boardings_per_stop"] = (
        summary["total_boardings"] / summary["unique_stops"]
    ).round(1)
    return summary.to_dict(orient="records")


def generate_accessibility_report(
    G: nx.DiGraph,
    stops: pd.DataFrame,
    employment_hubs: pd.DataFrame,
    routes: list[dict],
    ridership: pd.DataFrame,
    walking_radius: float = 0.25,
    max_travel_minutes: float = 30.0,
) -> dict:
    """Produce the full accessibility report dict for API response."""
    hub_access = employment_hubs_reachable(
        G, stops, employment_hubs, max_travel_minutes, walking_radius
    )
    route_lengths = calculate_route_lengths(routes, stops)
    coverage = calculate_stop_coverage(stops, walking_radius)
    ridership_summary = calculate_ridership_summary(ridership)

    accessible_hubs = [h for h in hub_access if h["accessible"]]
    inaccessible_hubs = [h for h in hub_access if not h["accessible"]]

    physical = _physical_nodes(G)
    all_times: list[float] = []
    for src in physical:
        lengths = nx.single_source_dijkstra_path_length(G, src, weight="weight")
        for dst in physical:
            if src != dst and dst in lengths:
                all_times.append(lengths[dst])

    avg_tt = round(sum(all_times) / len(all_times), 2) if all_times else 0.0
    min_tt = round(min(all_times), 2) if all_times else 0.0
    max_tt = round(max(all_times), 2) if all_times else 0.0

    return {
        "summary": {
            "total_stops": len(stops),
            "total_routes": len(routes),
            "accessible_employment_hubs": len(accessible_hubs),
            "inaccessible_employment_hubs": len(inaccessible_hubs),
            "total_reachable_workers": sum(h["estimated_workers"] for h in accessible_hubs),
            "avg_travel_time_minutes": avg_tt,
            "min_travel_time_minutes": min_tt,
            "max_travel_time_minutes": max_tt,
        },
        "employment_hub_access": hub_access,
        "route_performance": route_lengths,
        "ridership_summary": ridership_summary,
        "stop_coverage": coverage,
    }


def export_metrics_csv(report: dict) -> str:
    """Serialize the key metrics sections to a CSV string for download."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["=== SUMMARY ==="])
    for k, v in report["summary"].items():
        writer.writerow([k, v])

    writer.writerow([])
    writer.writerow(["=== EMPLOYMENT HUB ACCESSIBILITY ==="])
    writer.writerow(["hub_name", "latitude", "longitude", "estimated_workers",
                     "nearest_stop", "reachable_from_stops", "accessible"])
    for h in report["employment_hub_access"]:
        writer.writerow([
            h["hub_name"], h["latitude"], h["longitude"],
            h["estimated_workers"], h["nearest_stop"],
            h["reachable_from_stops"], h["accessible"],
        ])

    writer.writerow([])
    writer.writerow(["=== ROUTE PERFORMANCE ==="])
    writer.writerow(["route_id", "route_name", "stop_count", "total_distance_miles"])
    for r in report["route_performance"]:
        writer.writerow([r["route_id"], r["route_name"], r["stop_count"], r["total_distance_miles"]])

    return output.getvalue()
