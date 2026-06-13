// file location: src/components/page-ui/job-cards/scheduling/QuickActionsSection.js
// Scheduling dashboard → Quick Actions.
// A row of shortcut buttons. The orchestrator wires each handler to the
// relevant existing behaviour (scroll to collection, jump to Notes tab, jump
// to Messages tab, etc.).
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";

const ACTION_BTN_CLASS = "app-btn app-btn--secondary";

export default function QuickActionsSection({
  canEdit = false,
  onChangeCollectionTimes = () => {},
  onAddWorkshopNote = () => {},
  onSendCustomerUpdate = () => {},
}) {
  const actions = [
    { key: "collection", label: "Change collection times", icon: "🕒", onClick: onChangeCollectionTimes },
    { key: "note", label: "Add workshop note", icon: "📝", onClick: onAddWorkshopNote },
    { key: "update", label: "Send update to customer", icon: "✉️", onClick: onSendCustomerUpdate },
  ];

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-quick-actions"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "12px" }}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Quick Actions
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
        }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={ACTION_BTN_CLASS}
            onClick={action.onClick}
            disabled={!canEdit}
            style={{ justifyContent: "flex-start", gap: "8px" }}
          >
            <span aria-hidden="true">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </LayerSurface>
  );
}
