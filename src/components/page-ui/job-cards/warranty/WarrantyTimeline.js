// file location: src/components/page-ui/job-cards/warranty/WarrantyTimeline.js
// Warranty claim timeline: created → authorisation requested → authorised → work
// completed → claim submitted → claim paid. Each stage is driven by a real
// timestamp on the warranty_claims row. The authorisation stages are advanced
// from the summary dropdown; the later stages expose a "Mark done" button here.
// Section is a LayerTheme; the stepper rail is plain layout (no card surface).
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";

const formatStamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function WarrantyTimeline({
  claim,
  canEdit = false,
  busy = false,
  onUpdateClaim = () => {},
  style,
}) {
  // Stage config — `field` is the warranty_claims column; `markable` stages get a
  // button to stamp them once their predecessor is complete.
  const stages = [
    { key: "created", label: "Created", field: "created_at", markable: false },
    {
      key: "requested",
      label: "Authorisation Requested",
      field: "authorisation_requested_at",
      markable: false,
    },
    { key: "authorised", label: "Authorised", field: "authorised_at", markable: false },
    {
      key: "work_completed",
      label: "Work Completed",
      field: "work_completed_at",
      markable: true,
    },
    {
      key: "claim_submitted",
      label: "Claim Submitted",
      field: "claim_submitted_at",
      markable: true,
    },
    { key: "claim_paid", label: "Claim Paid", field: "claim_paid_at", markable: true },
  ];

  const resolved = stages.map((stage) => ({
    ...stage,
    stamp: claim?.[stage.field] || null,
    done: Boolean(claim?.[stage.field]),
  }));
  // The first not-done stage is "current".
  const currentIndex = resolved.findIndex((stage) => !stage.done);

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-timeline"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Warranty Timeline
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {resolved.map((stage, index) => {
          const isCurrent = index === currentIndex;
          const isLast = index === resolved.length - 1;
          const dotColor = stage.done
            ? "var(--success)"
            : isCurrent
            ? "var(--accent-strong)"
            : "var(--grey-accent-light)";
          // Mark-done is offered for markable stages once the previous stage is done.
          const prevDone = index === 0 || resolved[index - 1].done;
          const canMark = canEdit && stage.markable && !stage.done && prevDone;

          return (
            <div key={stage.key} style={{ display: "flex", gap: "12px", minHeight: "52px" }}>
              {/* Dot + connector rail (background-coloured, not a border). */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "var(--radius-pill)",
                    background: dotColor,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                {!isLast && (
                  <span
                    style={{
                      width: "2px",
                      flex: 1,
                      minHeight: "20px",
                      background: stage.done ? "var(--success)" : "var(--grey-accent-light)",
                    }}
                  />
                )}
              </div>

              {/* Label + timestamp / action */}
              <div style={{ paddingBottom: "16px", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: isCurrent || stage.done ? 700 : 500,
                    color: stage.done || isCurrent ? "var(--text-1)" : "var(--text-1)",
                    opacity: stage.done || isCurrent ? 1 : 0.6,
                  }}
                >
                  {stage.label}
                </div>
                {stage.stamp ? (
                  <div style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
                    {formatStamp(stage.stamp)}
                  </div>
                ) : canMark ? (
                  <button
                    type="button"
                    className="app-btn app-btn--ghost"
                    onClick={() =>
                      onUpdateClaim({ [stage.field]: new Date().toISOString() })
                    }
                    disabled={busy}
                    style={{ marginTop: "4px" }}
                  >
                    Mark done
                  </button>
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.5 }}>
                    Pending
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LayerTheme>
  );
}
