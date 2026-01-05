// file location: src/pages/api/parts/jobs/search.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";

const PARTS_ROLES = ["parts", "parts manager"];
const JOB_SELECT = `
  id,
  job_number,
  customer,
  customer_id,
  vehicle_reg,
  vehicle_make_model,
  description,
  status,
  waiting_status,
  type,
  created_at,
  updated_at
`;

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { jobNumber, search = "", limit = "15" } = req.query || {};

  try {
    if (jobNumber) {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_SELECT)
        .eq("job_number", jobNumber.trim())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Job not found" });
        }
        throw error;
      }

      return res.status(200).json({ success: true, job: data });
    }

    const size = Math.min(Math.max(Number.parseInt(limit, 10) || 15, 1), 50);
    let query = supabase
      .from("jobs")
      .select(JOB_SELECT)
      .order("updated_at", { ascending: false })
      .limit(size);

    if (search) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `job_number.ilike.${term},vehicle_reg.ilike.${term},customer.ilike.${term},description.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ success: true, jobs: data || [] });
  } catch (error) {
    console.error("Failed to search jobs:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to search jobs",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: PARTS_ROLES });
