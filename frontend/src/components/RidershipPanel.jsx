import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";
import { exportMetricsCsv } from "../api/client";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUTE_COLORS = {
  R1: "#e53e3e", R2: "#3182ce", R3: "#38a169",
  R4: "#d69e2e", R5: "#805ad5", R6: "#319795",
  R7: "#dd6b20", R8: "#c05621",
};

const ROUTE_NAME_COLORS = {
  "Route 1 Red Cliffs (A)":                 "#e53e3e",
  "Route 1 Red Cliffs (B)":                 "#fc8181",
  "Route 2 Riverside":                      "#3182ce",
  "Route 3 West Side Connector (Outbound)": "#38a169",
  "Route 3 West Side Connector (Inbound)":  "#68d391",
  "Route 4 Sunset":                         "#d69e2e",
  "Route 5 Ivins":                          "#805ad5",
  "Route 6 Dixie Dr South":                "#319795",
  "Route 7 Washington":                     "#dd6b20",
  "Route 8 Zion":                           "#c05621",
};

const SHORT = (r) => {
  if (!r) return "—";
  return r
    .replace("Route ", "R")
    .replace(" Red Cliffs", "").replace(" Riverside", "")
    .replace(" West Side Connector", "").replace(" Sunset", "")
    .replace(" Ivins", "").replace(" Dixie Dr South", "")
    .replace(" Washington", "").replace(" Zion", "")
    .replace(" (Outbound)", "↑").replace(" (Inbound)", "↓")
    .replace(" (A)", "A").replace(" (B)", "B");
};

const routeColor = (r) => ROUTE_NAME_COLORS[r] || ROUTE_COLORS[r] || "#888";

const fmtHour = (h) => {
  if (h == null) return "—";
  const n = Number(h);
  const ampm = n < 12 ? "am" : "pm";
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:00${ampm}`;
};

const yFmt = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v;

const TERMINUS_ROUTES = ["Route 3", "Route 4", "Route 5", "Route 6", "Route 7"];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div className="card" style={{ marginBottom: 16, ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
      <div className="card-title" style={{ margin: 0, flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

function DrilldownPanel({ onClose, children }) {
  return (
    <div style={{
      marginTop: 14, padding: "12px 14px",
      background: "rgba(230,201,40,0.04)",
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

function RouteBadge({ route, short }) {
  const color = routeColor(route);
  const label = short || SHORT(route);
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 700,
      background: color + "22", color, border: `1px solid ${color}55`,
    }}>{label}</span>
  );
}

function KpiCard({ label, value, sub, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? "rgba(230,201,40,0.07)" : "var(--surface)",
      border: `1px solid ${active ? "rgba(230,201,40,0.5)" : "var(--border)"}`,
      borderRadius: "var(--radius)", padding: "14px 16px",
      cursor: "pointer", transition: "border-color 0.15s",
      position: "relative",
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
      <span style={{ position: "absolute", top: 10, right: 12, fontSize: 10, color: "var(--muted)", opacity: 0.5 }}>ⓘ</span>
    </div>
  );
}

// ── System Summary KPIs ───────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtMonth = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo,10)-1]} '${y.slice(2)}`;
};

function SystemSummary({ byRoute, byDow, monthFilter }) {
  const [active, setActive] = useState(null);

  const totalIn    = (byRoute || []).reduce((s, r) => s + Number(r.total_in || 0), 0);
  const uniqueDays = Math.max(...(byRoute || []).map(r => Number(r.unique_days || 0)), 1);
  const dailyAvg   = uniqueDays > 0 ? Math.round(totalIn / uniqueDays) : 0;
  const topRoute   = [...(byRoute || [])].sort((a, b) => Number(b.total_in) - Number(a.total_in))[0];
  const peakDay    = [...(byDow || [])].sort((a, b) => Number(b.avg_in) - Number(a.avg_in))[0];
  const sorted     = [...(byRoute || [])].sort((a, b) => Number(b.total_in) - Number(a.total_in));
  const dowSorted  = [...(byDow || [])].sort((a, b) => Number(a.day_num) - Number(b.day_num));

  const isFiltered = monthFilter?.length > 0;

  // Period label for KPI sub-text
  const periodLabel = isFiltered
    ? monthFilter.length === 1
      ? `${fmtMonth(monthFilter[0])} · ${uniqueDays} service days`
      : `${monthFilter.length} months selected · ${uniqueDays} service days`
    : `${uniqueDays} service days · full period`;

  const cards = [
    { key: "boardings", label: "Total Boardings",  value: totalIn.toLocaleString(),               sub: `${(byRoute||[]).length} routes · ${isFiltered ? periodLabel : "full period"}` },
    { key: "daily",     label: "Daily System Avg", value: dailyAvg.toLocaleString(),              sub: periodLabel },
    { key: "peakday",   label: "Peak Day",         value: peakDay?.day_name?.slice(0,3) ?? "—",  sub: peakDay ? `${Number(peakDay.avg_in).toFixed(0)} avg boardings` : "" },
    { key: "toproute",  label: "Top Route",        value: topRoute ? SHORT(topRoute.route) : "—", sub: topRoute ? `${Number(topRoute.total_in).toLocaleString()} boardings` : "" },
  ];

  const drilldownContent = {
    boardings: (
      <>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Total Boardings by Route</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sorted.map(r => ({ name: SHORT(r.route), value: Number(r.total_in) }))}
            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fill: "#8899aa", fontSize: 11 }} />
            <YAxis tickFormatter={yFmt} tick={{ fill: "#8899aa", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              formatter={v => [v.toLocaleString(), "Boardings"]} />
            <Bar dataKey="value" radius={[4,4,0,0]}>
              {sorted.map((r, i) => <Cell key={i} fill={routeColor(r.route)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
          Raw APC unlinked trip counts. Routes 3–7 may be inflated by terminus double-counting at Sunset Corner.
        </div>
      </>
    ),
    daily: (
      <>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Avg Daily Boardings by Route</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "5px 14px", fontSize: 12, alignItems: "center" }}>
          {sorted.map((r, i) => (
            <React.Fragment key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <RouteBadge route={r.route} />
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{r.route}</span>
              </div>
              <span style={{ fontWeight: 700, textAlign: "right" }}>{Number(r.avg_daily_in || 0).toFixed(1)}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>/ day</span>
            </React.Fragment>
          ))}
        </div>
      </>
    ),
    peakday: (
      <>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Avg Boardings by Day of Week</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Day", "Avg Boardings", "vs Peak"].map(h => (
                <th key={h} style={{ textAlign: h === "Day" ? "left" : "right", color: "var(--muted)", padding: "4px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dowSorted.map((d, i) => {
              const val    = Number(d.avg_in);
              const peak   = Number(peakDay?.avg_in || 1);
              const pct    = (val / peak * 100).toFixed(0);
              const isPeak = d.day_name === peakDay?.day_name;
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: isPeak ? "rgba(230,201,40,0.06)" : undefined }}>
                  <td style={{ padding: "5px 8px", fontWeight: isPeak ? 700 : 400, color: isPeak ? "var(--accent)" : "var(--text)" }}>
                    {d.day_name}{isPeak && " ★"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{val.toFixed(0)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--muted)", fontSize: 11 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 50, height: 5, borderRadius: 3, background: "var(--border)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: isPeak ? "var(--accent)" : "var(--muted)" }} />
                      </div>
                      <span>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    ),
    toproute: (
      <>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Routes Ranked by Total Boardings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sorted.map((r, i) => {
            const maxVal = Number(sorted[0]?.total_in || 1);
            const pct    = (Number(r.total_in) / maxVal) * 100;
            return (
              <div key={i} style={{ fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                  <RouteBadge route={r.route} />
                  <span style={{ flex: 1, color: "var(--muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.route}</span>
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{Number(r.total_in).toLocaleString()}</span>
                  <span style={{ color: "var(--accent)", fontSize: 11, flexShrink: 0 }}>{Number(r.avg_daily_in || 0).toFixed(1)}/day</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--border)", marginLeft: 22 }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: routeColor(r.route), opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </>
    ),
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: active ? 0 : 16 }}>
        {cards.map(c => (
          <KpiCard key={c.key} label={c.label} value={c.value} sub={c.sub}
            active={active === c.key}
            onClick={() => setActive(prev => prev === c.key ? null : c.key)}
          />
        ))}
      </div>
      {active && drilldownContent[active] && (
        <DrilldownPanel onClose={() => setActive(null)}>
          {drilldownContent[active]}
        </DrilldownPanel>
      )}
      <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginTop: 4, marginBottom: 16 }}>
        * Click any card for details. Raw APC unlinked trip counts.
      </div>
    </>
  );
}

// ── Route × Day Heatmap ───────────────────────────────────────────────────────

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT  = { Monday:"Mon", Tuesday:"Tue", Wednesday:"Wed", Thursday:"Thu", Friday:"Fri", Saturday:"Sat", Sunday:"Sun" };

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : "150,150,150";
}

function RouteDayHeatmap({ byRouteDow }) {
  const { matrix, maxVal } = useMemo(() => {
    const routes = [...new Set((byRouteDow || []).map(r => r.route))].sort();
    const matrix = routes.map(route => {
      const days = DAYS_ORDER.map(day => {
        const row = (byRouteDow || []).find(r => r.route === route && r.day_name === day);
        return { day, value: row ? Math.round(Number(row.avg_in)) : 0 };
      });
      return { route, days };
    });
    const maxVal = Math.max(...matrix.flatMap(r => r.days.map(d => d.value)), 1);
    return { matrix, maxVal };
  }, [byRouteDow]);

  if (!matrix.length) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Avg Daily Boardings — Route × Day of Week</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Color intensity reflects demand level relative to the system peak. Bold cell = that route's peak day.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Route</th>
              {DAYS_ORDER.map(d => (
                <th key={d} style={{ textAlign: "center", padding: "4px 6px", color: "var(--muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                  borderBottom: d === "Friday" ? "2px solid var(--border)" : undefined }}>
                  {DAY_SHORT[d]}
                </th>
              ))}
              <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--accent)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wk Avg</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => {
              const color  = routeColor(row.route);
              const rgb    = hexToRgb(color);
              const maxRow = Math.max(...row.days.map(d => d.value), 1);
              const wkAvg  = Math.round(row.days.reduce((s, d) => s + d.value, 0) / 7);
              return (
                <tr key={i}>
                  <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <RouteBadge route={row.route} />
                      <span style={{ fontWeight: 600, fontSize: 11 }}>{SHORT(row.route)}</span>
                    </div>
                  </td>
                  {row.days.map((d, j) => {
                    const intensity = d.value / maxVal;
                    const isPeak    = d.value === maxRow && d.value > 0;
                    const isWeekend = d.day === "Saturday" || d.day === "Sunday";
                    const textColor = intensity > 0.45 ? "#fff" : "var(--text)";
                    return (
                      <td key={j} title={`${row.route} — ${d.day}: ${d.value} avg boardings`} style={{
                        textAlign: "center", padding: "9px 6px",
                        background: d.value > 0 ? `rgba(${rgb},${Math.max(0.1, intensity * 0.95)})` : "rgba(255,255,255,0.03)",
                        borderRadius: 5, fontWeight: isPeak ? 800 : 400,
                        color: d.value > 0 ? textColor : "var(--muted)", fontSize: 12,
                        border: isPeak ? `1.5px solid rgba(${rgb},0.9)` : `1px solid transparent`,
                        opacity: isWeekend ? 0.92 : 1,
                      }}>
                        {d.value > 0 ? d.value.toLocaleString() : "—"}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right", padding: "4px 8px", color: "var(--accent)", fontWeight: 700, fontSize: 12 }}>
                    {wkAvg}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Route Intelligence Scorecard ──────────────────────────────────────────────

function RouteScorecard({ byRoute, byRouteMonth, byRouteDow, byRouteStop }) {
  const [sortKey, setSortKey] = useState("total");
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => {
    if (!byRoute?.length) return [];
    return byRoute.map(r => {
      const name   = r.route;
      const months = [...(byRouteMonth || [])].filter(m => m.route === name).sort((a, b) => a.month.localeCompare(b.month));

      const recent3 = months.slice(-3);
      const prior3  = months.slice(-6, -3);
      const recentAvg = recent3.length ? recent3.reduce((s, m) => s + Number(m.total_in), 0) / recent3.length : 0;
      const priorAvg  = prior3.length  ? prior3.reduce((s, m) => s + Number(m.total_in), 0) / prior3.length  : 0;
      const trendPct  = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : null;

      const jan25 = months.filter(m => ["2025-01","2025-02"].includes(m.month)).reduce((s,m) => s + Number(m.total_in), 0);
      const jan26 = months.filter(m => ["2026-01","2026-02"].includes(m.month)).reduce((s,m) => s + Number(m.total_in), 0);
      const yoyPct = jan25 > 0 ? ((jan26 - jan25) / jan25) * 100 : null;

      const peakMonth = months.reduce((mx, m) => Number(m.total_in) > Number(mx?.total_in || 0) ? m : mx, null);
      const spark = months.map(m => Number(m.total_in));

      const dows = (byRouteDow || []).filter(d => d.route === name);
      const wdAvg = dows.filter(d => Number(d.day_num) >= 1 && Number(d.day_num) <= 5)
        .reduce((s, d, _, a) => s + Number(d.avg_in) / a.length, 0);
      const weAvg = dows.filter(d => Number(d.day_num) >= 6)
        .reduce((s, d, _, a) => s + Number(d.avg_in) / a.length, 0);
      const peakDow = dows.reduce((mx, d) => Number(d.avg_in) > Number(mx?.avg_in || 0) ? d : mx, null);
      const weRatio = wdAvg > 0 ? (weAvg / wdAvg) * 100 : null;

      const stops = [...new Set((byRouteStop || []).filter(s => s.route === name).map(s => s.address))];
      const productivity = stops.length > 0 ? Number(r.total_in) / stops.length : null;
      const isTerminus = TERMINUS_ROUTES.some(t => name.startsWith(t));

      return {
        name, short: SHORT(name), color: routeColor(name),
        totalIn: Number(r.total_in),
        avgDaily: Number(r.avg_daily_in || 0),
        trendPct, yoyPct,
        peakMonth: peakMonth?.month?.replace(/^\d{4}-/, "") || "—",
        peakMonthFull: peakMonth?.month || "—",
        peakDow: peakDow?.day_name?.slice(0,3) || "—",
        wdAvg, weAvg, weRatio,
        productivity: productivity ? Math.round(productivity) : null,
        stopCount: stops.length,
        isTerminus, spark,
      };
    });
  }, [byRoute, byRouteMonth, byRouteDow, byRouteStop]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "total")   return b.totalIn - a.totalIn;
      if (sortKey === "trend")   return (b.trendPct ?? -999) - (a.trendPct ?? -999);
      if (sortKey === "yoy")     return (b.yoyPct ?? -999) - (a.yoyPct ?? -999);
      if (sortKey === "prod")    return (b.productivity ?? 0) - (a.productivity ?? 0);
      if (sortKey === "weekend") return (b.weRatio ?? 0) - (a.weRatio ?? 0);
      return 0;
    });
  }, [rows, sortKey]);

  if (!sorted.length) return null;

  const Th = ({ k, label }) => (
    <th onClick={() => setSortKey(k)} style={{
      textAlign: "right", color: sortKey === k ? "var(--accent)" : "var(--muted)",
      padding: "6px 8px", borderBottom: "1px solid var(--border)",
      fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>{label}{sortKey === k ? " ▼" : ""}</th>
  );

  const TrendPct = ({ v }) => {
    if (v == null) return <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>;
    const up = v > 0;
    return <span style={{ color: up ? "#38a169" : "#e53e3e", fontWeight: 700, fontSize: 12 }}>{up ? "+" : ""}{v.toFixed(1)}%</span>;
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Route Intelligence Scorecard</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Click column headers to sort · Click a row to expand details
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", color: "var(--muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Route</th>
              <Th k="total"   label="Total Boardings" />
              <th style={{ textAlign: "right", color: "var(--muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Trend</th>
              <Th k="trend"   label="3-mo Δ" />
              <Th k="yoy"     label="YoY Jan–Feb" />
              <th style={{ textAlign: "right", color: "var(--muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Peak Mo</th>
              <th style={{ textAlign: "right", color: "var(--muted)", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Peak Day</th>
              <Th k="weekend" label="Wkend%" />
              <Th k="prod"    label="Boards/Stop" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isExp = expanded === r.name;
              return (
                <React.Fragment key={i}>
                  <tr onClick={() => setExpanded(prev => prev === r.name ? null : r.name)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isExp ? "rgba(230,201,40,0.04)" : undefined }}>
                    <td style={{ padding: "7px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <RouteBadge route={r.name} />
                        {r.isTerminus && <span title="Terminus inflation applies" style={{ fontSize: 10, color: "#d69e2e" }}>⚠</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700 }}>{r.totalIn.toLocaleString()}</td>
                    <td style={{ textAlign: "right", padding: "7px 8px" }}>
                      {r.spark.length > 1 ? (
                        <svg width="60" height="20" style={{ display: "block", marginLeft: "auto" }}>
                          {r.spark.map((v, si) => {
                            if (si === 0) return null;
                            const max = Math.max(...r.spark, 1);
                            const x1 = ((si-1) / (r.spark.length-1)) * 58 + 1;
                            const x2 = (si / (r.spark.length-1)) * 58 + 1;
                            const y1 = 18 - (r.spark[si-1] / max) * 16;
                            const y2 = 18 - (v / max) * 16;
                            return <line key={si} x1={x1} y1={y1} x2={x2} y2={y2} stroke={r.color} strokeWidth={1.5} opacity={0.8} />;
                          })}
                        </svg>
                      ) : <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right", padding: "7px 8px" }}><TrendPct v={r.trendPct} /></td>
                    <td style={{ textAlign: "right", padding: "7px 8px" }}><TrendPct v={r.yoyPct} /></td>
                    <td style={{ textAlign: "right", padding: "7px 8px", color: "var(--muted)", fontSize: 11 }}>{r.peakMonth}</td>
                    <td style={{ textAlign: "right", padding: "7px 8px", color: "var(--muted)", fontSize: 11 }}>{r.peakDow}</td>
                    <td style={{ textAlign: "right", padding: "7px 8px", color: "var(--muted)", fontSize: 11 }}>
                      {r.weRatio != null ? `${r.weRatio.toFixed(0)}%` : "—"}
                    </td>
                    <td style={{ textAlign: "right", padding: "7px 8px", color: "var(--accent)", fontWeight: 700 }}>
                      {r.productivity ?? "—"}
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ background: "rgba(230,201,40,0.02)" }}>
                      <td colSpan={9} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px 20px", fontSize: 12 }}>
                          <div><span style={{ color: "var(--muted)" }}>Avg Daily: </span><strong>{r.avgDaily.toFixed(1)}</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Stops: </span><strong>{r.stopCount}</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Weekday avg: </span><strong>{r.wdAvg.toFixed(0)}</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Weekend avg: </span><strong>{r.weAvg.toFixed(0)}</strong></div>
                        </div>
                        {r.isTerminus && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "#d69e2e", fontStyle: "italic" }}>
                            ⚠ Terminus inflation: this route shares Sunset Corner terminus — raw APC totals may be 22–53% higher than actual.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Year-over-Year Chart ───────────────────────────────────────────────────────

function YoYChart({ byRouteMonth }) {
  const data = useMemo(() => {
    const routes = [...new Set((byRouteMonth || []).map(r => r.route))].sort();
    return routes.map(route => {
      const months = (byRouteMonth || []).filter(m => m.route === route);
      const y25 = months.filter(m => ["2025-01","2025-02"].includes(m.month)).reduce((s,m) => s + Number(m.total_in), 0);
      const y26 = months.filter(m => ["2026-01","2026-02"].includes(m.month)).reduce((s,m) => s + Number(m.total_in), 0);
      return { name: SHORT(route), fullName: route, "2025": y25, "2026": y26, color: routeColor(route) };
    }).filter(d => d["2025"] > 0 || d["2026"] > 0)
      .sort((a, b) => b["2025"] - a["2025"]);
  }, [byRouteMonth]);

  if (!data.length) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Year-over-Year: Jan–Feb 2025 vs 2026</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Same 2-month window across years. Green bar = growth, red = decline.
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8899aa", fontSize: 11 }} />
          <YAxis tickFormatter={yFmt} tick={{ fill: "#8899aa", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={n => data.find(d => d.name === n)?.fullName || n}
            formatter={(v, name) => [v.toLocaleString(), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
          <Bar dataKey="2025" fill="rgba(150,150,160,0.55)" radius={[3,3,0,0]} />
          <Bar dataKey="2026" radius={[3,3,0,0]}>
            {data.map((d, i) => <Cell key={i} fill={d["2026"] >= d["2025"] ? "#38a169" : "#e53e3e"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Weekday vs Weekend Chart ───────────────────────────────────────────────────

function WeekdayWeekendChart({ byRouteDow }) {
  const data = useMemo(() => {
    const routes = [...new Set((byRouteDow || []).map(r => r.route))].sort();
    return routes.map(route => {
      const dows = (byRouteDow || []).filter(d => d.route === route);
      const wdArr = dows.filter(d => Number(d.day_num) >= 1 && Number(d.day_num) <= 5);
      const weArr = dows.filter(d => Number(d.day_num) >= 6);
      const wdAvg = wdArr.length ? wdArr.reduce((s, d) => s + Number(d.avg_in), 0) / wdArr.length : 0;
      const weAvg = weArr.length ? weArr.reduce((s, d) => s + Number(d.avg_in), 0) / weArr.length : 0;
      return { name: SHORT(route), fullName: route, Weekday: Math.round(wdAvg), Weekend: Math.round(weAvg), color: routeColor(route) };
    }).filter(d => d.Weekday > 0 || d.Weekend > 0)
      .sort((a, b) => b.Weekday - a.Weekday);
  }, [byRouteDow]);

  if (!data.length) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Weekday vs. Weekend Avg Daily Boardings</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        High weekday-to-weekend ratio = commuter route. Route 8 (Zion) expected to flip on weekends.
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8899aa", fontSize: 11 }} />
          <YAxis tickFormatter={yFmt} tick={{ fill: "#8899aa", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={n => data.find(d => d.name === n)?.fullName || n} />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
          <Bar dataKey="Weekday" fill="var(--accent)" radius={[3,3,0,0]} opacity={0.9} />
          <Bar dataKey="Weekend" fill="#3788d8" radius={[3,3,0,0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Seasonal Index Chart ───────────────────────────────────────────────────────

function SeasonalIndexChart({ byMonth, byRouteMonth }) {
  const [selectedRoute, setSelectedRoute] = useState("__system__");

  const routes = useMemo(() => [...new Set((byRouteMonth || []).map(r => r.route))].sort(), [byRouteMonth]);

  const chartData = useMemo(() => {
    const raw = selectedRoute === "__system__"
      ? [...(byMonth || [])].sort((a, b) => a.month.localeCompare(b.month))
      : [...(byRouteMonth || [])].filter(r => r.route === selectedRoute).sort((a, b) => a.month.localeCompare(b.month));
    if (!raw.length) return [];
    const avg = raw.reduce((s, d) => s + Number(d.total_in), 0) / raw.length;
    return raw.map(d => ({
      month: d.month,
      index: avg > 0 ? Math.round((Number(d.total_in) / avg) * 100) : 0,
      boardings: Number(d.total_in),
    }));
  }, [byMonth, byRouteMonth, selectedRoute]);

  if (!byMonth?.length) return null;

  const selColor = selectedRoute === "__system__" ? "var(--accent)" : routeColor(selectedRoute);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Seasonal Demand Index</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Each month relative to the period average (100 = average month).
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setSelectedRoute("__system__")} style={{
          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
          border: `1px solid ${selectedRoute === "__system__" ? "var(--accent)" : "var(--border)"}`,
          background: selectedRoute === "__system__" ? "rgba(230,201,40,0.12)" : "transparent",
          color: selectedRoute === "__system__" ? "var(--accent)" : "var(--muted)",
        }}>System</button>
        {routes.map(route => {
          const c = routeColor(route);
          const isActive = selectedRoute === route;
          return (
            <button key={route} onClick={() => setSelectedRoute(route)} style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${isActive ? c : "var(--border)"}`,
              background: isActive ? c + "22" : "transparent",
              color: isActive ? c : "var(--muted)",
            }}>{SHORT(route)}</button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#8899aa", fontSize: 10 }} />
          <YAxis domain={[0, "auto"]} tick={{ fill: "#8899aa", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
            formatter={(v, _, p) => [`${v} (${p.payload.boardings?.toLocaleString()} boardings)`, "Index"]} />
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4"
            label={{ value: "avg", position: "right", fill: "#8899aa", fontSize: 10 }} />
          <Bar dataKey="index" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.index >= 100 ? selColor : "rgba(150,150,160,0.45)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Day of Week Chart ─────────────────────────────────────────────────────────

function DowChart({ byDow, byRouteDow }) {
  const [drilldown, setDrilldown] = useState(null);

  const raw = useMemo(
    () => [...(byDow || [])].sort((a, b) => Number(a.day_num) - Number(b.day_num)),
    [byDow]
  );
  if (!raw?.length) return null;

  const chartData = raw.map(d => ({
    day: d.day_name.slice(0, 3), fullDay: d.day_name,
    Boardings: parseFloat(d.avg_in),
  }));

  const ddPerRoute = drilldown
    ? [...new Set((byRouteDow || []).map(r => r.route))]
        .map(route => {
          const row = byRouteDow.find(r => r.route === route && r.day_name === drilldown);
          return row ? { name: SHORT(route), fullName: route, Boardings: parseFloat(row.avg_in), color: routeColor(route) } : null;
        })
        .filter(Boolean).sort((a, b) => b.Boardings - a.Boardings)
    : [];

  const handleClick = (data) => {
    const day = data?.activePayload?.[0]?.payload?.fullDay;
    if (!day) return;
    setDrilldown(prev => prev === day ? null : day);
  };

  return (
    <Card>
      <CardTitle>Avg Boardings by Day of Week</CardTitle>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        Click a day bar to see per-route breakdown
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          onClick={handleClick} style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="day" tick={{ fill: "#8899aa", fontSize: 12 }} />
          <YAxis tick={{ fill: "#8899aa", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#0f1f35", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullDay || ""}
            formatter={(v, name, p) => p?.payload?.Boardings === 0 ? ["No service", ""] : [v.toLocaleString(), "Avg Boardings"]} />
          <Bar dataKey="Boardings" radius={[4,4,0,0]} minPointSize={28}
            label={{ position: "insideTop", fontSize: 10, dy: 10,
              fill: "rgba(255,255,255,0.4)",
              formatter: (v) => v === 0 ? "No service" : "",
            }}>
            {chartData.map((d, i) => (
              <Cell key={i}
                fill={d.Boardings === 0 ? "rgba(255,255,255,0.06)" : "#e6c928"}
                stroke={d.Boardings === 0 ? "rgba(255,255,255,0.18)" : "none"}
                strokeWidth={1}
                opacity={d.Boardings === 0 ? 1 : (drilldown && drilldown !== d.fullDay ? 0.25 : 1)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {drilldown && ddPerRoute.length > 0 && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
            {drilldown} — Avg boardings per route
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={ddPerRoute} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: "#8899aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8899aa", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                formatter={v => [v.toFixed(1), "Avg Boardings"]}
                labelFormatter={n => ddPerRoute.find(d => d.name === n)?.fullName || n} />
              <Bar dataKey="Boardings" radius={[4,4,0,0]}>
                {ddPerRoute.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </DrilldownPanel>
      )}
    </Card>
  );
}

// ── Top Stops Chart ───────────────────────────────────────────────────────────

function TopStopsChart({ byStop, byRouteStop }) {
  const [drilldown, setDrilldown] = useState(null);

  const aggregated = useMemo(() => {
    const agg = {};
    (byStop || []).forEach(s => {
      const key = s.address || s.stop_name || (s.stop_id ? String(s.stop_id) : "");
      if (!key) return; // skip rows with no identifier
      if (!agg[key]) agg[key] = { ...s, total_in: 0, total_out: 0, _dailySum: 0, _count: 0 };
      agg[key].total_in  += Number(s.total_in  || 0);
      agg[key].total_out += Number(s.total_out || 0);
      agg[key]._dailySum += Number(s.avg_daily_in || 0);
      agg[key]._count    += 1;
    });
    return Object.values(agg).map(s => ({
      ...s,
      avg_daily_in: (s._dailySum / Math.max(s._count, 1)).toFixed(1),
    }));
  }, [byStop]);

  if (!aggregated.length) return null;

  const allSorted = [...aggregated].sort((a, b) => Number(b.total_in) - Number(a.total_in));
  const displayRows = allSorted.slice(0, 15);

  const ddRoutes = drilldown
    ? (byRouteStop || [])
        .filter(r => (r.stop_name || r.address) === (drilldown.stop_name || drilldown.address))
        .sort((a, b) => Number(b.total_in) - Number(a.total_in))
    : [];

  const stopLabel = (s) => (s.address || s.stop_name || "").slice(0, 28);
  const stopKey   = (s) => s.address || s.stop_name || String(s.stop_id || "");

  const chartData = displayRows.map(s => ({
    name:     stopLabel(s),
    fullName: s.address || s.stop_name,
    key:      stopKey(s),
    Boardings: Number(s.total_in),
    row: s,
  }));

  return (
    <Card>
      <CardTitle>Top {displayRows.length} Stops by Boardings</CardTitle>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        Click a bar to see which routes serve that stop
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, displayRows.length * 34)}>
        <BarChart data={chartData} layout="vertical"
          margin={{ top: 4, right: 64, left: 8, bottom: 4 }}
          onClick={data => {
            const row = data?.activePayload?.[0]?.payload?.row;
            if (!row) return;
            const key = stopKey(row);
            setDrilldown(prev => stopKey(prev || {}) === key ? null : row);
          }}
          style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
          <XAxis type="number" tickFormatter={yFmt} tick={{ fill: "#8899aa", fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={200}
            tick={{ fill: "#b0bec5", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#0f1f35", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, fontSize: 12 }}
            formatter={v => [v.toLocaleString(), "Boardings"]}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ""} />
          <Bar dataKey="Boardings" radius={[0,4,4,0]} barSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill="#4a9eca"
                opacity={drilldown && stopKey(drilldown) !== d.key ? 0.35 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {drilldown && (
        <DrilldownPanel onClose={() => setDrilldown(null)}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{drilldown.address || drilldown.stop_name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 20px", fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: "var(--muted)" }}>Total Boardings</span>
            <span style={{ fontWeight: 700 }}>{Number(drilldown.total_in).toLocaleString()}</span>
            <span style={{ color: "var(--muted)" }}>Avg / Day</span>
            <span style={{ fontWeight: 700 }}>{drilldown.avg_daily_in}</span>
          </div>
          {ddRoutes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ddRoutes.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <RouteBadge route={r.route} />
                  <span style={{ color: "var(--muted)", flex: 1 }}>{r.route}</span>
                  <span style={{ fontWeight: 700 }}>{Number(r.total_in).toLocaleString()}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{r.avg_daily_in}/day</span>
                </div>
              ))}
            </div>
          )}
        </DrilldownPanel>
      )}
    </Card>
  );
}

// ── Month Filter Bar ──────────────────────────────────────────────────────────

function MonthFilterBar({ availableMonths, monthFilter, onMonthFilterChange }) {
  if (!availableMonths?.length) return null;

  const allSelected = monthFilter.length === 0;

  const toggleMonth = (m) => {
    onMonthFilterChange(
      monthFilter.includes(m) ? monthFilter.filter(x => x !== m) : [...monthFilter, m]
    );
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      padding: "8px 12px", marginBottom: 16,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginRight: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Period:
      </span>
      <button onClick={() => onMonthFilterChange([])} style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${allSelected ? "var(--accent)" : "var(--border)"}`,
        background: allSelected ? "rgba(230,201,40,0.12)" : "transparent",
        color: allSelected ? "var(--accent)" : "var(--muted)", transition: "all 0.12s",
      }}>All time</button>
      {availableMonths.map(m => {
        const active = monthFilter.includes(m);
        return (
          <button key={m} onClick={() => toggleMonth(m)} style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            background: active ? "rgba(230,201,40,0.12)" : "transparent",
            color: active ? "var(--accent)" : "var(--muted)", transition: "all 0.12s",
          }}>{fmtMonth(m)}</button>
        );
      })}
      {!allSelected && (
        <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 4, fontStyle: "italic" }}>
          {monthFilter.length} month{monthFilter.length !== 1 ? "s" : ""} selected
        </span>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function RidershipPanel({
  byStop, byRoute, byDow, byMonth, byRouteDow, byRouteMonth, byRouteStop,
  byHour, byRouteHour, byDowHour, byRouteDowHour, byRouteStopHour,
  byStopMonth, byDowMonth, byRouteDowMonth,
  availableMonths, monthFilter, onMonthFilterChange,
  otp, simulatedRouteIds,
}) {
  // ── Derive filtered versions of key datasets when monthFilter is active ──
  const filtered = useMemo(() => {
    const active = monthFilter?.length > 0;
    if (!active) return { byRoute, byDow, byStop, byRouteDow };

    // byRoute: sum route_month rows for selected months
    const rmFiltered = (byRouteMonth || []).filter(r => monthFilter.includes(r.month));
    const routeMap = {};
    rmFiltered.forEach(r => {
      if (!routeMap[r.route]) routeMap[r.route] = { route: r.route, total_in: 0, total_out: 0, unique_days: 0 };
      routeMap[r.route].total_in    += Number(r.total_in    || 0);
      routeMap[r.route].total_out   += Number(r.total_out   || 0);
      routeMap[r.route].unique_days += Number(r.unique_days || 0);
    });
    const filteredByRoute = Object.values(routeMap).map(r => ({
      ...r,
      avg_daily_in:  r.unique_days > 0 ? (r.total_in  / r.unique_days).toFixed(1) : "0",
      avg_daily_out: r.unique_days > 0 ? (r.total_out / r.unique_days).toFixed(1) : "0",
    }));

    // byDow: sum dow_month rows for selected months
    const dmFiltered = (byDowMonth || []).filter(r => monthFilter.includes(r.month));
    const dowMap = {};
    dmFiltered.forEach(r => {
      const k = String(r.day_num);
      if (!dowMap[k]) dowMap[k] = { day_num: r.day_num, day_name: r.day_name, total_in: 0, _ndays: 0 };
      dowMap[k].total_in += Number(r.total_in || 0);
      dowMap[k]._ndays   += 1;
    });
    const filteredByDow = Object.values(dowMap).map(r => ({
      ...r,
      avg_in: r._ndays > 0 ? (r.total_in / r._ndays).toFixed(1) : "0",
    }));

    // byStop: aggregate stop_month rows for selected months
    const smFiltered = (byStopMonth || []).filter(r => monthFilter.includes(r.month));
    const stopMap = {};
    smFiltered.forEach(r => {
      const k = `${r.route}||${r.stop_id}`;
      if (!stopMap[k]) stopMap[k] = { ...r, total_in: 0, total_out: 0, days: 0 };
      stopMap[k].total_in  += Number(r.total_in  || 0);
      stopMap[k].total_out += Number(r.total_out || 0);
      stopMap[k].days      += Number(r.days      || 0);
    });
    const filteredByStop = Object.values(stopMap).map(r => ({
      ...r,
      avg_daily_in:  r.days > 0 ? (r.total_in  / r.days).toFixed(2) : "0",
      avg_daily_out: r.days > 0 ? (r.total_out / r.days).toFixed(2) : "0",
    }));

    // byRouteDow: average route×dow across selected months from byRouteDowMonth
    const rdmFiltered = (byRouteDowMonth || []).filter(r => monthFilter.includes(r.month));
    const rdMap = {};
    rdmFiltered.forEach(r => {
      const k = `${r.route}||${r.day_num}`;
      if (!rdMap[k]) rdMap[k] = { route: r.route, day_num: r.day_num, day_name: r.day_name, total_in: 0, _ndays: 0 };
      rdMap[k].total_in += Number(r.total_in || 0);
      rdMap[k]._ndays   += 1;
    });
    const filteredByRouteDow = Object.values(rdMap).map(r => ({
      ...r,
      avg_in:  r._ndays > 0 ? (r.total_in / r._ndays).toFixed(1) : "0",
      avg_out: "0",
      total_out: 0,
    }));

    return {
      byRoute:    filteredByRoute,
      byDow:      filteredByDow,
      byStop:     filteredByStop.length ? filteredByStop : byStop,
      byRouteDow: filteredByRouteDow.length ? filteredByRouteDow : byRouteDow,
    };
  }, [monthFilter, byRoute, byDow, byStop, byRouteDow, byRouteMonth, byDowMonth, byStopMonth, byRouteDowMonth]);

  const hasData   = !!(byRoute?.length || byStop?.length || byHour?.length);
  const isFiltered = monthFilter?.length > 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="panel-title" style={{ fontSize: 16 }}>
          Ridership Analysis — Current Network
        </div>
        <button className="btn-ghost" onClick={async () => {
          const blob = await exportMetricsCsv();
          downloadBlob(blob, "suntran_ridership.csv");
        }}>↓ Export CSV</button>
      </div>

      {/* Month filter bar */}
      {hasData && (
        <MonthFilterBar
          availableMonths={availableMonths}
          monthFilter={monthFilter || []}
          onMonthFilterChange={onMonthFilterChange}
        />
      )}

      {!hasData ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No ridership data loaded</div>
          <div style={{ fontSize: 12 }}>Import AveragePassengerCounts.csv in the Import tab to populate this dashboard.</div>
        </div>
      ) : (
        <>
          {/* Executive summary KPIs */}
          <SystemSummary byRoute={filtered.byRoute} byDow={filtered.byDow} monthFilter={monthFilter} />

          {/* Route × Day heatmap */}
          <RouteDayHeatmap byRouteDow={filtered.byRouteDow} />

          {/* Route intelligence scorecard */}
          <RouteScorecard
            byRoute={filtered.byRoute}
            byRouteMonth={byRouteMonth}
            byRouteDow={filtered.byRouteDow}
            byRouteStop={byRouteStop}
          />

          {/* Pattern analysis — hide YoY + seasonal when filtered (they already show all months) */}
          {!isFiltered && <YoYChart byRouteMonth={byRouteMonth} />}
          <WeekdayWeekendChart byRouteDow={filtered.byRouteDow} />
          {!isFiltered && <SeasonalIndexChart byMonth={byMonth} byRouteMonth={byRouteMonth} />}

          {/* Supporting detail charts */}
          <DowChart byDow={filtered.byDow} byRouteDow={filtered.byRouteDow} />
          <TopStopsChart byStop={filtered.byStop} byRouteStop={byRouteStop} />
        </>
      )}
    </div>
  );
}
