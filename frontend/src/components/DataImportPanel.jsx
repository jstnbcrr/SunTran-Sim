import React, { useState, useEffect, useRef } from "react";
import {
  getSlotInfo,
  downloadTemplate,
  previewSlotUpload,
  uploadToSlot,
  downloadCurrentCsv,
  downloadBoardingsCsv,
} from "../api/client";

// ── Slot definitions (mirrors backend IMPORT_SLOTS) ───────────────────────────
const SLOT_GROUPS = [
  {
    id: "ridership",
    title: "Ridership & Boardings",
    desc: "Upload the latest exports from the transit agency system. Use Merge to keep history.",
    slots: [
      { key: "boardings_by_month",       label: "Monthly Ridership Summary",  desc: "Total boardings and alightings per calendar month.",                  merge: true  },
      { key: "boardings_by_route_month", label: "Route × Month Ridership",    desc: "Per-route boardings broken down by month.",                           merge: true  },
      { key: "boardings_by_route",       label: "Route Totals",               desc: "Cumulative boardings per route across all recorded days.",             merge: true  },
      { key: "boardings_by_route_stop",  label: "Route × Stop Boardings",     desc: "Boardings and alightings per stop per route.",                        merge: true  },
      { key: "boardings_by_stop",        label: "Stop-Level Boardings",       desc: "Boardings at every individual stop across all routes.",               merge: true  },
      { key: "boardings_by_dow",         label: "Day-of-Week Ridership",      desc: "Average and total boardings for each day of the week.",               merge: false },
      { key: "boardings_by_route_dow",   label: "Route × Day-of-Week",        desc: "Per-route ridership broken down by day of the week.",                 merge: false },
    ],
  },
  {
    id: "otp",
    title: "On-Time Performance",
    desc: "Upload using the exact template format. Columns must match exactly.",
    slots: [
      { key: "otp", label: "On-Time Performance", desc: "Early / on-time / late percentages and average deviation per stop per route.", merge: true },
    ],
  },
  {
    id: "network",
    title: "Network Files",
    desc: "Stops, routes, and employment hubs. These replace existing data — use carefully.",
    slots: [
      { key: "stops",           label: "Bus Stops",        desc: "All bus stop locations used in routing and the map.",          merge: false },
      { key: "routes",          label: "Routes",           desc: "Route definitions with ordered, pipe-separated stop lists.",  merge: false },
      { key: "employment_hubs", label: "Employment Hubs",  desc: "Major employment destinations for accessibility analysis.",   merge: false },
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
  const [stage,       setStage]   = useState("idle"); // idle|previewing|preview_ready|importing|done|error
  const [preview,     setPreview] = useState(null);
  const [error,       setError]   = useState(null);
  const [pendingFile, setPending] = useState(null);
  const [mode,        setMode]    = useState(merge ? "merge" : "replace");
  const inputRef = useRef();

  // Load slot info and column metadata on mount
  useEffect(() => {
    getSlotInfo(slotKey).then(setInfo).catch(() => setInfo({ exists: false, rows: 0 }));
    // Fetch slot list to get columns (cached after first load)
    fetch("/api/import/slots", { headers: { Authorization: `Bearer ${localStorage.getItem("suntran_token")}` } })
      .then(r => r.json())
      .then(slots => {
        const s = slots[slotKey];
        if (s) { setCols(s.columns); setFilename(s.filename); }
      }).catch(() => {});
    // key_cols not exposed in list endpoint, derive from backend slot definitions if needed
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
      {/* Card header */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Text */}
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
                  ? <>
                      <span style={{ color: "var(--text)" }}>{info.rows?.toLocaleString()} rows</span>
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

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, alignItems: "flex-end" }}>
            {/* Template + current download row */}
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
                onClick={() => slotKey === "stops" || slotKey === "routes" || slotKey === "employment_hubs"
                  ? downloadCurrentCsv(slotKey)
                  : downloadBoardingsCsv(slotKey, filename)
                }>
                ↓ Current
              </button>
            </div>

            {/* Mode + Upload row */}
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

        {/* Column pills — toggled */}
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

      {/* Preview / error panels */}
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
          Each slot expects a specific file format — download the template, fill it in,
          and upload. The system validates every column before accepting the file.
          After import the Map, Metrics and Ridership tabs update automatically.
        </p>
      </div>

      {SLOT_GROUPS.map(group => (
        <SlotGroup key={group.id} group={group} onRefreshAll={onUpload} />
      ))}
    </div>
  );
}
