// file location: src/features/jobCard/ui/KeyValueGrid.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

export default function KeyValueGrid({ items = [] }) {
  return (
    <div className={jobCardStyles.keyValueGrid}>
      {items
        .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
        .map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <div className={jobCardStyles.keyValueLabel}>{item.label}</div>
            <div className={jobCardStyles.keyValueValue} style={{ color: item.valueColor || undefined }}>
              {item.value}
            </div>
          </div>
        ))}
    </div>
  );
}
