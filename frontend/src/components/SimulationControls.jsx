import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { runSimulation, listBackups, restoreBackup, deleteBackup, downloadBackup, downloadCurrentCsv } from "../api/client";

const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a",
];

// ── Ordered stop selector with drag-and-drop reordering ───────────────────────
function OrderedStopSelector({ stops, selected, onChange, label }) {
  const [addingId,  setAddingId]  = useState("");
  const [dragOrder, setDragOrder] = useState(null); // local copy while dragging
  const [dragIdx,   setDragIdx]   = useState(null);

  const stopMap   = Object.fromEntries(stops.map(s => [s.stop_id, s]));
  const available = stops.filter(s => !selected.includes(s.stop_id));
  const display   = dragOrder || selected;

  const add = () => {
    if (!addingId || selected.includes(addingId)) return;
    onChange([...selected, addingId]);
    setAddingId("");
  };

  const remove = (id) => onChange(selected.filter(s => s !== id));

  const move = (i, dir) => {
    const next = [...selected];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const onDragStart = (e, i) => {
    setDragIdx(i);
    setDragOrder([...selected]);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = [...(dragOrder || selected)];
    const [item] = next.splice(dragIdx, 1);
    next.splice(i, 0, item);
    setDragOrder(next);
    setDragIdx(i);
  };

  const onDragEnd = () => {
    if (dragOrder) onChange(dragOrder);
    setDragOrder(null);
    setDragIdx(null);
  };

  return (
    <div className="form-row">
      <label>{label || "Stops (ordered)"}</label>

      {/* Add stop */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <select value={addingId} onChange={e => setAddingId(e.target.value)} style={{ flex: 1, fontSize: 12 }}>
          <option value="">— add a stop —</option>
          {available.map(s => (
            <option key={s.stop_id} value={s.stop_id}>
              {s.stop_name} ({s.stop_id})
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary"
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={add} disabled={!addingId}>
          Add
        </button>
      </div>

      {/* Ordered list */}
      {display.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--muted)", padding: "4px 0 8px" }}>
          No stops added yet. Select a stop above and click Add.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {display.map((id, i) => {
            const stop = stopMap[id];
            const isDragging = dragIdx === i;
            return (
              <div
                key={id}
                draggable
                onDragStart={e => onDragStart(e, i)}
                onDragOver={e => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: isDragging ? "var(--surface2)" : "var(--surface)",
                  border: `1px solid ${isDragging ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius)", padding: "5px 8px",
                  cursor: "grab", fontSize: 12,
                  opacity: isDragging ? 0.6 : 1,
                }}
              >
                <span style={{ color: "var(--accent)", fontWeight: 700, minWidth: 18, fontSize: 11 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {stop ? stop.stop_name : id}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{id}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 0, flexShrink: 0 }}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    style={{ fontSize: 9, lineHeight: 1, padding: "1px 3px", background: "none", border: "none",
                      color: i === 0 ? "var(--border)" : "var(--muted)", cursor: i === 0 ? "default" : "pointer" }}>
                    ▲
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === display.length - 1}
                    style={{ fontSize: 9, lineHeight: 1, padding: "1px 3px", background: "none", border: "none",
                      color: i === display.length - 1 ? "var(--border)" : "var(--muted)",
                      cursor: i === display.length - 1 ? "default" : "pointer" }}>
                    ▼
                  </button>
                </div>
                <button type="button" onClick={() => remove(id)}
                  style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none",
                    cursor: "pointer", padding: "2px 4px", flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Drag to reorder · ▲▼ to nudge · ✕ to remove
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared route form (used by both manage + scenario) ────────────────────────
function RouteForm({ stops, initial, onSubmit, onCancel, submitLabel, lockId }) {
  const [form, setForm] = useState(
    initial || { route_id: "", route_name: "", color: COLORS[0], stop_ids: [] }
  );
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = (e) => {
    e.preventDefault();
    if (!form.route_id.trim())       return setErr("Route ID is required.");
    if (!form.route_name.trim())     return setErr("Route name is required.");
    if (form.stop_ids.length < 2)    return setErr("Select at least 2 stops.");
    setErr("");
    onSubmit(form);
  };

  return (
    <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>⚠ {err}</div>}
      <div className="form-row">
        <label>Route ID</label>
        <input value={form.route_id} onChange={e => set("route_id", e.target.value)}
          placeholder="e.g. R9" disabled={lockId} />
      </div>
      <div className="form-row">
        <label>Route Name</label>
        <input value={form.route_name} onChange={e => set("route_name", e.target.value)}
          placeholder="e.g. New Connector" />
      </div>
      <div className="form-row">
        <label>Color</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => set("color", c)} style={{
              width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer",
              outline: form.color === c ? "3px solid white" : "none",
            }} />
          ))}
        </div>
      </div>
      <OrderedStopSelector stops={stops} selected={form.stop_ids} onChange={v => set("stop_ids", v)} />
      <div className="form-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

// ── Map click handler (inside MapContainer) ────────────────────────────────────
function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── Map picker modal ───────────────────────────────────────────────────────────
function MapPickerModal({ onConfirm, onCancel }) {
  const [picked, setPicked] = useState(null);
  const [name,   setName]   = useState("");
  const [err,    setErr]    = useState("");

  const handle = () => {
    if (!name.trim()) { setErr("Enter a stop name."); return; }
    if (!picked)      { setErr("Click on the map to place the stop."); return; }
    onConfirm({ name: name.trim(), lat: picked.lat, lng: picked.lng });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 10, padding: 20, width: 480, maxWidth: "95vw",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Pick Stop Location on Map</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Click anywhere on the map to place a custom stop.
        </div>

        <div className="form-row">
          <label>Stop Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Hospital Stop" autoFocus />
        </div>

        <div style={{ height: 300, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", cursor: "crosshair" }}>
          <MapContainer center={[37.155, -113.38]} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={(lat, lng) => setPicked({ lat, lng })} />
            {picked && (
              <CircleMarker
                center={[picked.lat, picked.lng]}
                radius={9}
                pathOptions={{ color: "#fff", fillColor: "#a78bfa", fillOpacity: 1, weight: 2 }}
              />
            )}
          </MapContainer>
        </div>

        {picked && (
          <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>
            Placed at {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </div>
        )}

        {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>⚠ {err}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={!picked || !name.trim()}>
            Add Stop
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add custom stop by coordinates ────────────────────────────────────────────
function AddStopForm({ onAdd }) {
  const [name, setName] = useState("");
  const [lat,  setLat]  = useState("");
  const [lng,  setLng]  = useState("");
  const [err,  setErr]  = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const handleManual = () => {
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (!name.trim())                        { setErr("Enter a stop name.");         return; }
    if (isNaN(la) || la < 36 || la > 39)     { setErr("Latitude must be ~37°N.");    return; }
    if (isNaN(lo) || lo < -115 || lo > -112) { setErr("Longitude must be ~-113°W."); return; }
    setErr("");
    onAdd({ name: name.trim(), lat: la, lng: lo });
    setName(""); setLat(""); setLng("");
  };

  const handlePickConfirm = ({ name: n, lat: la, lng: lo }) => {
    onAdd({ name: n, lat: la, lng: lo });
    setShowPicker(false);
  };

  return (
    <>
      {showPicker && (
        <MapPickerModal onConfirm={handlePickConfirm} onCancel={() => setShowPicker(false)} />
      )}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Add Custom Stop
        </div>
        <button type="button" className="btn-primary" style={{ width: "100%", fontSize: 12, marginBottom: 10 }}
          onClick={() => setShowPicker(true)}>
          + Pick on Map
        </button>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textAlign: "center" }}>— or enter coordinates manually —</div>
        <div className="form-row" style={{ marginBottom: 6 }}>
          <label>Stop Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Hospital Stop" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
          <div className="form-row">
            <label>Latitude</label>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="37.1068" />
          </div>
          <div className="form-row">
            <label>Longitude</label>
            <input value={lng} onChange={e => setLng(e.target.value)} placeholder="-113.5631" />
          </div>
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 11, marginBottom: 6 }}>⚠ {err}</div>}
        <button type="button" className="btn-ghost" style={{ width: "100%", fontSize: 12 }} onClick={handleManual}>
          + Add to Stop List
        </button>
      </div>
    </>
  );
}

const UPLOAD_TYPES = [
  { key: "stops",           label: "stops.csv",           hint: "stop_id, stop_name, latitude, longitude" },
  { key: "routes",          label: "routes.csv",          hint: "route_id, route_name, color, stop_ids (pipe-separated)" },
  { key: "ridership",       label: "ridership.csv",       hint: "route_id, stop_id, hour, hourly_boardings, hourly_alightings" },
  { key: "employment_hubs", label: "employment_hubs.csv", hint: "hub_name, latitude, longitude, estimated_workers" },
];

// ── Per-file data manager (upload + download + backup history) ────────────────
function DataFileManager({ fileType, label, hint, onUpload }) {
  const [uploadStatus, setUploadStatus] = useState(null); // null | "loading" | "ok" | "error: ..."
  const [backups, setBackups]           = useState(null);  // null = not loaded
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
      if (expanded) loadBackups(); // refresh backup list
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

  const formatSize = (bytes) => bytes < 1024 ? `${bytes}B` : `${(bytes/1024).toFixed(1)}KB`;
  const formatDate = (ts) => new Date(ts * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const isLoading = uploadStatus === "loading";
  const isOk      = uploadStatus === "ok";
  const isError   = uploadStatus?.startsWith("error:");

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 2 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{hint}</div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {/* Download current */}
          <button
            className="btn-ghost"
            title="Download current file"
            onClick={() => downloadCurrentCsv(fileType)}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            ↓
          </button>

          {/* Upload new */}
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

          {/* Toggle backup history */}
          <button
            className="btn-ghost"
            title="Backup history"
            onClick={toggleExpanded}
            style={{ fontSize: 11, padding: "3px 8px", color: expanded ? "var(--accent)" : "var(--muted)" }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Upload error */}
      {isError && (
        <div style={{
          marginTop: 6, fontSize: 11, color: "var(--danger)",
          background: "rgba(231,76,60,0.08)", borderRadius: 4, padding: "4px 8px",
        }}>
          {uploadStatus.replace("error: ", "")}
        </div>
      )}

      {/* Backup history panel */}
      {expanded && (
        <div style={{
          marginTop: 8, background: "var(--bg)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", overflow: "hidden",
        }}>
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
                padding: "6px 10px", borderBottom: "1px solid var(--border)",
                fontSize: 11,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text)", fontFamily: "monospace", fontSize: 10,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {formatDate(b.created_at)}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 10 }}>{formatSize(b.size_bytes)}</div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px" }}
                  title="Download this backup"
                  onClick={() => downloadBackup(fileType, b.filename)}
                  disabled={busyBackup === b.filename}
                >↓</button>
                <button
                  className={confirmRestore === b.filename ? "btn-primary" : "btn-ghost"}
                  style={{ fontSize: 10, padding: "2px 6px", whiteSpace: "nowrap" }}
                  onClick={() => handleRestore(b.filename)}
                  disabled={busyBackup === b.filename}
                >
                  {confirmRestore === b.filename ? "Confirm?" : "Restore"}
                </button>
                {confirmRestore === b.filename && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => setConfirmRestore(null)}
                  >Cancel</button>
                )}
                <button
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                  title="Delete this backup"
                  onClick={() => handleDelete(b.filename)}
                  disabled={busyBackup === b.filename}
                >✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Network management panel ──────────────────────────────────────────────────
function NetworkPanel({ stops, routes, onAdd, onUpdate, onDelete, onUpload }) {
  const [mode, setMode]             = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting]     = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>

      {/* CSV Upload / Data Management */}
      <div>
        <div className="panel-title">Data Files</div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {UPLOAD_TYPES.map(({ key, label, hint }) => (
            <DataFileManager key={key} fileType={key} label={label} hint={hint} onUpload={onUpload} />
          ))}
        </div>
      </div>

      <hr className="divider" />

      {/* Route CRUD */}
      {mode === "list" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="panel-title">Routes ({routes.length})</div>
            <button className="btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setMode("add")}>
              + Add Route
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {routes.map(r => (
              <div key={r.route_id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="route-badge" style={{ background: r.color }} />
                  <span style={{ fontWeight: 600, flex: 1, fontSize: 13 }}>{r.route_name}</span>
                  <span className="tag tag-blue">{r.route_id}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{r.stop_ids.length} stops</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => { setEditTarget(r); setMode("edit"); }}>Edit</button>
                  <button
                    className={deleting === r.route_id ? "btn-danger" : "btn-ghost"}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={async () => {
                      if (deleting === r.route_id) { await onDelete(r.route_id); setDeleting(null); }
                      else setDeleting(r.route_id);
                    }}>
                    {deleting === r.route_id ? "Confirm Delete" : "Delete"}
                  </button>
                  {deleting === r.route_id && (
                    <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => setDeleting(null)}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "add" && (
        <>
          <div className="panel-title">Add New Route</div>
          <RouteForm stops={stops} submitLabel="Save Route"
            onSubmit={async (f) => { await onAdd(f); setMode("list"); }}
            onCancel={() => setMode("list")} />
        </>
      )}

      {mode === "edit" && editTarget && (
        <>
          <div className="panel-title">Edit — {editTarget.route_name}</div>
          <RouteForm stops={stops} initial={editTarget} submitLabel="Save Changes" lockId
            onSubmit={async (f) => { await onUpdate(editTarget.route_id, f); setMode("list"); setEditTarget(null); }}
            onCancel={() => { setMode("list"); setEditTarget(null); }} />
        </>
      )}
    </div>
  );
}

// ── Route preview map ─────────────────────────────────────────────────────────

function FitBoundsController({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) {
      const lats = coords.map(c => c[0]);
      const lngs = coords.map(c => c[1]);
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [28, 28], maxZoom: 15 }
      );
    } else if (coords.length === 1) {
      map.setView(coords[0], 14);
    }
  }, [coords.map(c => c.join(",")).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RoutePreviewMap({ allStops, selectedStopIds, color }) {
  const stopMap = Object.fromEntries(allStops.map(s => [s.stop_id, s]));
  const coords = selectedStopIds
    .map(id => {
      const s = stopMap[id];
      if (!s) return null;
      const lat = parseFloat(s.latitude), lng = parseFloat(s.longitude);
      if (isNaN(lat) || isNaN(lng)) return null;
      return [lat, lng];
    })
    .filter(Boolean);

  const center = coords.length > 0
    ? [coords.reduce((s, c) => s + c[0], 0) / coords.length,
       coords.reduce((s, c) => s + c[1], 0) / coords.length]
    : [37.155, -113.38];

  const routeColor = color || "#a78bfa";

  return (
    <div style={{ height: 220, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", marginTop: 4 }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBoundsController coords={coords} />
        {coords.length >= 2 && (
          <Polyline positions={coords} pathOptions={{ color: routeColor, weight: 4, opacity: 0.9 }} />
        )}
        {coords.map((coord, i) => (
          <CircleMarker
            key={i}
            center={coord}
            radius={i === 0 || i === coords.length - 1 ? 8 : 6}
            pathOptions={{ color: "#fff", fillColor: routeColor, fillOpacity: 1, weight: 2 }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

// ── Saved-scenario localStorage helpers ───────────────────────────────────────
const SCENARIO_KEY = "suntran_scenarios";

function readScenarios() {
  try { return JSON.parse(localStorage.getItem(SCENARIO_KEY) || "[]"); }
  catch { return []; }
}

function writeScenarios(list) {
  localStorage.setItem(SCENARIO_KEY, JSON.stringify(list));
}

// ── Scenario builder panel ────────────────────────────────────────────────────
function ScenarioPanel({ stops, routes, onSimulationComplete, onSimulateRoute, onResetSimulation }) {
  const [proposedRoutes, setProposedRoutes] = useState([]);
  const [proposedStops,  setProposedStops]  = useState([]);
  const [customStops,    setCustomStops]    = useState([]);
  const [baseRoute,      setBaseRoute]      = useState("");
  const [buildMode,      setBuildMode]      = useState("new");
  const [form, setForm] = useState({ route_id: "R_PROPOSED", route_name: "Proposed Route", color: "#a78bfa", stop_ids: [] });
  const [params, setParams] = useState({
    walking_radius_miles: 0.25, max_travel_minutes: 30,
    average_speed_mph: 15, dwell_time_minutes: 0.5, transfer_penalty_minutes: 5,
  });
  const [running, setRunning]           = useState(false);
  const [err, setErr]                   = useState("");
  const [savedScenarios, setSaved]      = useState(() => readScenarios());
  const [scenarioName, setScenarioName] = useState("");

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setP = (k, v) => setParams(p => ({ ...p, [k]: parseFloat(v) }));

  // ── Draft persistence across tab switches ──────────────────────────────────
  // Restore draft on mount (component re-mounts every time the Simulate tab opens)
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem("suntran_draft") || "{}");
      if (!draft.proposedRoutes?.length) return;
      setProposedRoutes(draft.proposedRoutes);
      setProposedStops(draft.proposedStops || []);
      setCustomStops(draft.customStops || []);
      setParams(p => draft.params || p);
      // Re-preview the last route so the map reflects the restored state
      const last = draft.proposedRoutes[draft.proposedRoutes.length - 1];
      const baseId = last.route_id.replace(/_MOD$/, "");
      const originalId = routes.some(r => r.route_id === baseId) ? baseId : last.route_id;
      onSimulateRoute?.(originalId, last, draft.proposedStops || []);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft whenever queue, stops, or params change
  useEffect(() => {
    sessionStorage.setItem("suntran_draft", JSON.stringify({
      proposedRoutes, proposedStops, customStops, params,
    }));
  }, [proposedRoutes, proposedStops, customStops, params]);

  // Reactively push stop changes to the map as the user selects/deselects stops
  useEffect(() => {
    if (form.stop_ids.length < 2 || !form.route_id.trim()) return;
    const originalRouteId = buildMode === "modify" && baseRoute ? baseRoute : form.route_id;
    const usedCustom = customStops.filter(s => form.stop_ids.includes(s.stop_id));
    onSimulateRoute?.(originalRouteId, { ...form }, usedCustom);
  }, [form.stop_ids, form.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allStops = [
    ...stops,
    ...customStops.map(s => ({ stop_id: s.stop_id, stop_name: `★ ${s.stop_name}`, latitude: s.latitude, longitude: s.longitude })),
  ];

  const handleAddCustomStop = ({ name, lat, lng }) => {
    const id = `CUSTOM_${Date.now()}`;
    setCustomStops(prev => [...prev, { stop_id: id, stop_name: name, latitude: lat, longitude: lng }]);
  };

  const loadBase = () => {
    const r = routes.find(r => r.route_id === baseRoute);
    if (r) setForm({ ...r, route_id: r.route_id + "_MOD", route_name: r.route_name + " (Modified)" });
  };

  const addProposed = () => {
    if (!form.route_id.trim() || form.stop_ids.length < 2) {
      setErr("Complete the route form (ID + at least 2 stops) before adding.");
      return;
    }
    setErr("");

    const usedCustom = customStops.filter(s => form.stop_ids.includes(s.stop_id));

    setProposedRoutes(prev => {
      const filtered = prev.filter(r => r.route_id !== form.route_id);
      return [...filtered, { ...form }];
    });
    if (usedCustom.length > 0) {
      setProposedStops(prev => {
        const ids = new Set(prev.map(s => s.stop_id));
        return [...prev, ...usedCustom.filter(s => !ids.has(s.stop_id))];
      });
    }

    // The "original" route being compared is the base route (modify mode) or the new route id
    const originalRouteId = buildMode === "modify" && baseRoute ? baseRoute : form.route_id;
    onSimulateRoute?.(originalRouteId, { ...form }, usedCustom);

    setForm({ route_id: "R_PROPOSED", route_name: "Proposed Route", color: "#a78bfa", stop_ids: [] });
  };

  const handleRun = async () => {
    if (proposedRoutes.length === 0) { setErr("Add at least one proposed route first."); return; }
    setErr(""); setRunning(true);
    try {
      // Merge proposed routes into the full network (replacing any matching route IDs)
      const proposedIds = new Set(proposedRoutes.map(r => r.route_id));
      const fullProposed = [...routes.filter(r => !proposedIds.has(r.route_id)), ...proposedRoutes];
      const result = await runSimulation({
        proposed_routes: fullProposed,
        proposed_stops: proposedStops.length > 0 ? proposedStops.map(s => ({
          stop_id: s.stop_id, stop_name: s.stop_name,
          latitude: s.latitude, longitude: s.longitude,
        })) : undefined,
        ...params,
      });
      // Pass only the user-defined proposed routes (not the full network copy) for metrics display
      onSimulationComplete({ ...result, proposed_routes: proposedRoutes });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Simulation failed. Check the backend.");
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = () => {
    setProposedRoutes([]);
    setProposedStops([]);
    setCustomStops([]);
    setBaseRoute("");
    setForm({ route_id: "R_PROPOSED", route_name: "Proposed Route", color: "#a78bfa", stop_ids: [] });
    setErr("");
    sessionStorage.removeItem("suntran_draft");
    onResetSimulation?.();
  };

  const handleSave = () => {
    if (!scenarioName.trim()) return;
    const scenario = {
      id: Date.now(),
      name: scenarioName.trim(),
      proposedRoutes,
      proposedStops,
      customStops,
      params,
      savedAt: new Date().toISOString(),
    };
    const updated = [scenario, ...savedScenarios];
    setSaved(updated);
    writeScenarios(updated);
    setScenarioName("");
  };

  const handleLoad = (scenario) => {
    setProposedRoutes(scenario.proposedRoutes);
    setProposedStops(scenario.proposedStops || []);
    setCustomStops(scenario.customStops || []);
    setParams(scenario.params);
    setErr("");
    // Preview the last queued route on the map
    const last = scenario.proposedRoutes[scenario.proposedRoutes.length - 1];
    if (last) {
      const baseId = last.route_id.replace(/_MOD$/, "");
      const originalId = routes.some(r => r.route_id === baseId) ? baseId : last.route_id;
      onSimulateRoute?.(originalId, last, scenario.proposedStops || []);
    }
  };

  const handleDeleteScenario = (id) => {
    const updated = savedScenarios.filter(s => s.id !== id);
    setSaved(updated);
    writeScenarios(updated);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Build route */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, overflowY: "auto", minWidth: 300, maxWidth: 340, borderRight: "1px solid var(--border)" }}>
        <div className="panel-title">Build Proposed Route</div>

        <div style={{ display: "flex", gap: 8 }}>
          {["new", "modify"].map(m => (
            <button key={m} className={buildMode === m ? "btn-primary" : "btn-ghost"}
              style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => setBuildMode(m)}>
              {m === "new" ? "New Route" : "Modify Existing"}
            </button>
          ))}
        </div>

        {buildMode === "modify" && (
          <div className="form-row">
            <label>Base route</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={baseRoute} onChange={e => setBaseRoute(e.target.value)}>
                <option value="">— select —</option>
                {routes.map(r => <option key={r.route_id} value={r.route_id}>{r.route_name}</option>)}
              </select>
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={loadBase}>Load</button>
            </div>
          </div>
        )}

        <div className="form-row">
          <label>Route ID</label>
          <input value={form.route_id} onChange={e => setF("route_id", e.target.value)} placeholder="R_NEW" />
        </div>
        <div className="form-row">
          <label>Route Name</label>
          <input value={form.route_name} onChange={e => setF("route_name", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Color</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setF("color", c)} style={{
                width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer",
                outline: form.color === c ? "3px solid white" : "none",
              }} />
            ))}
          </div>
        </div>

        <AddStopForm onAdd={handleAddCustomStop} />
        {customStops.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--accent)" }}>★ {customStops.length} custom stop{customStops.length > 1 ? "s" : ""} available</div>
        )}

        <OrderedStopSelector stops={allStops} selected={form.stop_ids} onChange={v => setF("stop_ids", v)} />

        {form.stop_ids.length >= 2 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Route Preview
            </div>
            <RoutePreviewMap allStops={allStops} selectedStopIds={form.stop_ids} color={form.color} />
          </>
        )}

        <button className="btn-primary" onClick={addProposed} disabled={form.stop_ids.length < 2}>
          Add to Simulation
        </button>
      </div>

      {/* Queue + params */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, overflowY: "auto", minWidth: 260, maxWidth: 300, borderRight: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="panel-title" style={{ margin: 0 }}>Proposed Changes ({proposedRoutes.length})</div>
          {(proposedRoutes.length > 0 || form.stop_ids.length >= 2) && (
            <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 8px", color: "var(--danger)" }}
              onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>

        {proposedRoutes.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>No proposed routes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proposedRoutes.map(r => (
              <div key={r.route_id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="route-badge" style={{ background: r.color }} />
                  <span style={{ fontWeight: 600, flex: 1, fontSize: 13 }}>{r.route_name}</span>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => setProposedRoutes(p => p.filter(x => x.route_id !== r.route_id))}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{r.stop_ids.length} stops</div>
              </div>
            ))}
          </div>
        )}

        <hr className="divider" />
        <div className="panel-title">Parameters</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "walking_radius_miles",    label: "Walking radius (mi)",   min: 0.1, max: 2,  step: 0.1  },
            { key: "max_travel_minutes",      label: "Max transit time (min)", min: 10,  max: 90, step: 5    },
            { key: "average_speed_mph",       label: "Avg bus speed (mph)",    min: 8,   max: 30, step: 1    },
            { key: "dwell_time_minutes",      label: "Dwell time / stop (min)",min: 0.25,max: 3,  step: 0.25 },
            { key: "transfer_penalty_minutes",label: "Transfer penalty (min)", min: 0,   max: 15, step: 1    },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} className="form-row">
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                {label} <span style={{ color: "var(--text)", fontWeight: 600 }}>{params[key]}</span>
              </label>
              <input type="range" min={min} max={max} step={step} value={params[key]}
                onChange={e => setP(key, e.target.value)} style={{ width: "100%" }} />
            </div>
          ))}
        </div>

        <hr className="divider" />
        {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>⚠ {err}</div>}
        <button className="btn-primary" style={{ width: "100%", padding: 10 }}
          onClick={handleRun} disabled={running || proposedRoutes.length === 0}>
          {running ? "Running…" : "▶ Run Simulation"}
        </button>
      </div>

      {/* Save / Load scenarios */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, minWidth: 260 }}>

        {/* Save current scenario */}
        <div>
          <div className="panel-title" style={{ marginBottom: 10 }}>Save Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="Scenario name…"
              style={{ flex: 1, fontSize: 12 }}
            />
            <button
              className="btn-primary"
              style={{ fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}
              onClick={handleSave}
              disabled={!scenarioName.trim() || proposedRoutes.length === 0}
            >
              Save
            </button>
          </div>
          {proposedRoutes.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
              Add at least one proposed route before saving.
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Saved scenario list */}
        <div>
          <div className="panel-title" style={{ marginBottom: 8 }}>
            Saved Scenarios ({savedScenarios.length})
          </div>
          {savedScenarios.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>No saved scenarios yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {savedScenarios.map(s => (
                <div key={s.id} className="card" style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                    {s.proposedRoutes.length} route{s.proposedRoutes.length !== 1 ? "s" : ""}
                    {s.customStops?.length > 0 ? ` · ${s.customStops.length} custom stop${s.customStops.length !== 1 ? "s" : ""}` : ""}
                    {" · "}{new Date(s.savedAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 11, padding: "3px 10px" }}
                      onClick={() => handleLoad(s)}
                    >
                      Load
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "3px 10px", color: "var(--danger)" }}
                      onClick={() => handleDeleteScenario(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Instructions (kept but moved below) */}
        <div>
          <div className="panel-title" style={{ marginBottom: 10 }}>How to Run a Simulation</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { n: "1", title: "Design a route", desc: "New Route or Modify Existing. Add custom stops by map click or coordinate. Select stops in order." },
              { n: "2", title: "Queue changes", desc: "Add multiple proposed routes. Same ID replaces the original; new ID extends the network." },
              { n: "3", title: "Save or run", desc: "Save the scenario for later, or click Run Simulation to compare against the current network." },
              { n: "4", title: "Review results", desc: "Results appear in Metrics. The Map shows the original route (gray dashed) vs. simulated (colored)." },
            ].map(item => (
              <div key={item.n} className="card" style={{ display: "flex", gap: 10, padding: "10px 12px" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#001830", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {item.n}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{item.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SimulationControls({ stops, routes, onAdd, onUpdate, onDelete, onUpload, onSimulationComplete, onSimulateRoute, onResetSimulation }) {
  const [view, setView] = useState("scenario"); // scenario | network

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {[
          { id: "scenario", label: "Scenario Planning" },
          { id: "network",  label: "Manage Network"    },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: "6px 18px", fontSize: 13, fontWeight: 700, borderRadius: "6px 6px 0 0",
            border: "1px solid var(--border)", borderBottom: view === t.id ? "1px solid var(--surface)" : "1px solid var(--border)",
            background: view === t.id ? "var(--surface2)" : "transparent",
            color: view === t.id ? "var(--accent)" : "var(--muted)",
            cursor: "pointer", marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {view === "scenario" && (
          <ScenarioPanel
            stops={stops}
            routes={routes}
            onSimulationComplete={onSimulationComplete}
            onSimulateRoute={onSimulateRoute}
            onResetSimulation={onResetSimulation}
          />
        )}
        {view === "network" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div className="panel" style={{ minWidth: 340, maxWidth: 400 }}>
              <NetworkPanel stops={stops} routes={routes} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} onUpload={onUpload} />
            </div>
            <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>All Stops ({stops.length})</div>
              <div className="card" style={{ maxWidth: 700 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Stop ID</th><th>Name</th><th>Latitude</th><th>Longitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stops.map(s => (
                      <tr key={s.stop_id}>
                        <td><span className="tag tag-blue">{s.stop_id}</span></td>
                        <td>{s.stop_name}</td>
                        <td style={{ fontFamily: "monospace" }}>{parseFloat(s.latitude).toFixed(5)}</td>
                        <td style={{ fontFamily: "monospace" }}>{parseFloat(s.longitude).toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
