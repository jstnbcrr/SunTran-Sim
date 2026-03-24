import React, { useState, useEffect } from "react";
import {
  uploadCsv,
  downloadCurrentCsv,
  listBackups,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getBoardingsInfo,
  downloadBoardingsCsv,
  previewBoardingsUpload,
  uploadBoardings,
  uploadOtpExcel,
} from "../api/client";

// ── Network core files ─────────────────────────────────────────────────────────

const NETWORK_FILES = [
  { key: "stops",           label: "stops.csv",           hint: "stop_id, stop_name, latitude, longitude" },
  { key: "routes",          label: "routes.csv",          hint: "route_id, route_name, color, stop_ids (pipe-separated)" },
  { key: "ridership",       label: "ridership.csv",       hint: "route_id, stop_id, hour, hourly_boardings, hourly_alightings" },
  { key: "employment_hubs", label: "employment_hubs.csv", hint: "hub_name, latitude, longitude, estimated_workers" },
];

function DataFileManager({ fileType, label, hint, onUpload }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [backups, setBackups]           = useState(null);
  const [expanded, setExpanded]         = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [busyBackup, setBusyBackup]     = useState(null);

  const loadBackups = async () => {
    try {
      const data = await listBackups(fileType);
      setBackups(data.backups || []);
    } catch {
      setBackups([]);
    }
  };

  const toggleExpanded = () => {
    if (!expanded && backups === null) loadBackups();
    setExpanded(v => !v);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploadStatus("loading");
    const result = await onUpload(fileType, file);
    if (result?.success === false) {
      setUploadStatus(`error: ${result.error}`);
    } else {
      setUploadStatus("ok");
      setTimeout(() => setUploadStatus(null), 3000);
      if (expanded) loadBackups();
    }
  };

  const handleRestore = async (filename) => {
    if (confirmRestore !== filename) { setConfirmRestore(filename); return; }
    setBusyBackup(filename);
    try {
      await restoreBackup(fileType, filename);
      setConfirmRestore(null);
      await loadBackups();
    } finally {
      setBusyBackup(null);
    }
  };

  const handleDelete = async (filename) => {
    setBusyBackup(filename);
    try {
      await deleteBackup(fileType, filename);
      setBackups(b => b.filter(x => x.filename !== filename));
    } finally {
      setBusyBackup(null);
    }
  };

  const formatSize = (bytes) => bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
  const formatDate = (ts) => new Date(ts * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const isLoading = uploadStatus === "loading";
  const isOk      = uploadStatus === "ok";
  const isError   = uploadStatus?.startsWith("error:");

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{hint}</div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          <button className="btn-ghost" title="Download current file"
            onClick={() => downloadCurrentCsv(fileType)}
            style={{ fontSize: 11, padding: "3px 8px" }}>↓</button>
          <label style={{
            background: "var(--surface2)",
            border: `1px solid ${isOk ? "var(--success)" : isError ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--radius)", padding: "3px 8px",
            fontSize: 11, cursor: isLoading ? "default" : "pointer",
            color: isOk ? "var(--success)" : isError ? "var(--danger)" : "var(--text)",
            fontWeight: 600, whiteSpace: "nowrap",
          }}>
            {isLoading ? "Saving…" : isOk ? "✓ Saved" : "↑ Upload"}
            <input type="file" accept=".csv" hidden disabled={isLoading} onChange={handleUpload} />
          </label>
          <button className="btn-ghost" title="Backup history" onClick={toggleExpanded}
            style={{ fontSize: 11, padding: "3px 8px", color: expanded ? "var(--accent)" : "var(--muted)" }}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {isError && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)",
          background: "rgba(231,76,60,0.08)", borderRadius: 4, padding: "4px 8px" }}>
          {uploadStatus.replace("error: ", "")}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 8, background: "var(--bg)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", overflow: "hidden" }}>
          {backups === null ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted)" }}>Loading…</div>
          ) : backups.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted)" }}>
              No backups yet. Backups are created automatically before each upload.
            </div>
          ) : (
            backups.map(b => (
              <div key={b.filename} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", borderBottom: "1px solid var(--border)", fontSize: 11,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text)", fontFamily: "monospace", fontSize: 10,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {formatDate(b.created_at)}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 10 }}>{formatSize(b.size_bytes)}</div>
                </div>
                <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }}
                  title="Download this backup"
                  onClick={() => downloadBackup(fileType, b.filename)}
                  disabled={busyBackup === b.filename}>↓</button>
                <button
                  className={confirmRestore === b.filename ? "btn-primary" : "btn-ghost"}
                  style={{ fontSize: 10, padding: "2px 6px", whiteSpace: "nowrap" }}
                  onClick={() => handleRestore(b.filename)}
                  disabled={busyBackup === b.filename}>
                  {confirmRestore === b.filename ? "Confirm?" : "Restore"}
                </button>
                {confirmRestore === b.filename && (
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => setConfirmRestore(null)}>Cancel</button>
                )}
                <button className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                  title="Delete this backup"
                  onClick={() => handleDelete(b.filename)}
                  disabled={busyBackup === b.filename}>✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Ridership / OTP boardings files ────────────────────────────────────────────

const BOARDINGS_FILE_CONFIGS = [
  { key: "boardings_by_month",       label: "boardings_by_month.csv",       hint: "month, total_in, total_out, unique_days, avg_daily_in, avg_daily_out" },
  { key: "boardings_by_route_month", label: "boardings_by_route_month.csv", hint: "route, month, total_in, total_out, unique_days, avg_daily_in, avg_daily_out" },
  { key: "boardings_by_route",       label: "boardings_by_route.csv",       hint: "route, total_in, total_out, unique_days, avg_daily_in, avg_daily_out" },
  { key: "boardings_by_route_stop",  label: "boardings_by_route_stop.csv",  hint: "route, address, total_in, total_out, avg_daily_in, avg_daily_out, days" },
  { key: "boardings_by_stop",        label: "boardings_by_stop.csv",        hint: "route, stop_id, address, total_in, total_out, avg_daily_in, avg_daily_out, days" },
  { key: "boardings_by_dow",         label: "boardings_by_dow.csv",         hint: "day_num, day_name, avg_in, avg_out, total_in, total_out" },
  { key: "boardings_by_route_dow",   label: "boardings_by_route_dow.csv",   hint: "route, day_num, day_name, avg_in, avg_out, total_in, total_out" },
];

function BoardingsFileRow({ fileKey, label, hint }) {
  const [info, setInfo]           = useState(null);
  const [status, setStatus]       = useState(null);
  const [preview, setPreview]     = useState(null);
  const [pendingFile, setPending] = useState(null);
  const [mode, setMode]           = useState("merge");

  useEffect(() => {
    getBoardingsInfo(fileKey).then(setInfo).catch(() => setInfo({ exists: false, rows: 0 }));
  }, [fileKey]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setPending(file);
    setStatus("previewing");
    try {
      const prev = await previewBoardingsUpload(fileKey, file);
      setPreview(prev);
      setStatus("preview_ready");
    } catch (err) {
      setStatus(`error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setStatus("merging");
    try {
      const result = await uploadBoardings(fileKey, pendingFile, mode);
      setStatus("done");
      setPreview(null);
      setPending(null);
      setInfo(i => ({ ...i, rows: result.total_rows }));
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus(`error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  const cancelPreview = () => { setPreview(null); setPending(null); setStatus(null); };

  const isDone  = status === "done";
  const isError = status?.startsWith("error:");
  const isBusy  = status === "previewing" || status === "merging";

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{hint}</div>
          {info && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {info.exists
                ? <>
                    <span style={{ color: "var(--text)" }}>{info.rows.toLocaleString()} rows</span>
                    {info.date_range && (
                      <> · <span style={{ color: "var(--accent)" }}>{info.date_range.min} → {info.date_range.max}</span></>
                    )}
                  </>
                : <span style={{ color: "var(--danger)" }}>File not found</span>
              }
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button
            className="btn-ghost"
            title="Download current file"
            onClick={() => downloadBoardingsCsv(fileKey, label)}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >↓</button>
          <select value={mode} onChange={e => setMode(e.target.value)}
            style={{ fontSize: 10, padding: "3px 4px", borderRadius: 4,
              border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }}>
            <option value="merge">Merge</option>
            <option value="replace">Replace</option>
          </select>
          <label style={{
            background: "var(--surface2)",
            border: `1px solid ${isDone ? "var(--success)" : isError ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11,
            cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
          }}>
            {isBusy ? (status === "previewing" ? "Reading…" : "Saving…") : isDone ? "✓ Done" : "↑ Upload"}
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} disabled={isBusy} />
          </label>
        </div>
      </div>

      {isError && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)",
          background: "rgba(231,76,60,0.08)", borderRadius: 4, padding: "4px 8px" }}>
          {status.replace("error: ", "")}
        </div>
      )}

      {status === "preview_ready" && preview && (
        <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Import Preview</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginBottom: 8 }}>
            <div style={{ color: "var(--muted)" }}>Existing rows:</div>
            <div>{preview.existing_rows.toLocaleString()}</div>
            <div style={{ color: "var(--muted)" }}>Incoming rows:</div>
            <div>{preview.incoming_rows.toLocaleString()}</div>
            <div style={{ color: "var(--muted)" }}>New rows to add:</div>
            <div style={{ color: "var(--success)", fontWeight: 600 }}>+{preview.rows_to_add.toLocaleString()}</div>
            <div style={{ color: "var(--muted)" }}>Rows to update:</div>
            <div style={{ color: "var(--accent)", fontWeight: 600 }}>{preview.rows_to_update.toLocaleString()} updated</div>
            {preview.new_date_range && (
              <>
                <div style={{ color: "var(--muted)" }}>New data range:</div>
                <div style={{ color: "var(--accent)" }}>{preview.new_date_range.min} → {preview.new_date_range.max}</div>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ fontSize: 11, padding: "5px 14px" }} onClick={confirmImport}>
              Confirm Import
            </button>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 14px" }} onClick={cancelPreview}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OtpExcelRow() {
  const [info, setInfo]           = useState(null);
  const [status, setStatus]       = useState(null);
  const [preview, setPreview]     = useState(null);
  const [pendingFile, setPending] = useState(null);
  const [mode, setMode]           = useState("replace");

  useEffect(() => {
    getBoardingsInfo("otp").then(setInfo).catch(() => setInfo({ exists: false, rows: 0 }));
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setPending(file);
    setPreview({ filename: file.name });
    setStatus("preview_ready");
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setStatus("uploading");
    try {
      const result = await uploadOtpExcel(pendingFile, mode);
      setStatus("done");
      setPreview(null);
      setPending(null);
      setInfo(i => ({ ...i, rows: result.total_rows, exists: true }));
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus(`error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  const cancelPreview = () => { setPreview(null); setPending(null); setStatus(null); };

  const isDone  = status === "done";
  const isError = status?.startsWith("error:");
  const isBusy  = status === "uploading";

  return (
    <div style={{ paddingBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            otp.csv
            <span style={{ fontSize: 10, fontWeight: 400, color: "var(--accent)", marginLeft: 6 }}>
              Excel import
            </span>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
            Route_OTP_By_Route_as_tables.xlsx — reads COMBINED sheet automatically
          </div>
          {info && (
            <div style={{ fontSize: 10, marginTop: 2 }}>
              {info.exists
                ? <span style={{ color: "var(--text)" }}>{info.rows.toLocaleString()} stop-level OTP records</span>
                : <span style={{ color: "var(--danger)" }}>No OTP data loaded</span>
              }
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button
            className="btn-ghost"
            title="Download current otp.csv"
            onClick={() => downloadBoardingsCsv("otp", "otp.csv")}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >↓</button>
          <select value={mode} onChange={e => setMode(e.target.value)}
            style={{ fontSize: 10, padding: "3px 4px", borderRadius: 4,
              border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }}>
            <option value="replace">Replace all</option>
            <option value="merge">Merge</option>
          </select>
          <label style={{
            background: "var(--surface2)",
            border: `1px solid ${isDone ? "var(--success)" : isError ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11,
            cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
          }}>
            {isBusy ? "Uploading…" : isDone ? "✓ Done" : "↑ .xlsx"}
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFile} disabled={isBusy} />
          </label>
        </div>
      </div>

      {isError && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)",
          background: "rgba(231,76,60,0.08)", borderRadius: 4, padding: "4px 8px" }}>
          {status.replace("error: ", "")}
        </div>
      )}

      {status === "preview_ready" && preview && (
        <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Ready to import</div>
          <div style={{ color: "var(--muted)", marginBottom: 8 }}>
            File: <span style={{ color: "var(--text)" }}>{preview.filename}</span>
            <br />Mode: <span style={{ color: "var(--accent)" }}>{mode === "replace" ? "Replace all OTP data" : "Merge with existing"}</span>
            <br />Reads the <strong>COMBINED</strong> sheet — maps all stop records to otp.csv format.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ fontSize: 11, padding: "5px 14px" }} onClick={confirmImport}>
              Confirm Import
            </button>
            <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 14px" }} onClick={cancelPreview}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function DataImportPanel({ onUpload }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 24,
      maxWidth: 720, margin: "0 auto", padding: "24px 20px", overflowY: "auto", height: "100%",
    }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Data Import</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Upload new data exports to keep the simulation current. Use <strong>Merge</strong> on ridership files
          to append new months without losing history. Network files (stops, routes) always replace.
        </p>
      </div>

      {/* Network Files */}
      <div>
        <div className="panel-title" style={{ marginBottom: 8 }}>Network Files</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          Replacing these files updates the map, route editor, and simulation immediately.
          A backup is created automatically before each upload.
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {NETWORK_FILES.map(({ key, label, hint }) => (
            <DataFileManager key={key} fileType={key} label={label} hint={hint} onUpload={onUpload} />
          ))}
        </div>
      </div>

      {/* Ridership / Boardings Files */}
      <div>
        <div className="panel-title" style={{ marginBottom: 8 }}>Ridership &amp; Boardings Data</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          These files power the Ridership tab charts. Upload the latest export from the transit agency
          system. <strong>Merge mode</strong> adds new rows (e.g. a new month) while keeping all existing history.
          The current row count and date range are shown for each file.
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {BOARDINGS_FILE_CONFIGS.map(({ key, label, hint }) => (
            <BoardingsFileRow key={key} fileKey={key} label={label} hint={hint} />
          ))}
          <OtpExcelRow />
        </div>
      </div>

    </div>
  );
}
