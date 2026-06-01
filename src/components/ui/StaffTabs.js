// file location: src/components/ui/StaffTabs.js
// Staff tab bar. Renders a horizontal row of tab buttons using the shared
// `.app-btn` nav style inside an `.app-staff-tabs` container (scoped in
// staffglobal.css). Controlled: pass `activeKey` + `onChange`.
//
// tabs: Array<{ key: string, label: ReactNode, disabled?: boolean }>
import React from "react";

export default function StaffTabs({
  tabs = [],
  activeKey,
  onChange,
  className = "",
  ...rest
}) {
  return (
    <div className={`app-staff-tabs ${className}`.trim()} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
            onClick={() => !tab.disabled && onChange?.(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
