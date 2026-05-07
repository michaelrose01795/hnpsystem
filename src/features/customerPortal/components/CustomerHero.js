// file location: src/features/customerPortal/components/CustomerHero.js
import React from "react";

const heroTextStyle = { color: "var(--text-2)" };

function HeroFact({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(var(--text-2-rgb), 0.12)",
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.3em",
          color: "var(--text-2)",
          opacity: 0.85,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--text-2)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export default function CustomerHero({ nextVisit, lastUpdated }) {
  return (
    <section
      style={{
        background: "var(--primary)",
        color: "var(--text-2)",
        borderRadius: "var(--page-card-radius)",
        padding: "var(--section-card-padding)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.4em",
              color: "var(--text-2)",
            }}
          >
            Vehicle Health
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "var(--text-2)",
            }}
          >
            Stay close to your vehicle&apos;s progress
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "var(--text-2)",
              opacity: 0.92,
            }}
          >
            Approve work, review media, and keep in touch with the workshop. Every VHC update is
            synced with your booking so you know what happens next.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "var(--space-2)",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          }}
        >
          <HeroFact label="Next visit" value={nextVisit || "No visit scheduled"} />
          <HeroFact label="Last update" value={lastUpdated || "No recent updates"} />
        </div>
      </div>
    </section>
  );
}
