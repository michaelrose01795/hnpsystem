import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAlerts } from "@/context/AlertContext";
import { useUser } from "@/context/UserContext";
import { canViewDiagnostics } from "@/lib/auth/roles";
import { useSupportReport } from "@/context/SupportReportContext";
import { hasReportedAlert, subscribeFeedbackState } from "@/lib/support/feedbackDevBridge";

// Which toasts get a "Report this problem" action (Phase 10.1): friendly errors,
// validation/support warnings, and anything carrying a reference code. Success /
// info toasts don't — there's nothing to report.
const isReportableAlert = (alert) =>
  Boolean(alert) && (alert.type === "error" || alert.type === "warning" || Boolean(alert.referenceCode));

// Build the pre-filled support report from a clicked toast. The user-visible
// description carries only the friendly message + reference code; the private
// `trigger` (devInfo + origin + alert id) rides in the diagnostics blob the modal
// attaches — never shown to the reporter, so normal staff still see no technical
// detail. openSupportReport() adds route/user/role/page/recent-diagnostics.
function buildToastReportPrefill(alert) {
  const message = alert?.message || "";
  const ref = alert?.referenceCode || null;
  const description = [
    "I clicked “Report this problem” on this notification:",
    "",
    `“${message}”`,
    ref ? `\nReference: ${ref}` : null,
    "",
    "A private technical snapshot (the page I was on, my role, recent actions and any errors) is attached automatically.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    category: "bug",
    description,
    referenceCode: ref,
    trigger: {
      origin: "error-toast",
      referenceCode: ref,
      message,
      devInfo: alert?.devInfo || null,
      alertId: alert?.id,
    },
  };
}

// Legacy inline tones — used only by <AlertBadge> (not the toast stack).
const toneStyles = {
  success: { bg: "var(--success-surface)", text: "var(--success-strong)" },
  error:   { bg: "var(--danger-surface)",  text: "var(--danger-text)" },
  warning: { bg: "var(--warning-surface)", text: "var(--warning-text)" },
  info:    { bg: "var(--theme)",           text: "var(--accent-strong)" },
};

const getTone = (type) => toneStyles[type] || toneStyles.info;

// Toast tone descriptors for the stack: which .app-alert modifier to apply,
// the glyph icon (tone is carried by icon + colour, never colour alone), the
// screen-reader label, and whether the tone is urgent. Styling lives in
// staffglobal.css (.app-toast-stack / .app-alert).
const TOAST_TONES = {
  success: { modifier: "app-alert--success", icon: "✓", label: "Success",     urgent: false },
  error:   { modifier: "app-alert--danger",  icon: "!", label: "Error",       urgent: true },
  warning: { modifier: "app-alert--warning", icon: "!", label: "Warning",     urgent: true },
  info:    { modifier: "app-alert--info",    icon: "i", label: "Information",  urgent: false },
};

const getToastTone = (type) => TOAST_TONES[type] || TOAST_TONES.info;

function CopyDevInfoButton({ devInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(devInfo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = devInfo;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="app-alert__copy-btn"
      title="Copy error details for developer"
    >
      {copied ? "Copied!" : "Copy for Dev"}
    </button>
  );
}

export function AlertBadge() {
  const { alerts } = useAlerts();
  if (!alerts.length) return null;
  const latest = alerts[alerts.length - 1];
  const tone = getTone(latest.type);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "-12px",
        left: "16px",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        background: tone.bg,
        color: tone.text,
        fontSize: "0.75rem",
        fontWeight: 600,
        maxWidth: "220px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {alerts.length > 1 ? `${alerts.length} alerts` : latest.message}
    </div>
  );
}

/**
 * A single toast. Reuses the shared .app-alert surface. Handles keyboard
 * dismiss (Esc, and Enter/Space when the toast itself is focused) and reports
 * hover/focus so the parent can pause its auto-dismiss timer.
 */
function ToastItem({ alert, onDismiss, onPause, onResume, showDiagnostics, onReport, reported }) {
  const tone = getToastTone(alert.type);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  // Pause while hovered OR focused; resume only when neither holds.
  const sync = useCallback(() => {
    if (hoveredRef.current || focusedRef.current) onPause();
    else onResume();
  }, [onPause, onResume]);

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    sync();
  };
  const handleMouseLeave = () => {
    hoveredRef.current = false;
    sync();
  };
  const handleFocus = () => {
    focusedRef.current = true;
    sync();
  };
  const handleBlur = (event) => {
    // Focus moving between the toast's own children keeps it "focused".
    if (event.currentTarget.contains(event.relatedTarget)) return;
    focusedRef.current = false;
    sync();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onDismiss();
      return;
    }
    // Enter/Space dismiss only when the toast root (not a nested button) has focus.
    if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
      event.preventDefault();
      onDismiss();
    }
  };

  const canReport = isReportableAlert(alert) && typeof onReport === "function";

  return (
    <div
      className={`app-alert ${tone.modifier}`}
      tabIndex={0}
      aria-label={`${tone.label} notification: ${alert.message}. Press Escape or Enter to dismiss.`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {/* Message row */}
      <div className="app-alert__main">
        <span className="app-alert__icon" aria-hidden="true">
          {tone.icon}
        </span>
        <span className="app-alert__message">{alert.message}</span>
        <button
          type="button"
          className="app-alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      {/* Reference code — shown to EVERYONE so staff can quote it to support.
          The technical devInfo behind it is diagnostic-role gated below. */}
      {alert.referenceCode ? (
        <div className="app-alert__ref">
          Reference code:{" "}
          <span className="app-alert__ref-code">{alert.referenceCode}</span>
        </div>
      ) : null}

      {/* Dev copy row — Phase 4: only rendered for diagnostic roles. Non-diagnostic
          staff never see the technical devInfo; it is logged against the reference
          code (diagnosticsLog) for developer tracing instead. */}
      {showDiagnostics && alert.devInfo ? (
        <div className="app-alert__dev">
          <span className="app-alert__dev-label">Dev info available</span>
          <CopyDevInfoButton devInfo={alert.devInfo} />
        </div>
      ) : null}

      {/* Report row — Phase 10.1: one click files a pre-filled support report to
          the dev/support system (message + reference code + route/user/role/page
          + recent diagnostics + devInfo, the technical parts attached privately).
          Disabled once reported so repeated clicks can't file a duplicate. */}
      {canReport ? (
        <div className="app-alert__report">
          <button
            type="button"
            className="app-alert__report-btn"
            onClick={() => onReport(alert)}
            disabled={reported}
            aria-label={reported ? "Problem reported" : `Report this problem: ${alert.message}`}
          >
            {reported ? "Reported ✓" : "Report this problem"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function TopbarAlerts() {
  const { alerts, dismissAlert } = useAlerts();
  // Phase 4: who may see the technical devInfo row. Read the current user's roles
  // from UserContext (guarded — the provider may be absent on some shells) and
  // resolve via roles.js, never a hardcoded role string. useUser() returns the
  // raw context value (undefined without a provider), hence the optional chain.
  const user = useUser()?.user;
  const showDiagnostics = canViewDiagnostics(user?.roles);

  // Phase 10.1 — one-click "Report this problem" from a toast. openSupportReport
  // (from the support context) opens the shared report modal pre-filled from the
  // alert; the modal captures route/user/role/page/diagnostics and posts to the
  // dev/support system. useSupportReport returns the default (noop) context if a
  // provider is somehow absent, so this stays safe on every shell.
  const { openSupportReport } = useSupportReport();

  // Re-render when a report is filed so the originating toast flips to
  // "Reported ✓" (dedup state lives in the feedback bridge, shared with the modal
  // and the dev diagnostics page).
  const [, forceTick] = useState(0);
  useEffect(() => subscribeFeedbackState(() => forceTick((n) => n + 1)), []);

  const handleReport = useCallback(
    (alert) => {
      if (!alert || hasReportedAlert(alert.id)) return;
      openSupportReport({ prefill: buildToastReportPrefill(alert) });
    },
    [openSupportReport]
  );

  // Auto-dismiss timers, keyed by alert id. Owned here (not in AlertContext)
  // so they can be paused on hover/focus. Each entry tracks the remaining time
  // so a pause banks elapsed time and a resume continues from where it left off.
  const timersRef = useRef(new Map());

  // Reconcile timers against the current alert list: start timers for new
  // auto-closing alerts, drop timers for alerts that have gone.
  useEffect(() => {
    const timers = timersRef.current;
    const liveIds = new Set(alerts.map((a) => a.id));

    timers.forEach((entry, id) => {
      if (!liveIds.has(id)) {
        window.clearTimeout(entry.timeoutId);
        timers.delete(id);
      }
    });

    alerts.forEach((alert) => {
      if (alert.autoClose === false) return;
      if (timers.has(alert.id)) return;
      const duration = alert.duration || 5000;
      const entry = { remaining: duration, start: Date.now(), running: true, timeoutId: null };
      entry.timeoutId = window.setTimeout(() => {
        timers.delete(alert.id);
        dismissAlert(alert.id);
      }, duration);
      timers.set(alert.id, entry);
    });
  }, [alerts, dismissAlert]);

  // Clear every timer on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((entry) => window.clearTimeout(entry.timeoutId));
      timers.clear();
    };
  }, []);

  const pauseTimer = useCallback((id) => {
    const entry = timersRef.current.get(id);
    if (!entry || !entry.running) return;
    window.clearTimeout(entry.timeoutId);
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.start));
    entry.running = false;
  }, []);

  const resumeTimer = useCallback(
    (id) => {
      const entry = timersRef.current.get(id);
      if (!entry || entry.running) return;
      if (entry.remaining <= 0) {
        timersRef.current.delete(id);
        dismissAlert(id);
        return;
      }
      entry.start = Date.now();
      entry.running = true;
      entry.timeoutId = window.setTimeout(() => {
        timersRef.current.delete(id);
        dismissAlert(id);
      }, entry.remaining);
    },
    [dismissAlert]
  );

  // Show the 3 most recent alerts, newest on top.
  const visibleAlerts = alerts.slice(-3).reverse();
  const latest = alerts.length ? alerts[alerts.length - 1] : null;
  const liveMessage = latest ? `${getToastTone(latest.type).label}: ${latest.message}` : "";

  // The container is always mounted (even when empty) so the live region
  // persists and can announce the next alert.
  return (
    <div className="app-toast-stack">
      <div
        className="app-toast-stack__live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </div>

      {visibleAlerts.map((alert) => (
        <ToastItem
          key={alert.id}
          alert={alert}
          showDiagnostics={showDiagnostics}
          onReport={handleReport}
          reported={hasReportedAlert(alert.id)}
          onDismiss={() => dismissAlert(alert.id)}
          onPause={() => pauseTimer(alert.id)}
          onResume={() => resumeTimer(alert.id)}
        />
      ))}
    </div>
  );
}
