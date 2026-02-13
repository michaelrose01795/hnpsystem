// file location: src/features/jobCard/ui/SectionCard.js

import React from "react";
import { jobCardStyles } from "./jobCardStyles";

export default function SectionCard({ title, actions = null, children, className = "" }) {
  return (
    <section className={`${jobCardStyles.sectionCard} ${className}`.trim()}>
      {(title || actions) && (
        <div className={jobCardStyles.sectionHeader}>
          {title ? <h3 className={jobCardStyles.sectionTitle}>{title}</h3> : <div />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
