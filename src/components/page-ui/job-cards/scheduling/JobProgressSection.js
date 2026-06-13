// file location: src/components/page-ui/job-cards/scheduling/JobProgressSection.js
// Scheduling dashboard → Job Progress.
// Circular progress ring showing "n / total requests complete" in the centre,
// with green / amber / red / grey arc segments, alongside a vertical legend.
// The ring is an SVG functional diagram primitive (CLAUDE.md §3.0a allowlist),
// not a card, so its strokes are permitted.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import useJobProgressBreakdown from "@/hooks/useJobProgressBreakdown";

const SIZE = 150;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function JobProgressSection({ jobData }) {
  const breakdown = useJobProgressBreakdown(jobData);
  const { total, complete, percentComplete, segments } = breakdown;

  // Build the accumulating arc offsets for each non-zero segment.
  let accumulated = 0;
  const arcs =
    total > 0
      ? segments
          .filter((seg) => seg.count > 0)
          .map((seg) => {
            const fraction = seg.count / total;
            const dash = fraction * CIRCUMFERENCE;
            const arc = {
              key: seg.key,
              token: seg.token,
              dasharray: `${dash} ${CIRCUMFERENCE - dash}`,
              dashoffset: -accumulated,
            };
            accumulated += dash;
            return arc;
          })
      : [];

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-progress"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "16px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Job Progress
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ring */}
        <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
            aria-label={`${complete} of ${total} requests complete`}>
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              {/* Base track */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="rgba(var(--grey-accent-rgb), 0.22)"
                strokeWidth={STROKE}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.token}
                  strokeWidth={STROKE}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                />
              ))}
            </g>
          </svg>
          {/* Centre label */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
              {complete}/{total}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-1)", opacity: 0.6, marginTop: "2px" }}>
              requests complete
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--success)", marginTop: "2px" }}>
              {percentComplete}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "150px", flex: "1 1 150px" }}>
          {segments.map((seg) => (
            <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "var(--radius-pill)",
                  background: seg.token,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)", minWidth: "18px" }}>
                {seg.count}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.75 }}>
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </LayerSurface>
  );
}
