// file location: src/features/jobCard/ui/JobTabs.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

export default function JobTabs({ tabs = [], activeTab, onChange, className = "" }) {
  return (
    <div className={`${jobCardStyles.tabsWrap} ${className}`.trim()}>
      <div className={jobCardStyles.tabsRow}>
        {tabs.map((tab) => {
          const id = tab?.id ?? tab;
          const label = tab?.label ?? String(tab);
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange?.(id)}
              className={`${jobCardStyles.tabButton} ${isActive ? jobCardStyles.tabActive : jobCardStyles.tabInactive}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
