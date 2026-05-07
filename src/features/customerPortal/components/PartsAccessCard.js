// file location: src/features/customerPortal/components/PartsAccessCard.js
import React from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function PartsAccessCard({ parts = [] }) {
  return (
    <LayerSurface
      as="section"
      sectionKey="customer-parts-access"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "var(--text-2)",
              opacity: 0.9,
            }}
          >
            Parts &amp; accessories
          </p>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Compatible with my cars
          </h3>
        </div>
        <Link
          href="/customer/parts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "var(--radius-pill)",
            background: "rgba(var(--text-2-rgb), 0.18)",
            color: "var(--text-2)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Browse catalogue
        </Link>
      </header>

      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        {parts.map((part) => (
          <LayerTheme
            key={part.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-2)"
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-1)",
                  flex: "1 1 auto",
                  minWidth: 0,
                }}
              >
                {part.title}
              </p>
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-accent)",
                }}
              >
                {part.price}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "0.7rem",
                color: "var(--text-1)",
                opacity: 0.75,
              }}
            >
              Applies to: {part.appliesTo.join(", ")}
            </p>
            <div
              style={{
                marginTop: "var(--space-2)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span className="app-badge app-badge--accent-soft">
                {part.availability}
              </span>
              <Link
                href={{
                  pathname: "/customer/messages",
                  query: {
                    subject: `Quote request: ${part.title}`,
                    partId: part.id,
                  },
                }}
                className="app-btn app-btn--secondary"
              >
                Request quote
              </Link>
            </div>
          </LayerTheme>
        ))}
        {parts.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-4) var(--space-3)",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-1)",
              background: "var(--theme)",
              borderRadius: "var(--radius-md)",
              gridColumn: "1 / -1",
            }}
          >
            We will load compatible parts once your vehicle is connected to the portal.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
