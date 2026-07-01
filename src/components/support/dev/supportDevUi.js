// file location: src/components/support/dev/supportDevUi.js
//
// Help & Diagnostics ("support") — Phase 6. Small, reusable presentational
// primitives for the developer Support Centre. Built to CLAUDE.md:
//   - surfaces are ONLY <LayerSurface> / <LayerTheme> (borderless, tokens),
//   - chips/pills/rows are non-surfaces (tinted background, never a card border),
//   - list rows use the allowed `--separating-line` row rule,
//   - all colour comes from theme tokens (a tone is a token NAME; see adminView).
// These are deliberately generic so future support surfaces can reuse them.

import React, { useCallback, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { useAlerts } from "@/context/AlertContext";

const toneVar = (tone) => `var(--${tone || "text-1"})`;
// A soft tint of a tone token for chip backgrounds (never a border).
const toneTint = (tone, pct = 16) => `color-mix(in srgb, ${toneVar(tone)} ${pct}%, transparent)`;

// ---------------------------------------------------------------------------
// Pill / Badge — inline status chips (non-surface: tinted background only).
// ---------------------------------------------------------------------------
export function Pill({ label, tone = "text-1", title, strong = false, style }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm, 6px)",
        fontSize: "var(--text-body-xs, 11px)",
        fontWeight: strong ? 700 : 600,
        lineHeight: 1.6,
        color: toneVar(tone),
        background: toneTint(tone),
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export function BadgeRow({ badges = [], style }) {
  if (!badges.length) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px", ...style }}>
      {badges.map((b) => (
        <Pill key={b.key} label={b.label} tone={b.tone} strong />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section panel — a titled theme-layer surface. Use as the section container;
// nest <SubSurface> for an inner surface (keeps LayerTheme→LayerSurface alt.).
// ---------------------------------------------------------------------------
export function Panel({ title, subtitle, actions, children, sectionKey, style, contentStyle }) {
  return (
    <LayerTheme sectionKey={sectionKey} style={{ gap: "var(--space-md)", ...style }}>
      {(title || actions) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <div>
            {title && (
              <div style={{ fontWeight: 700, fontSize: "var(--text-h4, 15px)", color: "var(--accentText)" }}>{title}</div>
            )}
            {subtitle && (
              <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8, marginTop: "2px" }}>{subtitle}</div>
            )}
          </div>
          {actions ? <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", ...contentStyle }}>{children}</div>
    </LayerTheme>
  );
}

export function SubSurface({ children, style }) {
  return <LayerSurface style={{ gap: "var(--space-sm)", ...style }}>{children}</LayerSurface>;
}

// ---------------------------------------------------------------------------
// Key/value grid — the workhorse for diagnostics readouts.
// ---------------------------------------------------------------------------
export function KeyValue({ label, value, mono = false, tone }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 30%) 1fr", gap: "var(--space-sm)", alignItems: "baseline" }}>
      <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div
        style={{
          fontSize: "var(--text-body-sm)",
          color: tone ? toneVar(tone) : "var(--text-1)",
          fontFamily: mono ? "var(--font-mono, ui-monospace, monospace)" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function KeyValueGrid({ children, style }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", ...style }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Stat card (dashboard) — a small surface with a number + label.
// ---------------------------------------------------------------------------
export function StatCard({ label, value, tone = "accentText", hint, onClick, active = false }) {
  return (
    <LayerSurface
      as={onClick ? "button" : "div"}
      onClick={onClick}
      style={{
        minWidth: 0,
        gap: "2px",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        alignItems: "flex-start",
        outline: active ? `2px solid ${toneVar(tone)}` : "none", // focus/selection ring on the stat filter (non-surface accent)
      }}
    >
      <div style={{ fontSize: "var(--text-h2, 24px)", fontWeight: 800, color: toneVar(tone), lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.85 }}>{label}</div>
      {hint ? <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.55 }}>{hint}</div> : null}
    </LayerSurface>
  );
}

// ---------------------------------------------------------------------------
// Empty + loading states.
// ---------------------------------------------------------------------------
export function EmptyState({ icon = "🗂️", title = "Nothing here", message, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-sm)", padding: "var(--space-xl, 32px)", textAlign: "center" }}>
      <div style={{ fontSize: "28px" }} aria-hidden>{icon}</div>
      <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{title}</div>
      {message ? <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8, maxWidth: "40ch" }}>{message}</div> : null}
      {action}
    </div>
  );
}

export function LoadingBlock({ rows = 3, height = 44 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--text-1) 8%, transparent)",
            animation: "hnpPulse 1.2s ease-in-out infinite",
            opacity: 1 - i * 0.12,
          }}
        />
      ))}
      {/* keyframes are provided globally; fall back gracefully if absent */}
      <style jsx>{`
        @keyframes hnpPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons — ghost + solid, 44px touch targets.
// ---------------------------------------------------------------------------
export function DevButton({ children, onClick, variant = "ghost", tone = "accentText", disabled, title, type = "button", small = false }) {
  const solid = variant === "solid";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={solid ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"}
      style={{
        minHeight: small ? 32 : 44,
        padding: small ? "4px 10px" : "8px 14px",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--text-body-sm)",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        color: solid ? "var(--accentText-contrast, #fff)" : toneVar(tone),
        background: solid ? toneVar(tone) : toneTint(tone, 10),
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button (client). Acknowledges via AlertContext.
// ---------------------------------------------------------------------------
export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", small = true, tone = "accentText" }) {
  const { pushAlert } = useAlerts();
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text || "");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      pushAlert("Could not copy to the clipboard.", "error");
    }
  }, [text, pushAlert]);
  return (
    <DevButton onClick={onCopy} small={small} tone={tone} title="Copy to clipboard">
      {done ? `✓ ${copiedLabel}` : label}
    </DevButton>
  );
}

// ---------------------------------------------------------------------------
// Clickable source reference (file:line) — click copies the ref (there is no
// in-app source viewer). Rendered as monospace code.
// ---------------------------------------------------------------------------
export function SourceRef({ file, line, style }) {
  const { pushAlert } = useAlerts();
  if (!file) return null;
  const ref = `${file}${line ? `:${line}` : ""}`;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(ref);
          pushAlert("Copied source path.", "success");
        } catch {
          /* ignore */
        }
      }}
      title="Copy source path"
      style={{
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: "var(--text-body-xs)",
        color: "var(--accentText)",
        background: toneTint("accentText", 10),
        borderRadius: "var(--radius-sm, 6px)",
        padding: "2px 8px",
        cursor: "pointer",
        wordBreak: "break-all",
        textAlign: "left",
        ...style,
      }}
    >
      {ref}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Confidence bar (0..1).
// ---------------------------------------------------------------------------
export function ConfidenceBar({ value = 0, label = "Confidence" }) {
  const pct = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  const tone = pct >= 66 ? "success-base" : pct >= 33 ? "warning-base" : "danger-base";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.8 }}>
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "color-mix(in srgb, var(--text-1) 12%, transparent)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: toneVar(tone) }} />
      </div>
    </div>
  );
}

export { toneVar, toneTint };
