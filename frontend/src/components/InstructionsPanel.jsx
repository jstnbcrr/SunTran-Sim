import React, { useState } from "react";

const SECTIONS = [
  { id: "quickstart", label: "Quick Start" },
  { id: "map",        label: "Map" },
  { id: "ridership",  label: "Ridership" },
  { id: "import",     label: "Importing Data" },
  { id: "simulate",   label: "Simulate" },
  { id: "metrics",    label: "Metrics" },
  { id: "faq",        label: "FAQ" },
];

function Section({ id, title, children }) {
  return (
    <div id={id} style={{ marginBottom: 40 }}>
      <div style={{
        fontSize: 18, fontWeight: 700, color: "var(--accent)",
        borderBottom: "2px solid var(--border)", paddingBottom: 8, marginBottom: 18,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
        background: "var(--accent)", color: "#001830",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700,
      }}>
        {n}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, paddingTop: 4 }}>
        {children}
      </div>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      background: "rgba(230,201,40,0.08)", border: "1px solid rgba(230,201,40,0.3)",
      borderRadius: "var(--radius)", padding: "10px 14px",
      fontSize: 12, color: "var(--text)", lineHeight: 1.7, marginTop: 10,
    }}>
      <span style={{ color: "var(--accent)", fontWeight: 700 }}>💡 Tip: </span>
      {children}
    </div>
  );
}

function Warning({ children }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: "var(--radius)", padding: "10px 14px",
      fontSize: 12, color: "var(--text)", lineHeight: 1.7, marginTop: 10,
    }}>
      <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠ Watch out: </span>
      {children}
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      background: "rgba(55,136,216,0.08)", border: "1px solid rgba(55,136,216,0.25)",
      borderRadius: "var(--radius)", padding: "10px 14px",
      fontSize: 12, color: "var(--text)", lineHeight: 1.7, marginTop: 10,
    }}>
      <span style={{ color: "var(--accent2)", fontWeight: 700 }}>📌 Note: </span>
      {children}
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      display: "inline-block", background: color || "var(--surface2)",
      border: "1px solid var(--border)", borderRadius: 4,
      padding: "1px 7px", fontSize: 11, fontFamily: "monospace",
      color: "var(--text)", margin: "0 2px",
    }}>
      {children}
    </span>
  );
}

function WorkflowCard({ number, title, desc, tab }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
        background: "var(--accent)", color: "#001830",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>
        {number}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
          {title}
          {tab && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>→ {tab} tab</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function FaqItem({ question, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", textAlign: "left", padding: "6px 0", gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 }}>
          {question}
        </span>
        <span style={{
          flexShrink: 0, fontSize: 16, color: "var(--accent)",
          transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s",
        }}>▶</span>
      </button>
      {open && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8, paddingTop: 8, paddingLeft: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function InstructionsPanel() {
  const [activeSection, setActiveSection] = useState("quickstart");

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Sidebar */}
      <div style={{
        width: 190, flexShrink: 0, padding: "20px 12px",
        borderRight: "1px solid var(--border)", overflowY: "auto",
        background: "var(--surface)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 14 }}>
          Contents
        </div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: activeSection === s.id ? "rgba(230,201,40,0.1)" : "transparent",
              border: "none", borderLeft: activeSection === s.id
                ? "3px solid var(--accent)" : "3px solid transparent",
              color: activeSection === s.id ? "var(--accent)" : "var(--muted)",
              padding: "7px 10px", fontSize: 12, fontWeight: activeSection === s.id ? 700 : 400,
              cursor: "pointer", borderRadius: "0 var(--radius) var(--radius) 0",
              marginBottom: 2, transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 44px", maxWidth: 820 }}>

        {/* ── Quick Start ── */}
        <Section id="quickstart" title="Quick Start">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, marginBottom: 20 }}>
            There are two things you'll do in this tool — <strong>analyze historical ridership</strong> and
            <strong> test route changes</strong>. Here's how to get started with each.
          </p>

          <SubSection title="📊 I want to explore ridership data">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <WorkflowCard number="1" title="Upload your data" tab="Import" desc={'Go to the Import tab. Upload your monthly APC vendor CSV under \"Avg Passenger Counts.\" New months merge in automatically — do this each month.'} />
              <WorkflowCard number="2" title="Explore the dashboard" tab="Ridership" desc="Open the Ridership tab. You'll see boardings by route, stop, day of week, and monthly trends. Use the period pills at the top to filter to specific months." />
              <WorkflowCard number="3" title="Filter the map too" tab="Map" desc="The same period filter appears on the Map tab. Select a month to see the ridership heatmap for just that period." />
            </div>
          </SubSection>

          <SubSection title="🗺 I want to test a route change">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <WorkflowCard number="1" title="Look at the current network" tab="Map" desc="Use the Map tab to understand existing coverage. Toggle the 0.25-mile coverage circles to spot gaps. Click any stop to see its boarding volume." />
              <WorkflowCard number="2" title="Build your proposal" tab="Simulate" desc={'Open the Simulate tab. Find a route and click Edit, or click + Add Route. Adjust the stop list and click "Simulate This Route" to preview it on the map.'} />
              <WorkflowCard number="3" title="Run the comparison" tab="Simulate" desc={'Click "Run Full Simulation." The tool calculates how your change affects travel times and access to jobs, then opens the Metrics tab with the results.'} />
              <WorkflowCard number="4" title="Export your findings" tab="Metrics" desc="Click Export CSV to download the results. Run multiple scenarios and compare the exports." />
            </div>
          </SubSection>

          <Tip>After uploading new data, click <strong>↺ Refresh</strong> in the top-right to reload all charts.</Tip>
        </Section>

        {/* ── Map ── */}
        <Section id="map" title="Map Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, marginBottom: 16 }}>
            The Map is your starting point — it shows the current network and lets you visualize
            ridership patterns and coverage gaps before proposing changes.
          </p>

          <SubSection title="What you're looking at">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["🔵 Colored circles",  "Bus stops. Size and color show relative boarding volume — blue = low, yellow = medium, red = high."],
                ["━ Colored lines",     "Bus routes. Each route has its own color from the sidebar legend."],
                ["⭐ Gold stars",       "Employment hubs — hospitals, universities, major employers used in the simulation."],
                ["◯ Shaded rings",     "0.25-mile walking radius around each stop. Turn on in Map Layers to see coverage gaps."],
                ["╌ Dashed lines",     "Your proposed route from the Simulate tab, shown as a live preview overlay."],
              ].map(([icon, desc]) => (
                <div key={icon} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent2)", minWidth: 140, flexShrink: 0 }}>{icon}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Filtering by month">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              Once you've imported multiple months of data, a <strong>Period filter</strong> appears
              at the bottom of the sidebar. Click any month pill to show the ridership heatmap for
              just that period. Select multiple months to combine them.
              Click <Tag>All time</Tag> to go back to the full dataset.
            </div>
            <Note>The period filter is shared with the Ridership tab — changing it on the map also changes it in Ridership, and vice versa.</Note>
          </SubSection>

          <Tip>Click any stop marker to see its stop ID and average daily boardings. You'll need the stop ID when building a proposed route in the Simulate tab.</Tip>
        </Section>

        {/* ── Ridership ── */}
        <Section id="ridership" title="Ridership Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, marginBottom: 16 }}>
            The Ridership tab is a full analytics dashboard. Every chart updates instantly when you
            change the period filter at the top.
          </p>

          <SubSection title="What's on the dashboard">
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                ["System Summary",     "Total boardings, busiest route, busiest stop, and peak day — all at a glance. Click any card for a breakdown."],
                ["Route Scorecard",    "One row per route showing boardings, 3-month trend, year-over-year change, and weekday vs. weekend split. Click a row to expand stop-level detail."],
                ["Route × Day Heatmap","Color matrix showing which routes are busiest on which days of the week."],
                ["Day of Week",        "Average boardings by day across the system. Use the route dropdown to drill into a specific route."],
                ["Top 15 Stops",       "Horizontal bar chart of your highest-boarding stops. Filter to a single route to see just its stops."],
                ["Year-over-Year",     "Same month this year vs. last year, side by side. Hidden when a month filter is active."],
                ["Seasonal Index",     "Each month as a % of the average (100 = average month). Quickly shows your peak and slow seasons. Hidden when a month filter is active."],
              ].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent2)", minWidth: 160, flexShrink: 0 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Using the period filter">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              The pill bar at the top lists every month in your dataset. Click one month to scope
              all charts to that period. Click multiple months to combine them. Click
              <Tag>All time</Tag> to reset. The YoY and Seasonal Index charts are automatically
              hidden when a filter is active since they're designed to show the full timeline.
            </div>
          </SubSection>
        </Section>

        {/* ── Import ── */}
        <Section id="import" title="Importing Data">

          <SubSection title="Monthly APC import — do this every month">
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
              Each month your APC/AVL vendor provides a CSV export. Upload it here and the system
              automatically updates every ridership chart. New months are <strong>merged in</strong> —
              your existing history is preserved.
            </p>
            <Step n={1}>Go to the <strong>Import</strong> tab.</Step>
            <Step n={2}>Find the <strong>Avg Passenger Counts</strong> slot and click <Tag>Choose file</Tag>. Select the vendor CSV.</Step>
            <Step n={3}>Review the preview — it shows the detected columns, row count, and date range. Make sure it looks right.</Step>
            <Step n={4}>Leave the mode set to <Tag>Merge</Tag> and click <Tag>Import</Tag>.</Step>
            <Step n={5}>Click <strong>↺ Refresh</strong> in the top-right to reload all charts with the new month included.</Step>
            <Warning>Only use <Tag>Replace</Tag> mode if you're correcting a previously imported month with a revised file. Replace wipes all existing data for that dataset and starts fresh.</Warning>
          </SubSection>

          <SubSection title="What the vendor file needs to look like">
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
              The Avg Passenger Counts file needs these columns. Extra columns are fine — they're ignored.
            </div>
            <table style={{ marginTop: 4 }}>
              <thead>
                <tr><th>Column</th><th>Example</th><th>What it is</th></tr>
              </thead>
              <tbody>
                {[
                  ["route",     "Route 1",       "Route name"],
                  ["address",   "100 N Main St", "Stop address or name"],
                  ["stop_id",   "S001",           "Stop ID"],
                  ["date",      "2025-03-15",     "Service date (YYYY-MM-DD or MM/DD/YYYY)"],
                  ["hour",      "8",              "Hour of day, 0–23"],
                  ["total_in",  "12",             "Boardings at this stop this hour"],
                  ["total_out", "7",              "Alightings at this stop this hour"],
                ].map(([col, ex, desc]) => (
                  <tr key={col}>
                    <td><code style={{ fontSize: 11, color: "var(--accent)" }}>{col}</code></td>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{ex}</td>
                    <td style={{ fontSize: 12 }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Tip>Download the template from the Import tab to get a pre-formatted file you can fill in or map your vendor export to.</Tip>
          </SubSection>

          <SubSection title="Other files you can upload">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                ["OTP Excel",        "On-time performance spreadsheet from the vendor. Shown in the Metrics tab."],
                ["stops.csv",        "Updates the list of bus stops on the map. Replaces all existing stops."],
                ["routes.csv",       "Updates the route network. Replaces all existing routes."],
                ["employment_hubs.csv","Updates the employment destinations used in the simulation."],
              ].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Tag>{name}</Tag>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
            <Note>Stops, routes, and employment hubs uploads always <strong>replace</strong> the existing data entirely — there's no merge for those files. Make sure your file is complete before uploading.</Note>
          </SubSection>

          <SubSection title="Backups">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              Every successful import creates a timestamped backup automatically. Use the
              <strong> Backups</strong> section on the Import page to download a previous version
              or roll back to an earlier state if something goes wrong.
            </div>
          </SubSection>
        </Section>

        {/* ── Simulate ── */}
        <Section id="simulate" title="Simulate Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, marginBottom: 16 }}>
            Use this tab to propose route changes and see how they affect the network —
            without touching any live data.
          </p>

          <SubSection title="How to propose a route change">
            <Step n={1}>Find the route you want to modify in the Routes list and click <Tag>Edit</Tag>. Or click <Tag>+ Add Route</Tag> to create a brand-new one.</Step>
            <Step n={2}>Build the stop list — use the dropdown to add stops, drag to reorder, click × to remove. The Map tab will show a live preview of the path as you build it.</Step>
            <Step n={3}>Click <Tag>Simulate This Route</Tag> to stage the proposal. You can stage multiple routes before running.</Step>
            <Step n={4}>Adjust simulation parameters if needed (speed, walking radius, etc.) in the right panel.</Step>
            <Step n={5}>Click <Tag>Run Full Simulation</Tag>. The Metrics tab opens automatically with the current vs. proposed comparison.</Step>
            <Step n={6}>Click <Tag>Reset Simulation</Tag> to clear the proposal and start fresh.</Step>
          </SubSection>

          <SubSection title="Adding a stop that doesn't exist yet">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              If your proposed route needs a brand-new stop location, use the <strong>Custom Stops</strong>
              section to enter a latitude/longitude and a temporary ID. Custom stops only exist for the
              duration of the simulation — they are not saved to the database.
            </div>
          </SubSection>

          <SubSection title="Permanent edits and undo">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <Tag>Edit → Save</Tag> permanently writes the change to the database.
              <Tag>Delete</Tag> permanently removes a route (requires confirmation).
              The <Tag>↩ Undo</Tag> button in the header reverses the last add, edit, or delete.
            </div>
          </SubSection>

          <Note>Staging a simulation does <strong>not</strong> change the live network. Only Save/Delete in the Routes panel makes permanent changes.</Note>
        </Section>

        {/* ── Metrics ── */}
        <Section id="metrics" title="Metrics Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, marginBottom: 16 }}>
            After running a simulation this tab shows a side-by-side comparison: current network
            on the left, your proposed network on the right, with a delta for each metric.
            Green = improvement. Red = regression.
          </p>

          <SubSection title="The four metrics explained simply">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  metric: "Reachable Workers",
                  simple: "How many people have a bus they could take to work?",
                  detail: "Counts the total employees at every hub that has a bus stop within walking distance AND can be reached within 30 minutes from at least one other stop. This is the most meaningful equity metric.",
                  positive: "More workers have transit access to their job.",
                },
                {
                  metric: "Accessible Hubs",
                  simple: "How many employment destinations can people reach by bus?",
                  detail: "A hub counts as accessible if there's a nearby stop AND at least one route can reach it within the travel time limit.",
                  positive: "More employment destinations are within reach.",
                },
                {
                  metric: "Avg Travel Time",
                  simple: "How long does the average trip take?",
                  detail: "The mean shortest-path travel time (in minutes) between all stop pairs in the network. Lower is better — so a negative delta is good.",
                  positive: "Trips are faster on average (negative delta = green).",
                },
                {
                  metric: "Total Stops / Edges",
                  simple: "How big is the network?",
                  detail: "Stops = unique stop locations. Edges = directed connections between consecutive stops (each physical segment counts twice — once each direction).",
                  positive: "More stops or connections in the network.",
                },
              ].map(({ metric, simple, detail, positive }) => (
                <div key={metric} className="card" style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{metric}</div>
                  <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--muted)", marginBottom: 5 }}>"{simple}"</div>
                  <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, marginBottom: 4 }}>{detail}</div>
                  <div style={{ fontSize: 11, color: "#4ade80" }}>✓ Positive delta: {positive}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Exporting results">
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              Click <Tag>Export CSV</Tag> to download the full metrics report including the
              employment hub accessibility table. Run a simulation, export, adjust your proposal,
              run again, export — then compare the two files side by side.
            </div>
          </SubSection>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" title="FAQ">

          <FaqItem question="My proposed route looks good on the map but the metrics didn't improve. Why?">
            <p>A few common reasons:</p>
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li>Your new stops aren't within 0.25 miles of any employment hub, so no new workers become reachable.</li>
              <li>The area is already covered by another route — the hubs there were already accessible.</li>
              <li>The change added a transfer where trips were previously direct, which increased average travel time even if you added stops.</li>
            </ul>
            <p style={{ marginTop: 6 }}>Try turning on the 0.25-mile coverage overlay on the Map tab and look for employment hubs (stars) that don't have a stop ring overlapping them — those are the accessibility gaps worth targeting.</p>
          </FaqItem>

          <FaqItem question="What does the Transfer Penalty do?">
            <p>When a rider needs to switch from one route to another at a shared stop, the simulation
            adds extra minutes (default: 5) to represent waiting for the connecting bus. This means a
            slightly longer direct route often scores better than a technically shorter route that
            requires a transfer.</p>
            <p style={{ marginTop: 6 }}>You can adjust it in the Simulate tab. Lower it to model
            frequent, reliable connections. Raise it to model infrequent service where missing a
            connection is costly.</p>
          </FaqItem>

          <FaqItem question="What are the simulation's blind spots?">
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li><strong>No schedule or frequency</strong> — the model assumes a bus is always available. First/last trips, headways, and time gaps aren't modeled.</li>
              <li><strong>Constant speed</strong> — every segment uses the same average speed. No traffic, signals, or road type differences.</li>
              <li><strong>Straight-line walking</strong> — the 0.25-mile radius is crow-flies, not actual pedestrian paths.</li>
              <li><strong>Only counts employment hubs</strong> — grocery stores, clinics, schools, etc. aren't counted unless added to employment_hubs.csv.</li>
              <li><strong>No ridership prediction</strong> — adding a route doesn't estimate how many people will actually ride it. Use the Ridership tab to assess historical demand along a corridor.</li>
            </ul>
          </FaqItem>

          <FaqItem question="The charts are empty. What's wrong?">
            <p>Most likely the ridership data hasn't been imported yet. Go to the <strong>Import</strong> tab,
            upload your APC vendor CSV under "Avg Passenger Counts," then click <strong>↺ Refresh</strong> in
            the header. If data was just uploaded and charts still look empty, check that the
            <Tag>All time</Tag> pill is selected (not a month filter).</p>
          </FaqItem>

          <FaqItem question="I uploaded a file but the data looks wrong. Can I roll it back?">
            <p>Yes. Go to the <strong>Import</strong> tab, find the file type, and open the
            <strong> Backups</strong> section. Every import creates a timestamped backup. Click
            <Tag>Restore</Tag> next to the version you want to go back to.</p>
          </FaqItem>

          <FaqItem question="What's the difference between Merge and Replace when importing?">
            <p><strong>Merge</strong> adds new records on top of existing data, keyed by route/stop/month.
            If a record already exists for that key, it gets updated. If it's new, it gets added.
            Use this for routine monthly uploads.</p>
            <p style={{ marginTop: 6 }}><strong>Replace</strong> wipes all existing data for that dataset
            and loads the uploaded file from scratch. Use this only if you need to correct a previously
            imported month with a fully revised file.</p>
          </FaqItem>

        </Section>

      </div>
    </div>
  );
}
