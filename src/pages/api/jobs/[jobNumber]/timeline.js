// file location: src/pages/api/jobs/[jobNumber]/timeline.js
import { createClient } from "@supabase/supabase-js"; // import supabase client

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Extract jobNumber from the request URL
  const { jobNumber } = req.query;

  try {
    // 1️⃣ Get the job ID from the jobs table based on job number
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // 2️⃣ Call the get_job_timeline() SQL function via RPC
    const { data: timeline, error: timelineError } = await supabase.rpc(
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
