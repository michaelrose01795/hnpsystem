// file location: src/components/StatusTracking/SmartSummaryBlock.js
// Renders the Smart Summary panel above the Job Progress Tracker timeline.
// Shows current stage, latest update, technician, tracking, wash, invoice status,
// responsible party, job story, next likely step, attention items, and blocking reasons.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

// Inline style constants using CSS variables for consistency with the tracker.
const STYLES = {
  container: {
    display: "flex",
    flexDirection: "column",
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
    gap: "6px",
    color: color || "var(--info)",
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
    color: "var(--text-1, var(--grey-accent))",
    fontWeight: 500,
  },
  infoGrid: {
    display: "grid",
    gap: "6px",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--text-1, var(--info-dark))",
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
    color: "var(--text-1, var(--info-dark))",
  },
  nextStepCard: {
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
    color: "var(--text-1, var(--info-dark))",
  },
  nextStepDescription: {
    fontSize: "12px",
    color: "var(--grey-accent)",
    lineHeight: 1.4,
  },
  jobStory: {
    fontSize: "13px",
    color: "var(--text-1, var(--info-dark))",
    lineHeight: 1.5,
  },
  summarySentence: {
    fontSize: "12px",
    color: "var(--text-1, var(--grey-accent))",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  blockingBanner: {
    backgroundColor: "rgba(var(--danger-rgb, 220, 38, 38), 0.08)", // Danger-tinted background
    borderRadius: "var(--radius-xs)",
    padding: "8px 12px",
    fontSize: "12px",
    color: "var(--danger)",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  attentionBanner: {
    backgroundColor: "rgba(var(--warning-rgb, 245, 158, 11), 0.08)", // Warning-tinted background
    borderRadius: "var(--radius-xs)",
    padding: "8px 12px",
    fontSize: "12px",
    color: "var(--warning-dark, var(--warning))",
    fontWeight: 500,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  attentionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  attentionIcon: {
    fontSize: "12px",
    flexShrink: 0,
    marginTop: "1px",
  },
  confidenceBadge: () => ({
    marginLeft: "6px",
  }),
};

export default function SmartSummaryBlock({ summary, isCompact = false, isWide = false, flags = {} }) {
  if (!summary) return null; // Nothing to render without summary data

  const gridColumns = isCompact ? "1fr" : isWide ? "1fr 1fr" : "1fr"; // Responsive grid columns
  const showConfidence = flags.debug_mode_enabled || flags.confidence_display_enabled; // Show confidence badges

  return (
    <LayerTheme radius="var(--radius-sm)" padding="14px 16px" gap="10px" style={STYLES.container}>
      {/* Header row: label + stage badge */}
      <div style={STYLES.header}>
        <span style={STYLES.headerLabel}>Smart Summary</span>
        <span className="app-badge app-badge--control app-badge--accent-soft" style={STYLES.stageBadge(summary.stageColor)}>
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

      {/* Info grid: technician, tracking, wash, invoice, responsible */}
      <div style={{ ...STYLES.infoGrid, gridTemplateColumns: gridColumns }}>
        {summary.technician && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Tech</span>
            <span style={STYLES.infoValue}>{summary.technician}</span>
          </div>
        )}
        {summary.currentResponsible && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Owner</span>
            <span style={STYLES.infoValue}>{summary.currentResponsible}</span>
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
        {summary.invoiceStatus && summary.invoiceStatus !== "missing" && (
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Invoice</span>
            <span style={STYLES.infoValue}>{summary.invoiceStatus}</span>
          </div>
        )}
      </div>

      {/* Next steps — render all pending steps when multiple exist */}
      {((summary.nextSteps && summary.nextSteps.length > 0) || summary.nextStep) && (() => {
        const steps = summary.nextSteps && summary.nextSteps.length > 0
          ? summary.nextSteps
          : summary.nextStep ? [summary.nextStep] : [];
        if (steps.length === 0) return null;
        const multiStep = steps.length > 1;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {steps.map((step, index) => (
              <LayerSurface key={step.label || index} radius="var(--radius-xs)" padding="10px 12px" gap="2px" style={STYLES.nextStepCard}>
                <span style={STYLES.nextStepLabel}>
                  {multiStep ? `Next Step ${index + 1}` : "Next Step"}
                  {step.department && (
                    <span style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: "var(--grey-accent)",
                      marginLeft: "8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}>
                      {step.department}
                    </span>
                  )}
                  {!multiStep && showConfidence && summary.nextStepConfidence && (
                    <span className={`app-badge ${
                      summary.nextStepConfidence === "high" ? "app-badge--success" : summary.nextStepConfidence === "medium" ? "app-badge--warning" : "app-badge--danger"
                    }`} style={STYLES.confidenceBadge(summary.nextStepConfidence)}>
                      {summary.nextStepConfidence}
                    </span>
                  )}
                </span>
                <span style={STYLES.nextStepTitle}>{step.label}</span>
                {step.description && (
                  <span style={STYLES.nextStepDescription}>{step.description}</span>
                )}
              </LayerSurface>
            ))}
          </div>
        );
      })()}

      {/* Job story — natural-language narrative */}
      {summary.jobStory && (
        <div style={STYLES.jobStory}>{summary.jobStory}</div>
      )}

      {/* Summary sentence — template-generated overview */}
      {summary.summary && (
        <div style={STYLES.summarySentence}>
          {summary.summary}
          {showConfidence && summary.summaryConfidence && (
            <span className={`app-badge ${
              summary.summaryConfidence === "high" ? "app-badge--success" : summary.summaryConfidence === "medium" ? "app-badge--warning" : "app-badge--danger"
            }`} style={STYLES.confidenceBadge(summary.summaryConfidence)}>
              {summary.summaryConfidence}
            </span>
          )}
        </div>
      )}

      {/* Attention items banner — anomaly detection results */}
      {summary.attentionItems && summary.attentionItems.length > 0 && (
        <div style={STYLES.attentionBanner}>
          <span style={{ fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Attention Needed
          </span>
          {summary.attentionItems.map((item, index) => (
            <div key={item.code || index} style={STYLES.attentionItem}>
              <span style={STYLES.attentionIcon}>
                {item.severity === "warning" ? "⚠" : "ℹ"}
              </span>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Blocking reasons banner */}
      {summary.blockingReasons && summary.blockingReasons.length > 0 && (
        <div style={STYLES.blockingBanner}>
          {summary.blockingReasons.map((reason, index) => (
            <span key={reason.code || index}>{reason.message}</span>
          ))}
        </div>
      )}
    </LayerTheme>
  );
}
