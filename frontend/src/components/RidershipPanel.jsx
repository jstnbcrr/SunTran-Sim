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

// ── Demand forecast ───────────────────────────────────────────────────────────
const SUGGESTED_SCENARIOS = [
  {
    label: "S. Bloomington – New Costco",
    lat: 37.0721, lng: -113.5891,
    note: "Southern Bloomington development corridor. Major retail/employment growth area.",
  },
  { label: "Custom location", lat: "", lng: "", note: "" },
];

function DemandForecast({ stops, hubs, byRouteStop }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [lat, setLat] = useState(SUGGESTED_SCENARIOS[0].lat);
  const [lng, setLng] = useState(SUGGESTED_SCENARIOS[0].lng);
  const [radius, setRadius] = useState(1.0);

  const selectScenario = (idx) => {
    setScenarioIdx(idx);
    setLat(SUGGESTED_SCENARIOS[idx].lat);
    setLng(SUGGESTED_SCENARIOS[idx].lng);
  };

  const forecast = useMemo(() => {
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (isNaN(la) || isNaN(lo)) return null;

    // Find nearby stops with ridership data
    const stopLookup = {};
    stops.forEach(s => {
      const key = (s.address || s.stop_name || "").trim().toLowerCase();
      stopLookup[key] = { lat: parseFloat(s.latitude), lng: parseFloat(s.longitude), stop_id: s.stop_id, name: s.stop_name };
    });

    const nearbyStopData = [];
    byRouteStop.forEach(row => {
      const key = (row.address || "").trim().toLowerCase();
      const stopInfo = stopLookup[key];
      if (!stopInfo) return;
      const dist = haversine(la, lo, stopInfo.lat, stopInfo.lng);
      if (dist <= radius) {
        nearbyStopData.push({
          name: row.address, route: row.route,
          avg_daily_in: parseFloat(row.avg_daily_in) || 0,
          dist: dist,
        });
      }
    });

    // Nearest employment hubs
    const nearbyHubs = hubs.map(h => ({
      name: h.hub_name,
      workers: h.estimated_workers,
      dist: haversine(la, lo, parseFloat(h.latitude), parseFloat(h.longitude)),
    })).filter(h => h.dist <= 3).sort((a,b) => a.dist - b.dist);

    if (nearbyStopData.length === 0) return { nearbyStops: [], nearbyHubs, low: 0, mid: 0, high: 0, confidence: "Low" };

    // Distance-weighted average ridership from nearby stops
    const totalWeight = nearbyStopData.reduce((s, d) => s + (1 / (d.dist + 0.1)), 0);
    const weightedAvg = nearbyStopData.reduce((s, d) => s + d.avg_daily_in * (1 / (d.dist + 0.1)), 0) / totalWeight;

    // Hub proximity multiplier (more workers nearby = higher demand)
    const hubWorkers = nearbyHubs.reduce((s, h) => s + h.workers / Math.max(h.dist, 0.25), 0);
    const hubMultiplier = Math.min(1 + hubWorkers / 5000, 2.5);

    const base = weightedAvg * hubMultiplier;
    const low  = Math.round(base * 0.6);
    const mid  = Math.round(base);
    const high = Math.round(base * 1.5);

    const confidence = nearbyStopData.length >= 3 ? "High" : nearbyStopData.length === 2 ? "Medium" : "Low";

    return { nearbyStops: nearbyStopData.sort((a,b) => a.dist-b.dist).slice(0,5), nearbyHubs, low, mid, high, confidence, weightedAvg: Math.round(weightedAvg) };
  }, [lat, lng, radius, stops, hubs, byRouteStop]);

  const confColor = forecast?.confidence === "High" ? "var(--success)" : forecast?.confidence === "Medium" ? "var(--warning)" : "var(--danger)";

  return (
    <div style={CARD}>
      <div style={TITLE}>Demand Forecast — Hypothetical Stop</div>
      <div style={{fontSize:12,color:"var(--muted)",marginBottom:12,lineHeight:1.5}}>
        Estimates projected daily boardings for a new stop based on distance-weighted ridership from nearby existing stops and employment hub proximity.
      </div>

      {/* Scenario presets */}
      <div style={{marginBottom:12}}>
        <label style={{display:"block",fontSize:12,color:"var(--muted)",marginBottom:6}}>Scenario</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {SUGGESTED_SCENARIOS.map((s,i) => (
            <button key={i} onClick={() => selectScenario(i)} style={{
              padding:"5px 12px", fontSize:12, fontWeight:600, borderRadius:6, cursor:"pointer",
              border:`1px solid ${scenarioIdx===i ? "var(--accent)" : "var(--border)"}`,
              background: scenarioIdx===i ? "rgba(230,201,40,0.15)" : "transparent",
              color: scenarioIdx===i ? "var(--accent)" : "var(--muted)",
            }}>{s.label}</button>
          ))}
        </div>
        {SUGGESTED_SCENARIOS[scenarioIdx]?.note && (
          <div style={{fontSize:11,color:"var(--muted)",marginTop:6,fontStyle:"italic"}}>
            {SUGGESTED_SCENARIOS[scenarioIdx].note}
          </div>
        )}
      </div>

      {/* Coordinate inputs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <div className="form-row">
          <label>Latitude</label>
          <input value={lat} onChange={e=>setLat(e.target.value)} placeholder="37.07" />
        </div>
        <div className="form-row">
          <label>Longitude</label>
          <input value={lng} onChange={e=>setLng(e.target.value)} placeholder="-113.59" />
        </div>
        <div className="form-row">
          <label>Search radius (mi)</label>
          <input type="number" value={radius} min={0.25} max={5} step={0.25} onChange={e=>setRadius(parseFloat(e.target.value))} />
        </div>
      </div>

      {forecast && (
        <>
          {/* Forecast output */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
            {[
              { label:"Low Estimate",  value: forecast.low,  color:"var(--muted)"   },
              { label:"Mid Estimate",  value: forecast.mid,  color:"var(--accent)"  },
              { label:"High Estimate", value: forecast.high, color:"var(--success)" },
            ].map((e,i) => (
              <div key={i} style={{background:"var(--surface)",border:`1px solid var(--border)`,borderRadius:"var(--radius)",padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{e.label}</div>
                <div style={{fontSize:22,fontWeight:700,color:e.color}}>{e.value > 0 ? e.value : "—"}</div>
                <div style={{fontSize:10,color:"var(--muted)"}}>avg boardings/day</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <span style={{fontSize:12,color:"var(--muted)"}}>Model confidence:</span>
            <span style={{fontSize:12,fontWeight:700,color:confColor}}>{forecast.confidence}</span>
            <span style={{fontSize:11,color:"var(--muted)"}}>({forecast.nearbyStops.length} nearby stop{forecast.nearbyStops.length!==1?"s":""} within {radius} mi)</span>
          </div>

          {/* Nearby stops used */}
          {forecast.nearbyStops.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>Nearby stops used in model</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{textAlign:"left",color:"var(--muted)",padding:"4px 6px",borderBottom:"1px solid var(--border)"}}>Stop</th>
                    <th style={{textAlign:"left",color:"var(--muted)",padding:"4px 6px",borderBottom:"1px solid var(--border)"}}>Route</th>
                    <th style={{textAlign:"right",color:"var(--muted)",padding:"4px 6px",borderBottom:"1px solid var(--border)"}}>Dist (mi)</th>
                    <th style={{textAlign:"right",color:"var(--muted)",padding:"4px 6px",borderBottom:"1px solid var(--border)"}}>Avg/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.nearbyStops.map((s,i) => (
                    <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"4px 6px"}}>{s.name}</td>
                      <td style={{padding:"4px 6px"}}>
                        <span style={{color:ROUTE_COLORS[s.route]||"var(--muted)",fontWeight:600}}>{SHORT(s.route)}</span>
                      </td>
                      <td style={{padding:"4px 6px",textAlign:"right",fontFamily:"monospace"}}>{s.dist.toFixed(2)}</td>
                      <td style={{padding:"4px 6px",textAlign:"right",color:"var(--accent)",fontWeight:600}}>{s.avg_daily_in}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Nearby employment hubs */}
          {forecast.nearbyHubs.length > 0 && (
            <div>
              <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>Nearby employment hubs (within 3 mi)</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {forecast.nearbyHubs.slice(0,4).map((h,i) => (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 8px",background:"var(--surface)",borderRadius:4}}>
                    <span>{h.name}</span>
                    <span style={{color:"var(--muted)"}}>{h.workers.toLocaleString()} workers · {h.dist.toFixed(2)} mi</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forecast.nearbyStops.length === 0 && (
            <div style={{color:"var(--muted)",fontSize:12,fontStyle:"italic"}}>
              No stops with ridership data found within {radius} mi. Try increasing the search radius.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function RidershipPanel({ byStop, byRoute, byDow, byMonth, byRouteDow, byRouteMonth, byRouteStop, stops, hubs }) {
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

      <DemandForecast stops={stops} hubs={hubs} byRouteStop={byRouteStop} />
    </div>
  );
}
