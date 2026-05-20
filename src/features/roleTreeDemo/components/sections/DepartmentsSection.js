// file location: src/features/roleTreeDemo/components/sections/DepartmentsSection.js
// Department layer: connected department cards with animated SVG dashed lines
// and a focused deep-dive panel for the selected department.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { departmentDeepDive, departments } from "../../data/mockData";

export default function DepartmentsSection() {
  const [active, setActive] = useState(departments[0].id);
  const [positions, setPositions] = useState({});
  const containerRef = useRef(null);
  const cardRefs = useRef({});

  const focused = useMemo(
    () => departments.find((dept) => dept.id === active) || departments[0],
    [active]
  );

  const connectedDepartments = useMemo(
    () => focused.connects.map((id) => departments.find((dept) => dept.id === id)).filter(Boolean),
    [focused]
  );

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const next = {};
    departments.forEach((dept) => {
      const el = cardRefs.current[dept.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      next[dept.id] = {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
      };
    });
    setPositions(next);
  }, []);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const interval = window.setInterval(measure, 800);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearInterval(interval);
    };
  }, [measure]);

  const lines = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    departments.forEach((dept) => {
      (dept.connects || []).forEach((other) => {
        const key = [dept.id, other].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        pairs.push({ from: dept.id, to: other, key });
      });
    });
    return pairs;
  }, []);

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 03 &middot; Department layer</span>
        <h2 className={styles.title}>One Connected Workflow</h2>
        <p className={styles.subtitle}>
          Service, Parts, Workshop, Sales, Admin, Valet and Accounts share information through the
          same system. The lines show the hand-offs that need to feel effortless.
        </p>
      </header>

      <div className={styles.departmentScene} ref={containerRef}>
        <svg className={styles.departmentSvg} aria-hidden="true">
          {lines.map((line) => {
            const a = positions[line.from];
            const b = positions[line.to];
            if (!a || !b) return null;
            return (
              <line
                key={line.key}
                className={styles.departmentLine}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          })}
        </svg>

        <div className={styles.departmentGrid}>
          {departments.map((dept) => {
            const isActive = dept.id === active;
            return (
              <div
                key={dept.id}
                ref={(el) => {
                  cardRefs.current[dept.id] = el;
                }}
              >
                <LayerSurface
                  as="article"
                  className={`${styles.glassCard} ${styles.departmentCard} ${isActive ? styles.glassCardActive : ""}`}
                  data-clickable="true"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => setActive(dept.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(dept.id);
                    }
                  }}
                  radius="var(--radius-md)"
                  padding="18px"
                >
                  <span className={styles.cardKicker}>Department</span>
                  <div className={styles.cardTitle}>{dept.title}</div>
                </LayerSurface>
              </div>
            );
          })}
        </div>

        <div className={styles.departmentSignalDeck} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <LayerSurface className={styles.departmentDetail} radius="var(--radius-lg)">
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.cardKicker}>Department deep dive</span>
            <div className={styles.cardTitle}>{focused.title}</div>
          </div>
          <span className={styles.detailPill}>Needs clean hand-offs</span>
        </div>
        <p className={styles.cardBody}>{focused.needs}</p>
        <div className={styles.connectedChips} aria-label={`${focused.title} connects to`}>
          {connectedDepartments.map((dept) => (
            <span key={dept.id} className={styles.connectedChip}>
              {dept.title}
            </span>
          ))}
        </div>
        <div className={styles.departmentDeepDiveGrid}>
          {departmentDeepDive.map((item) => (
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
