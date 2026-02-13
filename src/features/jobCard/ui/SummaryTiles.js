// file location: src/features/jobCard/ui/SummaryTiles.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

const toneClassMap = {
  neutral: jobCardStyles.summaryToneNeutral,
  pink: jobCardStyles.summaryTonePink,
  green: jobCardStyles.summaryToneGreen,
};

export default function SummaryTiles({ items = [] }) {
  return (
    <div className={jobCardStyles.summaryGrid}>
      {items.map((item, index) => {
        const toneClass = toneClassMap[item?.tone] || toneClassMap.neutral;
        return (
          <div key={item?.label || `tile-${index}`} className={`${jobCardStyles.summaryTile} ${toneClass}`}>
            <div className={jobCardStyles.summaryValue} style={{ color: item?.valueColor || "#2f1f1f" }}>
              {item?.value ?? "-"}
            </div>
            <div className={jobCardStyles.summaryLabel}>{item?.label || ""}</div>
          </div>
        );
      })}
    </div>
  );
}
