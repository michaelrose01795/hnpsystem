// file location: src/pages/api/status/snapshot.js
import { buildJobStatusSnapshot } from "@/lib/status/jobStatusSnapshot";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobId, jobNumber } = req.query || {};

  try {
    const result = await buildJobStatusSnapshot({ jobId, jobNumber });
    if (!result?.success) {
      const statusCode = result?.status || (result?.error === "Job not found" ? 404 : 400);
      return res.status(statusCode).json({ success: false, error: result?.error || "Unable to build snapshot" });
    }

    return res.status(200).json({
      success: true,
      snapshot: result.data,
    });
  } catch (error) {
    console.error("Status snapshot API error", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
