// file location: src/components/VHC/mediaCapture/ConcernPickerModal.js
// Lightweight list modal shown after the user taps a section's camera
// button when more than one amber/red concern exists in the section.
// The user picks the concern they want the capture linked to, and the
// parent component then opens the camera with that concern attached.
//
// When exactly one concern exists the picker is bypassed entirely by
// the caller (SectionCameraButton), so this modal is only mounted in
// the "ambiguous" path.

import React from "react";
import VHCModalShell from "@/components/VHC/VHCModalShell";

const STATUS_BG = {
  red:   "rgba(var(--danger-rgb), 0.14)",
  amber: "rgba(var(--warning-rgb), 0.14)",
};

const STATUS_BORDER = {
  red:   "rgba(var(--danger-rgb), 0.55)",
  amber: "rgba(var(--warning-rgb), 0.55)",
};

const STATUS_LABEL = {
  red: "Red",
  amber: "Amber",
};

const STATUS_DOT = {
  red:   "var(--danger)",
  amber: "var(--warning)",
};

// Group concerns by their category so the list reads as "category → items"
// — matches how the data is stored server-side and how the user thinks
// about their reports inside each section modal.
function groupByCategory(concerns = []) {
  const buckets = new Map();
  concerns.forEach((concern) => {
    const key = concern.categoryLabel || concern.category || "";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(concern);
  });
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

export default function ConcernPickerModal({ isOpen, title = "Link capture to a concern", concerns = [], onPick, onClose }) {
  const groups = groupByCategory(concerns);

  return (
    <VHCModalShell
      isOpen={isOpen}
      title={title}
      subtitle={concerns.length > 0 ? `${concerns.length} concern${concerns.length === 1 ? "" : "s"} reported` : "No reported concerns"}
      width="540px"
      height="auto"
      adaptiveHeight
      onClose={onClose}
      sectionKey="concern-picker"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {groups.length === 0 ? (
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-light)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-body-sm)",
              textAlign: "center",
            }}
          >
            No amber or red concerns to link to yet.
          </div>
        ) : null}

        {groups.map((group) => (
          <section key={group.label || "__ungrouped"} style={{ display: "grid", gap: 4 }}>
            {group.label ? (
              <header
                style={{
                  fontSize: "var(--text-caption)",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  paddingLeft: "var(--space-xs)",
                }}
              >
                {group.label}
              </header>
            ) : null}

            {group.items.map((concern) => (
              <button
                key={concern.concernId}
                type="button"
                onClick={() => onPick?.(concern)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "12px 1fr auto",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${STATUS_BORDER[concern.status] || "var(--control-border-color)"}`,
                  background: STATUS_BG[concern.status] || "var(--surface)",
                  color: "var(--text-primary)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                  transition: "var(--control-transition)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "var(--radius-pill)",
                    background: STATUS_DOT[concern.status] || "var(--text-secondary)",
                  }}
                />
                <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: 700,
                      lineHeight: "var(--leading-tight)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {concern.label}
                  </span>
                  {concern.description ? (
                    <span
                      style={{
                        fontSize: "var(--text-caption)",
                        color: "var(--text-secondary)",
                        lineHeight: "var(--leading-tight)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {concern.description}
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: 800,
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-pill)",
                    background: STATUS_DOT[concern.status] || "var(--text-secondary)",
                    color: "var(--onAccentText)",
                    letterSpacing: "var(--tracking-caps)",
                    textTransform: "uppercase",
                  }}
                >
                  {STATUS_LABEL[concern.status] || concern.status}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </VHCModalShell>
  );
}
