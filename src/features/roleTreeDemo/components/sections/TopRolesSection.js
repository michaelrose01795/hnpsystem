// file location: src/features/roleTreeDemo/components/sections/TopRolesSection.js
// Top of the role tree: Owner / Directors / Managers as focused cards, with
// a deeper dashboard view and role-stack explanation for the active level.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { dashboardCards, roleViewStack, topRoles } from "../../data/mockData";

export default function TopRolesSection() {
  const [activeRole, setActiveRole] = useState(topRoles[0].id);
  const focused = topRoles.find((role) => role.id === activeRole) || topRoles[0];

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 02 &middot; Top of the role tree</span>
        <h2 className={styles.title}>Owner, Directors &amp; Managers</h2>
        <p className={styles.subtitle}>
          Each level needs a different view, but the source of truth stays the same. Choose a role
          to see how the same operational data changes shape.
        </p>
      </header>

      <div className={styles.topStack}>
        {topRoles.map((role) => {
          const isActive = role.id === activeRole;
          return (
            <LayerSurface
              as="article"
              key={role.id}
              className={`${styles.glassCard} ${styles.topStackCard} ${isActive ? styles.glassCardActive : ""}`}
              data-clickable="true"
              onClick={() => setActiveRole(role.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveRole(role.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              radius="var(--radius-md)"
              padding="20px"
            >
              <span className={styles.stackBadge}>{role.id}</span>
              <div className={styles.cardTitle}>{role.title}</div>
              <p className={styles.cardBody}>{role.summary}</p>
            </LayerSurface>
          );
        })}
      </div>

      <LayerSurface
        className={styles.roleTreeLiveScene}
        aria-hidden="true"
        radius="var(--radius-lg)"
        padding="18px"
        gap="14px"
      >
        <div className={styles.roleTreeSceneHeader}>
          <span>Live role signal</span>
          <span>One workflow, different views</span>
        </div>

        <div className={styles.roleTreeSceneGrid}>
          <div className={styles.roleTreeColumn}>
            {["Owner", "Directors", "Managers", "Departments", "Workshop floor"].map((label, index) => (
              <span key={label}>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{label}</strong>
              </span>
            ))}
          </div>
          <div className={styles.roleTreePulseRail}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.roleTreeMetrics}>
            <span>Capacity</span>
            <span>Risk</span>
            <span>Revenue</span>
            <span>Flow</span>
          </div>
        </div>
      </LayerSurface>

      <LayerSurface
        className={`${styles.glassCard} ${styles.topDetail}`}
        aria-label="What the focused role needs"
        radius="var(--radius-lg)"
      >
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.cardKicker}>Focused view</span>
            <div className={styles.cardTitle}>What {focused.title} needs to see</div>
          </div>
          <span className={styles.detailPill}>Shared truth, tailored view</span>
        </div>

        <div className={styles.topDetailGrid}>
          <div>
            <ul className={styles.cardList}>
              {focused.needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          </div>

          <div className={styles.roleViewStack}>
            {roleViewStack.map((item) => (
              <LayerTheme key={item.id} className={styles.stackLayer} padding="14px" gap="4px">
                <span className={styles.dashboardCardLabel}>{item.label}</span>
                <span>{item.line}</span>
              </LayerTheme>
            ))}
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          {dashboardCards.map((card) => (
            <LayerTheme key={card.id} className={styles.dashboardCard} padding="14px 16px" gap="6px">
              <span className={styles.dashboardCardLabel}>{card.title}</span>
              <span>{card.line}</span>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </div>
  );
}
