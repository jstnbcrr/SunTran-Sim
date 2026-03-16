import React, { useState } from "react";
import { login } from "../api/client";
import suntranLogo from "../assets/suntran-logo.png";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem("suntran_token", data.access_token);
      localStorage.setItem("suntran_user", data.username);
      onLogin(data.username);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Login failed. Check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <img src={suntranLogo} alt="SunTran" style={styles.logoImg} />
          <div style={styles.logoSub}>St. George, Utah — Transit Analysis</div>
        </div>

        <div style={styles.divider} />

        <p style={styles.heading}>Sign in to continue</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={styles.button}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse at 50% 30%, #002444 0%, #001830 70%)",
  },
  card: {
    background: "#002444",
    border: "1px solid #00427a",
    borderTop: "3px solid #e6c928",
    borderRadius: 12,
    padding: "36px 40px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(0,36,68,0.5)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  logoImg: {
    height: 64,
    width: "auto",
    objectFit: "contain",
  },
  logoSub: {
    fontSize: 11,
    color: "#ffffff",
    marginTop: 2,
  },
  divider: {
    height: 1,
    background: "#00427a",
    marginBottom: 20,
  },
  heading: {
    fontSize: 13,
    color: "#7a9ab5",
    marginBottom: 20,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: "#7a9ab5",
    marginBottom: 0,
  },
  input: {
    background: "#00305a",
    border: "1px solid #00427a",
    borderRadius: 8,
    color: "#eef3f8",
    padding: "9px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
  },
  error: {
    background: "#2d1010",
    border: "1px solid #7f1d1d",
    borderRadius: 6,
    color: "#fca5a5",
    fontSize: 12,
    padding: "8px 12px",
  },
  button: {
    background: "#e6c928",
    color: "#001830",
    border: "none",
    borderRadius: 8,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 4,
    transition: "opacity 0.15s",
  },
};
