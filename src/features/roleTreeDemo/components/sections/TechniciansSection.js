// file location: src/features/roleTreeDemo/components/sections/TechniciansSection.js
// Technician / apprentice level. Shows the bottom of the role tree, the tools
// available from this level, and the workflow signal that moves upward.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { technicianTools, technicianWorkflow } from "../../data/mockData";

export default function TechniciansSection() {
  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 05 &middot; The technician level</span>
        <h2 className={styles.title}>Where the Work Actually Happens</h2>
        <p className={styles.subtitle}>
          The system only works if the bay-level experience is simple. The technician view is where
          the operational truth enters the DMS.
        </p>
      </header>

      <div className={styles.technicianScene}>
        <LayerSurface className={styles.technicianPedestal} radius="var(--radius-lg)" padding="28px 22px">
          <div className={styles.technicianLiveRig} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.technicianAvatar} aria-hidden="true">AT</div>
          <div className={styles.technicianLabel}>Apprentice technician</div>
          <p className={styles.technicianSub}>The starting point of every job that leaves the workshop.</p>
          <div className={styles.technicianWorkflow}>
            {technicianWorkflow.map((step) => (
              <LayerTheme key={step.id} padding="12px" gap="4px">
                <span className={styles.dashboardCardLabel}>{step.label}</span>
                <span>{step.line}</span>
              </LayerTheme>
            ))}
          </div>
        </LayerSurface>

        <div className={styles.technicianTools}>
          {technicianTools.map((tool) => (
            <LayerSurface
              key={tool.id}
              className={styles.glassCard}
              radius="var(--radius-md)"
              padding="18px"
              gap="6px"
            >
              <span className={styles.cardKicker}>Tool</span>
              <div className={styles.cardTitle}>{tool.title}</div>
              <p className={styles.cardBody}>{tool.line}</p>
            </LayerSurface>
          ))}
          <LayerSurface className={styles.technicianFootnote} radius="var(--radius-md)" padding="14px 18px">
            If these problems are visible from the apprentice technician level, they affect the
            whole business.
          </LayerSurface>
        </div>
      </div>
    </div>
  );
}
