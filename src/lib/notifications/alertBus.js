let listeners = new Set();
let alertCounter = 0;

// Fallback-only tone inference for LEGACY / untyped callers (bare window.alert,
// or a showAlert call with no explicit type). New code reports via
// src/lib/notifications/report.js, which always passes an explicit `type`, so
// this brittle emoji/keyword guess never runs for those calls. Do not add new
// callers that rely on it — pass `type` explicitly. (Phase 3, Frontend Feedback
// & Error System.)
const deriveTypeFromMessage = (message = "") => {
  const normalized = String(message).toLowerCase();
  if (normalized.includes("✅") || normalized.includes("success")) return "success";
  if (normalized.includes("⚠") || normalized.includes("warning")) return "warning";
  if (
    normalized.includes("❌") ||
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("unable") ||
    normalized.includes("cannot")
  ) {
    return "error";
  }
  return "info";
};

export const showAlert = (message, type = null, options = {}) => {
  const payload = typeof message === "string" ? { message } : message || {};
  const alert = {
    id: payload.id || `alert-${Date.now()}-${++alertCounter}`,
    message: payload.message || "",
    // Priority: explicit payload.type → explicit `type` arg → inferred (fallback).
    type: payload.type || type || deriveTypeFromMessage(payload.message),
    autoClose: payload.autoClose !== undefined ? payload.autoClose : options.autoClose ?? true,
    duration: payload.duration || options.duration || 5000,
    devInfo: payload.devInfo || options.devInfo || null,
    // Phase 4: short, human-quotable error reference (set by buildErrorAlert).
    // Shown to everyone; the full devInfo above is role-gated in the renderer.
    referenceCode: payload.referenceCode || options.referenceCode || null,
  };
  listeners.forEach((listener) => listener(alert));
  return alert.id;
};

export const subscribeToAlerts = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

if (typeof window !== "undefined" && !window.__APP_ALERT_OVERRIDE__) {
  window.alert = (message) => {
    showAlert({
      message: typeof message === "string" ? message : JSON.stringify(message),
      type: deriveTypeFromMessage(message),
    });
  };
  window.__APP_ALERT_OVERRIDE__ = true;
}
