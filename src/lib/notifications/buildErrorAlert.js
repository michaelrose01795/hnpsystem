// Builds a showAlert-compatible payload for error scenarios.
// `userMessage`  — friendly sentence shown in the toast
// `err`          — the caught Error object (or any thrown value)
// `context`      — optional key/value pairs a dev would need (endpoint, file name, job number, etc.)
//
// The returned object can be spread directly into showAlert():
//   showAlert(buildErrorAlert("Upload failed", err, { endpoint: "/api/vhc/upload-media" }))
//
// Phase 4 (Frontend Feedback & Error System): every error is stamped with a
// short, human-quotable REFERENCE CODE (e.g. "ERR-K3F9Q2"). The code is embedded
// at the top of `devInfo` AND returned as `referenceCode` on the payload, so the
// renderer can show it to everyone (staff quote it to support) while gating the
// full technical `devInfo` behind a diagnostic role.

// Monotonic counter so two errors minted in the same millisecond still differ.
let refCounter = 0;

/**
 * Generate a short, human-quotable error reference code, e.g. "ERR-K3F9Q2".
 * Time-seeded (base36) + a rolling counter — unique enough to correlate a
 * staff-reported code with the full devInfo logged against it, never so long a
 * user can't read it aloud.
 * @returns {string}
 */
export function generateReferenceCode() {
  const time = Date.now().toString(36).toUpperCase().slice(-4);
  const seq = (++refCounter).toString(36).toUpperCase().padStart(2, "0").slice(-2);
  return `ERR-${time}${seq}`;
}

export function buildErrorAlert(userMessage, err, context = {}) {
  const timestamp = new Date().toISOString();
  const referenceCode = generateReferenceCode();

  const lines = [
    "=== HNP SYSTEM ERROR ===",
    `Reference: ${referenceCode}`,
    `Timestamp: ${timestamp}`,
    "",
    `User Message: ${userMessage}`,
    `Technical Error: ${err?.message || String(err)}`,
    `Error Type: ${err?.name || "Error"}`,
  ];

  const contextEntries = Object.entries(context).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (contextEntries.length > 0) {
    lines.push("", "Context:");
    for (const [key, value] of contextEntries) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (err?.stack) {
    lines.push("", "Stack Trace:", err.stack);
  }

  return {
    message: userMessage,
    type: "error",
    autoClose: false,
    referenceCode,
    devInfo: lines.join("\n"),
  };
}
