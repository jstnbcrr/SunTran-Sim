import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const ROUTE_COLORS = {
  "Route 1 Red Cliffs (A)":              "#e53e3e",
  "Route 1 Red Cliffs (B)":              "#fc8181",
  "Route 2 Riverside":                   "#3182ce",
  "Route 3 West Side Connector (Outbound)": "#38a169",
  "Route 3 West Side Connector (Inbound)":  "#68d391",
  "Route 4 Sunset":                      "#d69e2e",
  "Route 5 Ivins":                       "#805ad5",
  "Route 6 Dixie Dr South":              "#319795",
  "Route 7 Washington":                  "#dd6b20",
  "Route 8 Zion":                        "#c05621",
};

const SHORT = (r) => r
  .replace("Route ","R")
  .replace(" Red Cliffs","")
  .replace(" Riverside","")
  .replace(" West Side Connector","")
  .replace(" Sunset","")
  .replace(" Ivins","")
  .replace(" Dixie Dr South","")
  .replace(" Washington","")
  .replace(" Zion","")
  .replace(" (Outbound)","↑")
  .replace(" (Inbound)","↓")
  .replace(" (A)","A")
  .replace(" (B)","B");

const CARD  = { background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:16, marginBottom:16 };
const TITLE = { fontSize:13, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 };

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Route selector bar ────────────────────────────────────────────────────────
function RouteSelector({ routes, selected, onSelect }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20 }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          padding:"5px 14px", fontSize:12, fontWeight:700, borderRadius:6, cursor:"pointer",
          border:`2px solid ${selected===null ? "var(--accent)" : "var(--border)"}`,
          background: selected===null ? "rgba(230,201,40,0.15)" : "transparent",
          color: selected===null ? "var(--accent)" : "var(--muted)",
        }}
      >All Routes</button>
      {routes.map(r => (
        <button key={r} onClick={() => onSelect(r)} style={{
          padding:"5px 14px", fontSize:12, fontWeight:700, borderRadius:6, cursor:"pointer",
          border:`2px solid ${selected===r ? (ROUTE_COLORS[r]||"#555") : "var(--border)"}`,
          background: selected===r ? (ROUTE_COLORS[r]||"#555")+"22" : "transparent",
          color: selected===r ? (ROUTE_COLORS[r]||"#aaa") : "var(--muted)",
        }}>{SHORT(r)}</button>
      ))}
    </div>
  );
}

// ── Summary stats ─────────────────────────────────────────────────────────────
function SummaryStats({ byRoute, byRouteMonth, selectedRoute }) {
  const filtered = selectedRoute
    ? byRoute.filter(r => r.route === selectedRoute)
    : byRoute;
  const months = selectedRoute
    ? byRouteMonth.filter(r => r.route === selectedRoute)
    : byRouteMonth;

  const totalIn  = filtered.reduce((s,r) => s + Number(r.total_in),  0);
  const totalOut = filtered.reduce((s,r) => s + Number(r.total_out), 0);
  const monthCount = new Set(months.map(m => m.month)).size || 1;
  const avgMonthly = Math.round(totalIn / monthCount);
  const avgDaily   = filtered.length ? Math.round(filtered.reduce((s,r) => s + Number(r.avg_daily_in||0), 0)) : 0;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
      {[
        { label:"Total Boardings",    value: totalIn.toLocaleString()  },
        { label:"Total Alightings",   value: totalOut.toLocaleString() },
        { label:"Avg Monthly Board",  value: avgMonthly.toLocaleString() },
        { label:"Avg Daily Board",    value: avgDaily.toLocaleString() },
      ].map((s,i) => (
        <div key={i} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 14px" }}>
          <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>{s.label}</div>
          <div style={{ fontSize:18, fontWeight:700 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Route bar chart (system view only) ───────────────────────────────────────
function RouteChart({ byRoute }) {
  if (!byRoute?.length) return null;
  const data = [...byRoute].sort((a,b) => b.total_in - a.total_in).map(r => ({
    name: SHORT(r.route), fullName: r.route,
    Boardings: Number(r.total_in), Alightings: Number(r.total_out),
  }));
  return (
    <div style={CARD}>
      <div style={TITLE}>Total Boardings by Route</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{top:4,right:16,left:0,bottom:40}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{fill:"var(--muted)",fontSize:11}} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{fill:"var(--muted)",fontSize:11}} tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v} />
          <Tooltip contentStyle={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,fontSize:12}}
            formatter={(v,n) => [v.toLocaleString(),n]}
            labelFormatter={(_,p) => p?.[0]?.payload?.fullName||""} />
          <Legend wrapperStyle={{fontSize:12,color:"var(--muted)",paddingTop:8}} />
          <Bar dataKey="Boardings"  fill="#e6c928" radius={[4,4,0,0]} />
          <Bar dataKey="Alightings" fill="#3788d8" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── DOW chart ─────────────────────────────────────────────────────────────────
function DowChart({ byDow, byRouteDow, selectedRoute }) {
  const raw = selectedRoute
    ? byRouteDow.filter(r => r.route === selectedRoute)
    : byDow;
  if (!raw?.length) return null;
  const data = [...raw].sort((a,b) => Number(a.day_num)-Number(b.day_num)).map(d => ({
    day: d.day_name.slice(0,3),
    Boardings:  parseFloat(d.avg_in),
    Alightings: parseFloat(d.avg_out),
  }));
  return (
    <div style={CARD}>
      <div style={TITLE}>Avg Boardings by Day of Week{selectedRoute ? ` — ${SHORT(selectedRoute)}` : ""}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{top:4,right:16,left:0,bottom:4}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" tick={{fill:"var(--muted)",fontSize:12}} />
          <YAxis tick={{fill:"var(--muted)",fontSize:11}} />
          <Tooltip contentStyle={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,fontSize:12}} />
          <Legend wrapperStyle={{fontSize:12,color:"var(--muted)"}} />
          <Bar dataKey="Boardings"  fill="#e6c928" radius={[4,4,0,0]} />
          <Bar dataKey="Alightings" fill="#3788d8" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Monthly trend ─────────────────────────────────────────────────────────────
function MonthChart({ byMonth, byRouteMonth, selectedRoute }) {
  const raw = selectedRoute
    ? byRouteMonth.filter(r => r.route === selectedRoute)
    : byMonth;
  if (!raw?.length) return null;
  const data = [...raw].sort((a,b) => a.month.localeCompare(b.month)).map(d => ({
    month: d.month, Boardings: Number(d.total_in), Alightings: Number(d.total_out),
  }));
  return (
    <div style={CARD}>
      <div style={TITLE}>Monthly Trend{selectedRoute ? ` — ${SHORT(selectedRoute)}` : ""}</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{top:4,right:16,left:0,bottom:40}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{fill:"var(--muted)",fontSize:11}} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{fill:"var(--muted)",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,fontSize:12}}
            formatter={v=>v.toLocaleString()} />
          <Legend wrapperStyle={{fontSize:12,color:"var(--muted)",paddingTop:8}} />
          <Line type="monotone" dataKey="Boardings"  stroke="#e6c928" strokeWidth={2} dot={{r:3}} />
          <Line type="monotone" dataKey="Alightings" stroke="#3788d8" strokeWidth={2} dot={{r:3}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Top stops table ───────────────────────────────────────────────────────────
function TopStopsTable({ byStop, byRouteStop, selectedRoute }) {
  const raw = selectedRoute
    ? byRouteStop.filter(r => r.route === selectedRoute)
    : byStop;
  if (!raw?.length) return null;
  const sorted = [...raw].sort((a,b) => Number(b.total_in)-Number(a.total_in)).slice(0,20);
  return (
    <div style={CARD}>
      <div style={TITLE}>Top Stops by Boardings{selectedRoute ? ` — ${SHORT(selectedRoute)}` : ""}</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={{textAlign:"left",color:"var(--muted)",padding:"6px 8px",borderBottom:"1px solid var(--border)"}}>#</th>
              <th style={{textAlign:"left",color:"var(--muted)",padding:"6px 8px",borderBottom:"1px solid var(--border)"}}>Stop</th>
              {!selectedRoute && <th style={{textAlign:"left",color:"var(--muted)",padding:"6px 8px",borderBottom:"1px solid var(--border)"}}>Route</th>}
              <th style={{textAlign:"right",color:"var(--muted)",padding:"6px 8px",borderBottom:"1px solid var(--border)"}}>Total In</th>
              <th style={{textAlign:"right",color:"var(--muted)",padding:"6px 8px",borderBottom:"1px solid var(--border)"}}>Avg/Day</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s,i) => (
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"5px 8px",color:"var(--muted)"}}>{i+1}</td>
                <td style={{padding:"5px 8px",fontWeight:500}}>{s.address || s.stop_name}</td>
                {!selectedRoute && (
                  <td style={{padding:"5px 8px"}}>
                    <span style={{display:"inline-block",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:600,
                      background:(ROUTE_COLORS[s.route]||"#333")+"33",color:ROUTE_COLORS[s.route]||"var(--muted)"}}>
                      {SHORT(s.route)}
                    </span>
                  </td>
                )}
                <td style={{padding:"5px 8px",textAlign:"right"}}>{Number(s.total_in).toLocaleString()}</td>
                <td style={{padding:"5px 8px",textAlign:"right",color:"var(--accent)",fontWeight:600}}>{s.avg_daily_in}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function RidershipPanel({ byStop, byRoute, byDow, byMonth, byRouteDow, byRouteMonth, byRouteStop }) {
  const allRoutes = useMemo(() => [...new Set((byRoute||[]).map(r => r.route))].sort(), [byRoute]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24 }}>
      <div style={{ fontSize:16, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>
        Ridership Analysis — Jan 2025 – Feb 2026
      </div>

      <RouteSelector routes={allRoutes} selected={selectedRoute} onSelect={setSelectedRoute} />

      <SummaryStats byRoute={byRoute} byRouteMonth={byRouteMonth} selectedRoute={selectedRoute} />

      {!selectedRoute && <RouteChart byRoute={byRoute} />}

      <DowChart   byDow={byDow}     byRouteDow={byRouteDow}     selectedRoute={selectedRoute} />
      <MonthChart byMonth={byMonth} byRouteMonth={byRouteMonth} selectedRoute={selectedRoute} />
      <TopStopsTable byStop={byStop} byRouteStop={byRouteStop}  selectedRoute={selectedRoute} />
    </div>
  );
}
