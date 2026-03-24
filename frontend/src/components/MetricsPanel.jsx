import React, { useState } from "react";
import { exportMetricsCsv } from "../api/client";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ROUTE_COLORS = {
  R1: "#e53e3e", R2: "#3182ce", R3: "#38a169",
  R4: "#d69e2e", R5: "#805ad5", R6: "#319795",
  R7: "#dd6b20", R8: "#c05621",
};

// ─── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({ modalKey, metrics, onClose }) {
  if (!modalKey) return null;

  const s = metrics?.summary ?? {};
  const routePerf = metrics?.route_performance ?? [];
  const hubAccess = metrics?.employment_hub_access ?? [];

  const accessibleHubs = hubAccess.filter((h) => h.accessible === true);
  const gapHubs = hubAccess.filter((h) => h.accessible === false);
  const totalGapWorkers = gapHubs.reduce((sum, h) => sum + (h.estimated_workers || 0), 0);
  const totalReachableWorkers = accessibleHubs.reduce((sum, h) => sum + (h.estimated_workers || 0), 0);

  const maxTravelWarning = s.max_travel_time_minutes > 120;

  const modalContent = {
    total_stops: {
      title: "Total Stops",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            <strong>What counts as a stop?</strong> Each unique bus stop in the network is counted
            once, identified by its <code>stop_id</code>. A stop may be served by multiple routes.
            Custom stops added during simulation are included in this count.
          </p>
          <table>
            <thead>
              <tr>
                <th>Route ID</th>
                <th>Route Name</th>
                <th>Stop Count</th>
              </tr>
            </thead>
            <tbody>
              {routePerf.map((r, i) => {
                const color = ROUTE_COLORS[r.route_id];
                return (
                  <tr key={i}>
                    <td>
                      <span
                        className="tag"
                        style={color ? { background: color, color: "#fff", borderColor: color } : undefined}
                      >
                        {r.route_id}
                      </span>
                    </td>
                    <td>{r.route_name}</td>
                    <td>{r.stop_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, fontStyle: "italic" }}>
            Note: Individual stops shared across multiple routes are counted once in the total,
            so the sum of per-route stop counts may exceed the network total.
          </p>
        </>
      ),
    },

    total_routes: {
      title: "Total Routes",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Full route performance breakdown for all routes currently loaded in the network.
          </p>
          <table>
            <thead>
              <tr>
                <th>Route ID</th>
                <th>Name</th>
                <th>Stops</th>
                <th>Distance (mi)</th>
                <th>Coverage %</th>
              </tr>
            </thead>
            <tbody>
              {routePerf.map((r, i) => {
                const color = ROUTE_COLORS[r.route_id];
                const coveragePct =
                  s.total_stops && s.total_stops > 0
                    ? ((r.stop_count / s.total_stops) * 100).toFixed(1) + "%"
                    : "—";
                return (
                  <tr key={i}>
                    <td>
                      <span
                        className="tag"
                        style={color ? { background: color, color: "#fff", borderColor: color } : undefined}
                      >
                        {r.route_id}
                      </span>
                    </td>
                    <td>{r.route_name}</td>
                    <td>{r.stop_count}</td>
                    <td>{r.total_distance_miles}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{coveragePct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ),
    },

    accessible_hubs: {
      title: "Accessible Hubs",
      body: (
        <>
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(56,161,105,0.08)",
              border: "1px solid rgba(56,161,105,0.3)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            A hub is <strong style={{ color: "var(--success)" }}>accessible</strong> if a bus stop
            exists within <strong>0.25 miles</strong> walking distance AND that stop can be reached
            within <strong>30 minutes</strong> of travel time on the network.
          </div>
          {accessibleHubs.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No accessible hubs found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Hub Name</th>
                  <th>Workers</th>
                  <th>Nearest Stop</th>
                  <th>Reachable From</th>
                </tr>
              </thead>
              <tbody>
                {accessibleHubs.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{h.hub_name}</td>
                    <td>{h.estimated_workers?.toLocaleString()}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{h.nearest_stop || "—"}</td>
                    <td>{h.reachable_from_stops} stops</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ),
    },

    coverage_gaps: {
      title: "Coverage Gaps",
      body: (
        <>
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            These employment hubs have <strong style={{ color: "var(--danger)" }}>NO bus stop</strong>{" "}
            within 0.25 miles walking distance — completely unreachable by transit. Consider adding
            a route or stop nearby.
          </div>
          {gapHubs.length === 0 ? (
            <p style={{ color: "var(--success)", fontSize: 13, fontWeight: 600 }}>
              ✓ No coverage gaps — all hubs are reachable.
            </p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Hub Name</th>
                    <th>Estimated Workers</th>
                  </tr>
                </thead>
                <tbody>
                  {gapHubs.map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{h.hub_name}</td>
                      <td>{h.estimated_workers?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  marginTop: 14,
                  padding: "8px 12px",
                  background: "var(--surface-2, rgba(0,0,0,0.15))",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--danger)",
                }}
              >
                Total workers affected: {totalGapWorkers.toLocaleString()}
              </div>
            </>
          )}
        </>
      ),
    },

    reachable_workers: {
      title: "Reachable Workers",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Total estimated employees at employment hubs that are accessible by transit (a bus stop
            within 0.25 miles and reachable within 30 minutes).
          </p>
          {accessibleHubs.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No accessible hubs found.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Hub Name</th>
                    <th>Workers</th>
                    <th>Reachable From</th>
                  </tr>
                </thead>
                <tbody>
                  {[...accessibleHubs]
                    .sort((a, b) => (b.estimated_workers || 0) - (a.estimated_workers || 0))
                    .map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{h.hub_name}</td>
                        <td>{h.estimated_workers?.toLocaleString()}</td>
                        <td>{h.reachable_from_stops} stops</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div
                style={{
                  marginTop: 14,
                  padding: "8px 12px",
                  background: "var(--surface-2, rgba(0,0,0,0.15))",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--success)",
                }}
              >
                Total reachable workers: {totalReachableWorkers.toLocaleString()}
              </div>
            </>
          )}
        </>
      ),
    },

    avg_travel_time: {
      title: "Avg Travel Time",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Average shortest-path travel time across <strong>all stop pairs</strong> in the network,
            in minutes. Calculated using Dijkstra's algorithm at{" "}
            <strong>15 mph average speed</strong> + <strong>0.5 min dwell per stop</strong> +{" "}
            <strong>5 min transfer penalty</strong>.
          </p>
          <table>
            <thead>
              <tr>
                <th>Statistic</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Average</td>
                <td>
                  <strong>{s.avg_travel_time_minutes} min</strong>
                </td>
              </tr>
              <tr>
                <td>Maximum</td>
                <td>{s.max_travel_time_minutes} min</td>
              </tr>
            </tbody>
          </table>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 14,
              fontStyle: "italic",
              lineHeight: 1.6,
            }}
          >
            A lower average travel time means riders can reach destinations faster on average.
            Improvements like new transfer points, express routes, or shortened route lengths
            will reduce this figure.
          </p>
        </>
      ),
    },

    max_travel_time: {
      title: "Max Travel Time",
      body: (
        <>
          {maxTravelWarning && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(217,119,6,0.09)",
                border: "1px solid #d97706",
                borderRadius: 6,
                fontSize: 13,
                color: "#92400e",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              <strong>⚠ This value may indicate a data issue.</strong> A travel time of{" "}
              {s.max_travel_time_minutes} minutes (
              {(s.max_travel_time_minutes / 60).toFixed(1)} hours) suggests two stops may be
              connected by a very long route with no shortcuts. Check Route R8 (Zion) which spans
              approximately 102 miles.
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              What causes high max travel time?
            </div>
            <ul
              style={{
                fontSize: 13,
                color: "var(--muted)",
                lineHeight: 1.8,
                paddingLeft: 20,
                marginBottom: 0,
              }}
            >
              <li>Very long routes with stops far apart</li>
              <li>No available transfer shortcuts between routes</li>
              <li>Stops that are only reachable via a single long path</li>
              <li>Routes that loop or backtrack significantly</li>
            </ul>
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "8px 12px",
              background: "var(--surface-2, rgba(0,0,0,0.15))",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--text)",
            }}
          >
            Current max travel time: <strong>{s.max_travel_time_minutes} min</strong>
          </div>
        </>
      ),
    },
  };

  const content = modalContent[modalKey];
  if (!content) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 24,
          maxWidth: 560,
          width: "90%",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>{content.title}</div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "var(--muted)",
              lineHeight: 1,
              padding: "0 4px",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ fontSize: 13 }}>{content.body}</div>
      </div>
    </div>
  );
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, unit, delta, warning, warningSubtitle, onClick }) {
  const deltaClass =
    delta === undefined
      ? ""
      : delta > 0
      ? "delta-positive"
      : delta < 0
      ? "delta-negative"
      : "delta-neutral";

  return (
    <div
      className="stat-box"
      onClick={onClick}
      style={{
        ...(warning
          ? { border: "2px solid #d97706", background: "rgba(217,119,6,0.07)" }
          : undefined),
        ...(onClick ? { cursor: "pointer", position: "relative" } : undefined),
      }}
    >
      {onClick && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            fontSize: 11,
            color: "var(--muted)",
            opacity: 0.6,
            lineHeight: 1,
            userSelect: "none",
          }}
          title="Click for details"
        >
          ⓘ
        </span>
      )}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {unit && <div className="stat-unit">{unit}</div>}
      {warning && warningSubtitle && (
        <div style={{ fontSize: 10, color: "#d97706", marginTop: 2, fontStyle: "italic" }}>
          {warningSubtitle}
        </div>
      )}
      {delta !== undefined && (
        <div className={`stat-unit ${deltaClass}`} style={{ fontWeight: 700, marginTop: 2 }}>
          {delta > 0 ? `+${delta}` : delta} vs current
        </div>
      )}
    </div>
  );
}

// ─── HubAccessTable ───────────────────────────────────────────────────────────

function HubAccessTable({ hubs, title }) {
  if (!hubs || hubs.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th>Hub</th>
            <th>Workers</th>
            <th>Nearest Stop</th>
            <th>Reachable From</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {hubs.map((h, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{h.hub_name}</td>
              <td>{h.estimated_workers?.toLocaleString()}</td>
              <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                {h.nearest_stop || "—"}
              </td>
              <td>{h.reachable_from_stops} stops</td>
              <td>
                <span className={`tag ${h.accessible ? "tag-green" : "tag-red"}`}>
                  {h.accessible ? "Accessible" : "Gap"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Gap explanation note */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--danger)" }}>Gap</strong> means no bus stop exists within
        0.25 miles walking distance of this hub. These locations are completely unreachable by
        transit. Consider adding a route or stop nearby.
      </div>
    </div>
  );
}

// ─── RoutePerformanceTable ────────────────────────────────────────────────────

function RoutePerformanceTable({ routes, totalStops }) {
  if (!routes || routes.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Route Performance</div>
      <table>
        <thead>
          <tr>
            <th>Route ID</th>
            <th>Name</th>
            <th>Stops</th>
            <th>Distance (mi)</th>
            <th>Coverage %</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => {
            const routeColor = ROUTE_COLORS[r.route_id];
            const coveragePct =
              totalStops && totalStops > 0
                ? ((r.stop_count / totalStops) * 100).toFixed(1) + "%"
                : "—";
            return (
              <tr key={i}>
                <td>
                  <span
                    className="tag"
                    style={
                      routeColor
                        ? { background: routeColor, color: "#fff", borderColor: routeColor }
                        : undefined
                    }
                  >
                    {r.route_id}
                  </span>
                </td>
                <td>{r.route_name}</td>
                <td>{r.stop_count}</td>
                <td>{r.total_distance_miles}</td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{coveragePct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── RidershipTable ───────────────────────────────────────────────────────────

function RidershipTable({ ridership }) {
  if (!ridership || ridership.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Ridership Summary</div>
      <table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Total Boardings</th>
            <th>Total Alightings</th>
            <th>Peak Hour</th>
            <th>Avg Board/Stop</th>
          </tr>
        </thead>
        <tbody>
          {ridership.map((r, i) => {
            const suspectBoarding = r.total_boardings === 0;
            const suspectAlighting = r.total_alightings === 0;
            const suspect = suspectBoarding || suspectAlighting;
            return (
              <tr
                key={i}
                style={suspect ? { background: "rgba(234,179,8,0.13)" } : undefined}
              >
                <td><span className="tag tag-blue">{r.route_id}</span></td>
                <td>
                  {r.total_boardings}
                  {suspectBoarding && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#92400e" }}>
                      ⚠ Check data
                    </span>
                  )}
                </td>
                <td>
                  {r.total_alightings}
                  {suspectAlighting && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#92400e" }}>
                      ⚠ Check data
                    </span>
                  )}
                </td>
                <td>{r.peak_hour}:00</td>
                <td>{r.avg_boardings_per_stop}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ComparisonSection ────────────────────────────────────────────────────────

function ComparisonSection({ simResult }) {
  if (!simResult) return null;
  const { current, proposed, delta } = simResult;

  const rows = [
    { label: "Total Stops", cur: current.total_stops, prop: proposed.total_stops, d: delta.total_stops_delta },
    { label: "Total Route Segments", cur: current.total_edges, prop: proposed.total_edges, d: delta.total_edges_delta },
    { label: "Avg Travel Time (min)", cur: current.avg_travel_time_minutes, prop: proposed.avg_travel_time_minutes, d: delta.avg_travel_time_delta },
    { label: "Accessible Hubs", cur: current.accessible_hubs, prop: proposed.accessible_hubs, d: delta.accessible_hubs_delta },
    { label: "Reachable Workers", cur: current.total_reachable_workers?.toLocaleString(), prop: proposed.total_reachable_workers?.toLocaleString(), d: delta.total_reachable_workers_delta },
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Current vs Proposed Network Comparison</div>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Proposed</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const dVal = typeof row.d === "number" ? row.d : 0;
            const cls =
              dVal > 0 ? "delta-positive" : dVal < 0 ? "delta-negative" : "delta-neutral";
            // For avg travel time, lower is better
            const isTravelTime = row.label.includes("Travel");
            const realClass = isTravelTime
              ? dVal < 0 ? "delta-positive" : dVal > 0 ? "delta-negative" : "delta-neutral"
              : cls;

            return (
              <tr key={i}>
                <td style={{ fontWeight: 500, textAlign: "left" }}>{row.label}</td>
                <td>{row.cur}</td>
                <td>{row.prop}</td>
                <td className={realClass} style={{ fontWeight: 700 }}>
                  {typeof row.d === "number" && row.d > 0 ? `+${row.d}` : row.d}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Hub detail comparison */}
      {proposed.hub_details && proposed.hub_details.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
            Proposed Hub Accessibility
          </div>
          <table>
            <thead>
              <tr>
                <th>Hub</th>
                <th>Workers</th>
                <th>Current</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {proposed.hub_details.map((ph, i) => {
                const ch = current.hub_details?.[i];
                return (
                  <tr key={i}>
                    <td>{ph.hub_name}</td>
                    <td>{ph.estimated_workers?.toLocaleString()}</td>
                    <td>
                      <span className={`tag ${ch?.accessible ? "tag-green" : "tag-red"}`}>
                        {ch?.accessible ? "✓" : "✗"}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${ph.accessible ? "tag-green" : "tag-red"}`}>
                        {ph.accessible ? "✓" : "✗"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── OtpSection ───────────────────────────────────────────────────────────────

function OtpSection({ otp }) {
  if (!otp || otp.length === 0) return null;

  // Group by route_id
  const byRoute = otp.reduce((acc, row) => {
    if (!acc[row.route_id]) acc[row.route_id] = { name: row.route_name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, ""), stops: [] };
    acc[row.route_id].stops.push(row);
    return acc;
  }, {});

  const [activeRoute, setActiveRoute] = useState(Object.keys(byRoute)[0]);
  const routeIds = Object.keys(byRoute).sort();
  const stops = byRoute[activeRoute]?.stops ?? [];

  // Sort by order if available
  const sorted = [...stops].sort((a, b) => {
    const ao = parseFloat(a.order) || 0;
    const bo = parseFloat(b.order) || 0;
    return ao - bo;
  });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 12 }}>Schedule Reliability (OTP)</div>

      {/* Route tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {routeIds.map(id => (
          <button
            key={id}
            onClick={() => setActiveRoute(id)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: `2px solid ${ROUTE_COLORS[id] || "#555"}`,
              background: activeRoute === id ? (ROUTE_COLORS[id] || "#555") : "transparent",
              color: activeRoute === id ? "#fff" : (ROUTE_COLORS[id] || "#aaa"),
              cursor: "pointer",
              opacity: 1,
            }}
          >
            {id}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        {byRoute[activeRoute]?.name}
      </div>

      <table>
        <thead>
          <tr>
            <th>Stop</th>
            <th style={{ textAlign: "center" }}>Dir</th>
            <th style={{ textAlign: "center", color: "var(--success)" }}>On-Time%</th>
            <th style={{ textAlign: "center", color: "var(--danger)" }}>Late%</th>
            <th style={{ textAlign: "center" }}>Avg Dev (min)</th>
            <th style={{ textAlign: "center" }}>Trips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const late = parseFloat(s.late_pct) || 0;
            const dev = parseFloat(s.avg_deviation) || 0;
            const isProb = late > 20 || dev < -3;
            return (
              <tr key={i} style={isProb ? { background: "rgba(239,68,68,0.08)" } : {}}>
                <td style={{ fontWeight: isProb ? 600 : 400 }}>
                  {isProb && <span style={{ color: "var(--danger)", marginRight: 4 }}>▲</span>}
                  {s.stop_name}
                </td>
                <td style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>{s.direction || "—"}</td>
                <td style={{ textAlign: "center", color: "var(--success)" }}>{s.ontime_pct}%</td>
                <td style={{ textAlign: "center", color: late > 20 ? "var(--danger)" : "var(--text)" }}>
                  {s.late_pct}%
                </td>
                <td style={{ textAlign: "center", color: dev < -3 ? "var(--danger)" : "var(--muted)" }}>
                  {parseFloat(s.avg_deviation).toFixed(1)}
                </td>
                <td style={{ textAlign: "center", color: "var(--muted)" }}>{s.total_trips}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        ▲ Problem stop: &gt;20% late or avg deviation &lt; −3 min &nbsp;·&nbsp; Data: 1/1/2025 – 2/4/2026
      </div>
    </div>
  );
}

// ─── MetricsPanel (root export) ──────────────────────────────────────────────

export default function MetricsPanel({ metrics, simResult, routes, otp }) {
  const [activeModal, setActiveModal] = useState(null);

  const handleExport = async () => {
    const blob = await exportMetricsCsv();
    downloadBlob(blob, "suntran_metrics.csv");
  };

  if (!metrics) {
    return (
      <div style={{ padding: 32, color: "var(--muted)" }}>
        Loading metrics…
      </div>
    );
  }

  const s = metrics.summary;

  // Count coverage gaps from employment_hub_access
  const coverageGapCount = metrics.employment_hub_access
    ? metrics.employment_hub_access.filter((h) => h.accessible === false).length
    : undefined;

  // Compute delta for coverage gaps if simResult available
  const simGapCount = simResult?.proposed?.hub_details
    ? simResult.proposed.hub_details.filter((h) => h.accessible === false).length
    : undefined;
  const currentGapCount = simResult?.current?.hub_details
    ? simResult.current.hub_details.filter((h) => h.accessible === false).length
    : undefined;
  const gapDelta =
    simGapCount !== undefined && currentGapCount !== undefined
      ? simGapCount - currentGapCount
      : undefined;

  const gapDeltaForDisplay = gapDelta !== undefined ? gapDelta : undefined;

  // Whether max travel time is suspiciously high
  const maxTravelTimeWarning = s.max_travel_time_minutes > 120;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* Detail modal */}
      <DetailModal
        modalKey={activeModal}
        metrics={metrics}
        onClose={() => setActiveModal(null)}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="panel-title" style={{ fontSize: 16 }}>
          Network Metrics {simResult ? "— Simulation Run" : "— Current Network"}
        </div>
        <button className="btn-ghost" onClick={handleExport}>
          ↓ Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatBox
          label="Total Stops"
          value={s.total_stops}
          delta={simResult?.delta?.total_stops_delta}
          onClick={() => setActiveModal("total_stops")}
        />
        <StatBox
          label="Total Routes"
          value={s.total_routes}
          onClick={() => setActiveModal("total_routes")}
        />
        <StatBox
          label="Accessible Hubs"
          value={s.accessible_employment_hubs}
          delta={simResult?.delta?.accessible_hubs_delta}
          onClick={() => setActiveModal("accessible_hubs")}
        />
        <StatBox
          label="Coverage Gaps"
          value={coverageGapCount ?? "—"}
          delta={
            gapDeltaForDisplay !== undefined
              ? -gapDeltaForDisplay
              : undefined
          }
          onClick={() => setActiveModal("coverage_gaps")}
        />
        <StatBox
          label="Reachable Workers"
          value={s.total_reachable_workers?.toLocaleString()}
          delta={simResult?.delta?.total_reachable_workers_delta}
          onClick={() => setActiveModal("reachable_workers")}
        />
        <StatBox
          label="Avg Travel Time"
          value={s.avg_travel_time_minutes}
          unit="minutes"
          delta={simResult?.delta?.avg_travel_time_delta}
          onClick={() => setActiveModal("avg_travel_time")}
        />
        <StatBox
          label="Max Travel Time"
          value={s.max_travel_time_minutes}
          unit="minutes"
          warning={maxTravelTimeWarning}
          warningSubtitle="May indicate data issue"
          onClick={() => setActiveModal("max_travel_time")}
        />
      </div>

      {/* Simulation comparison */}
      {simResult && <ComparisonSection simResult={simResult} />}

      {/* Route performance */}
      <RoutePerformanceTable
        routes={metrics.route_performance}
        totalStops={s.total_stops}
      />

      {/* Hub accessibility */}
      <HubAccessTable
        hubs={metrics.employment_hub_access}
        title="Employment Hub Accessibility (Current Network)"
      />

      {/* Ridership */}
      <RidershipTable ridership={metrics.ridership_summary} />

      {/* OTP */}
      <OtpSection otp={otp} />
    </div>
  );
}
