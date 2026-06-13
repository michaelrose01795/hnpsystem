// file location: src/components/page-ui/job-cards/service-history/JobHistoryTree.js
// "Job tracking tree" section: a vertical timeline of the vehicle's jobs. Each
// node shows job number, appointment date, status, mileage and a single
// " | "-separated line of that job's requests. Clicking a node selects it,
// driving the SelectedJobDetail panel below.
//
// Layer alternation (CLAUDE.md §3.0): <LayerSurface> section → <LayerTheme>
// nodes. Selection is signalled with a box-shadow ring (not a border) so the
// Border Sweep law (§3.0a) is respected.

import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  DASH,
  formatMiles,
  formatText,
  joinRequests,
  statusBadgeClass,
} from "./historyFormat";

const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

const metaStyle = {
  fontSize: "0.8rem",
  color: "rgba(var(--text-1-rgb), 0.7)",
};

export default function JobHistoryTree({ history = [], selectedJobId, onSelect }) {
  if (!history.length) {
    return (
      <LayerSurface
        sectionKey="jobcard-service-history-tree"
        parentKey="jobcard-tab-service-history"
        gap="var(--space-4)"
      >
        <p style={eyebrowStyle}>Job history</p>
        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
          No previous service history for this vehicle.
        </p>
      </LayerSurface>
    );
  }

  return (
    <LayerSurface
      sectionKey="jobcard-service-history-tree"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>Job history</p>

      {/* Tree column: a continuous rule down the left, nodes hung off it. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {history.map((job) => {
          const requests = joinRequests(job);
          const isSelected = (job.id ?? job.jobNumber) === selectedJobId;
          return (
            <div
              key={job.id || job.jobNumber}
              style={{ display: "flex", alignItems: "stretch", gap: "var(--space-3)" }}
            >
              {/* Timeline rail + node dot. The rail is a 2px tinted strip, not a
                  decorative card border, so it sits outside the Border Sweep ban. */}
              <div
                style={{
                  position: "relative",
                  width: "12px",
                  flex: "0 0 12px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    background: "var(--theme-hover)",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "18px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "var(--radius-pill)",
                    background: isSelected ? "var(--accent-strong)" : "var(--theme-hover)",
                  }}
                />
              </div>

              <LayerTheme
                as="button"
                type="button"
                onClick={() => onSelect?.(job.id ?? job.jobNumber)}
                radius="var(--radius-sm)"
                padding="var(--space-4)"
                gap="var(--space-2)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  // Selection ring via box-shadow (allowed) — never a border.
                  boxShadow: isSelected ? "var(--focus-ring, 0 0 0 2px var(--accent-strong))" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accentText)" }}>
                    {formatText(job.jobNumber)}
                  </span>
                  <span className={`app-badge ${statusBadgeClass(job.status)}`}>
                    {formatText(job.status)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", ...metaStyle }}>
                  <span>{formatText(job.serviceDateFormatted)}</span>
                  <span>{formatMiles(job.mileage)}</span>
                </div>

                <div style={{ ...metaStyle, color: "var(--text-1)", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                  {requests.length ? requests.join(" | ") : DASH}
                </div>
              </LayerTheme>
            </div>
          );
        })}
      </div>
    </LayerSurface>
  );
}
