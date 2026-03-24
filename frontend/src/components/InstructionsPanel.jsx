import React, { useState } from "react";

const SECTIONS = [
  { id: "overview",   label: "Overview" },
  { id: "map",        label: "Map Tab" },
  { id: "simulate",   label: "Simulate Tab" },
  { id: "metrics",    label: "Metrics Tab" },
  { id: "ridership",  label: "Ridership Tab" },
  { id: "upload",     label: "Uploading Data" },
  { id: "params",     label: "Simulation Parameters" },
  { id: "csvschema",  label: "CSV Schemas" },
  { id: "faq",        label: "FAQ" },
];

function Section({ id, title, children }) {
  return (
    <div id={id} style={{ marginBottom: 36 }}>
      <div style={{
        fontSize: 17, fontWeight: 700, color: "var(--accent)",
        borderBottom: "2px solid var(--border)", paddingBottom: 8, marginBottom: 16,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
        background: "var(--accent)", color: "#001830",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700,
      }}>
        {n}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, paddingTop: 3 }}>
        {children}
      </div>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      background: "rgba(230,201,40,0.08)", border: "1px solid rgba(230,201,40,0.25)",
      borderRadius: "var(--radius)", padding: "10px 14px",
      fontSize: 12, color: "var(--text)", lineHeight: 1.6, marginTop: 8,
    }}>
      <span style={{ color: "var(--accent)", fontWeight: 700 }}>Tip: </span>
      {children}
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      background: "rgba(55,136,216,0.08)", border: "1px solid rgba(55,136,216,0.25)",
      borderRadius: "var(--radius)", padding: "10px 14px",
      fontSize: 12, color: "var(--text)", lineHeight: 1.6, marginTop: 8,
    }}>
      <span style={{ color: "var(--accent2)", fontWeight: 700 }}>Note: </span>
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

function FaqItem({ question, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12,
    }}>
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
        <div style={{
          fontSize: 12, color: "var(--muted)", lineHeight: 1.8,
          paddingTop: 8, paddingLeft: 4,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SchemaTable({ columns }) {
  return (
    <table style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th>Column</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {columns.map(([col, type, desc]) => (
          <tr key={col}>
            <td><code style={{ fontSize: 11, color: "var(--accent)" }}>{col}</code></td>
            <td style={{ color: "var(--muted)", fontSize: 11 }}>{type}</td>
            <td style={{ fontSize: 12 }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParamTable({ rows }) {
  return (
    <table style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Default</th>
          <th>What it controls</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([param, def, desc]) => (
          <tr key={param}>
            <td style={{ fontWeight: 600, fontSize: 12 }}>{param}</td>
            <td><Tag>{def}</Tag></td>
            <td style={{ fontSize: 12 }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function InstructionsPanel() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Sidebar TOC */}
      <div style={{
        width: 200, flexShrink: 0, padding: "20px 12px",
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

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 40px", maxWidth: 860 }}>

        {/* ── Overview ── */}
        <Section id="overview" title="Overview">
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.8, marginBottom: 12 }}>
            The <strong>SunTran Transit Simulation Tool</strong> is a research platform for analyzing
            the SunTran bus network in St. George, Utah. It lets you visualize existing routes,
            propose changes, and measure how those changes affect rider access to employment hubs
            and essential destinations — all without touching the live system.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            {[
              ["Map", "Visualize routes, stops, coverage, and employment hubs on an interactive map."],
              ["Simulate", "Propose new or modified routes and preview their network impact."],
              ["Metrics", "Compare accessibility statistics between the current and proposed network."],
              ["Ridership", "Explore historical boarding data by stop, route, day, and month."],
            ].map(([tab, desc]) => (
              <div key={tab} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>{tab}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Map Tab ── */}
        <Section id="map" title="Map Tab">
          <SubSection title="Map elements">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Blue circles", "Bus stops. Size reflects relative boarding volume when ridership data is loaded."],
                ["Colored lines", "Bus routes. Each route has a distinct color matching the legend."],
                ["Star markers", "Employment hubs — hospitals, universities, major employers."],
                ["Shaded circles", "0.25-mile walking-radius coverage around each stop (toggle on/off)."],
              ].map(([label, desc]) => (
                <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent2)", minWidth: 120, flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Controls">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <Tag>Toggle Coverage</Tag> — shows or hides the 0.25-mile walking circles around every stop.
                Use this to identify neighborhoods that lack transit access.
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                Proposed routes (built in the Simulate tab) appear as <strong>dashed lines</strong> overlaid
                on the current network so you can compare them side-by-side.
              </div>
            </div>
          </SubSection>

          <Tip>Click any stop marker to see its Stop ID and name. This ID is what you'll use when building proposed routes.</Tip>
        </Section>

        {/* ── Simulate Tab ── */}
        <Section id="simulate" title="Simulate Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            The Simulate tab is the core research workflow. It has two panels: the left panel manages
            the network and lets you propose routes; the right panel runs the full simulation and
            shows a live map preview.
          </p>

          <SubSection title="Proposing a route change">
            <Step n={1}>In the <strong>left panel</strong>, find the route you want to modify and click <Tag>Edit</Tag>, or click <Tag>+ Add Route</Tag> to create a new one.</Step>
            <Step n={2}>Use the stop selector to build an ordered list of stops. You can add stops from the dropdown, drag to reorder, or remove them by clicking the × tag.</Step>
            <Step n={3}>Click <Tag>Simulate This Route</Tag> to stage the proposal. The map will immediately preview the new path.</Step>
            <Step n={4}>Repeat for additional routes if you want to test a multi-route scenario.</Step>
            <Step n={5}>When ready, click <Tag>Run Full Simulation</Tag>. Results appear in the <strong>Metrics</strong> tab automatically.</Step>
          </SubSection>

          <SubSection title="Adding custom stops">
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              If your proposed route needs a stop that doesn't exist yet, use the <strong>Custom Stops</strong>
              section to enter a latitude/longitude and give it a temporary ID. Custom stops are only
              used for the simulation — they are not saved to the database.
            </div>
          </SubSection>

          <SubSection title="Editing and deleting existing routes">
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              The <strong>Routes</strong> list shows all current routes. Edit permanently updates the
              route in the database (and writes it to <code>routes.csv</code>). Delete requires a
              confirmation click to prevent accidents. Use the <Tag>↩ Undo</Tag> button in the
              header to reverse the last add, edit, or delete.
            </div>
          </SubSection>

          <Note>Simulating a route does not change the live network. It only stages a proposal for comparison. Permanent changes require using Edit/Save in the Routes panel.</Note>
        </Section>

        {/* ── Metrics Tab ── */}
        <Section id="metrics" title="Metrics Tab">
          <SubSection title="Baseline metrics">
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              When no simulation has been run, the Metrics tab shows the <strong>current network</strong>:
              total stops, accessible employment hubs, reachable workers, and average travel time
              across all stop pairs.
            </div>
          </SubSection>

          <SubSection title="Simulation comparison">
            <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
              After running a simulation, the tab shows a side-by-side comparison:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Accessible hubs", "Number of employment hubs reachable within the travel time limit."],
                ["Reachable workers", "Sum of estimated_workers for all reachable hubs."],
                ["Avg travel time", "Mean shortest-path travel time across all reachable stop pairs."],
                ["Delta indicators", "Green = improvement, red = regression vs the current network."],
              ].map(([label, desc]) => (
                <div key={label} style={{ display: "flex", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, minWidth: 150, flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Exporting results">
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              Click <Tag>Export CSV</Tag> to download a spreadsheet of the current metrics report,
              including the employment hub accessibility table and per-route performance data.
              This is the primary way to share findings with stakeholders or include data in a paper.
            </div>
          </SubSection>

          <Tip>Run multiple simulations (tweaking parameters each time) and export the CSV after each one to build a comparison table in Excel or Google Sheets.</Tip>
        </Section>

        {/* ── Ridership Tab ── */}
        <Section id="ridership" title="Ridership Tab">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            The Ridership tab visualizes historical boarding data loaded from the boardings CSV files.
            Use it to understand current demand patterns before proposing changes.
          </p>

          <SubSection title="Chart views">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["By Stop", "Total boardings per stop across all routes. Identifies the busiest stops."],
                ["By Route", "Total boardings per route. Shows which routes carry the most riders."],
                ["By Day of Week", "Ridership broken down by day — useful for understanding weekday vs weekend demand."],
                ["By Month", "Monthly trends — useful for seasonal analysis."],
                ["Route × Day", "Heatmap of each route's ridership by day of week."],
                ["Route × Month", "Heatmap of each route's ridership by month."],
              ].map(([view, desc]) => (
                <div key={view} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Tag>{view}</Tag>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </SubSection>

          <Note>Ridership data reflects historical actuals. If you've uploaded new boardings CSVs, click ↺ Refresh in the header to reload the charts.</Note>
        </Section>

        {/* ── Upload Data ── */}
        <Section id="upload" title="Uploading Data">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 16 }}>
            All four core datasets can be replaced via the <strong>Upload Data</strong> section in the
            Simulate tab. The backend validates the CSV structure before accepting it — you'll see a
            specific error message if required columns are missing.
          </p>

          <SubSection title="How to upload">
            <Step n={1}>Go to the <strong>Simulate</strong> tab. The Upload Data panel is at the top-left.</Step>
            <Step n={2}>Click <Tag>Upload</Tag> next to the file type you want to replace.</Step>
            <Step n={3}>Select a <code>.csv</code> file from your computer.</Step>
            <Step n={4}>Wait for the <Tag color="rgba(34,197,94,0.15)">✓ Uploaded</Tag> confirmation. If the file has schema errors, a red message explains what's wrong.</Step>
            <Step n={5}>The app automatically refreshes all data after a successful upload.</Step>
          </SubSection>

          <Tip>Uploading a new file <strong>replaces</strong> the existing data entirely. There is no merge. Make sure your file contains all the rows you want, not just new additions.</Tip>

          <Note>Uploading a new routes.csv or stops.csv clears the undo history since the entire dataset changes.</Note>
        </Section>

        {/* ── Simulation Parameters ── */}
        <Section id="params" title="Simulation Parameters">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 12 }}>
            These parameters are configurable in the Simulate tab before running a full simulation.
            They affect both the current and proposed network calculations so the comparison remains fair.
          </p>
          <ParamTable rows={[
            ["Average speed", "15 mph", "Bus travel speed used to convert distances to travel times. Increase for express routes, decrease for stop-and-go traffic."],
            ["Dwell time", "0.5 min", "Time added at each stop for passenger boarding/alighting. Increase for busy stops or accessibility-focused service."],
            ["Transfer penalty", "5 min", "Extra minutes added when a rider must switch routes at a shared stop. Reflects wait time for the connecting bus."],
            ["Walking radius", "0.25 mi", "Maximum distance a rider will walk from their origin to a stop, or from a stop to an employment hub."],
            ["Travel time limit", "30 min", "A hub is considered 'accessible' only if it can be reached within this many minutes from at least one stop."],
          ]} />
          <Tip>To model a scenario where SunTran improves on-time performance, lower the transfer penalty. To model a less walkable community, reduce the walking radius.</Tip>
        </Section>

        {/* ── CSV Schemas ── */}
        <Section id="csvschema" title="CSV Schemas">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
            The following column definitions are required. Extra columns are ignored. Column names are case-sensitive.
          </p>

          <SubSection title="stops.csv">
            <SchemaTable columns={[
              ["stop_id",   "string",  "Unique identifier, e.g. S001. Used to reference stops in routes.csv."],
              ["stop_name", "string",  "Human-readable name shown in the UI and map tooltips."],
              ["latitude",  "decimal", "WGS84 latitude, e.g. 37.10423."],
              ["longitude", "decimal", "WGS84 longitude, e.g. -113.56789. Must be negative for Utah."],
            ]} />
          </SubSection>

          <SubSection title="routes.csv">
            <SchemaTable columns={[
              ["route_id",   "string",  "Unique identifier, e.g. R1."],
              ["route_name", "string",  "Display name, e.g. Red Rock Corridor."],
              ["color",      "string",  "Hex color for the map polyline, e.g. #e74c3c. Optional — defaults to #3388ff."],
              ["stop_ids",   "string",  "Pipe-separated list of stop_ids in route order, e.g. S001|S012|S045."],
            ]} />
            <Note>Stop order in stop_ids determines the direction of travel. Bidirectional service is modeled automatically.</Note>
          </SubSection>

          <SubSection title="employment_hubs.csv">
            <SchemaTable columns={[
              ["hub_name",          "string",  "Name of the employer or destination, e.g. Dixie State University."],
              ["latitude",          "decimal", "WGS84 latitude of the hub entrance or centroid."],
              ["longitude",         "decimal", "WGS84 longitude."],
              ["estimated_workers", "integer", "Number of employees or daily visitors — used to weight accessibility impact."],
            ]} />
          </SubSection>

          <SubSection title="ridership.csv">
            <SchemaTable columns={[
              ["route_id",         "string",  "Matches a route_id from routes.csv."],
              ["stop_id",          "string",  "Matches a stop_id from stops.csv."],
              ["hour",             "integer", "Hour of day (0–23) in 24-hour format."],
              ["hourly_boardings", "integer", "Number of passengers boarding at this stop in this hour."],
              ["hourly_alightings","integer", "Number of passengers alighting at this stop in this hour."],
            ]} />
          </SubSection>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" title="FAQ — Understanding the Simulation Results">
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
            When you run a simulation the Metrics tab shows a <strong>current</strong> value,
            a <strong>proposed</strong> value, and a <strong>delta</strong> (the difference).
            A green delta is an improvement; red is a regression. Click each question below to learn
            exactly what is being measured.
          </p>

          <FaqItem question="What does Total Stops mean, and what does a +/− delta tell me?">
            <p>This is simply the number of physical bus stops in the network graph. Each unique stop
            ID counts as one node.</p>
            <p style={{ marginTop: 6 }}>
              <strong>+ delta</strong> — your proposed route introduces stops that didn't previously exist
              (e.g. you added custom stops or a new route that passes through new locations).<br />
              <strong>− delta</strong> — stops were removed because a route was deleted or shortened and
              those stops are no longer served by any route.
            </p>
            <p style={{ marginTop: 6 }}>A stop count change alone is neither good nor bad — what matters
            is whether those new stops improve hub accessibility and travel time.</p>
          </FaqItem>

          <FaqItem question="What is a Route Segment / Total Edges?">
            <p>A <strong>route segment</strong> is the direct connection between two consecutive stops
            on a route. For example, a route with 4 stops (A → B → C → D) has 3 segments.</p>
            <p style={{ marginTop: 6 }}>Because the simulation models bus travel as <strong>bidirectional</strong>
            (buses run both ways), each segment is stored as two directed edges in the network graph.
            So 3 physical segments = 6 edges in the count.</p>
            <p style={{ marginTop: 6 }}>
              <strong>+ delta</strong> — more segments means more direct connections between stops.<br />
              <strong>− delta</strong> — a route was shortened or removed, reducing the number of
              connections in the network.
            </p>
            <p style={{ marginTop: 6 }}>A high edge count alone doesn't mean better service — a long
            route in a low-demand area adds many edges but may not improve hub accessibility at all.</p>
          </FaqItem>

          <FaqItem question="What does Average Travel Time mean, and why is a negative delta good?">
            <p>The simulation calculates the <strong>shortest travel time</strong> between every possible
            pair of stops in the network using Dijkstra's algorithm. Average Travel Time is the mean of
            all those shortest paths, in minutes.</p>
            <p style={{ marginTop: 6 }}>Travel time between two stops is based on:</p>
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li>Straight-line distance between stops (via haversine formula)</li>
              <li>Divided by average bus speed (default 15 mph)</li>
              <li>Plus 0.5 minutes dwell time at each stop</li>
              <li>Plus 5 minutes if the rider must transfer to a different route</li>
            </ul>
            <p style={{ marginTop: 6 }}>
              <strong>− delta (green)</strong> — the proposed network gets riders to destinations
              faster on average. This is what you want.<br />
              <strong>+ delta (red)</strong> — the change made the average trip longer. This could mean
              a direct route was replaced by a less efficient one, or transfers were added.
            </p>
            <p style={{ marginTop: 6 }}>This is the most meaningful single metric for evaluating
            rider experience.</p>
          </FaqItem>

          <FaqItem question="What does Accessible Hubs mean?">
            <p>An employment hub (hospital, university, major employer) is considered
            <strong> accessible</strong> if two conditions are met:</p>
            <ol style={{ paddingLeft: 18, marginTop: 4 }}>
              <li>There is at least one bus stop within <strong>0.25 miles walking distance</strong> of
              the hub's entrance.</li>
              <li>At least one other stop in the network can reach that hub stop within the
              <strong> travel time limit</strong> (default 30 minutes).</li>
            </ol>
            <p style={{ marginTop: 6 }}>
              <strong>+ delta</strong> — your proposed route opened up transit access to an employer
              that was previously unreachable or too far.<br />
              <strong>− delta</strong> — a route change removed the only bus path to a hub within
              the time limit. This is a serious equity concern.
            </p>
          </FaqItem>

          <FaqItem question="What does Reachable Workers mean?">
            <p>This is the total number of workers across all <strong>accessible</strong> employment hubs.
            Each hub in <code>employment_hubs.csv</code> has an <code>estimated_workers</code> field.
            This metric sums those values for every hub that passes the accessibility test above.</p>
            <p style={{ marginTop: 6 }}>
              <strong>+ delta</strong> — more workers now have at least one bus stop they can use to
              reach their workplace within 30 minutes. This is the headline equity metric.<br />
              <strong>− delta</strong> — a route change cut off access to a major employer. Even a
              small route tweak can cause a large negative number here if it affects a hub with
              thousands of workers.
            </p>
            <p style={{ marginTop: 6 }}>Example: if Intermountain Health has 3,200 estimated workers
            and your proposed route is the only one that can reach it within 30 minutes — removing
            that route drops Reachable Workers by 3,200 instantly.</p>
          </FaqItem>

          <FaqItem question="What is a Transfer Penalty and how does it affect results?">
            <p>When the shortest path between two stops requires switching from one route to another
            at a shared stop, the simulation adds a <strong>transfer penalty</strong> (default 5 minutes)
            to that trip's total travel time.</p>
            <p style={{ marginTop: 6 }}>This represents the real-world wait time for the connecting bus.
            It means a direct route — even if slightly longer in distance — will often score better than
            a faster route that requires a transfer.</p>
            <p style={{ marginTop: 6 }}>You can adjust this in <strong>Simulation Parameters</strong>.
            Lowering it models a system with frequent, reliable connections. Raising it to 10–15 minutes
            models infrequent service where missed connections are costly.</p>
          </FaqItem>

          <FaqItem question="Why might my proposed route show no improvement even though it added stops?">
            <p>Several reasons this can happen:</p>
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li>The new stops are not within 0.25 miles of any employment hub — so they don't
              help hub accessibility.</li>
              <li>The new stops are in an area already covered by another route — no new workers
              become reachable.</li>
              <li>The route added a transfer requirement for trips that were previously direct,
              increasing average travel time.</li>
              <li>The employment hub nearest to your new stops already had no bus stop within
              walking range — the hub is simply too far off any route.</li>
            </ul>
            <p style={{ marginTop: 6 }}>Check the <strong>Employment Hub Access</strong> table in the
            Metrics tab to see which specific hubs are and aren't accessible, and use the Map tab to
            visually inspect walking-radius coverage around those hubs.</p>
          </FaqItem>

          <FaqItem question="What are the limitations of the simulation model?">
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li><strong>No schedules or frequency</strong> — the model assumes a bus is always available.
              It does not account for headway, time of day, or first/last trip.</li>
              <li><strong>Speed is constant</strong> — all route segments use the same average speed.
              There is no traffic modeling.</li>
              <li><strong>Walking is crow-flies</strong> — the 0.25-mile walking radius uses straight-line
              distance, not actual walkable paths.</li>
              <li><strong>Employment hubs only</strong> — accessibility is measured only to hubs in
              your <code>employment_hubs.csv</code>. Grocery stores, clinics, schools, etc. are not
              counted unless added to that file.</li>
              <li><strong>No demand modeling</strong> — adding a route doesn't predict how many people
              will actually ride it. Use the Ridership tab's Demand Forecast for that estimate.</li>
            </ul>
          </FaqItem>
        </Section>

      </div>
    </div>
  );
}
