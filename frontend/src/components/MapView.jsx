import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ── Employment hub star icon ───────────────────────────────────────────────────
function makeHubIcon(size = 28) {
  return L.divIcon({
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [size / 2, -size / 2],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="#f59e0b" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"
      />
    </svg>`,
  });
}
const HUB_ICON = makeHubIcon(28);

const ST_GEORGE_CENTER = [37.108, -113.583];
const ST_GEORGE_ZOOM   = 13;
const WALKING_RADIUS_M = 402.34; // 0.25 miles in meters

// ─── Coordinate validation ─────────────────────────────────────────────────────
// Leaflet requires [lat, lng]. Mapbox/GeoJSON APIs return [lng, lat].
// This utility catches swapped coords before they reach Leaflet.
function isValidLatLng(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function validateCoords(coords, context = "") {
  return coords.filter(([lat, lng]) => {
    if (!isValidLatLng(lat, lng)) {
      console.warn(`[SunTran] Invalid coord dropped in "${context}": [${lat}, ${lng}]`);
      return false;
    }
    return true;
  });
}

// ─── Bounds helper ─────────────────────────────────────────────────────────────
// Returns [[minLat, minLng], [maxLat, maxLng]] — Leaflet fitBounds format.
// Avoids importing L directly; works with coords already in [lat, lng] order.
function getBounds(coords) {
  if (!coords || coords.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}

// ─── Routing (Mapbox Directions) ───────────────────────────────────────────────
const segmentCache         = new Map(); // [lat,lng] coords per stop pair
const segmentDurationCache = new Map(); // travel seconds per stop pair

async function getRoadSegment(start, end) {
  // start/end are [lat, lng] — Mapbox needs lon,lat
  const key = `${start[0]},${start[1]}-${end[0]},${end[1]}`;
  if (segmentCache.has(key)) return segmentCache.get(key);

  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${start[1]},${start[0]};${end[1]},${end[0]}` +
      `?geometries=geojson&access_token=${token}`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.routes?.length > 0) {
      const mapboxRoute = data.routes[0];
      // Mapbox returns [lng, lat] — convert every coord to [lat, lng] for Leaflet
      const coords = validateCoords(
        mapboxRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        `Mapbox ${start} → ${end}`
      );
      if (coords.length >= 2) {
        segmentCache.set(key, coords);
        segmentDurationCache.set(key, mapboxRoute.duration ?? 0); // seconds
        return coords;
      }
    }
  } catch (_) {}

  return [start, end]; // fallback: straight line
}

async function buildRoadRoute(stopCoords) {
  if (stopCoords.length < 2) return stopCoords;
  // Sequential — avoids Mapbox rate-limiting from simultaneous bursts
  let fullRoute = [];
  for (let i = 0; i < stopCoords.length - 1; i++) {
    const segment = await getRoadSegment(stopCoords[i], stopCoords[i + 1]);
    fullRoute = fullRoute.concat(segment);
  }
  return fullRoute;
}

// ─── Travel time stats ─────────────────────────────────────────────────────────
// Reads cached Mapbox durations after buildRoadRoute has populated them.
// Returns null if no duration data is available yet.
function getRouteTravelStats(stopCoords) {
  if (!stopCoords || stopCoords.length < 2) return null;
  let totalSeconds  = 0;
  let segments      = 0;
  for (let i = 0; i < stopCoords.length - 1; i++) {
    const key = `${stopCoords[i][0]},${stopCoords[i][1]}-${stopCoords[i+1][0]},${stopCoords[i+1][1]}`;
    const dur = segmentDurationCache.get(key);
    if (dur != null) { totalSeconds += dur; segments++; }
  }
  if (segments === 0) return null;
  const totalMinutes   = Math.round(totalSeconds / 60);
  const avgPerStop     = +(totalSeconds / segments / 60).toFixed(1);
  const longestSegIdx  = (() => {
    let maxDur = -1, maxIdx = 0;
    for (let i = 0; i < stopCoords.length - 1; i++) {
      const key = `${stopCoords[i][0]},${stopCoords[i][1]}-${stopCoords[i+1][0]},${stopCoords[i+1][1]}`;
      const d = segmentDurationCache.get(key) ?? 0;
      if (d > maxDur) { maxDur = d; maxIdx = i; }
    }
    return { idx: maxIdx, minutes: +(maxDur / 60).toFixed(1) };
  })();
  return { totalMinutes, avgPerStop, segments, longestSegIdx };
}

// ─── Stop → coord builder (with per-stop validation) ──────────────────────────
function buildRoutePolylines(routes, stops) {
  const stopMap = {};
  stops.forEach(s => { stopMap[s.stop_id] = s; });

  return routes.map(route => {
    const coords = route.stop_ids
      .map(id => {
        const s = stopMap[id];
        if (!s) return null;
        const lat = parseFloat(s.latitude);
        const lng = parseFloat(s.longitude);
        if (!isValidLatLng(lat, lng)) {
          console.warn(
            `[SunTran] Invalid stop coord — route ${route.route_id}, stop ${id}: [${lat}, ${lng}]`
          );
          return null;
        }
        return [lat, lng];
      })
      .filter(Boolean);
    return { ...route, coords };
  });
}

// ─── MapController ─────────────────────────────────────────────────────────────
// Lives inside <MapContainer> to access the Leaflet map instance via useMap().
// Stores the instance in the parent's ref so external code can call map methods.
// Uses setTimeout(..., 0) so calls run AFTER the browser finishes layout.
function MapController({ mapRef, invalidateTrigger }) {
  const map = useMap();

  useEffect(() => { mapRef.current = map; }, [map, mapRef]);

  // Invalidate on mount — handles initial render and tab-switch remounts
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);

  // Invalidate whenever the trigger increments (sidebar toggle, route select, etc.)
  useEffect(() => {
    if (invalidateTrigger === 0) return;
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [invalidateTrigger, map]);

  return null;
}

// ─── Ridership heatmap helpers ─────────────────────────────────────────────────
function buildBoardingsLookup(boardingsByStop) {
  const lookup = {};
  if (!boardingsByStop?.length) return lookup;
  boardingsByStop.forEach(row => {
    const key = (row.address || "").trim().toLowerCase();
    const val = parseFloat(row.avg_daily_in) || 0;
    if (!lookup[key] || val > lookup[key]) lookup[key] = val;
  });
  return lookup;
}

function ridershipColor(avgDaily, maxVal) {
  if (!avgDaily || maxVal === 0) return { fill: "#e6c928", opacity: 0.9 };
  const t = Math.min(avgDaily / maxVal, 1);
  // blue → yellow → red gradient
  let r, g, b;
  if (t < 0.5) {
    r = Math.round(38  + t * 2 * (230 - 38));
    g = Math.round(130 + t * 2 * (201 - 130));
    b = Math.round(200 - t * 2 * 200);
  } else {
    const t2 = (t - 0.5) * 2;
    r = Math.round(230 + t2 * (239 - 230));
    g = Math.round(201 - t2 * 201);
    b = 0;
  }
  return { fill: `rgb(${r},${g},${b})`, opacity: 1 };
}

// ─── MapView ───────────────────────────────────────────────────────────────────
export default function MapView({
  stops,
  routes,
  hubs,
  simState,
  showCoverage,
  onToggleCoverage,
  boardingsByStop,
}) {
  const mapRef = useRef(null);
  const [invalidateTrigger, setInvalidateTrigger] = useState(0);
  const [panelOpen,      setPanelOpen]      = useState(true);
  const [activeRouteId,  setActiveRouteId]  = useState(null);
  const [showHeatmap,    setShowHeatmap]    = useState(true);

  const boardingsLookup = buildBoardingsLookup(boardingsByStop);
  const maxBoarding = Math.max(...Object.values(boardingsLookup), 1);

  const {
    simulatedRoutes = {},
    simulatedStops  = [],
    activeSimulationRouteId = null,
  } = simState || {};

  // All stops including custom ones added in the simulation
  const allStopsForSim = [...stops, ...simulatedStops];

  const routeLines = buildRoutePolylines(routes, stops);

  // The single simulated route (if any) — built against all stops incl. custom
  const simRouteData = activeSimulationRouteId ? simulatedRoutes[activeSimulationRouteId] : null;
  const simRouteLine = simRouteData ? buildRoutePolylines([simRouteData], allStopsForSim)[0] : null;

  const [showHubs,      setShowHubs]      = useState(true);
  const [roadCoords,    setRoadCoords]    = useState({});
  const [simRoadCoords, setSimRoadCoords] = useState(null);
  const [routeStats,    setRouteStats]    = useState({}); // { [routeId]: stats }

  // ── Layer visibility helpers ──────────────────────────────────────────────────

  // Show only the chosen route and zoom to its bounds.
  const showRoute = (routeId) => {
    setActiveRouteId(routeId);
    const coords = roadCoords[routeId]
      || routeLines.find(r => r.route_id === routeId)?.coords;
    const bounds = getBounds(coords);
    if (bounds && mapRef.current) {
      setTimeout(() => mapRef.current.fitBounds(bounds, { padding: [50, 50] }), 0);
    }
  };

  // Restore all routes and reset to city-level view.
  const showAllRoutes = () => {
    setActiveRouteId(null);
    if (mapRef.current) {
      setTimeout(() => mapRef.current.setView(ST_GEORGE_CENTER, ST_GEORGE_ZOOM), 0);
    }
  };

  // Toggle sidebar — also invalidate map size so tiles re-anchor
  const togglePanel = () => {
    setPanelOpen(v => !v);
    setInvalidateTrigger(v => v + 1);
  };

  // ── Road-route fetching ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!routeLines.length) return;
    let cancelled = false;
    routeLines.forEach(async (route) => {
      if (route.coords.length < 2) return;
      const coords = await buildRoadRoute(route.coords);
      if (cancelled) return;
      setRoadCoords(prev => ({ ...prev, [route.route_id]: coords }));
      // Duration data is now in segmentDurationCache — compute stats
      const stats = getRouteTravelStats(route.coords);
      if (stats) setRouteStats(prev => ({ ...prev, [route.route_id]: stats }));
    });
    return () => { cancelled = true; };
  }, [routes, stops]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coordinate-based key: re-run whenever actual lat/lng values change, not just stop IDs.
  // This catches custom stops whose coords enter allStopsForSim after the stop ID was selected.
  const simCoordsKey = simRouteLine?.coords.map(c => c.join(",")).join("|") ?? "";

  useEffect(() => {
    if (!simRouteLine || simRouteLine.coords.length < 2) {
      setSimRoadCoords(null);
      return;
    }
    const coords = simRouteLine.coords; // capture current coords for this effect run
    let cancelled = false;
    buildRoadRoute(coords).then(result => {
      if (!cancelled) setSimRoadCoords(result);
    });
    return () => { cancelled = true; };
  }, [simCoordsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived render values ─────────────────────────────────────────────────────

  // When a route is active, only render stops that belong to it
  const activeStopIds = activeRouteId
    ? new Set(routeLines.find(r => r.route_id === activeRouteId)?.stop_ids || [])
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      {panelOpen && (
        <div className="panel" style={{ minWidth: 230, maxWidth: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0 }}>

          {/* ── Routes (top) ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="panel-title" style={{ margin: 0 }}>Routes</div>
            {activeRouteId && (
              <button
                onClick={showAllRoutes}
                style={{
                  fontSize: 11, padding: "3px 8px", borderRadius: 5,
                  background: "rgba(230,201,40,0.15)",
                  border: "1px solid rgba(230,201,40,0.4)",
                  color: "#e6c928", cursor: "pointer",
                }}
              >
                Show all
              </button>
            )}
          </div>

          {/* Route items — clickable, highlight active */}
          <div className="panel-section scrollable" style={{ flex: 1 }}>
            {routeLines.map(r => {
              const isActive = r.route_id === activeRouteId;
              const stats    = routeStats[r.route_id];
              return (
                <div key={r.route_id}>
                  {/* ── Route row ── */}
                  <div
                    className="route-list-item"
                    onClick={() => isActive ? showAllRoutes() : showRoute(r.route_id)}
                    style={{
                      cursor: "pointer",
                      flexWrap: "wrap",
                      background: isActive
                        ? `${r.color}28`
                        : activeRouteId ? "rgba(255,255,255,0.03)" : undefined,
                      border: isActive
                        ? `1px solid ${r.color}`
                        : activeRouteId ? "1px solid rgba(255,255,255,0.06)" : undefined,
                      opacity: activeRouteId && !isActive ? 0.45 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      className="route-badge"
                      style={{
                        background: r.color || "#3388ff",
                        boxShadow: isActive ? `0 0 6px ${r.color}` : "none",
                      }}
                    />
                    <span className="name" style={{ color: isActive ? "#eef3f8" : undefined, flex: 1 }}>
                      {r.route_name}
                    </span>
                    {/* Quick time badge — visible on all loaded routes */}
                    {stats ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: isActive ? r.color : "#7a9ab5",
                        background: isActive ? `${r.color}22` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isActive ? r.color + "55" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 4, padding: "1px 5px", marginLeft: 4,
                      }}>
                        ~{stats.totalMinutes} min
                      </span>
                    ) : (
                      <span className="stop-count">
                        {roadCoords[r.route_id] ? r.stop_ids.length : "…"} stops
                      </span>
                    )}
                  </div>

                  {/* ── Expanded stats card (active route only) ── */}
                  {isActive && stats && (
                    <div style={{
                      margin: "2px 0 4px",
                      padding: "10px 12px",
                      background: `${r.color}12`,
                      border: `1px solid ${r.color}40`,
                      borderLeft: `3px solid ${r.color}`,
                      borderRadius: "0 0 6px 6px",
                      fontSize: 11,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ color: "#7a9ab5" }}>Total travel time</span>
                        <span style={{ fontWeight: 700, color: "#eef3f8" }}>
                          {stats.totalMinutes} min
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ color: "#7a9ab5" }}>Avg between stops</span>
                        <span style={{ fontWeight: 700, color: "#eef3f8" }}>
                          {stats.avgPerStop} min
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ color: "#7a9ab5" }}>Longest segment</span>
                        <span style={{ fontWeight: 700, color: "#eef3f8" }}>
                          {stats.longestSegIdx.minutes} min
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#7a9ab5" }}>Stops</span>
                        <span style={{ fontWeight: 700, color: "#eef3f8" }}>
                          {r.stop_ids.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Loading state — route selected but stats not yet available */}
                  {isActive && !stats && roadCoords[r.route_id] === undefined && (
                    <div style={{
                      margin: "2px 0 4px", padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "0 0 6px 6px",
                      fontSize: 11, color: "#7a9ab5",
                    }}>
                      Calculating travel times…
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {simRouteLine && (
            <>
              <hr className="divider" />
              <div className="panel-title" style={{ color: "#a78bfa", marginBottom: 6 }}>Simulated Route</div>
              <div className="panel-section">
                <div className="route-list-item">
                  <span className="route-badge" style={{ background: simRouteLine.color || "#a78bfa", outline: "2px solid #a78bfa" }} />
                  <span className="name">{simRouteLine.route_name}</span>
                  <span className="stop-count">{simRouteLine.stop_ids.length} stops</span>
                </div>
                {activeSimulationRouteId && routes.find(r => r.route_id === activeSimulationRouteId) && (
                  <div className="route-list-item" style={{ opacity: 0.6, marginTop: 4 }}>
                    <span className="route-badge" style={{ background: "#888", outline: "2px dashed #888" }} />
                    <span className="name" style={{ color: "var(--muted)" }}>
                      Original: {routes.find(r => r.route_id === activeSimulationRouteId).route_name}
                    </span>
                  </div>
                )}
                {simulatedStops.length > 0 && (
                  <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 6 }}>
                    + {simulatedStops.length} custom stop{simulatedStops.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Map Layers (bottom) ── */}
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <hr className="divider" style={{ marginBottom: 10 }} />

            <div className="panel-title" style={{ marginBottom: 8 }}>Map Layers</div>

            <div className="panel-section" style={{ gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={showHeatmap} onChange={() => setShowHeatmap(v => !v)} />
                Ridership heatmap
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={showCoverage} onChange={onToggleCoverage} />
                0.25-mile coverage
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={showHubs} onChange={() => setShowHubs(v => !v)} />
                Employment hubs
              </label>
            </div>

            {/* Inline legend */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {!showHeatmap && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e6c928", display: "inline-block", flexShrink: 0 }} />
                  Bus stop
                </div>
              )}
              {showHeatmap && (
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  <div style={{ marginBottom: 3 }}>Boardings: low → high</div>
                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: "linear-gradient(to right, rgb(38,130,200), rgb(230,201,0), rgb(239,0,0))" }} />
                </div>
              )}
              {showHubs && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                      fill="#f59e0b" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  Employment hub
                </div>
              )}
              {showCoverage && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(230,201,40,0.2)", border: "1px solid #e6c928", display: "inline-block", flexShrink: 0 }} />
                  0.25mi walk zone
                </div>
              )}
            </div>

            <hr className="divider" style={{ marginTop: 10 }} />
            <button className="btn-ghost" onClick={togglePanel} style={{ fontSize: 12, width: "100%" }}>
              ◀ Hide panel
            </button>
          </div>

        </div>
      )}

      {/* ── Map area ─────────────────────────────────────────────────────────────
          Wrapper uses position:relative so MapContainer can fill it absolutely,
          giving Leaflet real pixel dimensions rather than flex-computed percentages.

          CRITICAL — do NOT apply CSS `transform` to this element or any ancestor.
          Leaflet uses getBoundingClientRect() to position tiles and markers.
          Any ancestor transform shifts that rect and causes the basemap to appear
          offset from all overlaid markers and polylines. ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

        {!panelOpen && (
          <button
            onClick={togglePanel}
            style={{
              position: "absolute", top: 10, left: 10, zIndex: 1000,
              background: "#002444", border: "1px solid #00427a",
              color: "#e6c928", borderRadius: 6, padding: "6px 10px",
              fontSize: 12, cursor: "pointer",
            }}
          >
            ▶ Layers
          </button>
        )}

        <MapContainer
          center={ST_GEORGE_CENTER}
          zoom={ST_GEORGE_ZOOM}
          zoomControl={true}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <MapController mapRef={mapRef} invalidateTrigger={invalidateTrigger} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ── Current routes ──
              Active route: heavier weight (8), full opacity, glowing color.
              Inactive routes: hidden when a route is selected.
              Route being simulated: rendered as gray dashed (original baseline). */}
          {routeLines.map(route => {
            const isActive   = route.route_id === activeRouteId;
            const isSimTarget = route.route_id === activeSimulationRouteId;
            const isVisible  = !activeRouteId || isActive;
            if (!isVisible || route.coords.length < 2) return null;

            const positions = roadCoords[route.route_id] || route.coords;
            return (
              <Polyline
                key={route.route_id}
                positions={positions}
                pathOptions={isSimTarget ? {
                  color: "#888888", weight: 3, opacity: 0.7, dashArray: "6 6",
                } : {
                  color:   route.color || "#3388ff",
                  weight:  isActive ? 8 : 5,
                  opacity: isActive ? 1 : 0.9,
                }}
              >
                <Popup>
                  <b>{route.route_name}</b>{isSimTarget ? " (original)" : ""}<br />
                  {route.stop_ids.length} stops
                </Popup>
              </Polyline>
            );
          })}

          {/* ── Simulated route overlay — solid colored line over the gray dashed original ── */}
          {simRouteLine && simRouteLine.coords.length > 1 && (
            <Polyline
              key={`sim-${simRouteLine.route_id}`}
              positions={simRoadCoords || simRouteLine.coords}
              pathOptions={{ color: simRouteLine.color || "#a78bfa", weight: 6, opacity: 1 }}
            >
              <Popup>
                <b>[Simulated] {simRouteLine.route_name}</b><br />
                {simRouteLine.stop_ids.length} stops
              </Popup>
            </Polyline>
          )}

          {/* ── Custom stops added in simulation ── */}
          {simulatedStops.map(stop => (
            <CircleMarker
              key={`simstop-${stop.stop_id}`}
              center={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
              radius={8}
              pathOptions={{ color: "#fff", fillColor: "#a78bfa", fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <b>★ {stop.stop_name}</b><br />
                <span style={{ fontSize: 11, color: "#888" }}>Custom simulation stop</span>
              </Tooltip>
              <Popup>
                <b>★ {stop.stop_name}</b><br />
                Custom stop<br />
                {parseFloat(stop.latitude).toFixed(5)}, {parseFloat(stop.longitude).toFixed(5)}
              </Popup>
            </CircleMarker>
          ))}

          {/* ── Coverage circles ── */}
          {showCoverage && stops
            .filter(stop => !activeStopIds || activeStopIds.has(stop.stop_id))
            .map(stop => (
              <Circle
                key={`cov-${stop.stop_id}`}
                center={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
                radius={WALKING_RADIUS_M}
                pathOptions={{ color: "#e6c928", fillColor: "#e6c928", fillOpacity: 0.07, weight: 1 }}
              />
            ))
          }

          {/* ── Bus stops — when route is active, show only stops on that route ── */}
          {stops
            .filter(stop => !activeStopIds || activeStopIds.has(stop.stop_id))
            .map(stop => {
              const addrKey = (stop.address || "").trim().toLowerCase();
              const nameKey = (stop.stop_name || "").trim().toLowerCase();
              const avgDaily = boardingsLookup[addrKey] || boardingsLookup[nameKey] || 0;
              const { fill, opacity } = showHeatmap
                ? ridershipColor(avgDaily, maxBoarding)
                : { fill: "#e6c928", opacity: 1 };
              const radius = showHeatmap
                ? Math.max(5, Math.min(14, 5 + (avgDaily / maxBoarding) * 9))
                : (activeStopIds ? 7 : 6);
              return (
                <CircleMarker
                  key={stop.stop_id}
                  center={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
                  radius={radius}
                  pathOptions={{ color: "#fff", fillColor: fill, fillOpacity: opacity, weight: activeStopIds ? 2.5 : 2 }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <b>{stop.stop_name}</b><br />
                    {showHeatmap && avgDaily > 0 && <span>{avgDaily} avg boardings/day<br /></span>}
                    <span style={{ fontSize: 11, color: "#888" }}>{stop.stop_id}</span>
                  </Tooltip>
                  <Popup>
                    <b>{stop.stop_name}</b><br />
                    ID: {stop.stop_id}<br />
                    {showHeatmap && avgDaily > 0 && <>Avg boardings/day: {avgDaily}<br /></>}
                    {parseFloat(stop.latitude).toFixed(5)}, {parseFloat(stop.longitude).toFixed(5)}
                  </Popup>
                </CircleMarker>
              );
            })
          }

          {/* ── Employment hubs (star markers) ── */}
          {showHubs && hubs.map((hub, i) => (
            <Marker
              key={`hub-${i}`}
              position={[parseFloat(hub.latitude), parseFloat(hub.longitude)]}
              icon={HUB_ICON}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <b>{hub.hub_name}</b><br />
                {hub.estimated_workers.toLocaleString()} workers
              </Tooltip>
              <Popup>
                <b>{hub.hub_name}</b><br />
                Workers: {hub.estimated_workers.toLocaleString()}<br />
                {parseFloat(hub.latitude).toFixed(5)}, {parseFloat(hub.longitude).toFixed(5)}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
