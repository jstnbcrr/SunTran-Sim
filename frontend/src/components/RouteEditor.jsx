import React, { useState } from "react";

const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a",
];

function StopSelector({ stops, selected, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label>Stops (in order)</label>
      <select
        multiple
        size={6}
        style={{ height: "auto" }}
        value={selected}
        onChange={e =>
          onChange(Array.from(e.target.selectedOptions, o => o.value))
        }
      >
        {stops.map(s => (
          <option key={s.stop_id} value={s.stop_id}>
            {s.stop_name} ({s.stop_id})
          </option>
        ))}
      </select>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Hold Ctrl/Cmd to select multiple. Order = sequence.
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((id, idx) => {
            const stop = stops.find(s => s.stop_id === id);
            return (
              <span
                key={id}
                className="tag tag-blue"
                style={{ cursor: "pointer" }}
                onClick={() => onChange(selected.filter(s => s !== id))}
                title="Click to remove"
              >
                {idx + 1}. {stop ? stop.stop_name : id} ✕
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RouteForm({ stops, initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(
    initial || { route_id: "", route_name: "", color: COLORS[0], stop_ids: [] }
  );
  const [err, setErr] = useState("");

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.route_id.trim()) return setErr("Route ID is required");
    if (!form.route_name.trim()) return setErr("Route name is required");
    if (form.stop_ids.length < 2) return setErr("Select at least 2 stops");
    setErr("");
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && <div style={{ color: "var(--danger)", fontSize: 12 }}>⚠ {err}</div>}
      <div className="form-row">
        <label>Route ID</label>
        <input
          value={form.route_id}
          onChange={e => set("route_id", e.target.value)}
          placeholder="e.g. R6"
          disabled={!!initial}
        />
      </div>
      <div className="form-row">
        <label>Route Name</label>
        <input
          value={form.route_name}
          onChange={e => set("route_name", e.target.value)}
          placeholder="e.g. Black Desert Connector"
        />
      </div>
      <div className="form-row">
        <label>Color</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => set("color", c)}
              style={{
                width: 24, height: 24, borderRadius: 4, background: c, cursor: "pointer",
                outline: form.color === c ? "3px solid white" : "none",
              }}
            />
          ))}
        </div>
      </div>
      <StopSelector stops={stops} selected={form.stop_ids} onChange={v => set("stop_ids", v)} />
      <div className="form-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function RouteEditor({
  stops,
  routes,
  onAdd,
  onUpdate,
  onDelete,
  onUpload,
}) {
  const [mode, setMode] = useState("list"); // list | add | edit
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleAdd = async (form) => {
    await onAdd(form);
    setMode("list");
  };

  const handleUpdate = async (form) => {
    await onUpdate(editTarget.route_id, form);
    setMode("list");
    setEditTarget(null);
  };

  const handleDelete = async (id) => {
    if (deleting === id) {
      await onDelete(id);
      setDeleting(null);
    } else {
      setDeleting(id);
    }
  };

  const handleUpload = (fileType) => (e) => {
    if (e.target.files[0]) onUpload(fileType, e.target.files[0]);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div className="panel" style={{ maxWidth: 400, minWidth: 360 }}>
        {/* Upload section */}
        <div className="panel-title">Upload Data</div>
        <div className="card">
          {["stops", "routes", "ridership", "employment_hubs"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>
                {t.replace("_", " ")}.csv
              </span>
              <label
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                Upload
                <input type="file" accept=".csv" hidden onChange={handleUpload(t)} />
              </label>
            </div>
          ))}
        </div>

        <hr className="divider" />

        {/* Route management */}
        {mode === "list" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="panel-title">Routes ({routes.length})</div>
              <button className="btn-primary" style={{ padding: "5px 12px" }} onClick={() => setMode("add")}>
                + Add Route
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
              {routes.map(r => (
                <div key={r.route_id} className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span className="route-badge" style={{ background: r.color }} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{r.route_name}</span>
                    <span className="tag tag-blue">{r.route_id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                    {r.stop_ids.length} stops
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => { setEditTarget(r); setMode("edit"); }}
                    >
                      Edit
                    </button>
                    <button
                      className={deleting === r.route_id ? "btn-danger" : "btn-ghost"}
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => handleDelete(r.route_id)}
                    >
                      {deleting === r.route_id ? "Confirm Delete" : "Delete"}
                    </button>
                    {deleting === r.route_id && (
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: "4px 10px" }}
                        onClick={() => setDeleting(null)}
                      >
                        Cancel
                      </button>
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
            <RouteForm
              stops={stops}
              onSubmit={handleAdd}
              onCancel={() => setMode("list")}
              submitLabel="Add Route"
            />
          </>
        )}

        {mode === "edit" && editTarget && (
          <>
            <div className="panel-title">Edit Route — {editTarget.route_name}</div>
            <RouteForm
              stops={stops}
              initial={editTarget}
              onSubmit={handleUpdate}
              onCancel={() => { setMode("list"); setEditTarget(null); }}
              submitLabel="Save Changes"
            />
          </>
        )}
      </div>

      {/* Stop list table */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>All Stops ({stops.length})</div>
        <div className="card" style={{ maxWidth: 700 }}>
          <table>
            <thead>
              <tr>
                <th>Stop ID</th>
                <th>Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
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
  );
}
