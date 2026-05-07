// file location: src/features/customerPortal/components/AppointmentTimeline.js
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function AppointmentTimeline({ events = [] }) {
  return (
    <LayerSurface
      as="section"
      sectionKey="customer-appointment-timeline"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
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
          Booking timeline
        </p>
        <h3
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          What&apos;s happened so far
        </h3>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {events.map((event) => (
          <LayerTheme
            key={event.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-1)"
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-1)",
                }}
              >
                {event.label}
              </p>
              <span className="app-badge app-badge--accent-soft">{event.timestamp}</span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "var(--text-1)",
                opacity: 0.85,
              }}
            >
              {event.description}
            </p>
          </LayerTheme>
        ))}
        {events.length === 0 && (
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
            Your booking history will appear here once we start working on your car.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
