import axios from "axios";

const BASE = "/api";

const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("suntran_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored credentials so the login screen re-appears
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("suntran_token");
      localStorage.removeItem("suntran_user");
      window.dispatchEvent(new Event("suntran_logout"));
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = (username, password) => {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  return axios
    .post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    .then((r) => r.data);
};

// ── Data endpoints ────────────────────────────────────────────────────────────

export const getStops          = ()       => api.get("/stops").then(r => r.data);
export const getRoutes         = ()       => api.get("/routes").then(r => r.data);
export const getEmploymentHubs = ()       => api.get("/employment-hubs").then(r => r.data);
export const getRidership      = ()       => api.get("/ridership").then(r => r.data);
export const getMetrics        = ()       => api.get("/metrics").then(r => r.data);
export const getOtp            = ()       => api.get("/otp").then(r => r.data);
export const getBoardingsByStop  = ()     => api.get("/boardings/by-stop").then(r => r.data);
export const getBoardingsByRoute = ()     => api.get("/boardings/by-route").then(r => r.data);
export const getBoardingsByDow   = ()     => api.get("/boardings/by-dow").then(r => r.data);
export const getBoardingsByMonth      = () => api.get("/boardings/by-month").then(r => r.data);
export const getBoardingsByRouteDow   = () => api.get("/boardings/by-route-dow").then(r => r.data);
export const getBoardingsByRouteMonth = () => api.get("/boardings/by-route-month").then(r => r.data);
export const getBoardingsByRouteStop  = () => api.get("/boardings/by-route-stop").then(r => r.data);
export const getCoverageGaps   = ()       => api.get("/simulate/coverage-gaps").then(r => r.data);

export const addRoute    = (route)       => api.post("/routes", route).then(r => r.data);
export const updateRoute = (id, route)   => api.put(`/routes/${id}`, route).then(r => r.data);
export const deleteRoute = (id)          => api.delete(`/routes/${id}`).then(r => r.data);

export const runSimulation = (params) =>
  api.post("/simulate", params).then(r => r.data);

export const exportMetricsCsv = () =>
  api.get("/metrics/export", { responseType: "blob" }).then(r => r.data);

export const uploadCsv = (fileType, file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/upload/${fileType}`, form).then(r => r.data);
};

export const downloadCurrentCsv = (fileType) => {
  const token = localStorage.getItem("suntran_token");
  const a = document.createElement("a");
  a.href = `/api/data/${fileType}/download`;
  // Trigger via fetch so we can attach the auth header
  return api.get(`/data/${fileType}/download`, { responseType: "blob" }).then(r => {
    const url = URL.createObjectURL(r.data);
    a.href = url;
    a.download = `${fileType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

export const listBackups    = (fileType)           => api.get(`/data/${fileType}/backups`).then(r => r.data);
export const restoreBackup  = (fileType, filename) => api.post(`/data/${fileType}/restore/${filename}`).then(r => r.data);
export const deleteBackup   = (fileType, filename) => api.delete(`/data/${fileType}/backup/${filename}`).then(r => r.data);
export const downloadBackup = (fileType, filename) =>
  api.get(`/data/${fileType}/backup/${filename}/download`, { responseType: "blob" }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  });
