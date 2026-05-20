// file location: src/features/roleTreeDemo/components/sections/ProblemsSection.js
// Daily workflow problems shown as friction cards, with an explicit before /
// after deep dive for what changes once the workflow is connected.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { workflowImprovements, workflowProblems } from "../../data/mockData";

export default function ProblemsSection() {
  const [connected, setConnected] = useState(false);

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 04 &middot; Workflow problems</span>
        <h2 className={styles.title}>Where the Day Loses Time</h2>
        <p className={styles.subtitle}>
          These are the friction points the team lives with every day. Connect the departments to
          see the same problems shrink into a clearer, calmer workflow.
        </p>
      </header>

      <div className={`${styles.problemsScene} ${connected ? styles.problemsResolved : ""}`}>
        <div className={styles.problemScanner} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.problemsGrid}>
          {workflowProblems.map((problem) => (
            <LayerSurface
              as="article"
              key={problem.id}
              className={styles.problemCard}
              radius="var(--radius-md)"
              padding="18px"
              gap="6px"
            >
              <span className={styles.cardKicker}>Friction</span>
              <div className={styles.cardTitle}>{problem.title}</div>
              <p className={styles.cardBody}>{problem.line}</p>
            </LayerSurface>
          ))}
        </div>
      </div>

      <div className={styles.problemToggleRow}>
        <button
          type="button"
          className={`app-btn ${connected ? "app-btn--secondary" : "app-btn--primary"}`}
          onClick={() => setConnected((value) => !value)}
        >
          {connected ? "Show friction again" : "Connect the departments"}
        </button>
      </div>

      <LayerSurface className={styles.problemDeepDive} radius="var(--radius-lg)">
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.cardKicker}>{connected ? "Connected state" : "Current pain"}</span>
            <div className={styles.cardTitle}>
              {connected ? "The day starts to flow." : "The hidden cost is staff attention."}
            </div>
          </div>
          <span className={styles.detailPill}>{connected ? "Shared workflow" : "Disconnected workflow"}</span>
        </div>
        <p className={styles.cardBody}>
          {connected
            ? "When the same job record carries status, notes, parts, media and ownership, the business spends less time asking where things are."
            : "The biggest loss is not one single system gap. It is the repeated micro-chase that pulls people away from customers and vehicles."}
        </p>
        <div className={styles.improvementGrid}>
          {workflowImprovements.map((item) => (
            <LayerTheme key={item.id} padding="14px" gap="4px">
              <span className={styles.dashboardCardLabel}>{item.label}</span>
              <span>{item.line}</span>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </div>
  );
}
