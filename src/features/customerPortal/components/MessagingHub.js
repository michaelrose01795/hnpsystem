// file location: src/features/customerPortal/components/MessagingHub.js
import React from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function MessagingHub({ contacts = [] }) {
  return (
    <LayerSurface
      as="section"
      sectionKey="customer-messaging-hub"
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
            Message centre
          </p>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Talk to the right team
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
          Linked to your job
        </span>
      </header>

      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        }}
      >
        {contacts.map((contact) => (
          <LayerTheme
            key={contact.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-2)"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-1)",
                }}
              >
                {contact.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--text-1)",
                  opacity: 0.75,
                }}
              >
                {contact.name}
              </p>
            </div>
            <Link
              href={{
                pathname: "/customer/messages",
                query: {
                  contact: contact.id,
                  subject: `Message ${contact.label}`,
                },
              }}
              className="app-btn app-btn--primary"
              style={{ alignSelf: "flex-start" }}
            >
              Message
            </Link>
          </LayerTheme>
        ))}
        {contacts.length === 0 && (
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
            Select a job card or VHC to start a conversation with the team.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
