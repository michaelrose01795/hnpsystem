// file location: src/features/jobCard/ui/RequestList.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";
import EmptyState from "./EmptyState";

export default function RequestList({ items = [], getKey, renderText }) {
  if (!items.length) {
    return <EmptyState message="No requests logged." />;
  }

  return (
    <div className={jobCardStyles.requestList}>
      {items.map((item, index) => (
        <div
          key={typeof getKey === "function" ? getKey(item, index) : index}
          className={`${jobCardStyles.requestItem} ${jobCardStyles.requestItemAccent}`}
        >
          <div className={jobCardStyles.requestText}>
            {typeof renderText === "function" ? renderText(item, index) : String(item?.text || item || "")}
          </div>
        </div>
      ))}
    </div>
  );
}
