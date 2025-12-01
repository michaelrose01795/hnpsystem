import { supabaseService } from "@/lib/supabaseClient";

const COMPLETED_STATUSES = [
  "Complete",
  "Completed",
  "Invoiced",
  "Delivered",
  "Delivered to Customer",
  "Archived",
];

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
      .from("jobs")
      .select(
        `
          id,
          job_number,
          customer,
          vehicle_reg,
          vehicle_make_model,
          status,
          created_at,
          updated_at
        `
      )
      .in("status", COMPLETED_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(numericLimit);

    if (trimmedQuery) {
      const escaped = trimmedQuery.replace(/%/g, "\\%");
      queryBuilder = queryBuilder.or(
        [
          `job_number.ilike.%${escaped}%`,
          `vehicle_reg.ilike.%${escaped}%`,
          `customer.ilike.%${escaped}%`,
        ].join(",")
      );
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw error;
    }

    const formatted = (data || []).map((job) => ({
      id: job.id,
      jobNumber: job.job_number,
      customer: job.customer,
      vehicleReg: job.vehicle_reg,
      vehicleMakeModel: job.vehicle_make_model,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ archive search error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to search archived jobs" });
  }
}
