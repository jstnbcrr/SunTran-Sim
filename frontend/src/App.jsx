import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  getBoardingsByRouteDowMonth,
  getBoardingsByRouteMonth,
  getBoardingsByRouteStop,
  getBoardingsByHour,
  getBoardingsByRouteHour,
  getBoardingsByDowHour,
  getBoardingsByRouteDowHour,
  getBoardingsByRouteStopHour,
  getBoardingsByStopMonth,
  getBoardingsByDowMonth,
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
  const [boardingsRouteDow,        setBoardingsRouteDow]        = useState([]);
  const [boardingsRouteDowMonth,   setBoardingsRouteDowMonth]   = useState([]);
  const [boardingsRouteMonth, setBoardingsRouteMonth] = useState([]);
  const [boardingsRouteStop,  setBoardingsRouteStop]  = useState([]);
  const [boardingsHour,         setBoardingsHour]         = useState([]);
  const [boardingsRouteHour,    setBoardingsRouteHour]    = useState([]);
  const [boardingsDowHour,      setBoardingsDowHour]      = useState([]);
  const [boardingsRouteDowHour, setBoardingsRouteDowHour] = useState([]);
  const [boardingsRouteStopHour,setBoardingsRouteStopHour]= useState([]);
  const [boardingsStopMonth,    setBoardingsStopMonth]    = useState([]);
  const [boardingsDowMonth,     setBoardingsDowMonth]     = useState([]);
  const [monthFilter,           setMonthFilter]           = useState([]); // [] = all time
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showCoverage, setShowCoverage] = useState(false);
  // Undo stack: each entry is { type: 'add'|'update'|'delete', routeId, snapshot }
  const [undoStack, setUndoStack]   = useState([]);

  // Derive sorted list of available months from byRouteMonth data
  const availableMonths = useMemo(() => {
    const months = new Set();
    boardingsRouteMonth.forEach(r => { if (r.month) months.add(r.month); });
    return Array.from(months).sort();
  }, [boardingsRouteMonth]);

  // Reset filter if months disappear (e.g. after data reload)
  useEffect(() => {
    if (monthFilter.length > 0 && availableMonths.length > 0) {
      const valid = monthFilter.filter(m => availableMonths.includes(m));
      if (valid.length !== monthFilter.length) setMonthFilter(valid);
    }
  }, [availableMonths]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const fetches = [
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
        getBoardingsByHour(),
        getBoardingsByRouteHour(),
        getBoardingsByDowHour(),
        getBoardingsByRouteDowHour(),
        getBoardingsByRouteStopHour(),
        getBoardingsByStopMonth(),
        getBoardingsByDowMonth(),
        getBoardingsByRouteDowMonth(),
      ];
      const results = await Promise.allSettled(fetches);
      const val = (i, fallback = []) =>
        results[i].status === "fulfilled" ? results[i].value : fallback;

      setStops(val(0, []));
      setRoutes(val(1, []));
      setHubs(val(2, []));
      setMetrics(val(3, null));
      setOtp(val(4, []));
      setBoardingsStop(val(5, []));
      setBoardingsRoute(val(6, []));
      setBoardingsDow(val(7, []));
      setBoardingsMonth(val(8, []));
      setBoardingsRouteDow(val(9, []));
      setBoardingsRouteMonth(val(10, []));
      setBoardingsRouteStop(val(11, []));
      setBoardingsHour(val(12, []));
      setBoardingsRouteHour(val(13, []));
      setBoardingsDowHour(val(14, []));
      setBoardingsRouteDowHour(val(15, []));
      setBoardingsRouteStopHour(val(16, []));
      setBoardingsStopMonth(val(17, []));
      setBoardingsDowMonth(val(18, []));
      setBoardingsRouteDowMonth(val(19, []));

      // Surface errors only for critical fetches
      const criticalFailed = [0, 1, 2].some(i => results[i].status === "rejected" &&
        results[i].reason?.response?.status !== 401);
      if (criticalFailed) {
        setError("Could not reach backend. Is the server running?");
      }
    } catch (e) {
      if (e?.response?.status !== 401) {
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
            boardingsStopMonth={boardingsStopMonth}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
            availableMonths={availableMonths}
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
            byHour={boardingsHour}
            byRouteHour={boardingsRouteHour}
            byDowHour={boardingsDowHour}
            byRouteDowHour={boardingsRouteDowHour}
            byRouteStopHour={boardingsRouteStopHour}
            byStopMonth={boardingsStopMonth}
            byDowMonth={boardingsDowMonth}
            byRouteDowMonth={boardingsRouteDowMonth}
            availableMonths={availableMonths}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
            otp={otp}
          />
        )}
        {activeTab === "Import" && <DataImportPanel onUpload={fetchAll} />}
        {activeTab === "Instructions" && <InstructionsPanel />}
      </main>
    </div>
  );
}
