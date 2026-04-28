// file location: src/lib/jobs/logActivityClient.js
// Client-side wrapper around POST /api/jobs/log-activity. Fire-and-forget: any
// failure is swallowed so logging never blocks user flows.
export async function logJobActivityClient(payload) {
  try {
    await fetch("/api/jobs/log-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
  } catch (err) {
    console.warn("logJobActivityClient failed:", err?.message || err);
  }
}
