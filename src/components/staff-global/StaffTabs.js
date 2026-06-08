// file location: src/components/staff-global/StaffTabs.js
// Controlled staff tab list using global staff tab classes.
import React from "react";

export default function StaffTabs({
  tabs = [],
  activeKey,
  onChange,
  className = "",
  ...rest
}) {
  return (
    <div className={`staff-tabs tab-api ${className}`.trim()} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            className={`staff-tab tab-api__item${isActive ? " is-active" : ""}`}
            onClick={() => !tab.disabled && onChange?.(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
