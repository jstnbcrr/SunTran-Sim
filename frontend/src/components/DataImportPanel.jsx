import React, { useState, useEffect, useRef } from "react";
import {
  getSlotInfo,
  downloadTemplate,
  previewSlotUpload,
  uploadToSlot,
  downloadCurrentCsv,
  downloadBoardingsCsv,
  getRawImportInfo,
  previewRawImport,
  uploadRawImport,
  getBoardingsMonths,
  deleteBoardingsMonth,
} from "../api/client";

// ── Slot definitions — network files only (ridership/OTP come from raw AVL/APC) ──
const SLOT_GROUPS = [
  {
    id: "network",
    title: "Network Files",
    desc: "Stops, routes, and employment hubs. These replace existing data — use carefully.",
    slots: [
      { key: "stops",           label: "Bus Stops",        desc: "All bus stop locations used in routing and the map.",         merge: false },
      { key: "routes",          label: "Routes",           desc: "Route definitions with ordered, pipe-separated stop lists.", merge: false },
      { key: "employment_hubs", label: "Employment Hubs",  desc: "Major employment destinations for accessibility analysis.",  merge: false },
    ],
  },
];

// ── Column pills ───────────────────────────────────────────────────────────────
function ColumnPills({ columns, keyColumns = [] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
      {columns.map(col => {
        const isKey = keyColumns.includes(col);
        return (
          <span key={col} style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 10,
            background: isKey ? "rgba(52,152,219,0.15)" : "var(--surface2)",
            color: isKey ? "var(--accent)" : "var(--muted)",
            border: `1px solid ${isKey ? "var(--accent)" : "var(--border)"}`,
            fontFamily: "monospace",
          }}>
            {col}
          </span>
        );
      })}
    </div>
  );
}

// ── Mismatch error detail ──────────────────────────────────────────────────────
function MismatchError({ err }) {
  const detail = err?.response?.data?.detail || err?.message || String(err);
  let parsed = null;
  try { parsed = typeof detail === "object" ? detail : JSON.parse(detail); } catch {}

  if (parsed?.missing) {
    return (
      <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8,
        background: "rgba(231,76,60,0.08)", borderRadius: 6, padding: "10px 12px" }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Column mismatch — file doesn't match the template</div>
        <div style={{ marginBottom: 4 }}>
          Missing: {parsed.missing.map(c => (
            <span key={c} style={{ fontFamily: "monospace", background: "rgba(231,76,60,0.15)",
              padding: "1px 5px", borderRadius: 4, marginRight: 4 }}>{c}</span>
          ))}
        </div>
        <div style={{ color: "var(--muted)" }}>
          Download the template below to see the exact format required.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8,
      background: "rgba(231,76,60,0.08)", borderRadius: 6, padding: "8px 12px" }}>
      {typeof detail === "string" ? detail : detail?.message || "Upload failed"}
    </div>
  );
}

// ── Import preview card ────────────────────────────────────────────────────────
function PreviewCard({ preview, onConfirm, onCancel, busy }) {
  return (
    <div style={{ marginTop: 10, background: "var(--bg)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Ready to import</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px",
        fontSize: 11, marginBottom: 10 }}>
        <span style={{ color: "var(--muted)" }}>Existing rows</span>
        <span>{preview.existing_rows?.toLocaleString()}</span>
        <span style={{ color: "var(--muted)" }}>Incoming rows</span>
        <span>{preview.incoming_rows?.toLocaleString()}</span>
        {preview.rows_to_add > 0 && <>
          <span style={{ color: "var(--muted)" }}>New rows</span>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>+{preview.rows_to_add?.toLocaleString()}</span>
        </>}
        {preview.rows_to_update > 0 && <>
          <span style={{ color: "var(--muted)" }}>Rows updated</span>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{preview.rows_to_update?.toLocaleString()}</span>
        </>}
        {preview.date_range && <>
          <span style={{ color: "var(--muted)" }}>Data range</span>
          <span style={{ color: "var(--accent)" }}>{preview.date_range.min} → {preview.date_range.max}</span>
        </>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" style={{ fontSize: 11, padding: "6px 18px" }}
          onClick={onConfirm} disabled={busy}>
          {busy ? "Importing…" : "Confirm Import"}
        </button>
        <button className="btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }}
          onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Single import slot card ────────────────────────────────────────────────────
function ImportSlotCard({ slotKey, label, desc, merge, onRefreshAll }) {
  const [info,        setInfo]    = useState(null);
  const [columns,     setCols]    = useState([]);
  const [keyColumns,  setKeyCols] = useState([]);
  const [filename,    setFilename] = useState("");
  const [expanded,    setExpanded] = useState(false);
  const [stage,       setStage]   = useState("idle");
  const [preview,     setPreview] = useState(null);
  const [error,       setError]   = useState(null);
  const [pendingFile, setPending] = useState(null);
  const [mode,        setMode]    = useState(merge ? "merge" : "replace");
  const inputRef = useRef();

  useEffect(() => {
    getSlotInfo(slotKey).then(setInfo).catch(() => setInfo({ exists: false, rows: 0 }));
    fetch("/api/import/slots", { headers: { Authorization: `Bearer ${localStorage.getItem("suntran_token")}` } })
      .then(r => r.json())
      .then(slots => {
        const s = slots[slotKey];
        if (s) { setCols(s.columns); setFilename(s.filename); }
      }).catch(() => {});
  }, [slotKey]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setPending(file);
    setStage("previewing");
    setError(null);
    try {
      const prev = await previewSlotUpload(slotKey, file);
      setPreview(prev);
      setStage("preview_ready");
    } catch (err) {
      setError(err);
      setStage("error");
      setPending(null);
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setStage("importing");
    try {
      const result = await uploadToSlot(slotKey, pendingFile, mode);
      setStage("done");
      setPreview(null);
      setPending(null);
      setInfo(i => ({ ...i, rows: result.total_rows, exists: true }));
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setStage("idle"), 5000);
    } catch (err) {
      setError(err);
      setStage("error");
    }
  };

  const reset = () => { setStage("idle"); setPreview(null); setError(null); setPending(null); };
  const isBusy = stage === "previewing" || stage === "importing";

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
    }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
              {stage === "done" && (
                <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>✓ Imported</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{desc}</div>
            {info && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                {info.exists
                  ? <span style={{ color: "var(--text)" }}>{info.rows?.toLocaleString()} rows</span>
                  : <span style={{ color: "var(--danger)" }}>No data on file</span>
                }
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 5 }}>
              <button className="btn-ghost"
                title="Download blank template (.xlsx)"
                style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap" }}
                onClick={() => downloadTemplate(slotKey, filename)}>
                ↓ Template
              </button>
              <button className="btn-ghost"
                title="Download current data file"
                style={{ fontSize: 10, padding: "3px 9px" }}
                onClick={() => downloadCurrentCsv(slotKey)}>
                ↓ Current
              </button>
            </div>

            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {merge && (
                <select value={mode} onChange={e => setMode(e.target.value)}
                  style={{ fontSize: 10, padding: "3px 5px", borderRadius: 4,
                    border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }}>
                  <option value="merge">Merge</option>
                  <option value="replace">Replace</option>
                </select>
              )}
              <label style={{
                background: "var(--accent)", color: "#fff",
                borderRadius: "var(--radius)", padding: "4px 12px",
                fontSize: 11, fontWeight: 600,
                cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}>
                {isBusy ? (stage === "previewing" ? "Reading…" : "Saving…") : "↑ Upload"}
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
                  style={{ display: "none" }} onChange={handleFile} disabled={isBusy} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="btn-ghost"
            style={{ fontSize: 10, padding: "2px 8px", color: "var(--muted)" }}
            onClick={() => setExpanded(v => !v)}>
            {expanded ? "▲ Hide columns" : "▼ Show required columns"}
          </button>
          {expanded && columns.length > 0 && (
            <ColumnPills columns={columns} keyColumns={keyColumns} />
          )}
        </div>
      </div>

      {stage === "preview_ready" && preview && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "0 16px 14px" }}>
          <PreviewCard
            preview={preview}
            onConfirm={confirmImport}
            onCancel={reset}
            busy={stage === "importing"}
          />
        </div>
      )}
      {stage === "error" && error && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "0 16px 14px" }}>
          <MismatchError err={error} />
          <button className="btn-ghost" style={{ fontSize: 11, marginTop: 8, padding: "4px 12px" }}
            onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}

// ── Raw AVL/APC vendor import ─────────────────────────────────────────────────

const RAW_SLOTS = [
  {
    rawType:  "avg-passenger",
    label:    "Average Passenger Counts",
    filename: "AveragePassengerCounts.csv",
    desc:     "APC vendor daily export. One file replaces all 7 ridership datasets at once.",
    outputs:  ["boardings_by_route", "boardings_by_route_month", "boardings_by_route_stop",
               "boardings_by_stop", "boardings_by_month", "boardings_by_dow", "boardings_by_route_dow"],
  },
  {
    rawType:  "otp-trip",
    label:    "Trip OTP by Route and Stop",
    filename: "TripOTPByRouteAndStop.csv",
    desc:     "AVL vendor on-time performance export. Replaces schedule reliability data.",
    outputs:  ["otp"],
  },
  {
    rawType:  "hourly-apc",
    label:    "Hourly APC Counts",
    filename: "HourlyApcCounts.csv",
    desc:     "APC hourly report. Populates hour-of-day boarding profile for peak analysis.",
    outputs:  ["boardings_by_hour"],
  },
  {
    rawType:  "arrivals",
    label:    "Raw Stop Arrival Times",
    filename: "RawStopArrivalTimes.csv",
    desc:     "AVL raw arrival/departure timestamps. Stored for future dwell-time analysis.",
    outputs:  ["raw_arrivals"],
  },
];

const OUTPUT_LABELS = {
  boardings_by_hour:         "Peak Hour Profile",
  boardings_by_route:        "Route Totals",
  boardings_by_route_month:  "Route × Month",
  boardings_by_route_stop:   "Route × Stop",
  boardings_by_stop:         "Stop Boardings",
  boardings_by_month:        "Monthly Trend",
  boardings_by_dow:          "Day-of-Week",
  boardings_by_route_dow:    "Route × DOW",
  otp:                       "On-Time Performance",
  raw_arrivals:              "Raw Arrivals (stored)",
};

// Sample CSV for each raw type
const RAW_SAMPLES = {
  "avg-passenger": `"Report Name","Report Date",Agency\n"Average Passenger Count","2026-04-01 14:08:06","City Of St. George | SunTran"\n\n"Report Information"\n"Start Date","End Date","Time Grouping","Group On Route","Group On Stop"\n03/01/2026,03/31/2026,Daily,TRUE,TRUE\n\n"Average Passenger Counts"\nDate,"Route ID","Route Name","Stop ID","Stop Name","Total Count In","Average Count In","Total Count Out","Average Count Out"\n03/02/2026,12538,"Route 1 Red Cliffs (B)",143486,"449 North 2450 East",12,12.00,11,11.00\n`,
  "otp-trip": `"Report Name","Report Date"\n"On-Time Performance (OTP)","2026-04-01 14:04:56"\n\n"OTP by Date, Route, and Stop"\n"Route ID","Route Name","Stop ID","Stop Name",Date,"Average Schedule Deviation (minutes)","Early Trips","% Early Trips","On-Time Trips","% On-Time Trips","Late Trips","% Late Trips"\n12538,"Route 1 Red Cliffs (B)",143486,"449 North 2450 East",2026-03-02,1.5,2,18.18,8,72.73,1,9.09\n`,
  "hourly-apc": `"Report Name","Report Date"\n"Hourly Passenger Count","2026-04-01 14:07:56"\n\n"Hourly Passenger Count In by Route"\n"Route ID","Route Name",00:00,01:00,02:00,03:00,04:00,05:00,06:00,07:00,08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00,21:00,22:00,23:00,Total\n12538,"Route 1 Red Cliffs (B)",0,0,0,0,0,0,126,169,224,151,206,262,276,269,259,337,403,300,241,125,109,20,0,0,3477\n`,
  "arrivals": `Date,"Arrival Time","Departure Time",Route,Stop,Vehicle\n2026-03-02,05:32:51,05:33:06,"Route 1 Red Cliffs (B)","Bio Life 816 North 2860 East",0036\n`,
};

function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Validation warnings banner ─────────────────────────────────────────────────
function ValidationWarnings({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px", borderRadius: 6,
      background: "rgba(214,158,46,0.10)",
      border: "1px solid rgba(214,158,46,0.45)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#d69e2e", marginBottom: 6 }}>
        ⚠ {warnings.length} unrecognized route name{warnings.length > 1 ? "s" : ""}
      </div>
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 11, color: "var(--text)", marginBottom: 4,
          paddingLeft: 8, borderLeft: "2px solid rgba(214,158,46,0.5)" }}>
          <span style={{ fontFamily: "monospace", background: "rgba(214,158,46,0.15)",
            padding: "1px 5px", borderRadius: 4 }}>{w.route_name}</span>
          <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 10 }}>
            will be imported as a new route — verify this is correct
          </span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
        You can still confirm. If this is a variant of an existing route,
        add it to the alias table in the backend before importing.
      </div>
    </div>
  );
}

function RawImportCard({ rawType, label, filename, desc, outputs, onRefreshAll }) {
  const [info,        setInfo]    = useState(null);
  const [stage,       setStage]   = useState("idle");
  const [preview,     setPreview] = useState(null);
  const [error,       setError]   = useState(null);
  const [pendingFile, setPending] = useState(null);
  const [otpPeriod,   setOtpPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const inputRef = useRef();

  useEffect(() => {
    getRawImportInfo(rawType).then(setInfo).catch(() => setInfo({ exists: false, rows: 0 }));
  }, [rawType]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setPending(file);
    setStage("previewing");
    setError(null);
    try {
      const prev = await previewRawImport(rawType, file);
      setPreview(prev);
      setStage("preview_ready");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not parse file");
      setStage("error");
      setPending(null);
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setStage("importing");
    try {
      await uploadRawImport(rawType, pendingFile, rawType === "otp-trip" ? otpPeriod : null);
      setInfo(i => ({ ...i, exists: true }));
      setStage("done");
      setPreview(null);
      setPending(null);
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setStage("idle"), 5000);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Import failed");
      setStage("error");
    }
  };

  const reset = () => { setStage("idle"); setPreview(null); setError(null); setPending(null); };
  const isBusy = stage === "previewing" || stage === "importing";

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
    }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted)", padding: "1px 5px",
                background: "var(--surface2)", borderRadius: 4, border: "1px solid var(--border)" }}>
                {filename}
              </span>
              {stage === "done" && (
                <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>✓ Imported</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{desc}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {outputs.map(o => (
                <span key={o} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10,
                  background: "rgba(230,201,40,0.08)", color: "var(--accent)",
                  border: "1px solid rgba(230,201,40,0.3)" }}>
                  {OUTPUT_LABELS[o] || o}
                </span>
              ))}
            </div>
            {rawType === "otp-trip" && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Archive as period:</span>
                <input
                  type="month"
                  value={otpPeriod}
                  onChange={e => setOtpPeriod(e.target.value)}
                  style={{
                    fontSize: 11, padding: "3px 8px",
                    background: "var(--surface2)", color: "var(--text)",
                    border: "1px solid var(--border)", borderRadius: 6,
                    colorScheme: "dark",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  (sets the label in the Metrics OTP selector)
                </span>
              </div>
            )}
            {info && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
                {info.exists
                  ? <>
                      <span style={{ color: "var(--text)" }}>{info.rows?.toLocaleString()} rows on file</span>
                      {info.date_range && (
                        <span style={{ color: "var(--accent)", marginLeft: 6 }}>
                          {info.date_range.min} → {info.date_range.max}
                        </span>
                      )}
                    </>
                  : <span style={{ color: "var(--danger)" }}>No data on file</span>
                }
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 5 }}>
              <button className="btn-ghost"
                title="Download sample showing the expected vendor file format"
                style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap" }}
                onClick={() => downloadText(RAW_SAMPLES[rawType] || "", `${filename.replace(".csv","_sample.csv")}`)}>
                ↓ Sample Format
              </button>
              {rawType !== "arrivals" && (
                <button className="btn-ghost"
                  title="Download current data on file"
                  style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap" }}
                  onClick={() => downloadBoardingsCsv(outputs[0], `${outputs[0]}.csv`)}>
                  ↓ Current
                </button>
              )}
            </div>
            <label style={{
              background: "var(--accent)", color: "#001830",
              borderRadius: "var(--radius)", padding: "5px 14px",
              fontSize: 11, fontWeight: 700,
              cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
              whiteSpace: "nowrap", display: "block",
            }}>
              {isBusy ? (stage === "previewing" ? "Reading…" : "Saving…") : "↑ Upload"}
              <input ref={inputRef} type="file" accept=".csv"
                style={{ display: "none" }} onChange={handleFile} disabled={isBusy} />
            </label>
          </div>
        </div>
      </div>

      {/* Preview panel */}
      {stage === "preview_ready" && preview && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Ready to import</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 11, marginBottom: 10 }}>
            {preview.incoming_rows != null && <>
              <span style={{ color: "var(--muted)" }}>Rows parsed</span>
              <span>{preview.incoming_rows?.toLocaleString()}</span>
            </>}
            {preview.routes != null && <>
              <span style={{ color: "var(--muted)" }}>Routes</span>
              <span style={{ fontWeight: 600 }}>{preview.routes}</span>
            </>}
            {preview.stops != null && <>
              <span style={{ color: "var(--muted)" }}>Stops</span>
              <span style={{ fontWeight: 600 }}>{preview.stops}</span>
            </>}
            {preview.total_boardings != null && <>
              <span style={{ color: "var(--muted)" }}>Total boardings</span>
              <span style={{ fontWeight: 600 }}>{preview.total_boardings?.toLocaleString()}</span>
            </>}
            {preview.date_range && <>
              <span style={{ color: "var(--muted)" }}>Date range</span>
              <span style={{ color: "var(--accent)" }}>{preview.date_range.min} → {preview.date_range.max}</span>
            </>}
            <span style={{ color: "var(--muted)" }}>Updates</span>
            <span>{(preview.slots_updated || []).map(s => OUTPUT_LABELS[s] || s).join(", ")}</span>
          </div>

          {/* Validation warnings */}
          <ValidationWarnings warnings={preview.warnings} />

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ fontSize: 11, padding: "6px 18px" }}
              onClick={confirmImport}>Confirm Import</button>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "6px 14px" }}
              onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {/* Error panel */}
      {stage === "error" && error && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--danger)", background: "rgba(231,76,60,0.08)",
            borderRadius: 6, padding: "8px 12px" }}>
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
          <button className="btn-ghost" style={{ fontSize: 11, marginTop: 8, padding: "4px 12px" }}
            onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}

// ── Group section ──────────────────────────────────────────────────────────────
function SlotGroup({ group, onRefreshAll }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div className="panel-title">{group.title}</div>
        <p style={{ margin: "2px 0 12px", fontSize: 12, color: "var(--muted)" }}>{group.desc}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {group.slots.map(s => (
          <ImportSlotCard
            key={s.key}
            slotKey={s.key}
            label={s.label}
            desc={s.desc}
            merge={s.merge}
            onRefreshAll={onRefreshAll}
          />
        ))}
      </div>
    </div>
  );
}

// ── Manage Months ─────────────────────────────────────────────────────────────

function ManageMonthsPanel({ onRefreshAll }) {
  const [months,   setMonths]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [result,   setResult]   = useState(null);

  const loadMonths = () => {
    getBoardingsMonths()
      .then(d => setMonths(d.months || []))
      .catch(() => setMonths([]));
  };

  useEffect(() => { loadMonths(); }, []);

  const handleDelete = async (month) => {
    setDeleting(month);
    setResult(null);
    try {
      const r = await deleteBoardingsMonth(month);
      const total = Object.values(r.rows_removed || {}).reduce((s, n) => s + n, 0);
      setResult({ ok: true, month, msg: `Removed ${total} rows for ${month}.` });
      await loadMonths();
      if (onRefreshAll) onRefreshAll();
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Delete failed";
      setResult({ ok: false, month, msg });
    } finally {
      setDeleting(null);
      setConfirm(null);
    }
  };

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtMonth = (m) => {
    const [y, mo] = m.split("-");
    return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
  };

  return (
    <div>
      <div className="panel-title">Manage Months</div>
      <p style={{ margin: "2px 0 12px", fontSize: 12, color: "var(--muted)" }}>
        Remove a month that has bad or incomplete data. This permanently deletes it
        from all ridership files — a backup is made automatically first.
      </p>

      {result && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: 6, fontSize: 11,
          background: result.ok ? "rgba(56,161,105,0.10)" : "rgba(231,76,60,0.10)",
          border: `1px solid ${result.ok ? "rgba(56,161,105,0.4)" : "rgba(231,76,60,0.4)"}`,
          color: result.ok ? "var(--success)" : "var(--danger)",
        }}>
          {result.ok ? "✓ " : "✗ "}{result.msg}
        </div>
      )}

      {months === null ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</div>
      ) : months.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No month data on file.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {months.map(m => (
            <div key={m} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px 5px 12px",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12,
            }}>
              <span style={{ fontWeight: 600 }}>{fmtMonth(m)}</span>
              {confirm === m ? (
                <>
                  <span style={{ fontSize: 10, color: "var(--danger)", marginLeft: 4 }}>Delete?</span>
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deleting === m}
                    style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: "var(--danger)", color: "#fff", border: "none",
                      cursor: deleting === m ? "default" : "pointer",
                      fontWeight: 700, opacity: deleting === m ? 0.6 : 1,
                    }}>
                    {deleting === m ? "…" : "Yes"}
                  </button>
                  <button
                    onClick={() => setConfirm(null)}
                    disabled={!!deleting}
                    style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: "var(--surface2)", color: "var(--text)",
                      border: "1px solid var(--border)", cursor: "pointer",
                    }}>
                    No
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirm(m)}
                  title={`Remove all data for ${fmtMonth(m)}`}
                  style={{
                    fontSize: 12, padding: "0 4px", background: "none",
                    border: "none", color: "var(--muted)", cursor: "pointer",
                    lineHeight: 1, borderRadius: 3,
                  }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function DataImportPanel({ onUpload }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 28,
      maxWidth: 720, margin: "0 auto", padding: "28px 20px",
      overflowY: "auto", height: "100%",
    }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Data Import</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Drop in the raw files from SunTran and the system handles everything.
          Network files (stops, routes, hubs) are managed separately below.
          All tabs update automatically after import.
        </p>
      </div>

      {/* Raw vendor file importers */}
      <div>
        <div className="panel-title">Raw AVL/APC Vendor Files</div>
        <p style={{ margin: "2px 0 12px", fontSize: 12, color: "var(--muted)" }}>
          Drop in the exact files received from SunTran — no preprocessing needed.
          The system strips vendor metadata headers and populates all ridership,
          OTP, and boarding datasets automatically.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RAW_SLOTS.map(s => (
            <RawImportCard
              key={s.rawType}
              rawType={s.rawType}
              label={s.label}
              filename={s.filename}
              desc={s.desc}
              outputs={s.outputs}
              onRefreshAll={onUpload}
            />
          ))}
        </div>
      </div>

      {/* Network file importers */}
      {SLOT_GROUPS.map(group => (
        <SlotGroup key={group.id} group={group} onRefreshAll={onUpload} />
      ))}

      {/* Month management */}
      <ManageMonthsPanel onRefreshAll={onUpload} />
    </div>
  );
}
