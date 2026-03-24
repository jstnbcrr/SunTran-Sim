import React, { useState, useRef, useCallback } from "react";
import { smartImportPreview, smartImport, downloadCurrentCsv, downloadBoardingsCsv } from "../api/client";

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ready:    { bg: "rgba(46,204,113,0.12)", color: "var(--success)", text: "Ready" },
    imported: { bg: "rgba(46,204,113,0.12)", color: "var(--success)", text: "✓ Imported" },
    unknown:  { bg: "rgba(241,196,15,0.15)", color: "#f1c40f",        text: "⚠ Unrecognized" },
    skipped:  { bg: "rgba(241,196,15,0.15)", color: "#f1c40f",        text: "Skipped" },
    error:    { bg: "rgba(231,76,60,0.12)",  color: "var(--danger)",  text: "Error" },
  };
  const s = map[status] || map.unknown;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
      background: s.bg, color: s.color }}>
      {s.text}
    </span>
  );
}

// ── Single file preview row ────────────────────────────────────────────────────
function FilePreviewRow({ file, onRemove }) {
  const isUnknown  = file.status === "unknown";
  const isError    = file.status === "error";
  const isImported = file.status === "imported";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start",
      padding: "10px 12px",
      borderBottom: "1px solid var(--border)",
      background: isError ? "rgba(231,76,60,0.04)" : isUnknown ? "rgba(241,196,15,0.04)" : "transparent",
    }}>
      <div>
        {/* File name + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{file.filename}</span>
          <StatusBadge status={file.status} />
        </div>

        {/* Detected type */}
        <div style={{ fontSize: 11, color: isUnknown || isError ? "var(--danger)" : "var(--accent)", marginBottom: 2 }}>
          {file.label}
        </div>

        {/* Stats row */}
        {!isError && !isUnknown && (
          <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {file.incoming_rows != null && (
              <span>{file.incoming_rows.toLocaleString()} rows incoming</span>
            )}
            {file.existing_rows != null && (
              <span>{file.existing_rows.toLocaleString()} existing</span>
            )}
            {file.rows_to_add != null && (
              <span style={{ color: "var(--success)", fontWeight: 600 }}>+{file.rows_to_add} new</span>
            )}
            {file.rows_to_update != null && file.rows_to_update > 0 && (
              <span style={{ color: "var(--accent)" }}>{file.rows_to_update} updated</span>
            )}
            {file.date_range && (
              <span style={{ color: "var(--accent)" }}>{file.date_range.min} → {file.date_range.max}</span>
            )}
            {/* Post-import totals */}
            {isImported && file.total_rows != null && (
              <span style={{ color: "var(--success)" }}>Total: {file.total_rows.toLocaleString()} rows</span>
            )}
          </div>
        )}

        {/* Error message */}
        {isError && (
          <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 2 }}>{file.error}</div>
        )}
        {isUnknown && (
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Columns: {file.columns?.slice(0, 6).join(", ")}{file.columns?.length > 6 ? "…" : ""}
          </div>
        )}
      </div>

      {/* Remove button (only before import) */}
      {onRemove && (
        <button className="btn-ghost" onClick={onRemove}
          style={{ fontSize: 11, padding: "2px 7px", color: "var(--muted)", marginTop: 2 }}>✕</button>
      )}
    </div>
  );
}

// ── Drop zone ──────────────────────────────────────────────────────────────────
function DropZone({ onFiles, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    if (files.length) onFiles(files);
  }, [onFiles, disabled]);

  const handleDragOver = (e) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleInput = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "36px 24px",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        background: dragging ? "rgba(52,152,219,0.06)" : "var(--surface2)",
        transition: "border-color 0.15s, background 0.15s",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        Drop your export files here
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        CSV and .xlsx files · Multiple files at once · Auto-identified by column headers
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          or click to browse
        </span>
      </div>
      <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls"
        style={{ display: "none" }} onChange={handleInput} />
    </div>
  );
}

// ── Downloads section ──────────────────────────────────────────────────────────
const DOWNLOAD_FILES = [
  { type: "stops",                 label: "stops.csv",                  isBoardings: false },
  { type: "routes",                label: "routes.csv",                 isBoardings: false },
  { type: "ridership",             label: "ridership.csv",              isBoardings: false },
  { type: "employment_hubs",       label: "employment_hubs.csv",        isBoardings: false },
  { type: "boardings_by_month",    label: "boardings_by_month.csv",     isBoardings: true },
  { type: "boardings_by_route_month", label: "boardings_by_route_month.csv", isBoardings: true },
  { type: "boardings_by_route",    label: "boardings_by_route.csv",     isBoardings: true },
  { type: "boardings_by_route_stop", label: "boardings_by_route_stop.csv", isBoardings: true },
  { type: "boardings_by_stop",     label: "boardings_by_stop.csv",      isBoardings: true },
  { type: "boardings_by_dow",      label: "boardings_by_dow.csv",       isBoardings: true },
  { type: "boardings_by_route_dow", label: "boardings_by_route_dow.csv", isBoardings: true },
  { type: "otp",                   label: "otp.csv",                    isBoardings: true },
];

function DownloadsSection() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="btn-ghost" style={{ fontSize: 12, padding: "6px 12px", width: "100%" }}
        onClick={() => setOpen(v => !v)}>
        {open ? "▲" : "▼"} Download current data files
      </button>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {DOWNLOAD_FILES.map(({ type, label, isBoardings }) => (
            <button key={type} className="btn-ghost"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => isBoardings ? downloadBoardingsCsv(type, label) : downloadCurrentCsv(type)}>
              ↓ {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function DataImportPanel({ onUpload }) {
  const [stage, setStage]   = useState("idle");   // idle | previewing | ready | importing | done
  const [files, setFiles]   = useState([]);        // preview results from backend
  const [mode, setMode]     = useState("merge");
  const [rawFiles, setRaw]  = useState([]);        // original File objects

  const handleFiles = async (fileList) => {
    setStage("previewing");
    setRaw(fileList);
    try {
      const result = await smartImportPreview(fileList);
      setFiles(result.files);
      setStage("ready");
    } catch (err) {
      setFiles([{ filename: "Preview failed", status: "error",
        label: err?.response?.data?.detail || err.message, error: err.message }]);
      setStage("ready");
    }
  };

  const removeFile = (idx) => {
    const newFiles  = files.filter((_, i) => i !== idx);
    const newRaw    = rawFiles.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setRaw(newRaw);
    if (newFiles.length === 0) setStage("idle");
  };

  const handleImport = async () => {
    const readyRaw = rawFiles.filter((_, i) => files[i]?.status !== "unknown" && files[i]?.status !== "error");
    if (!readyRaw.length) return;
    setStage("importing");
    try {
      const result = await smartImport(readyRaw, mode);
      setFiles(result.files);
      setStage("done");
      // Re-fetch app data so map/metrics/ridership update live
      if (onUpload) onUpload();
    } catch (err) {
      setFiles(prev => prev.map(f => ({ ...f, status: "error",
        error: err?.response?.data?.detail || err.message })));
      setStage("done");
    }
  };

  const reset = () => { setStage("idle"); setFiles([]); setRaw([]); };

  const readyCount  = files.filter(f => f.status === "ready").length;
  const importedCount = files.filter(f => f.status === "imported").length;
  const skippedCount  = files.filter(f => f.status === "skipped" || f.status === "unknown").length;
  const errorCount    = files.filter(f => f.status === "error").length;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 20,
      maxWidth: 680, margin: "0 auto", padding: "28px 20px",
      overflowY: "auto", height: "100%",
    }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Data Import</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Drop all your export files at once. The system auto-identifies each file by its columns
          and updates the map, metrics, and ridership charts instantly.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Import mode:</span>
        {["merge", "replace"].map(m => (
          <button key={m}
            className={mode === m ? "btn-primary" : "btn-ghost"}
            style={{ fontSize: 11, padding: "4px 12px" }}
            onClick={() => setMode(m)}>
            {m === "merge" ? "Merge — keep history" : "Replace — overwrite"}
          </button>
        ))}
        <span style={{ fontSize: 10, color: "var(--muted)", flex: 1 }}>
          {mode === "merge" ? "New rows are added, existing rows updated" : "Existing data is fully replaced"}
        </span>
      </div>

      {/* Drop zone (shown when idle) */}
      {stage === "idle" && (
        <DropZone onFiles={handleFiles} disabled={false} />
      )}

      {/* Previewing spinner */}
      {stage === "previewing" && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          Identifying files…
        </div>
      )}

      {/* File list (ready or done) */}
      {(stage === "ready" || stage === "importing" || stage === "done") && (
        <div>
          {/* Summary bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {stage === "done" ? "Import complete" : `${files.length} file${files.length !== 1 ? "s" : ""} detected`}
            </span>
            {stage === "done" && (
              <>
                {importedCount > 0 && <span style={{ fontSize: 11, color: "var(--success)" }}>✓ {importedCount} imported</span>}
                {skippedCount  > 0 && <span style={{ fontSize: 11, color: "#f1c40f" }}>⚠ {skippedCount} skipped</span>}
                {errorCount    > 0 && <span style={{ fontSize: 11, color: "var(--danger)" }}>✕ {errorCount} errors</span>}
              </>
            )}
            {stage === "ready" && (
              <>
                {readyCount > 0  && <span style={{ fontSize: 11, color: "var(--success)" }}>{readyCount} ready</span>}
                {skippedCount > 0 && <span style={{ fontSize: 11, color: "#f1c40f" }}>{skippedCount} unrecognized</span>}
                {errorCount > 0  && <span style={{ fontSize: 11, color: "var(--danger)" }}>{errorCount} errors</span>}
              </>
            )}
          </div>

          {/* File rows */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {files.map((f, i) => (
              <FilePreviewRow
                key={i}
                file={f}
                onRemove={stage === "ready" ? () => removeFile(i) : null}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            {stage === "ready" && (
              <>
                <button
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "8px 24px", opacity: readyCount === 0 ? 0.5 : 1 }}
                  disabled={readyCount === 0}
                  onClick={handleImport}
                >
                  Import {readyCount} file{readyCount !== 1 ? "s" : ""}
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "8px 16px" }}
                  onClick={() => { reset(); }}>
                  Cancel
                </button>
                <label className="btn-ghost" style={{ fontSize: 12, padding: "8px 16px", cursor: "pointer" }}>
                  + Add more files
                  <input type="file" multiple accept=".csv,.xlsx,.xls" style={{ display: "none" }}
                    onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }} />
                </label>
              </>
            )}
            {stage === "importing" && (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>⏳ Importing…</span>
            )}
            {stage === "done" && (
              <>
                <button className="btn-primary" style={{ fontSize: 13, padding: "8px 24px" }}
                  onClick={reset}>
                  Import more files
                </button>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Map, Metrics &amp; Ridership updated automatically
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Downloads */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <DownloadsSection />
      </div>

    </div>
  );
}
