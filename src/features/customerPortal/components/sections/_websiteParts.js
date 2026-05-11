// file location: src/features/customerPortal/components/sections/_websiteParts.js
// Website-native primitive parts shared by every expanded customer-portal
// section so they all match the rest of /website/profile (typography,
// spacing, glass tiles, badge pills, tracker dots). These are intentionally
// thin wrappers around singlescroll.module.css classes — no inline colour
// tokens, so contrast on the permanent-dark glass shell is consistent.
import React from "react";
import styles from "@/singlescroll/styles/singlescroll.module.css";

// ── Layout ──────────────────────────────────────────────────────────────
export function Stack({ children, gap = 14, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {children}
    </div>
  );
}

export function Grid({ children, min = 220, gap = 12, style }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Sub-header inside a card ────────────────────────────────────────────
export function SubHeader({ children }) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        color: "var(--accentText)",
      }}
    >
      {children}
    </h3>
  );
}

// ── Label/value detail field (matches Personal Details rows) ────────────
export function Field({ label, value, mono }) {
  return (
    <div className={styles.profileDetailField}>
      <span className={styles.profileDetailLabel}>{label}</span>
      <span
        className={styles.profileDetailValue}
        style={mono ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : undefined}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export function FieldGrid({ children }) {
  return <div className={styles.profileDetailGrid}>{children}</div>;
}

// ── Glass tile for sub-cards inside a section ───────────────────────────
export function Tile({ children, padding = 14, style }) {
  return (
    <div
      style={{
        padding,
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Items list (job/visit/order rows) ──────────────────────────────────
export function ItemList({ children }) {
  return <ul className={styles.profileItemList}>{children}</ul>;
}

export function ItemRow({ title, meta, right, children }) {
  return (
    <li className={styles.profileItemRow}>
      <div>
        <div className={styles.profileItemTitle}>{title}</div>
        {meta ? <div className={styles.profileItemMeta}>{meta}</div> : null}
        {children}
      </div>
      {right ? <div>{right}</div> : null}
    </li>
  );
}

// ── Status badge pills ─────────────────────────────────────────────────
export function Badge({ children, tone = "neutral" }) {
  const cls =
    tone === "ok"
      ? `${styles.profileBadge} ${styles.profileBadgePaid}`
      : tone === "open"
      ? `${styles.profileBadge} ${styles.profileBadgeOpen}`
      : styles.profileBadge;
  return <span className={cls}>{children}</span>;
}

// ── Empty / muted small text ───────────────────────────────────────────
export function Empty({ children }) {
  return <p className={styles.profileEmpty}>{children}</p>;
}

// ── Stage tracker (Booked → Checked-in → … → Ready) ────────────────────
export function Tracker({ stages = [], activeIndex = -1 }) {
  return (
    <div
      className={styles.profileTracker}
      style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
    >
      {stages.map((s, idx) => {
        const done = idx < activeIndex;
        const active = idx === activeIndex;
        const cls = [
          styles.profileTrackerStep,
          done ? styles.profileTrackerStepDone : "",
          active ? styles.profileTrackerStepActive : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={s.key || s.label || idx} className={cls}>
            <span className={styles.profileTrackerDot} />
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Banner (warn / soft / ok) ─────────────────────────────────────────
export function Banner({ tone = "neutral", title, sub, right }) {
  const cls = [
    styles.profileBanner,
    tone === "warn" ? styles.profileBannerWarn : "",
    tone === "soft" ? styles.profileBannerSoft : "",
    tone === "ok" ? styles.profileBannerOk : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className={styles.profileBannerText}>
        <span className={styles.profileBannerTitle}>{title}</span>
        {sub ? <span className={styles.profileBannerSub}>{sub}</span> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

// ── Button styled to match `Edit` / `Back to site` / `Log out` ────────
export function GhostBtn({ children, onClick, href, type = "button", style }) {
  const cls = `app-btn ${styles.profileGhostBtn}`;
  if (href) {
    return (
      <a className={cls} href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} style={style}>
      {children}
    </button>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────
export function ProgressBar({ pct = 0 }) {
  return (
    <div className={styles.profileMileageBar} style={{ height: 8 }}>
      <div className={styles.profileMileageBarFill} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

// ── Money figure (account-balance hero style) ─────────────────────────
export function MoneyHero({ label, value }) {
  return (
    <div className={styles.profileBalanceHero}>
      <span className={styles.profileDetailLabel}>{label}</span>
      <span className={styles.profileBalanceFigure}>{value}</span>
    </div>
  );
}
