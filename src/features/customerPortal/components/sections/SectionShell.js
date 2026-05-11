// file location: src/features/customerPortal/components/sections/SectionShell.js
// Website-native section card wrapper used by every expanded /website/profile
// section. Renders the same `profileCard` glass shell as the original
// "Personal details" section so the whole page reads as one consistent
// /website experience. Each section component composes its own interior using
// the helpers in `_websiteParts.js`.
import React from "react";
import styles from "@/singlescroll/styles/singlescroll.module.css";
import PortalTodoNote from "./PortalTodoNote";

export default function SectionShell({
  id,
  eyebrow,
  title,
  action,
  todo,
  count,
  children,
  wide = true,
}) {
  return (
    <section
      id={id}
      className={`${styles.profileCard}${wide ? " " + styles.profileCardWide : ""}`}
    >
      <div className={styles.profileCardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {eyebrow ? (
            <span
              className={styles.profileEyebrow}
              style={{ fontSize: 10, letterSpacing: "0.6px" }}
            >
              {eyebrow}
            </span>
          ) : null}
          <h2 className={styles.profileCardTitle}>{title}</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {count != null ? (
            <span className={styles.profileCardCount}>{count}</span>
          ) : null}
          {action || null}
        </div>
      </div>
      {todo ? <PortalTodoNote {...(typeof todo === "string" ? { label: todo } : todo)} /> : null}
      {children}
    </section>
  );
}
