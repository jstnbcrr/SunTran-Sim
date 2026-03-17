import React, { useState, useEffect } from "react";

const STORAGE_KEY = "suntran_welcome_seen";

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#001e3c",
        border: "1px solid #00427a",
        borderRadius: 12,
        padding: "32px 36px",
        maxWidth: 520,
        width: "100%",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <img
            src="/suntran-logo.png"
            alt="SunTran"
            style={{ height: 36, objectFit: "contain" }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <h2 style={{ margin: 0, fontSize: 20, color: "#eef3f8", fontWeight: 700 }}>
            Welcome to the SunTran Bus Simulation
          </h2>
        </div>

        {/* Description */}
        <p style={{ color: "#a8c0d6", fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.6 }}>
          This tool lets you explore and test changes to St. George's SunTran bus network —
          so you can see how route adjustments affect rider access across the city.
        </p>

        {/* Tab breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {[
            { icon: "🗺️", label: "Map", desc: "See all bus routes and stops on a live map. Click any route to zoom in and check travel times." },
            { icon: "🕹️", label: "Simulate", desc: "Build proposed routes, adjust walking distance and speed, then run a side-by-side comparison against the current system." },
            { icon: "📊", label: "Metrics & Ridership", desc: "View accessibility scores, employment hub coverage, boarding counts, and on-time performance by route." },
            { icon: "📖", label: "Instructions", desc: "Full guidance on every feature, including how to upload your own data." },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "10px 12px",
            }}>
              <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{icon}</span>
              <div>
                <span style={{ color: "#e6c928", fontWeight: 700, fontSize: 13 }}>{label}</span>
                <span style={{ color: "#a8c0d6", fontSize: 12.5, marginLeft: 6 }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Closing + CTA */}
        <p style={{ color: "#7a9ab5", fontSize: 12.5, margin: "0 0 18px", lineHeight: 1.5 }}>
          Take your time exploring — everything is non-destructive until you save or upload a file.
        </p>

        <button
          onClick={dismiss}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 8,
            border: "none",
            background: "#e6c928",
            color: "#001e3c",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            letterSpacing: 0.3,
          }}
        >
          Get Started
        </button>

      </div>
    </div>
  );
}
