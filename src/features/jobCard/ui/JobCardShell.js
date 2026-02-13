// file location: src/features/jobCard/ui/JobCardShell.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

export default function JobCardShell({ children, className = "" }) {
  return (
    <div className={`${jobCardStyles.pageBackground} ${className}`.trim()}>
      <div className={`${jobCardStyles.shell} ${jobCardStyles.sectionSpacing}`}>
        {children}
      </div>
    </div>
  );
}
