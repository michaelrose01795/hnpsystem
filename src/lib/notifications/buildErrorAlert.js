// Builds a showAlert-compatible payload for error scenarios.
// `userMessage`  — friendly sentence shown in the toast
// `err`          — the caught Error object (or any thrown value)
// `context`      — optional key/value pairs a dev would need (endpoint, file name, job number, etc.)
//
// The returned object can be spread directly into showAlert():
//   showAlert(buildErrorAlert("Upload failed", err, { endpoint: "/api/vhc/upload-media" }))

export function buildErrorAlert(userMessage, err, context = {}) {
  const timestamp = new Date().toISOString();

  const lines = [
    "=== HNP SYSTEM ERROR ===",
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
    devInfo: lines.join("\n"),
  };
}
