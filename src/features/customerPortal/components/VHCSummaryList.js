// file location: src/features/customerPortal/components/VHCSummaryList.js
import React from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

function StatPill({ label, value, tone = "default" }) {
  const colors = {
    danger: "var(--danger)",
    warning: "var(--warningMain)",
    default: "var(--text-1)",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "8px",
        padding: "10px 12px",
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: colors[tone] || colors.default,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: "0.75rem", color: "var(--text-1)" }}>{label}</span>
    </div>
  );
}

export default function VHCSummaryList({ summaries = [], vehicles = [] }) {
  const vehicleLookup = React.useMemo(
    () => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id || vehicle.reg, vehicle])),
    [vehicles]
  );

  return (
    <LayerSurface
      as="section"
      sectionKey="customer-vhc-summary-list"
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
            VHC status
          </p>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Vehicle health checks
          </h3>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
            background: "rgba(var(--text-2-rgb), 0.18)",
            color: "var(--text-2)",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          Connected to workshop
        </span>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {summaries.map((summary) => {
          const vehicle = vehicleLookup[summary.vehicleId];
          return (
            <LayerTheme
              key={summary.id}
              radius="var(--radius-md)"
              padding="var(--space-4)"
              gap="var(--space-3)"
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "var(--text-1)",
                    }}
                  >
                    {vehicle?.makeModel || "Vehicle"}
                    {vehicle?.reg ? ` • ${vehicle.reg}` : ""}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.75rem",
                      color: "var(--text-1)",
                      opacity: 0.75,
                    }}
                  >
                    Shared on {summary.createdAt} · {summary.status}
                  </p>
                </div>
                <Link
                  href={{
                    pathname: "/customer/vhc",
                    query: {
                      vehicle: vehicle?.reg || "",
                      job: summary.jobNumber || "",
                    },
                  }}
                  className="app-btn app-btn--secondary"
                >
                  View VHC
                </Link>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "var(--space-2)",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                }}
              >
                <StatPill
                  label="critical red items"
                  value={summary.redItems}
                  tone="danger"
                />
                <StatPill
                  label="amber advisories"
                  value={summary.amberItems}
                  tone="warning"
                />
                <StatPill label="photos & videos" value={summary.media} />
              </div>
            </LayerTheme>
          );
        })}
        {summaries.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-4) var(--space-3)",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-1)",
              background: "var(--theme)",
              borderRadius: "var(--radius-md)",
            }}
          >
            Your vehicle health checks will appear here once the workshop sends them to you.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
