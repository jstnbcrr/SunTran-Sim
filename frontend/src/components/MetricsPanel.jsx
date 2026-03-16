import React from "react";
import { exportMetricsCsv } from "../api/client";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatBox({ label, value, unit, delta }) {
  const deltaClass =
    delta === undefined
      ? ""
      : delta > 0
      ? "delta-positive"
      : delta < 0
      ? "delta-negative"
      : "delta-neutral";

  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {unit && <div className="stat-unit">{unit}</div>}
      {delta !== undefined && (
        <div className={`stat-unit ${deltaClass}`} style={{ fontWeight: 700, marginTop: 2 }}>
          {delta > 0 ? `+${delta}` : delta} vs current
        </div>
      )}
    </div>
  );
}

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
    </div>
  );
}

function RoutePerformanceTable({ routes }) {
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
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={i}>
              <td><span className="tag tag-blue">{r.route_id}</span></td>
              <td>{r.route_name}</td>
              <td>{r.stop_count}</td>
              <td>{r.total_distance_miles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          {ridership.map((r, i) => (
            <tr key={i}>
              <td><span className="tag tag-blue">{r.route_id}</span></td>
              <td>{r.total_boardings}</td>
              <td>{r.total_alightings}</td>
              <td>{r.peak_hour}:00</td>
              <td>{r.avg_boardings_per_stop}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

const ROUTE_COLORS = {
  R1: "#e53e3e", R2: "#3182ce", R3: "#38a169",
  R4: "#d69e2e", R5: "#805ad5", R6: "#319795",
  R7: "#dd6b20", R8: "#c05621",
};

function OtpSection({ otp }) {
  if (!otp || otp.length === 0) return null;

  // Group by route_id
  const byRoute = otp.reduce((acc, row) => {
    if (!acc[row.route_id]) acc[row.route_id] = { name: row.route_name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, ""), stops: [] };
    acc[row.route_id].stops.push(row);
    return acc;
  }, {});

  const [activeRoute, setActiveRoute] = React.useState(Object.keys(byRoute)[0]);
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

export default function MetricsPanel({ metrics, simResult, routes, otp }) {
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

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="panel-title" style={{ fontSize: 16 }}>
          Network Metrics {simResult ? "— Simulation Run" : "— Current Network"}
        </div>
        <button className="btn-ghost" onClick={handleExport}>
          ↓ Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatBox
          label="Total Stops"
          value={s.total_stops}
          delta={simResult?.delta?.total_stops_delta}
        />
        <StatBox
          label="Total Routes"
          value={s.total_routes}
        />
        <StatBox
          label="Accessible Hubs"
          value={s.accessible_employment_hubs}
          delta={simResult?.delta?.accessible_hubs_delta}
        />
        <StatBox
          label="Reachable Workers"
          value={s.total_reachable_workers?.toLocaleString()}
          delta={simResult?.delta?.total_reachable_workers_delta}
        />
        <StatBox
          label="Avg Travel Time"
          value={s.avg_travel_time_minutes}
          unit="minutes"
          delta={simResult?.delta?.avg_travel_time_delta}
        />
        <StatBox
          label="Max Travel Time"
          value={s.max_travel_time_minutes}
          unit="minutes"
        />
      </div>

      {/* Simulation comparison */}
      {simResult && <ComparisonSection simResult={simResult} />}

      {/* Route performance */}
      <RoutePerformanceTable routes={metrics.route_performance} />

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
