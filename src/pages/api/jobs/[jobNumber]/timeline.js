// file location: src/pages/api/jobs/[jobNumber]/timeline.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabaseService } from "@/lib/database/supabaseClient";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseService) {
    return res.status(503).json({ error: "Database service is unavailable" });
  }

  // Extract jobNumber from the request URL
  const jobNumber = Array.isArray(req.query.jobNumber)
    ? req.query.jobNumber[0]
    : String(req.query.jobNumber || "").trim();
  if (!jobNumber || jobNumber.length > 100) {
    return res.status(400).json({ error: "Invalid job number" });
  }

  try {
    // 1️⃣ Get the job ID from the jobs table based on job number
    const { data: job, error: jobError } = await supabaseService
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // 2️⃣ Call the get_job_timeline() SQL function via RPC
    const { data: timeline, error: timelineError } = await supabaseService.rpc(
      "get_job_timeline",
      { p_job_id: job.id } // parameter name must match SQL function
    );

    if (timelineError) {
      console.error(timelineError);
      return res.status(500).json({ error: "Failed to fetch timeline" });
    }

    // 3️⃣ Return timeline as JSON
    return res.status(200).json({
      jobNumber,
      timeline,
      count: timeline.length,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}

export default withRoleGuard(handler);
