import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { supabaseService } from "@/lib/supabaseClient";

const MAX_RESULTS = 50;

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (!jobNumber || typeof jobNumber !== "string") {
    return res.status(400).json({ message: "Job number is required" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  if (!supabaseService) {
    return res.status(500).json({
      message:
        "Supabase service role is required to load warranty jobs in this environment.",
    });
  }

  try {
    const jobCard = await getJobByNumberOrReg(jobNumber);
    if (!jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const { data, error } = await supabaseService
      .from("jobs")
      .select(
        "id, job_number, status, job_source, vehicle_reg, vehicle_make_model, warranty_linked_job_id"
      )
      .eq("job_source", "Warranty")
      .neq("id", jobCard.id)
      .order("created_at", { ascending: false })
      .limit(MAX_RESULTS);

    if (error) {
      throw error;
    }

    const filtered = (data || []).filter(
      (record) =>
        !record.warranty_linked_job_id ||
        record.warranty_linked_job_id === jobCard.id
    );

    return res.status(200).json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error("❌ Warranty options API error:", error);
    return res.status(500).json({
      message: "Unable to load warranty job options",
    });
  }
}
