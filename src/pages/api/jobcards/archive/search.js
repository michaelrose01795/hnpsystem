import { supabaseService } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key not configured" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { q = "", limit = "25" } = req.query;
    const trimmedQuery = String(q || "").trim();
    const numericLimit = Math.min(50, Math.max(1, Number(limit) || 25));

    let queryBuilder = supabaseService
      .from("job_archive")
      .select(
        `
          archive_id,
          job_id,
          job_number,
          customer_name,
          vehicle_reg,
          vehicle_make_model,
          status,
          completed_at,
          created_at
        `
      )
      .order("completed_at", { ascending: false })
      .limit(numericLimit);

    if (trimmedQuery) {
      const escaped = trimmedQuery.replace(/%/g, "\\%");
      queryBuilder = queryBuilder.or(
        [
          `job_number.ilike.%${escaped}%`,
          `vehicle_reg.ilike.%${escaped}%`,
          `customer_name.ilike.%${escaped}%`,
          `vehicle_make_model.ilike.%${escaped}%`,
        ].join(",")
      );
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw error;
    }

    const formatted = (data || []).map((job) => ({
      id: job.archive_id || job.job_id,
      jobNumber: job.job_number,
      customer: job.customer_name,
      vehicleReg: job.vehicle_reg,
      vehicleMakeModel: job.vehicle_make_model,
      status: job.status || "Archived",
      createdAt: job.created_at,
      updatedAt: job.completed_at || job.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ archive search error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to search archived jobs" });
  }
}
