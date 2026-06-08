// file location: src/components/customer-global/CustomerTabs.js
// Controlled customer tab list using customer-global class names.
import React from "react";

export default function CustomerTabs({
  tabs = [],
  activeKey,
  onChange,
  className = "",
  ...rest
}) {
  return (
    <div className={`customer-tabs ${className}`.trim()} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            className={`customer-tab${isActive ? " is-active" : ""}`}
            onClick={() => !tab.disabled && onChange?.(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
