"""Core transit network simulation engine using NetworkX."""

from math import radians, cos, sin, asin, sqrt
from typing import Optional
import networkx as nx
import pandas as pd


# ── Geometry ──────────────────────────────────────────────────────────────────

def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles between two lat/lon points."""
    R = 3958.8  # Earth radius in miles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * asin(sqrt(a))


def travel_time_minutes(
    distance_miles: float,
    speed_mph: float = 15.0,
    dwell_time: float = 0.5,
) -> float:
    """Estimate travel time between two consecutive stops."""
    return (distance_miles / speed_mph) * 60 + dwell_time


# ── Graph Construction ─────────────────────────────────────────────────────────

def build_transit_graph(
    routes: list[dict],
    stops: pd.DataFrame,
    speed_mph: float = 15.0,
    dwell_time: float = 0.5,
    transfer_penalty: float = 5.0,
) -> nx.DiGraph:
    """
    Build a directed weighted graph of the transit network.

    Uses an expanded line-graph approach so transfer penalties are correctly
    applied when a shortest path requires switching routes.

    Physical stop nodes  : stop_id          (origin / destination for queries)
    Route-specific nodes : "stop_id@route_id" (in-vehicle position)

    Edges:
      physical -> route_node   : weight 0   (boarding)
      route_node -> physical   : weight 0   (alighting)
      route_node -> next_route : weight t   (travel along route)
      route_nodeA -> route_nodeB at same stop : weight transfer_penalty
    """
    stop_index: dict[str, dict] = {}
    for _, row in stops.iterrows():
        stop_index[str(row["stop_id"])] = {
            "name": row["stop_name"],
            "lat": float(row["latitude"]),
            "lon": float(row["longitude"]),
        }

    G = nx.DiGraph()

    # Add physical stop nodes (used as origins/destinations in all queries)
    for sid, attrs in stop_index.items():
        G.add_node(sid, **attrs)

    # Track which routes serve each stop (for transfer detection)
    stop_routes: dict[str, set[str]] = {}

    for route in routes:
        route_id = route["route_id"]
        stop_ids = route["stop_ids"]

        for i in range(len(stop_ids) - 1):
            src = stop_ids[i]
            dst = stop_ids[i + 1]

            if src not in stop_index or dst not in stop_index:
                continue

            src_r = f"{src}@{route_id}"
            dst_r = f"{dst}@{route_id}"

            s = stop_index[src]
            d = stop_index[dst]
            dist = haversine_miles(s["lat"], s["lon"], d["lat"], d["lon"])
            time = travel_time_minutes(dist, speed_mph, dwell_time)

            # Add route-specific nodes if not already present
            if src_r not in G:
                G.add_node(src_r, **stop_index[src], route_id=route_id)
            if dst_r not in G:
                G.add_node(dst_r, **stop_index[dst], route_id=route_id)

            # Travel edges along route (bidirectional, keep fastest)
            if not G.has_edge(src_r, dst_r) or G[src_r][dst_r]["weight"] > time:
                G.add_edge(src_r, dst_r, weight=time, route_id=route_id, distance_miles=dist)
            if not G.has_edge(dst_r, src_r) or G[dst_r][src_r]["weight"] > time:
                G.add_edge(dst_r, src_r, weight=time, route_id=route_id, distance_miles=dist)

            # Boarding: physical stop -> route-specific node (free)
            if not G.has_edge(src, src_r):
                G.add_edge(src, src_r, weight=0)
            if not G.has_edge(dst, dst_r):
                G.add_edge(dst, dst_r, weight=0)

            # Alighting: route-specific node -> physical stop (free)
            if not G.has_edge(src_r, src):
                G.add_edge(src_r, src, weight=0)
            if not G.has_edge(dst_r, dst):
                G.add_edge(dst_r, dst, weight=0)

            stop_routes.setdefault(src, set()).add(route_id)
            stop_routes.setdefault(dst, set()).add(route_id)

    # Add transfer edges between routes at shared stops
    for sid, routes_set in stop_routes.items():
        routes_list = list(routes_set)
        if len(routes_list) > 1:
            G.nodes[sid]["transfer_stop"] = True
            for i, r1 in enumerate(routes_list):
                for r2 in routes_list[i + 1:]:
                    n1 = f"{sid}@{r1}"
                    n2 = f"{sid}@{r2}"
                    if n1 in G and n2 in G:
                        G.add_edge(n1, n2, weight=transfer_penalty, transfer=True)
                        G.add_edge(n2, n1, weight=transfer_penalty, transfer=True)

    return G


def _physical_nodes(G: nx.DiGraph) -> list[str]:
    """Return only the physical stop node IDs (excludes route-specific nodes)."""
    return [n for n in G.nodes if "@" not in str(n)]


# ── Shortest Path / Travel Time ────────────────────────────────────────────────

def shortest_travel_time(
    G: nx.DiGraph, source: str, target: str
) -> Optional[float]:
    """Return shortest travel time in minutes between physical stops, or None."""
    try:
        return nx.shortest_path_length(G, source, target, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def all_pairs_travel_times(G: nx.DiGraph) -> dict[str, dict[str, float]]:
    """
    Compute all-pairs shortest travel times between physical stops only.
    Returns {src_stop_id: {dst_stop_id: minutes}}.
    """
    physical = set(_physical_nodes(G))
    lengths: dict[str, dict[str, float]] = {}
    for src in physical:
        src_lengths = nx.single_source_dijkstra_path_length(G, src, weight="weight")
        lengths[src] = {k: v for k, v in src_lengths.items() if k in physical}
    return lengths


# ── Coverage Analysis ──────────────────────────────────────────────────────────

def stops_within_walking_distance(
    stops: pd.DataFrame,
    center_lat: float,
    center_lon: float,
    radius_miles: float = 0.25,
) -> list[str]:
    """Return stop_ids within walking radius of a point."""
    result = []
    for _, row in stops.iterrows():
        d = haversine_miles(center_lat, center_lon, row["latitude"], row["longitude"])
        if d <= radius_miles:
            result.append(str(row["stop_id"]))
    return result


def get_coverage_circles(
    stops: pd.DataFrame, radius_miles: float = 0.25
) -> list[dict]:
    """Return a list of {stop_id, lat, lon, radius_miles} for map rendering."""
    circles = []
    for _, row in stops.iterrows():
        circles.append(
            {
                "stop_id": str(row["stop_id"]),
                "lat": float(row["latitude"]),
                "lon": float(row["longitude"]),
                "radius_miles": radius_miles,
            }
        )
    return circles


# ── Employment Hub Accessibility ───────────────────────────────────────────────

def nearest_stop_to_hub(
    hub_lat: float, hub_lon: float, stops: pd.DataFrame, radius_miles: float = 0.25
) -> Optional[str]:
    """Return the stop_id of the nearest stop within walking radius of a hub."""
    best_id = None
    best_dist = float("inf")
    for _, row in stops.iterrows():
        d = haversine_miles(hub_lat, hub_lon, row["latitude"], row["longitude"])
        if d <= radius_miles and d < best_dist:
            best_dist = d
            best_id = str(row["stop_id"])
    return best_id


def employment_hubs_reachable(
    G: nx.DiGraph,
    stops: pd.DataFrame,
    employment_hubs: pd.DataFrame,
    max_travel_minutes: float = 30.0,
    walking_radius_miles: float = 0.25,
) -> list[dict]:
    """
    For each employment hub, compute which stops can reach it within max_travel_minutes.
    Only considers physical stop nodes.
    """
    physical = set(_physical_nodes(G))
    results = []

    for _, hub in employment_hubs.iterrows():
        hub_stop = nearest_stop_to_hub(
            hub["latitude"], hub["longitude"], stops, walking_radius_miles
        )

        if hub_stop is None or hub_stop not in G.nodes:
            results.append(
                {
                    "hub_name": hub["hub_name"],
                    "latitude": float(hub["latitude"]),
                    "longitude": float(hub["longitude"]),
                    "estimated_workers": int(hub["estimated_workers"]),
                    "nearest_stop": None,
                    "reachable_from_stops": 0,
                    "accessible": False,
                }
            )
            continue

        reachable = 0
        for node in physical:
            t = shortest_travel_time(G, node, hub_stop)
            if t is not None and t <= max_travel_minutes:
                reachable += 1

        results.append(
            {
                "hub_name": hub["hub_name"],
                "latitude": float(hub["latitude"]),
                "longitude": float(hub["longitude"]),
                "estimated_workers": int(hub["estimated_workers"]),
                "nearest_stop": hub_stop,
                "reachable_from_stops": reachable,
                "accessible": reachable > 0,
            }
        )
    return results


# ── Network Comparison ─────────────────────────────────────────────────────────

def compare_networks(
    current_graph: nx.DiGraph,
    proposed_graph: nx.DiGraph,
    stops: pd.DataFrame,
    employment_hubs: pd.DataFrame,
    max_travel_minutes: float = 30.0,
    walking_radius: float = 0.25,
) -> dict:
    """
    Compare current vs proposed transit network on key metrics.
    Returns a dict with 'current', 'proposed', and 'delta' sections.
    """
    current_metrics = _network_metrics(
        current_graph, stops, employment_hubs, max_travel_minutes, walking_radius
    )
    proposed_metrics = _network_metrics(
        proposed_graph, stops, employment_hubs, max_travel_minutes, walking_radius
    )

    delta = {
        "total_stops_delta": proposed_metrics["total_stops"] - current_metrics["total_stops"],
        "total_edges_delta": proposed_metrics["total_edges"] - current_metrics["total_edges"],
        "avg_travel_time_delta": round(
            proposed_metrics["avg_travel_time_minutes"]
            - current_metrics["avg_travel_time_minutes"],
            2,
        ),
        "accessible_hubs_delta": proposed_metrics["accessible_hubs"] - current_metrics["accessible_hubs"],
        "total_reachable_workers_delta": proposed_metrics["total_reachable_workers"] - current_metrics["total_reachable_workers"],
        "coverage_stops_delta": proposed_metrics["coverage_stops"] - current_metrics["coverage_stops"],
    }

    return {
        "current": current_metrics,
        "proposed": proposed_metrics,
        "delta": delta,
    }


def _network_metrics(
    G: nx.DiGraph,
    stops: pd.DataFrame,
    employment_hubs: pd.DataFrame,
    max_travel_minutes: float,
    walking_radius: float,
) -> dict:
    """Compute summary metrics for a single network state."""
    hub_access = employment_hubs_reachable(
        G, stops, employment_hubs, max_travel_minutes, walking_radius
    )

    accessible_hubs = sum(1 for h in hub_access if h["accessible"])
    total_workers = sum(
        h["estimated_workers"] for h in hub_access if h["accessible"]
    )

    # Average travel time across all reachable physical-stop pairs
    physical = _physical_nodes(G)
    all_times: list[float] = []
    for src in physical:
        lengths = nx.single_source_dijkstra_path_length(G, src, weight="weight")
        for dst in physical:
            if src != dst and dst in lengths:
                all_times.append(lengths[dst])

    avg_time = round(sum(all_times) / len(all_times), 2) if all_times else 0.0

    return {
        "total_stops": len(physical),
        "total_edges": G.number_of_edges(),
        "avg_travel_time_minutes": avg_time,
        "accessible_hubs": accessible_hubs,
        "total_reachable_workers": total_workers,
        "coverage_stops": len(physical),
        "hub_details": hub_access,
    }
