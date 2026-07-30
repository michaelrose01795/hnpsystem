const CLIENT_SESSION_KEY = "hnp:audit:client-session";
const SERVER_SESSION_KEY = "hnp:audit:server-session";
const SESSION_ENDED_KEY = "hnp:audit:ended";

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.sessionStorage);

export const createClientAuditId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : null;

export function getClientAuditSessionId() {
  if (!canUseStorage()) return null;
  let id = window.sessionStorage.getItem(CLIENT_SESSION_KEY);
  if (!id) {
    id = createClientAuditId();
    if (id) window.sessionStorage.setItem(CLIENT_SESSION_KEY, id);
  }
  return id;
}

export function setClientAuditSessionId(value) {
  if (!canUseStorage() || !value) return;
  window.sessionStorage.setItem(CLIENT_SESSION_KEY, value);
}

export const getServerAuditSessionId = () =>
  canUseStorage() ? window.sessionStorage.getItem(SERVER_SESSION_KEY) : null;

export function setServerAuditSessionId(value) {
  if (!canUseStorage() || !value) return;
  window.sessionStorage.setItem(SERVER_SESSION_KEY, value);
  window.sessionStorage.removeItem(SESSION_ENDED_KEY);
}

export function clearAuditSession() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(CLIENT_SESSION_KEY);
  window.sessionStorage.removeItem(SERVER_SESSION_KEY);
  window.sessionStorage.setItem(SESSION_ENDED_KEY, "1");
}

export async function endCurrentAuditSession({
  status = "logged_out",
  endReason = "explicit_logout",
  keepalive = true,
} = {}) {
  const sessionId = getServerAuditSessionId();
  if (!sessionId || !canUseStorage()) return;
  try {
    await fetch("/api/audit/session", {
      method: "POST",
      credentials: "include",
      keepalive,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", sessionId, status, endReason }),
    });
  } catch {
    // The stale-session maintenance function safely closes unclean sessions.
  } finally {
    clearAuditSession();
  }
}

export const AUDIT_CLIENT_STORAGE_KEYS = {
  clientSession: CLIENT_SESSION_KEY,
  serverSession: SERVER_SESSION_KEY,
  ended: SESSION_ENDED_KEY,
};

export async function recordClientAuditEvent(event) {
  const sessionId = getServerAuditSessionId();
  if (!sessionId || typeof window === "undefined") return;
  try {
    await fetch("/api/audit/events", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, event }),
    });
  } catch {
    // Audit transport must not change the outcome of the originating action.
  }
}
