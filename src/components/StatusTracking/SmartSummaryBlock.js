// file location: src/components/StatusTracking/SmartSummaryBlock.js
// Renders the Smart Summary panel above the Job Progress Tracker timeline.
// Shows current stage, latest update, technician, tracking, wash status,
// next likely step, summary sentence, and blocking reasons.

import React from "react";

// Inline style constants using CSS variables for consistency with the tracker.
const STYLES = {
  container: {
    backgroundColor: "var(--surface)", // Match tracker card background
    borderRadius: "var(--radius-sm)", // Consistent border radius
    border: "1px solid var(--border)", // Subtle border
    padding: "14px 16px", // Comfortable internal spacing
    display: "flex",
    flexDirection: "column",
    gap: "12px", // Spacing between summary sections
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  headerLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--accent-purple)", // Accent colour for the section label
  },
  stageBadge: (color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: color || "var(--info)",
    backgroundColor: "var(--surface-light)",
    borderRadius: "var(--radius-pill)",
    padding: "4px 12px",
  }),
  stageDot: (color) => ({
    width: "8px",
    height: "8px",
    borderRadius: "var(--radius-full)",
    backgroundColor: color || "var(--info)",
    flexShrink: 0,
  }),
  latestUpdate: {
    fontSize: "12px",
    color: "var(--text-secondary, var(--grey-accent))",
    fontWeight: 500,
  },
  infoGrid: {
    display: "grid",
    gap: "8px",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--text-primary, var(--info-dark))",
  },
  infoLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--grey-accent)",
    minWidth: "72px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  infoValue: {
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-primary, var(--info-dark))",
  },
  nextStepCard: {
    borderLeft: "3px solid var(--accent-purple)", // Accent left border for emphasis
    backgroundColor: "var(--surface-light)",
    borderRadius: "0 var(--radius-xs) var(--radius-xs) 0",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  nextStepLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--accent-purple)",
  },
  nextStepTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary, var(--info-dark))",
  },
  nextStepDescription: {
    fontSize: "12px",
    color: "var(--grey-accent)",
    lineHeight: 1.4,
  },
  summarySentence: {
    fontSize: "13px",
    color: "var(--text-secondary, var(--grey-accent))",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  blockingBanner: {
    backgroundColor: "rgba(var(--danger-rgb, 220, 38, 38), 0.08)", // Danger-tinted background
    border: "1px solid rgba(var(--danger-rgb, 220, 38, 38), 0.2)",
    borderRadius: "var(--radius-xs)",
    padding: "8px 12px",
    fontSize: "12px",
    color: "var(--danger)",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
};

export default function SmartSummaryBlock({ summary, isCompact = false, isWide = false }) {
  if (!summary) return null; // Nothing to render without summary data

  const gridColumns = isCompact ? "1fr" : isWide ? "1fr 1fr" : "1fr"; // Responsive grid columns

  return (
    <div style={STYLES.container}>
      {/* Header row: label + stage badge */}
      <div style={STYLES.header}>
        <span style={STYLES.headerLabel}>Smart Summary</span>
        <span style={STYLES.stageBadge(summary.stageColor)}>
          <span style={STYLES.stageDot(summary.stageColor)} />
          {summary.stage}
        </span>
      </div>

      {/* Latest update line */}
      {summary.latestUpdate && (
        <div style={STYLES.latestUpdate}>
          Latest: {summary.latestUpdate}
        </div>
      )}

      {/* Info grid: technician, tracking, wash */}
      <div style={{ ...STYLES.infoGrid, gridTemplateColumns: gridColumns }}>
        {summary.technician && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Tech</span>
            <span style={STYLES.infoValue}>{summary.technician}</span>
          </div>
        )}
        {summary.trackingStatus && summary.trackingStatus !== "Not tracked" && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Tracking</span>
            <span style={STYLES.infoValue}>{summary.trackingStatus}</span>
          </div>
        )}
        {summary.washStatus && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Wash</span>
            <span style={STYLES.infoValue}>{summary.washStatus}</span>
          </div>
        )}
      </div>

      {/* Next likely step card */}
      {summary.nextStep && (
        <div style={STYLES.nextStepCard}>
          <span style={STYLES.nextStepLabel}>Next Step</span>
          <span style={STYLES.nextStepTitle}>{summary.nextStep.label}</span>
          {summary.nextStep.description && (
            <span style={STYLES.nextStepDescription}>{summary.nextStep.description}</span>
          )}
        </div>
      )}

      {/* Plain-English summary sentence */}
      {summary.summary && (
        <div style={STYLES.summarySentence}>{summary.summary}</div>
      )}

      {/* Blocking reasons banner */}
      {summary.blockingReasons && summary.blockingReasons.length > 0 && (
        <div style={STYLES.blockingBanner}>
          {summary.blockingReasons.map((reason, index) => (
            <span key={reason.code || index}>{reason.message}</span>
          ))}
        </div>
      )}
    </div>
  );
}
