// file location: src/pages/api/status/search.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";

const JOB_SELECT = `
  id,
  job_number,
  customer,
  vehicle_reg,
  vehicle_make_model,
  description,
  updated_at
`;

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const queryText = String(req.query?.q || "").trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 8, 1), 20);

  if (!queryText) {
    return res.status(200).json({ success: true, jobs: [] });
  }

  try {
    const term = `%${queryText}%`;
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_SELECT)
      .or(
        `job_number.ilike.${term},vehicle_reg.ilike.${term},customer.ilike.${term},description.ilike.${term},vehicle_make_model.ilike.${term}`
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      jobs: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    console.error("Status search API error", error);
    return res.status(500).json({
      success: false,
      error: "Unable to search jobs",
    });
  }
}

export default withRoleGuard(handler);
