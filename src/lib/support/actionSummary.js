// file location: src/lib/support/actionSummary.js
//
// Pre-Phase-5 enhancement — turns the captured diagnostics snapshot into a
// plain-English description draft for the Help & Diagnostics ("support") report
// popup. The user always sees this pre-filled into the editable description box
// and is free to correct it or add detail.
//
// PURE + dependency-free so it runs in the node Vitest environment. It only
// reads the ALREADY-SANITISED snapshot produced by captureDiagnostics() — every
// field it touches (route, action labels, section keys) was scrubbed at record
// time, so this adds no new privacy surface.

const DEFAULT_LIMIT = 10;

/**
 * One plain-English sentence describing a single recorded action. The shapes
 * mirror recordAction()'s output (route_change / click / render_error /
 * boundary_* / generic).
 * @param {object} [action]
 * @returns {string}
 */
export function describeAction(action = {}) {
  const type = action?.type || "action";
  const where = action?.sectionKey ? ` (${action.sectionKey})` : "";

  switch (type) {
    case "route_change":
      return action?.to
        ? `Opened ${action.to}${action.from ? ` from ${action.from}` : ""}`
        : "Navigated to another page";
    case "click":
      if (action?.label) return `Clicked "${action.label}"${where}`;
      if (action?.sectionKey) return `Interacted with ${action.sectionKey}`;
      return "Clicked something on the page";
    case "render_error":
      return `A screen error occurred${action?.label ? `: ${action.label}` : ""}${where}`;
    case "boundary_caught":
      return `The app caught an error${action?.label ? `: ${action.label}` : ""}${where}`;
    case "boundary_retry":
      return "Pressed “Try again” after an error";
    case "boundary_reload":
      return "Reloaded the app after an error";
    case "boundary_report":
      return "Opened this report form after an error";
    default:
      return action?.label ? `${type}: ${action.label}` : type;
  }
}

/**
 * Build the auto-filled description draft from a (sanitised) diagnostics
 * snapshot. Summarises the current page, any detected error / failed-request
 * signals, and the last N recorded actions as a numbered list, then leaves a
 * clearly-labelled space for the user to say what actually went wrong.
 *
 * @param {object} snapshot captureDiagnostics() output
 * @param {{ limit?: number }} [opts]
 * @returns {string}
 */
export function buildDescriptionDraft(snapshot, { limit = DEFAULT_LIMIT } = {}) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
  const actions = Array.isArray(snapshot?.recent_actions) ? snapshot.recent_actions : [];
  const recent = actions.slice(-safeLimit);

  const page = snapshot?.route?.asPath || snapshot?.route?.pathname || null;
  const errorCount =
    (Array.isArray(snapshot?.unhandled_errors) ? snapshot.unhandled_errors.length : 0) +
    (Array.isArray(snapshot?.console_errors) ? snapshot.console_errors.length : 0);
  const failedRequests = Array.isArray(snapshot?.failed_requests) ? snapshot.failed_requests.length : 0;

  const lines = [];
  lines.push("[Auto-filled from what the system saw — please edit or correct anything below.]");
  lines.push("");
  if (page) lines.push(`Page: ${page}`);

  const signals = [];
  if (errorCount) signals.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
  if (failedRequests) signals.push(`${failedRequests} failed request${failedRequests === 1 ? "" : "s"}`);
  if (signals.length) lines.push(`Detected: ${signals.join(", ")}.`);

  lines.push("");
  if (recent.length) {
    lines.push(`Recent steps (last ${recent.length}):`);
    recent.forEach((action, index) => {
      lines.push(`${index + 1}. ${describeAction(action)}`);
    });
  } else {
    lines.push("Recent steps: none were captured.");
  }

  lines.push("");
  lines.push("What went wrong / what I expected:");
  lines.push("");

  return lines.join("\n");
}
