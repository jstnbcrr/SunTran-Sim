import React, { useState, useEffect, useCallback } from "react";
import MapView from "./components/MapView";
import SimulationControls from "./components/SimulationControls";
import MetricsPanel from "./components/MetricsPanel";
import Login from "./components/Login";
import WelcomeModal from "./components/WelcomeModal";
import {
  getStops,
  getRoutes,
  getEmploymentHubs,
  getMetrics,
  getOtp,
  getBoardingsByStop,
  getBoardingsByRoute,
  getBoardingsByDow,
  getBoardingsByMonth,
  getBoardingsByRouteDow,
  getBoardingsByRouteMonth,
  getBoardingsByRouteStop,
  addRoute,
  updateRoute,
  deleteRoute,
  uploadCsv,
} from "./api/client";
import RidershipPanel from "./components/RidershipPanel";
import InstructionsPanel from "./components/InstructionsPanel";
import DataImportPanel from "./components/DataImportPanel";
import "./App.css";
import suntranLogo from "./assets/suntran-logo.png";

const TABS = ["Map", "Simulate", "Metrics", "Ridership", "Import", "Instructions"];

export default function App() {
  const [activeTab, setActiveTab]   = useState("Map");
  const [stops, setStops]           = useState([]);
  const [routes, setRoutes]         = useState([]);
  const [hubs, setHubs]             = useState([]);
  const [metrics, setMetrics]       = useState(null);
  const [simResult, setSimResult]   = useState(null);
  const [simState, setSimState]     = useState({
    simulatedRoutes: {},        // { [originalRouteId]: RouteData }
    simulatedStops:  [],        // custom stops added in simulation
    activeSimulationRouteId: null,
  });
  const [otp, setOtp]               = useState([]);
  const [boardingsStop,       setBoardingsStop]       = useState([]);
  const [boardingsRoute,      setBoardingsRoute]      = useState([]);
  const [boardingsDow,        setBoardingsDow]        = useState([]);
  const [boardingsMonth,      setBoardingsMonth]      = useState([]);
  const [boardingsRouteDow,   setBoardingsRouteDow]   = useState([]);
  const [boardingsRouteMonth, setBoardingsRouteMonth] = useState([]);
  const [boardingsRouteStop,  setBoardingsRouteStop]  = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showCoverage, setShowCoverage] = useState(false);
  // Undo stack: each entry is { type: 'add'|'update'|'delete', routeId, snapshot }
  const [undoStack, setUndoStack]   = useState([]);

  // Auth state — check localStorage on mount
  const [currentUser, setCurrentUser] = useState(
    () => localStorage.getItem("suntran_user") || null
  );

  // Listen for 401s from the axios interceptor
  useEffect(() => {
    const handleLogout = () => setCurrentUser(null);
    window.addEventListener("suntran_logout", handleLogout);
    return () => window.removeEventListener("suntran_logout", handleLogout);
  }, []);

  const handleLogin = (username) => setCurrentUser(username);

  const handleLogout = () => {
    localStorage.removeItem("suntran_token");
    localStorage.removeItem("suntran_user");
    setCurrentUser(null);
  };

  const handleSimulateRoute = useCallback((originalRouteId, updatedRoute, customStops = []) => {
    setSimState(prev => {
      const stopIds = new Set(prev.simulatedStops.map(s => s.stop_id));
      return {
        simulatedRoutes: { ...prev.simulatedRoutes, [originalRouteId]: updatedRoute },
        simulatedStops:  [...prev.simulatedStops, ...customStops.filter(s => !stopIds.has(s.stop_id))],
        activeSimulationRouteId: originalRouteId,
      };
    });
  }, []);

  const handleResetSimulation = useCallback(() => {
    setSimState({ simulatedRoutes: {}, simulatedStops: [], activeSimulationRouteId: null });
    setSimResult(null);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, h, m, o, bs, br, bd, bm, brd, brm, brs] = await Promise.all([
        getStops(),
        getRoutes(),
        getEmploymentHubs(),
        getMetrics(),
        getOtp(),
        getBoardingsByStop(),
        getBoardingsByRoute(),
        getBoardingsByDow(),
        getBoardingsByMonth(),
        getBoardingsByRouteDow(),
        getBoardingsByRouteMonth(),
        getBoardingsByRouteStop(),
      ]);
      setStops(s);
      setRoutes(r);
      setHubs(h);
      setMetrics(m);
      setOtp(o);
      setBoardingsStop(bs);
      setBoardingsRoute(br);
      setBoardingsDow(bd);
      setBoardingsMonth(bm);
      setBoardingsRouteDow(brd);
      setBoardingsRouteMonth(brm);
      setBoardingsRouteStop(brs);
    } catch (e) {
      if (e.response?.status !== 401) {
        setError("Could not reach backend. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchAll();
  }, [currentUser, fetchAll]);

  // Show login screen if not authenticated
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const handleAddRoute = async (route) => {
    await addRoute(route);
    setUndoStack(s => [...s, { type: "add", routeId: route.route_id, snapshot: null }]);
    fetchAll();
  };

  const handleUpdateRoute = async (id, route) => {
    const previous = routes.find(r => r.route_id === id);
    await updateRoute(id, route);
    if (previous) {
      setUndoStack(s => [...s, { type: "update", routeId: id, snapshot: previous }]);
    }
    fetchAll();
  };

  const handleDeleteRoute = async (id) => {
    const previous = routes.find(r => r.route_id === id);
    await deleteRoute(id);
    if (previous) {
      setUndoStack(s => [...s, { type: "delete", routeId: id, snapshot: previous }]);
    }
    fetchAll();
  };

  const handleUndo = async () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    if (last.type === "add") {
      await deleteRoute(last.routeId);
    } else if (last.type === "update") {
      await updateRoute(last.routeId, last.snapshot);
    } else if (last.type === "delete") {
      await addRoute(last.snapshot);
    }
    fetchAll();
  };

  const handleUpload = async (fileType, file) => {
    try {
      await uploadCsv(fileType, file);
      setUndoStack([]);  // uploads replace data wholesale; clear undo history
      await fetchAll();
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Upload failed";
      return { success: false, error: msg };
    }
  };

  return (
    <div className="app-shell">
      <WelcomeModal />
      <header className="app-header">
        <div className="app-logo">
          <img src={suntranLogo} alt="SunTran" className="logo-img" />
          <span className="logo-sub">St. George, Utah — Transit Analysis</span>
        </div>
        <nav className="app-nav">
          {TABS.map(t => (
            <button
              key={t}
              className={`nav-btn ${activeTab === t ? "active" : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {currentUser}
          </span>
          {undoStack.length > 0 && (
            <button
              className="btn-ghost"
              onClick={handleUndo}
              title={`Undo last route edit (${undoStack.length} in history)`}
              style={{ fontSize: 12 }}
            >
              ↩ Undo
            </button>
          )}
          <button className="btn-ghost" onClick={fetchAll} disabled={loading}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
          <button className="btn-ghost" onClick={handleLogout} style={{ color: "var(--danger)" }}>
            Sign Out
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          ⚠ {error}
        </div>
      )}

      <main className="app-main">
        {activeTab === "Map" && (
          <MapView
            stops={stops}
            routes={routes}
            hubs={hubs}
            simState={simState}
            showCoverage={showCoverage}
            onToggleCoverage={() => setShowCoverage(v => !v)}
            boardingsByStop={boardingsStop}
          />
        )}
        {activeTab === "Simulate" && (
          <SimulationControls
            stops={stops}
            routes={routes}
            hubs={hubs}
            byRouteStop={boardingsRouteStop}
            onAdd={handleAddRoute}
            onUpdate={handleUpdateRoute}
            onDelete={handleDeleteRoute}
            onUpload={handleUpload}
            onSimulateRoute={handleSimulateRoute}
            onResetSimulation={handleResetSimulation}
            simState={simState}
            onSimulationComplete={(result) => {
              setSimResult(result);
              setActiveTab("Metrics");
            }}
          />
        )}
        {activeTab === "Metrics" && (
          <MetricsPanel
            metrics={metrics}
            simResult={simResult}
            routes={routes}
            otp={otp}
          />
        )}
        {activeTab === "Ridership" && (
          <RidershipPanel
            byStop={boardingsStop}
            byRoute={boardingsRoute}
            byDow={boardingsDow}
            byMonth={boardingsMonth}
            byRouteDow={boardingsRouteDow}
            byRouteMonth={boardingsRouteMonth}
            byRouteStop={boardingsRouteStop}
          />
        )}
        {activeTab === "Import" && <DataImportPanel onUpload={fetchAll} />}
        {activeTab === "Instructions" && <InstructionsPanel />}
      </main>
    </div>
  );
}
