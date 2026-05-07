import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { exportMetricsCsv, getOtpPeriods, getOtpPeriod, deleteOtpPeriod } from "../api/client";

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

// ── Shared UI primitives ──────────────────────────────────────────────────────

function CollapsibleCard({ title, children, rightLabel }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div className="card-title" style={{ margin: 0, flex: 1 }}>{title}</div>
        {rightLabel && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{rightLabel}</span>
        )}
      </div>
      {children}
    </div>
  );
}


function SimBadge() {
  return (
    <span style={{
      marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 8,
      background: "rgba(214,158,46,0.12)", color: "#d69e2e",
      border: "1px solid rgba(214,158,46,0.4)", fontWeight: 600,
    }}>
      Simulated
    </span>
  );
}

function DrilldownPanel({ onClose, children }) {
  return (
    <div style={{
      marginTop: 14, padding: "12px 14px",
      background: "rgba(230,201,40,0.05)",
      border: "1px solid rgba(230,201,40,0.35)",
      borderRadius: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "0 2px",
        }}>×</button>
      </div>
      {children}
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({ modalKey, metrics, otp, onClose }) {
  if (!modalKey) return null;

  const s = metrics?.summary ?? {};
  const routePerf = metrics?.route_performance ?? [];
  const hubAccess = metrics?.employment_hub_access ?? [];

  // Computed here so modal body can reference them
  const totalRouteMiles = routePerf
    .reduce((sum, r) => sum + (parseFloat(r.total_distance_miles) || 0), 0)
    .toFixed(1);

  const accessibleHubs = hubAccess.filter(h => h.accessible === true);
  const gapHubs        = hubAccess.filter(h => h.accessible === false);

  // Per-route OTP summaries for system_otp modal
  const otpByRoute = (otp || []).reduce((acc, row) => {
    if (!acc[row.route_id]) acc[row.route_id] = { id: row.route_id, name: row.route_name, rows: [] };
    acc[row.route_id].rows.push(row);
    return acc;
  }, {});
  const otpSummaries = Object.values(otpByRoute).map(r => ({
    id: r.id,
    name: r.name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, ""),
    early:  (r.rows.reduce((s, x) => s + parseFloat(x.early_pct  || 0), 0) / r.rows.length).toFixed(1),
    ontime: (r.rows.reduce((s, x) => s + parseFloat(x.ontime_pct || 0), 0) / r.rows.length).toFixed(1),
    late:   (r.rows.reduce((s, x) => s + parseFloat(x.late_pct   || 0), 0) / r.rows.length).toFixed(1),
    trips:   r.rows.reduce((s, x) => s + Number(x.total_trips || 0), 0),
  })).sort((a, b) => parseFloat(a.ontime) - parseFloat(b.ontime));

  const modalContent = {
    total_stops: {
      title: "Total Stops — 170 across 8 routes",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 12 }}>
            Each unique stop is counted once even if served by multiple routes. Route 8 Zion runs
            to Springdale which accounts for its higher stop count relative to ridership.
          </p>
          <table>
            <thead><tr><th>Route</th><th>Name</th><th>Stops</th><th>Distance (mi)</th><th>Stop Spacing</th></tr></thead>
            <tbody>
              {routePerf.map((r, i) => {
                const color = ROUTE_COLORS[r.route_id];
                const dist  = parseFloat(r.total_distance_miles) || 0;
                const spacing = r.stop_count > 1 ? (dist / (r.stop_count - 1)).toFixed(2) + " mi" : "—";
                return (
                  <tr key={i}>
                    <td><span className="tag" style={color ? { background: color, color: "#fff", borderColor: color } : undefined}>{r.route_id}</span></td>
                    <td>{r.route_name}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{r.stop_count}</td>
                    <td style={{ textAlign: "right" }}>{r.total_distance_miles}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 11 }}>{spacing}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
            Stops shared between routes are counted once in the system total.
            Stop spacing = route distance ÷ (stops − 1).
          </p>
        </>
      ),
    },
    accessible_hubs: {
      title: "Accessible Employment Hubs",
      body: (
        <>
          <div style={{ padding: "10px 14px", background: "rgba(56,161,105,0.08)", border: "1px solid rgba(56,161,105,0.3)", borderRadius: 6, fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
            A hub is <strong style={{ color: "var(--success)" }}>accessible</strong> if a stop exists within
            <strong> 0.25 miles</strong> walking distance AND is reachable within <strong>30 minutes</strong> transit time from at least one other stop.
          </div>
          <table>
            <thead><tr><th>Hub</th><th>Nearest Stop ID</th><th>Reachable From</th></tr></thead>
            <tbody>
              {accessibleHubs.sort((a, b) => b.reachable_from_stops - a.reachable_from_stops).map((h, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{h.hub_name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{h.nearest_stop || "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--accent)", fontWeight: 700 }}>{h.reachable_from_stops} stops</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
            "Reachable from" = number of stops that can reach this hub within 30 min via the current network.
            Higher = more of the city can access this employment destination.
          </p>
        </>
      ),
    },
    coverage_gaps: {
      title: "Coverage Gaps — Unreachable Hubs",
      body: (
        <>
          <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
            These hubs have <strong style={{ color: "var(--danger)" }}>no bus stop within 0.25 miles</strong> —
            workers at these locations cannot reach them by transit without driving to a stop first.
          </div>
          {gapHubs.length === 0 ? (
            <p style={{ color: "var(--success)", fontSize: 13, fontWeight: 600 }}>✓ All hubs are reachable.</p>
          ) : (
            <>
              <table>
                <thead><tr><th>Hub Name</th><th>Gap Reason</th></tr></thead>
                <tbody>
                  {gapHubs.map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{h.hub_name}</td>
                      <td style={{ fontSize: 11, color: "var(--danger)" }}>No stop within 0.25 mi walking</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
                To close a gap: add a stop within 0.25 miles of the hub in the Simulation Tool,
                then re-run the simulation to see if it becomes accessible.
              </p>
            </>
          )}
        </>
      ),
    },
    route_miles: {
      title: "Total Route Miles",
      body: (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 12 }}>
            Combined distance of all active routes in the network. Longer routes cover more geography
            but cost more to operate. Adding or extending routes in the Simulation Tool will change this number.
          </p>
          <table>
            <thead><tr><th>Route</th><th>Name</th><th style={{ textAlign: "right" }}>Distance (mi)</th><th style={{ textAlign: "right" }}>Stops</th></tr></thead>
            <tbody>
              {[...routePerf].sort((a, b) => parseFloat(b.total_distance_miles) - parseFloat(a.total_distance_miles)).map((r, i) => {
                const color = ROUTE_COLORS[r.route_id];
                return (
                  <tr key={i}>
                    <td><span className="tag" style={color ? { background: color, color: "#fff", borderColor: color } : undefined}>{r.route_id}</span></td>
                    <td>{r.route_name}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{r.total_distance_miles}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>{r.stop_count}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                <td colSpan={2}>Total</td>
                <td style={{ textAlign: "right" }}>{totalRouteMiles} mi</td>
                <td style={{ textAlign: "right", color: "var(--muted)" }}>{s.total_stops}</td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    stop_spacing: {
      title: "Avg Stop Spacing",
      body: (
        <>
          <div style={{ padding: "10px 14px", background: "rgba(55,136,216,0.08)", border: "1px solid rgba(55,136,216,0.25)", borderRadius: 6, fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
            <strong>What's a good stop spacing?</strong> Transit planning guidelines suggest
            0.25–0.4 miles between stops for local bus routes. Under 0.2 mi = stops are too close
            (slows travel time). Over 0.5 mi = stops are too far apart (walking burden on riders).
          </div>
          <table>
            <thead><tr><th>Route</th><th>Name</th><th style={{ textAlign: "right" }}>Spacing (mi)</th><th style={{ textAlign: "right" }}>Assessment</th></tr></thead>
            <tbody>
              {[...routePerf].filter(r => r.stop_count > 1).sort((a, b) => {
                const sa = parseFloat(a.total_distance_miles) / (a.stop_count - 1);
                const sb = parseFloat(b.total_distance_miles) / (b.stop_count - 1);
                return sb - sa;
              }).map((r, i) => {
                const color = ROUTE_COLORS[r.route_id];
                const spacing = (parseFloat(r.total_distance_miles) / (r.stop_count - 1)).toFixed(2);
                const sp = parseFloat(spacing);
                const assessment = sp < 0.2 ? { label: "Too close", c: "#3182ce" }
                  : sp <= 0.4 ? { label: "Optimal", c: "var(--success)" }
                  : sp <= 0.6 ? { label: "Acceptable", c: "#d69e2e" }
                  : { label: "Too sparse", c: "var(--danger)" };
                return (
                  <tr key={i}>
                    <td><span className="tag" style={color ? { background: color, color: "#fff", borderColor: color } : undefined}>{r.route_id}</span></td>
                    <td>{r.route_name}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{spacing} mi</td>
                    <td style={{ textAlign: "right", color: assessment.c, fontWeight: 600, fontSize: 11 }}>{assessment.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
            Spacing = route distance ÷ (stops − 1). Route 8 Zion will appear sparse due to its long highway segments.
          </p>
        </>
      ),
    },
    system_otp: {
      title: "System On-Time Performance",
      body: (
        <>
          <div style={{ padding: "10px 14px", background: "rgba(55,136,216,0.08)", border: "1px solid rgba(55,136,216,0.25)", borderRadius: 6, fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
            OTP thresholds from liaison data: <strong>Early</strong> = departed &gt;1 min before scheduled,
            <strong> On-Time</strong> = within −1 to +5 min, <strong>Late</strong> = &gt;5 min after scheduled.
            Data covers 1/1/2025 – 2/4/2026.
          </div>
          {otpSummaries.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No OTP data loaded.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th style={{ textAlign: "center", color: "#3182ce" }}>Early %</th>
                  <th style={{ textAlign: "center", color: "var(--success)" }}>On-Time %</th>
                  <th style={{ textAlign: "center", color: "var(--danger)" }}>Late %</th>
                  <th style={{ textAlign: "right" }}>Total Trips</th>
                </tr>
              </thead>
              <tbody>
                {otpSummaries.map((r, i) => {
                  const color = ROUTE_COLORS[r.id];
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="tag" style={color ? { background: color, color: "#fff", borderColor: color, fontSize: 10 } : undefined}>{r.id}</span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", color: "#3182ce", fontWeight: 600 }}>{r.early}%</td>
                      <td style={{ textAlign: "center", color: "var(--success)", fontWeight: 700 }}>{r.ontime}%</td>
                      <td style={{ textAlign: "center", color: parseFloat(r.late) > 20 ? "var(--danger)" : "var(--text)", fontWeight: 600 }}>{r.late}%</td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 11 }}>{r.trips.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ),
    },
  };

  const content = modalContent[modalKey];
  if (!content) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, maxWidth: 560, width: "90%", maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{content.title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)", lineHeight: 1, padding: "0 4px" }} aria-label="Close">×</button>
        </div>
        <div style={{ fontSize: 13 }}>{content.body}</div>
      </div>
    </div>
  );
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, unit, delta, warning, warningSubtitle, onClick }) {
  const deltaClass = delta === undefined ? "" : delta > 0 ? "delta-positive" : delta < 0 ? "delta-negative" : "delta-neutral";
  return (
    <div className="stat-box" onClick={onClick} style={{
      ...(warning ? { border: "2px solid #d97706", background: "rgba(217,119,6,0.07)" } : undefined),
      ...(onClick ? { cursor: "pointer", position: "relative" } : undefined),
    }}>
      {onClick && <span style={{ position: "absolute", top: 6, right: 8, fontSize: 11, color: "var(--muted)", opacity: 0.6, lineHeight: 1, userSelect: "none" }} title="Click for details">ⓘ</span>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {unit && <div className="stat-unit">{unit}</div>}
      {warning && warningSubtitle && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2, fontStyle: "italic" }}>{warningSubtitle}</div>}
      {delta !== undefined && (
        <div className={`stat-unit ${deltaClass}`} style={{ fontWeight: 700, marginTop: 2 }}>
          {delta > 0 ? `+${delta}` : delta} vs current
        </div>
      )}
    </div>
  );
}

// ─── Route Performance Section ────────────────────────────────────────────────

function RoutePerformanceSection({ routes, totalStops, simulatedRouteIds }) {
  const [drilldown, setDrilldown] = useState(null);

  if (!routes || routes.length === 0) return null;

  const data = routes.map(r => ({
    id:            r.route_id,
    name:          r.route_name,
    Stops:         r.stop_count,
    Distance:      parseFloat(r.total_distance_miles) || 0,
    color:         ROUTE_COLORS[r.route_id] || "#888",
    isSimulated:   simulatedRouteIds?.has(r.route_id),
    coveragePct:   totalStops ? ((r.stop_count / totalStops) * 100).toFixed(1) : "—",
  }));

  return (
    <CollapsibleCard title="Route Performance" rightLabel={`${routes.length} routes`}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        Click a row to inspect
      </div>
      <table>
        <thead>
          <tr><th>Route ID</th><th>Name</th><th>Stops</th><th>Distance (mi)</th><th>Coverage %</th></tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} onClick={() => setDrilldown(prev => prev?.id === r.id ? null : r)}
              style={{ cursor: "pointer", background: drilldown?.id === r.id ? "rgba(230,201,40,0.07)" : undefined }}>
              <td>
                <span className="tag" style={{ background: r.color, color: "#fff", borderColor: r.color }}>{r.id}</span>
                {r.isSimulated && <SimBadge />}
              </td>
              <td>{r.name}</td>
              <td>{r.Stops}</td>
              <td>{r.Distance.toFixed(2)}</td>
              <td style={{ color: "var(--muted)", fontSize: 12 }}>{r.coveragePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="tag" style={{ background: drilldown.color, color: "#fff", borderColor: drilldown.color }}>{drilldown.id}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{drilldown.name}</span>
            {drilldown.isSimulated && <SimBadge />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 20px", fontSize: 12 }}>
            <span style={{ color: "var(--muted)" }}>Stops</span>
            <span style={{ fontWeight: 700 }}>{drilldown.Stops}</span>
            <span style={{ color: "var(--muted)" }}>Distance</span>
            <span style={{ fontWeight: 700 }}>{drilldown.Distance.toFixed(2)} mi</span>
            <span style={{ color: "var(--muted)" }}>Net Coverage</span>
            <span style={{ fontWeight: 700 }}>{drilldown.coveragePct}%</span>
            <span style={{ color: "var(--muted)" }}>Avg Stop Spacing</span>
            <span style={{ fontWeight: 700 }}>
              {drilldown.Stops > 1 ? (drilldown.Distance / (drilldown.Stops - 1)).toFixed(2) + " mi" : "—"}
            </span>
          </div>
          {drilldown.isSimulated && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(214,158,46,0.1)", borderRadius: 6, fontSize: 11, color: "#d69e2e" }}>
              This is a simulated route pushed from a scenario. It has no historical ridership data.
            </div>
          )}
        </DrilldownPanel>
      )}
    </CollapsibleCard>
  );
}

// ─── Hub Access Section ───────────────────────────────────────────────────────

function HubAccessSection({ hubs, title }) {
  const [drilldown, setDrilldown] = useState(null);

  if (!hubs || hubs.length === 0) return null;

  const sorted = [...hubs].sort((a, b) => a.hub_name.localeCompare(b.hub_name));
  const accessible = hubs.filter(h => h.accessible).length;
  const total      = hubs.length;

  return (
    <CollapsibleCard title={title} rightLabel={`${accessible}/${total} accessible`}>
      {/* Quick status strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(56,161,105,0.12)", color: "var(--success)", fontWeight: 600 }}>
          ✓ {accessible} accessible
        </span>
        {total - accessible > 0 && (
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(239,68,68,0.1)", color: "var(--danger)", fontWeight: 600 }}>
            ✗ {total - accessible} gap{total - accessible > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <table>
        <thead>
          <tr><th>Hub</th><th>Nearest Stop</th><th>Reachable From</th><th>Status</th></tr>
        </thead>
        <tbody>
          {sorted.map((h, i) => (
            <tr key={i}
              onClick={() => setDrilldown(prev => prev?.hub_name === h.hub_name ? null : h)}
              style={{ cursor: "pointer", background: drilldown?.hub_name === h.hub_name ? "rgba(230,201,40,0.07)" : undefined }}>
              <td style={{ fontWeight: 500 }}>{h.hub_name}</td>
              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{h.nearest_stop || "—"}</td>
              <td>{h.reachable_from_stops} stops</td>
              <td><span className={`tag ${h.accessible ? "tag-green" : "tag-red"}`}>{h.accessible ? "Accessible" : "Gap"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className={`tag ${drilldown.accessible ? "tag-green" : "tag-red"}`}>
              {drilldown.accessible ? "✓ Accessible" : "✗ Gap"}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{drilldown.hub_name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 20px", fontSize: 12 }}>
            <span style={{ color: "var(--muted)" }}>Nearest Stop</span>
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{drilldown.nearest_stop || "—"}</span>
            <span style={{ color: "var(--muted)" }}>Reachable From</span>
            <span style={{ fontWeight: 700 }}>{drilldown.reachable_from_stops} stops</span>
          </div>
          {!drilldown.accessible && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 6, fontSize: 11, color: "var(--danger)" }}>
              No bus stop within 0.25 miles walking distance. This hub is unreachable by transit.
            </div>
          )}
        </DrilldownPanel>
      )}
    </CollapsibleCard>
  );
}

// ─── Ridership Section ────────────────────────────────────────────────────────

function RidershipSection({ ridership, simulatedRouteIds }) {
  const [drilldown, setDrilldown] = useState(null);

  if (!ridership || ridership.length === 0) return null;

  const data = ridership.map(r => ({
    id:          r.route_id,
    Boardings:   r.total_boardings,
    Alightings:  r.total_alightings,
    peakHour:    r.peak_hour,
    avgPerStop:  r.avg_boardings_per_stop,
    isSimulated: simulatedRouteIds?.has(r.route_id),
    color:       ROUTE_COLORS[r.route_id] || "#888",
  }));

  return (
    <CollapsibleCard title="Ridership Summary" rightLabel={`${ridership.length} routes`}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Click a row to inspect</div>
      <table>
        <thead>
          <tr><th>Route</th><th>Total Boardings</th><th>Total Alightings</th><th>Peak Hour</th><th>Avg Board/Stop</th></tr>
        </thead>
        <tbody>
          {ridership.map((r, i) => {
            const isSim = simulatedRouteIds?.has(r.route_id);
            const suspectBoarding = r.total_boardings === 0;
            const suspectAlighting = r.total_alightings === 0;
            return (
              <tr key={i}
                onClick={() => setDrilldown(prev => prev?.id === r.route_id ? null : { id: r.route_id, ...data[i] })}
                style={{
                  cursor: "pointer",
                  background: drilldown?.id === r.route_id ? "rgba(230,201,40,0.07)" : (suspectBoarding || suspectAlighting) && !isSim ? "rgba(234,179,8,0.13)" : undefined,
                }}>
                <td>
                  <span className="tag tag-blue">{r.route_id}</span>
                  {isSim && <SimBadge />}
                </td>
                <td>
                  {isSim ? <span style={{ color: "var(--muted)", fontSize: 11 }}>No ridership data</span> : r.total_boardings}
                  {!isSim && suspectBoarding && <span style={{ marginLeft: 6, fontSize: 11, color: "#92400e" }}>⚠ Check data</span>}
                </td>
                <td>
                  {isSim ? "—" : (r.total_alightings != null && r.total_alightings !== 0 ? r.total_alightings : "—")}
                  {!isSim && suspectAlighting && r.total_alightings === 0 && <span style={{ marginLeft: 6, fontSize: 11, color: "#92400e" }}>⚠ Check data</span>}
                </td>
                <td>{isSim ? "—" : (r.peak_hour != null ? `${r.peak_hour}:00` : "—")}</td>
                <td>{isSim ? "—" : r.avg_boardings_per_stop}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="tag" style={{ background: drilldown.color, color: "#fff", borderColor: drilldown.color }}>
              {drilldown.id}
            </span>
            {drilldown.isSimulated && <SimBadge />}
          </div>
          {drilldown.isSimulated ? (
            <div style={{ padding: "12px 14px", background: "rgba(214,158,46,0.08)", borderRadius: 6, fontSize: 12, color: "#d69e2e", fontStyle: "italic" }}>
              No ridership data available — this is a simulated route only. Historical boarding data will appear here once the route is operated and recorded.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 20px", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Total Boardings</span>
              <span style={{ fontWeight: 700 }}>{drilldown.Boardings?.toLocaleString()}</span>
              <span style={{ color: "var(--muted)" }}>Total Alightings</span>
              <span style={{ fontWeight: 700 }}>{drilldown.Alightings?.toLocaleString()}</span>
              <span style={{ color: "var(--muted)" }}>Peak Hour</span>
              <span style={{ fontWeight: 700 }}>{drilldown.peakHour}:00</span>
              <span style={{ color: "var(--muted)" }}>Avg / Stop</span>
              <span style={{ fontWeight: 700 }}>{drilldown.avgPerStop}</span>
            </div>
          )}
        </DrilldownPanel>
      )}
    </CollapsibleCard>
  );
}

// ─── Comparison Section ───────────────────────────────────────────────────────

function ComparisonSection({ simResult }) {
  if (!simResult) return null;
  const { current, proposed, delta } = simResult;

  const rows = [
    { label: "Total Stops",          cur: current.total_stops,                          prop: proposed.total_stops,                          d: delta.total_stops_delta },
    { label: "Total Route Segments", cur: current.total_edges,                          prop: proposed.total_edges,                          d: delta.total_edges_delta },
    { label: "Avg Travel Time (min)",cur: current.avg_travel_time_minutes,              prop: proposed.avg_travel_time_minutes,              d: delta.avg_travel_time_delta },
    { label: "Accessible Hubs",      cur: current.accessible_hubs,                     prop: proposed.accessible_hubs,                     d: delta.accessible_hubs_delta },
  ];

  return (
    <CollapsibleCard title="Current vs Proposed Network Comparison">
      <table className="comparison-table">
        <thead><tr><th>Metric</th><th>Current</th><th>Proposed</th><th>Change</th></tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const dVal = typeof row.d === "number" ? row.d : 0;
            const isTravelTime = row.label.includes("Travel");
            const cls = isTravelTime
              ? (dVal < 0 ? "delta-positive" : dVal > 0 ? "delta-negative" : "delta-neutral")
              : (dVal > 0 ? "delta-positive" : dVal < 0 ? "delta-negative" : "delta-neutral");
            return (
              <tr key={i}>
                <td style={{ fontWeight: 500, textAlign: "left" }}>{row.label}</td>
                <td>{row.cur}</td>
                <td>{row.prop}</td>
                <td className={cls} style={{ fontWeight: 700 }}>{typeof row.d === "number" && row.d > 0 ? `+${row.d}` : row.d}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {proposed.hub_details && proposed.hub_details.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Proposed Hub Accessibility</div>
          <table>
            <thead><tr><th>Hub</th><th>Current</th><th>Proposed</th></tr></thead>
            <tbody>
              {proposed.hub_details.map((ph, i) => {
                const ch = current.hub_details?.[i];
                return (
                  <tr key={i}>
                    <td>{ph.hub_name}</td>
                    <td><span className={`tag ${ch?.accessible ? "tag-green" : "tag-red"}`}>{ch?.accessible ? "✓" : "✗"}</span></td>
                    <td><span className={`tag ${ph.accessible ? "tag-green" : "tag-red"}`}>{ph.accessible ? "✓" : "✗"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleCard>
  );
}

// ─── OTP Section ──────────────────────────────────────────────────────────────

function OtpSection({ otp }) {
  if (!otp || otp.length === 0) return null;

  const byRoute = otp.reduce((acc, row) => {
    if (!acc[row.route_id]) acc[row.route_id] = {
      name: row.route_name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, ""),
      stops: [],
    };
    acc[row.route_id].stops.push(row);
    return acc;
  }, {});

  const [activeRoute, setActiveRoute] = useState(Object.keys(byRoute)[0]);
  const routeIds = Object.keys(byRoute).sort();
  const stops = byRoute[activeRoute]?.stops ?? [];
  const sorted = [...stops].sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0));

  return (
    <CollapsibleCard title="Schedule Reliability (OTP)" defaultOpen={false}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {routeIds.map(id => (
          <button key={id} onClick={() => setActiveRoute(id)} style={{
            padding: "4px 12px", fontSize: 12, fontWeight: 700, borderRadius: 6,
            border: `2px solid ${ROUTE_COLORS[id] || "#555"}`,
            background: activeRoute === id ? (ROUTE_COLORS[id] || "#555") : "transparent",
            color: activeRoute === id ? "#fff" : (ROUTE_COLORS[id] || "#aaa"),
            cursor: "pointer",
          }}>
            {id}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{byRoute[activeRoute]?.name}</div>
      <table>
        <thead>
          <tr>
            <th>Stop</th>
            <th style={{ textAlign: "center" }}>Dir</th>
            <th style={{ textAlign: "center", color: "#3182ce" }}>Early%</th>
            <th style={{ textAlign: "center", color: "var(--success)" }}>On-Time%</th>
            <th style={{ textAlign: "center", color: "var(--danger)" }}>Late%</th>
            <th style={{ textAlign: "center" }}>Avg Dev (min)</th>
            <th style={{ textAlign: "center" }}>Trips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const late = parseFloat(s.late_pct) || 0;
            const dev  = parseFloat(s.avg_deviation) || 0;
            const isProb = late > 20 || dev < -3;
            return (
              <tr key={i} style={isProb ? { background: "rgba(239,68,68,0.08)" } : {}}>
                <td style={{ fontWeight: isProb ? 600 : 400 }}>
                  {isProb && <span style={{ color: "var(--danger)", marginRight: 4 }}>▲</span>}
                  {s.stop_name}
                </td>
                <td style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>{s.direction || "—"}</td>
                <td style={{ textAlign: "center", color: "#3182ce" }}>{s.early_pct}%</td>
                <td style={{ textAlign: "center", color: "var(--success)" }}>{s.ontime_pct}%</td>
                <td style={{ textAlign: "center", color: late > 20 ? "var(--danger)" : "var(--text)" }}>{s.late_pct}%</td>
                <td style={{ textAlign: "center", color: dev < -3 ? "var(--danger)" : "var(--muted)" }}>{parseFloat(s.avg_deviation).toFixed(1)}</td>
                <td style={{ textAlign: "center", color: "var(--muted)" }}>{s.total_trips}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        ▲ Problem stop: &gt;20% late or avg deviation &lt; −3 min &nbsp;·&nbsp; Data: 1/1/2025 – 2/4/2026
      </div>
    </CollapsibleCard>
  );
}

// ─── OTP Route Summary Scorecard ─────────────────────────────────────────────

function OtpScorecard({ otp }) {
  if (!otp || otp.length === 0) return null;

  const byRoute = otp.reduce((acc, row) => {
    const id = row.route_id;
    if (!acc[id]) acc[id] = { id, name: row.route_name, stops: [] };
    acc[id].stops.push(row);
    return acc;
  }, {});

  const summaries = Object.values(byRoute).map(r => {
    const stops = r.stops;
    const avgEarly  = stops.reduce((s, x) => s + parseFloat(x.early_pct  || 0), 0) / stops.length;
    const avgOtp    = stops.reduce((s, x) => s + parseFloat(x.ontime_pct || 0), 0) / stops.length;
    const avgLate   = stops.reduce((s, x) => s + parseFloat(x.late_pct   || 0), 0) / stops.length;
    const avgDev    = stops.reduce((s, x) => s + parseFloat(x.avg_deviation || 0), 0) / stops.length;
    const totalTrips = stops.reduce((s, x) => s + Number(x.total_trips || 0), 0);
    const probStops  = stops.filter(x => parseFloat(x.late_pct) > 20 || parseFloat(x.avg_deviation) < -3);
    const worstStop  = [...stops].sort((a, b) => parseFloat(b.late_pct) - parseFloat(a.late_pct))[0];
    return { id: r.id, name: r.name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, ""),
      avgEarly, avgOtp, avgLate, avgDev, totalTrips, probCount: probStops.length, stopCount: stops.length, worstStop };
  }).sort((a, b) => a.avgOtp - b.avgOtp); // worst first

  const otpColor = (pct) => pct >= 80 ? "#38a169" : pct >= 60 ? "#d69e2e" : "#e53e3e";

  return (
    <CollapsibleCard title="Schedule Reliability Summary" defaultOpen={true}
      rightLabel={`${summaries.length} routes`}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Routes sorted by on-time performance, worst first. A stop is a problem if &gt;20% late or avg deviation &lt;−3 min.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Route","Early %","On-Time %","Late %","Avg Dev","Problem Stops","Total Trips","Worst Stop"].map(h => (
                <th key={h} style={{ textAlign: h === "Route" || h === "Worst Stop" ? "left" : "center",
                  color: "var(--muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)",
                  fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="tag" style={{ background: ROUTE_COLORS[r.id] || "#555", color: "#fff", borderColor: ROUTE_COLORS[r.id] || "#555", fontSize: 10 }}>{r.id}</span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{r.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: "center", color: "#3182ce", fontWeight: 600, padding: "7px 8px" }}>
                  {r.avgEarly.toFixed(1)}%
                </td>
                <td style={{ textAlign: "center", fontWeight: 700, color: otpColor(r.avgOtp), padding: "7px 8px" }}>
                  {r.avgOtp.toFixed(1)}%
                </td>
                <td style={{ textAlign: "center", color: r.avgLate > 20 ? "var(--danger)" : "var(--muted)", padding: "7px 8px" }}>
                  {r.avgLate.toFixed(1)}%
                </td>
                <td style={{ textAlign: "center", color: r.avgDev < -1 ? "var(--danger)" : "var(--muted)", padding: "7px 8px" }}>
                  {r.avgDev > 0 ? "+" : ""}{r.avgDev.toFixed(1)} min
                </td>
                <td style={{ textAlign: "center", padding: "7px 8px" }}>
                  {r.probCount > 0
                    ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>{r.probCount} / {r.stopCount}</span>
                    : <span style={{ color: "var(--success)" }}>None</span>}
                </td>
                <td style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, padding: "7px 8px" }}>
                  {r.totalTrips.toLocaleString()}
                </td>
                <td style={{ fontSize: 11, color: "var(--muted)", padding: "7px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.worstStop?.stop_name || "—"}
                  {r.worstStop && <span style={{ color: "var(--danger)", marginLeft: 4 }}>{parseFloat(r.worstStop.late_pct).toFixed(0)}% late</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
        On-Time % and Late % are averages across all stops for the route. Data: 1/1/2025 – 2/4/2026.
      </div>
    </CollapsibleCard>
  );
}

// ─── Network Health Banner ────────────────────────────────────────────────────

function NetworkHealthBanner({ otp }) {
  if (!otp?.length) return null;

  const byRoute = otp.reduce((acc, row) => {
    const id = row.route_id;
    if (!acc[id]) acc[id] = { id, name: row.route_name, stops: [] };
    acc[id].stops.push(row);
    return acc;
  }, {});

  const summaries = Object.values(byRoute).map(r => {
    const stops = r.stops;
    const avgOtp  = stops.reduce((s, x) => s + parseFloat(x.ontime_pct || 0), 0) / stops.length;
    const avgLate = stops.reduce((s, x) => s + parseFloat(x.late_pct   || 0), 0) / stops.length;
    const probCount = stops.filter(x => parseFloat(x.late_pct) > 20 || parseFloat(x.avg_deviation) < -3).length;
    const name = r.name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, "");
    return { id: r.id, name, avgOtp, avgLate, probCount };
  });

  const healthy    = summaries.filter(r => r.avgOtp >= 80).length;
  const watch      = summaries.filter(r => r.avgOtp >= 60 && r.avgOtp < 80).length;
  const atRisk     = summaries.filter(r => r.avgOtp < 60).length;
  const totalProb  = summaries.reduce((s, r) => s + r.probCount, 0);
  const worst      = [...summaries].sort((a, b) => a.avgOtp - b.avgOtp)[0];
  const best       = [...summaries].sort((a, b) => b.avgOtp - a.avgOtp)[0];
  const total      = summaries.length;

  const statusCards = [
    { label: "Healthy", sub: "≥80% on-time", value: healthy, total, color: "#38a169", bg: "rgba(56,161,105,0.10)", border: "rgba(56,161,105,0.3)" },
    { label: "Watch",   sub: "60–80%",        value: watch,  total, color: "#d69e2e", bg: "rgba(214,158,46,0.10)", border: "rgba(214,158,46,0.3)" },
    { label: "At-Risk", sub: "<60% on-time",  value: atRisk, total, color: "#e53e3e", bg: "rgba(229,62,62,0.10)",  border: "rgba(229,62,62,0.3)"  },
    { label: "Flagged Stops", sub: "across network", value: totalProb, total: null, color: "#805ad5", bg: "rgba(128,90,213,0.10)", border: "rgba(128,90,213,0.3)" },
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Network Health Overview</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Healthy = ≥80% on-time · Watch = 60–80% · At-Risk = &lt;60%.
        A stop is flagged if &gt;20% of trips are late or avg deviation &lt;−3 min.
      </div>

      {/* Status tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {statusCards.map((c, i) => (
          <div key={i} style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 8, padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>
              {c.value}
              {c.total != null && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>/{c.total}</span>}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.color, marginTop: 2 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Best / Worst callout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {best && (
          <div style={{ fontSize: 12, padding: "8px 12px", background: "rgba(56,161,105,0.07)", border: "1px solid rgba(56,161,105,0.2)", borderRadius: 6 }}>
            <span style={{ color: "#38a169", fontWeight: 700 }}>✓ Best: </span>
            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: (ROUTE_COLORS[best.id] || "#888") + "22", color: ROUTE_COLORS[best.id] || "#888", border: `1px solid ${(ROUTE_COLORS[best.id] || "#888")}55`, marginRight: 4 }}>{best.id}</span>
            <span style={{ fontWeight: 600 }}>{best.name}</span>
            <span style={{ color: "#38a169", marginLeft: 6 }}>{best.avgOtp.toFixed(1)}% on-time</span>
          </div>
        )}
        {worst && (
          <div style={{ fontSize: 12, padding: "8px 12px", background: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: 6 }}>
            <span style={{ color: "var(--danger)", fontWeight: 700 }}>⚠ Worst: </span>
            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: (ROUTE_COLORS[worst.id] || "#888") + "22", color: ROUTE_COLORS[worst.id] || "#888", border: `1px solid ${(ROUTE_COLORS[worst.id] || "#888")}55`, marginRight: 4 }}>{worst.id}</span>
            <span style={{ fontWeight: 600 }}>{worst.name}</span>
            <span style={{ color: "var(--danger)", marginLeft: 6 }}>{worst.avgOtp.toFixed(1)}% on-time · {worst.avgLate.toFixed(1)}% late</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OTP Visual Chart (stacked horizontal bars) ───────────────────────────────

function OtpVisualChart({ otp }) {
  const [drilldown, setDrilldown] = useState(null);

  if (!otp?.length) return null;

  const byRoute = otp.reduce((acc, row) => {
    const id = row.route_id;
    if (!acc[id]) acc[id] = { id, name: row.route_name, stops: [] };
    acc[id].stops.push(row);
    return acc;
  }, {});

  const data = Object.values(byRoute).map(r => {
    const stops  = r.stops;
    const early  = stops.reduce((s, x) => s + parseFloat(x.early_pct  || 0), 0) / stops.length;
    const ontime = stops.reduce((s, x) => s + parseFloat(x.ontime_pct || 0), 0) / stops.length;
    const late   = stops.reduce((s, x) => s + parseFloat(x.late_pct   || 0), 0) / stops.length;
    const name   = r.name.replace(/ \([AB]\)$/, "").replace(/ \((Out|In)bound\)$/, "");
    return { id: r.id, name, early, ontime, late };
  }).sort((a, b) => b.ontime - a.ontime); // best first

  const chartData = data.map(r => ({
    name:    r.id,
    fullName: r.name,
    "Early":   parseFloat(r.early.toFixed(1)),
    "On-Time": parseFloat(r.ontime.toFixed(1)),
    "Late":    parseFloat(r.late.toFixed(1)),
  }));

  const handleClick = (d) => {
    const id = d?.activePayload?.[0]?.payload?.name;
    if (!id) return;
    setDrilldown(prev => prev === id ? null : id);
  };

  const drillStops = drilldown
    ? [...(otp || []).filter(r => r.route_id === drilldown)]
        .sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0))
    : [];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">On-Time Performance by Route</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Each bar = 100% of observed trips. Sorted best → worst on-time. Click a route bar to inspect stop-level detail.
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 11 }}>
        {[{ label: "Early", color: "#3182ce" }, { label: "On-Time", color: "#38a169" }, { label: "Late", color: "#e53e3e" }].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ color: "var(--muted)" }}>{l.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 42)}>
        <BarChart data={chartData} layout="vertical"
          margin={{ top: 4, right: 80, left: 32, bottom: 4 }}
          onClick={handleClick} style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
            tick={{ fill: "var(--muted)", fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={28}
            tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={n => chartData.find(d => d.name === n)?.fullName || n}
            formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
          />
          <Bar dataKey="Early"   stackId="a" fill="#3182ce" />
          <Bar dataKey="On-Time" stackId="a" fill="#38a169" />
          <Bar dataKey="Late"    stackId="a" fill="#e53e3e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: (ROUTE_COLORS[drilldown] || "#888") + "22", color: ROUTE_COLORS[drilldown] || "#888",
              border: `1px solid ${(ROUTE_COLORS[drilldown] || "#888")}55` }}>{drilldown}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Stop-by-Stop OTP</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Stop", "Dir", "Early%", "On-Time%", "Late%", "Avg Dev", "Trips"].map(h => (
                    <th key={h} style={{
                      textAlign: h === "Stop" ? "left" : "center",
                      color: "var(--muted)", padding: "4px 6px",
                      borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 10,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillStops.map((s, i) => {
                  const late = parseFloat(s.late_pct) || 0;
                  const dev  = parseFloat(s.avg_deviation) || 0;
                  const isProb = late > 20 || dev < -3;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: isProb ? "rgba(239,68,68,0.06)" : undefined }}>
                      <td style={{ padding: "4px 6px", fontWeight: isProb ? 600 : 400 }}>
                        {isProb && <span style={{ color: "var(--danger)", marginRight: 3 }}>▲</span>}
                        {s.stop_name}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--muted)", fontSize: 10, padding: "4px 6px" }}>{s.direction || "—"}</td>
                      <td style={{ textAlign: "center", color: "#3182ce",          padding: "4px 6px" }}>{s.early_pct}%</td>
                      <td style={{ textAlign: "center", color: "#38a169", fontWeight: 600, padding: "4px 6px" }}>{s.ontime_pct}%</td>
                      <td style={{ textAlign: "center", color: late > 20 ? "var(--danger)" : "var(--text)", padding: "4px 6px" }}>{s.late_pct}%</td>
                      <td style={{ textAlign: "center", color: dev < -3 ? "var(--danger)" : "var(--muted)", padding: "4px 6px" }}>{parseFloat(s.avg_deviation).toFixed(1)}</td>
                      <td style={{ textAlign: "center", color: "var(--muted)", padding: "4px 6px" }}>{s.total_trips}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DrilldownPanel>
      )}
    </div>
  );
}

// ─── Route Efficiency Chart (visual boards/mile + boards/stop) ────────────────

function RouteEfficiencyChart({ routes, ridership }) {
  const [view, setView] = useState("perMile");

  if (!routes?.length) return null;

  const riderMap = (ridership || []).reduce((acc, r) => { acc[r.route_id] = r; return acc; }, {});

  const rawData = routes.map(r => {
    const rid      = riderMap[r.route_id];
    const boardings = Number(rid?.total_boardings || 0);
    const dist      = parseFloat(r.total_distance_miles) || 0;
    const stops     = r.stop_count || 0;
    const spacing   = stops > 1 ? dist / (stops - 1) : 0;
    const spAssess  = spacing < 0.2 ? { label: "Too close", c: "#3182ce" }
      : spacing <= 0.4 ? { label: "Optimal", c: "#38a169" }
      : spacing <= 0.6 ? { label: "Acceptable", c: "#d69e2e" }
      : spacing > 0    ? { label: "Too sparse", c: "#e53e3e" }
      : null;
    return {
      id: r.route_id, name: r.route_name,
      color: ROUTE_COLORS[r.route_id] || "#888",
      boardings, dist, stops, spacing, spAssess,
      boardPerMile: dist > 0 ? boardings / dist : 0,
      boardPerStop: stops > 0 ? boardings / stops : 0,
    };
  }).filter(r => r.boardings > 0);

  const sorted = [...rawData].sort((a, b) =>
    b[view === "perMile" ? "boardPerMile" : "boardPerStop"] - a[view === "perMile" ? "boardPerMile" : "boardPerStop"]
  );

  const sysAvg = sorted.length
    ? sorted.reduce((s, r) => s + r[view === "perMile" ? "boardPerMile" : "boardPerStop"], 0) / sorted.length
    : 0;

  const chartData = sorted.map(r => ({
    name:     r.id,
    fullName: r.name,
    value:    parseFloat((view === "perMile" ? r.boardPerMile : r.boardPerStop).toFixed(1)),
    color:    r.color,
  }));

  return (
    <CollapsibleCard title="Route Efficiency" rightLabel="productivity by route">
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Routes ranked by boardings per unit of network resource. Below system average = potential candidate for schedule or alignment review.
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[{ k: "perMile", label: "Boards / Mile" }, { k: "perStop", label: "Boards / Stop" }].map(v => (
          <button key={v.k} onClick={() => setView(v.k)} style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${view === v.k ? "var(--accent)" : "var(--border)"}`,
            background: view === v.k ? "rgba(230,201,40,0.12)" : "transparent",
            color: view === v.k ? "var(--accent)" : "var(--muted)",
          }}>{v.label}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 38)}>
        <BarChart data={chartData} layout="vertical"
          margin={{ top: 4, right: 72, left: 28, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickFormatter={v => v.toLocaleString()} />
          <YAxis type="category" dataKey="name" width={28}
            tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={n => chartData.find(d => d.name === n)?.fullName || n}
            formatter={v => [v.toLocaleString(), view === "perMile" ? "Boards / Mile" : "Boards / Stop"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
        System avg: {sysAvg.toFixed(1)} {view === "perMile" ? "boardings / mile" : "boardings / stop"}
      </div>

      {/* Stop spacing assessment strip */}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Stop Spacing Assessment</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rawData.sort((a, b) => a.id.localeCompare(b.id)).map((r, i) => (
            r.spAssess ? (
              <div key={i} title={`${r.name}: ${r.spacing.toFixed(2)} mi avg spacing`} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
                borderRadius: 20, fontSize: 11,
                background: r.spAssess.c + "18",
                border: `1px solid ${r.spAssess.c}44`,
              }}>
                <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                  background: (r.color || "#888") + "22", color: r.color || "#888",
                  border: `1px solid ${(r.color || "#888")}55` }}>{r.id}</span>
                <span style={{ color: r.spAssess.c, fontWeight: 600 }}>{r.spAssess.label}</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{r.spacing.toFixed(2)} mi</span>
              </div>
            ) : null
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
          Optimal = 0.25–0.40 mi · Too close = &lt;0.20 mi · Acceptable = 0.40–0.60 mi · Too sparse = &gt;0.60 mi
        </div>
      </div>
    </CollapsibleCard>
  );
}

// ─── OTP Period Selector ──────────────────────────────────────────────────────

const MONTH_NAMES_OTP = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtOtpPeriod = (p) => {
  if (!p) return p;
  const [y, m] = String(p).split("-");
  return `${MONTH_NAMES_OTP[parseInt(m, 10) - 1]} ${y}`;
};

function OtpPeriodSelector({ activePeriod, onSelect }) {
  const [periods, setPeriods] = useState([]);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    getOtpPeriods().then(setPeriods).catch(() => {});
  }, []);

  const handleDelete = async (e, period) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${fmtOtpPeriod(period)} OTP data?`)) return;
    setDeleting(period);
    try {
      await deleteOtpPeriod(period);
      const updated = await getOtpPeriods();
      setPeriods(updated);
      if (activePeriod === period) onSelect(null);
    } finally {
      setDeleting(null);
    }
  };

  if (!periods.length) return null;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
      marginBottom: 16, padding: "10px 14px",
      background: "rgba(49,130,206,0.05)",
      border: "1px solid rgba(49,130,206,0.2)",
      borderRadius: 10,
    }}>
      <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        OTP Period
      </span>
      <button
        onClick={() => onSelect(null)}
        style={{
          padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
          border: `1px solid ${!activePeriod ? "#3182ce" : "var(--border)"}`,
          background: !activePeriod ? "rgba(49,130,206,0.15)" : "transparent",
          color: !activePeriod ? "#3182ce" : "var(--muted)",
        }}
      >
        All Time
      </button>
      {periods.map(({ period }) => {
        const active = activePeriod === period;
        return (
          <div key={period} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              onClick={() => onSelect(active ? null : period)}
              style={{
                padding: "3px 12px", borderRadius: "20px 0 0 20px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? "#3182ce" : "var(--border)"}`,
                borderRight: "none",
                background: active ? "rgba(49,130,206,0.15)" : "transparent",
                color: active ? "#3182ce" : "var(--muted)",
              }}
            >
              {fmtOtpPeriod(period)}
            </button>
            <button
              onClick={(e) => handleDelete(e, period)}
              disabled={deleting === period}
              title="Remove this period"
              style={{
                padding: "3px 7px", borderRadius: "0 20px 20px 0", fontSize: 10, cursor: "pointer",
                border: `1px solid ${active ? "#3182ce" : "var(--border)"}`,
                background: active ? "rgba(49,130,206,0.15)" : "transparent",
                color: "var(--muted)",
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── MetricsPanel (root export) ──────────────────────────────────────────────

export default function MetricsPanel({ metrics, simResult, routes, otp, simulatedRouteIds }) {
  const [activeModal, setActiveModal] = useState(null);
  const [otpPeriod, setOtpPeriod]     = useState(null);   // null = all-time
  const [periodOtp, setPeriodOtp]     = useState(null);   // loaded on demand

  useEffect(() => {
    if (!otpPeriod) { setPeriodOtp(null); return; }
    getOtpPeriod(otpPeriod).then(setPeriodOtp).catch(() => setPeriodOtp(null));
  }, [otpPeriod]);

  const activeOtp = periodOtp ?? otp;

  const handleExport = async () => {
    const blob = await exportMetricsCsv();
    downloadBlob(blob, "suntran_metrics.csv");
  };

  if (!metrics) {
    return <div style={{ padding: 32, color: "var(--muted)" }}>Loading metrics…</div>;
  }

  const s = metrics.summary;

  // Compute system-wide avg OTP — follows the selected period
  const systemOtp = activeOtp?.length
    ? (activeOtp.reduce((sum, r) => sum + parseFloat(r.ontime_pct || 0), 0) / activeOtp.length).toFixed(1)
    : null;

  // Total route miles and avg stop spacing across all routes
  const routePerf = metrics.route_performance ?? [];
  const totalRouteMiles = routePerf
    .reduce((sum, r) => sum + (parseFloat(r.total_distance_miles) || 0), 0)
    .toFixed(1);
  const allSpacings = routePerf
    .filter(r => r.stop_count > 1)
    .map(r => (parseFloat(r.total_distance_miles) || 0) / (r.stop_count - 1));
  const avgStopSpacing = allSpacings.length
    ? (allSpacings.reduce((a, b) => a + b, 0) / allSpacings.length).toFixed(2)
    : null;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <DetailModal modalKey={activeModal} metrics={metrics} otp={activeOtp} onClose={() => setActiveModal(null)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="panel-title" style={{ fontSize: 16 }}>
          Metrics Dashboard {simResult ? "— Simulation Run" : "— Current Network"}
        </div>
        <button className="btn-ghost" onClick={handleExport}>↓ Export CSV</button>
      </div>

      {/* 4-card KPI grid */}
      <div className="stat-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatBox label="Total Stops"       value={s.total_stops}        delta={simResult?.delta?.total_stops_delta} onClick={() => setActiveModal("total_stops")} />
        <StatBox label="Total Route Miles" value={totalRouteMiles}       unit="mi"  onClick={() => setActiveModal("route_miles")} />
        <StatBox label="Avg Stop Spacing"  value={avgStopSpacing ?? "—"} unit="mi"  onClick={() => setActiveModal("stop_spacing")} />
        <StatBox label="System On-Time"    value={systemOtp ?? "—"}      unit="%"   onClick={() => setActiveModal("system_otp")} />
      </div>

      {/* Network Health Overview */}
      <NetworkHealthBanner otp={activeOtp} />

      {/* Simulation comparison */}
      {simResult && <ComparisonSection simResult={simResult} />}

      {/* Route Efficiency Chart */}
      <RouteEfficiencyChart
        routes={metrics.route_performance}
        ridership={metrics.ridership_summary}
      />

      {/* Ridership Summary */}
      <RidershipSection ridership={metrics.ridership_summary} simulatedRouteIds={simulatedRouteIds} />

      {/* Employment hub reference — planning context */}
      <HubAccessSection
        hubs={metrics.employment_hub_access}
        title="Employment Hub Reference"
      />

      {/* OTP period selector + all OTP charts */}
      <OtpPeriodSelector activePeriod={otpPeriod} onSelect={setOtpPeriod} />
      <OtpVisualChart otp={activeOtp} />
      <OtpScorecard otp={activeOtp} />
      <OtpSection otp={activeOtp} />
    </div>
  );
}
