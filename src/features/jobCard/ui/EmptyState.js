// file location: src/features/jobCard/ui/EmptyState.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

export default function EmptyState({ message = "Nothing to show yet." }) {
  return <div className={jobCardStyles.emptyState}>{message}</div>;
}
