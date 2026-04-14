let listeners = new Set();
let alertCounter = 0;

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

export const showAlert = (message, type = "info", options = {}) => {
  const payload = typeof message === "string" ? { message } : message || {};
  const alert = {
    id: payload.id || `alert-${Date.now()}-${++alertCounter}`,
    message: payload.message || "",
    type: payload.type || type || deriveTypeFromMessage(payload.message),
    autoClose: payload.autoClose !== undefined ? payload.autoClose : options.autoClose ?? true,
    duration: payload.duration || options.duration || 5000,
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
