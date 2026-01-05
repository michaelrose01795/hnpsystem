// file location: src/pages/api/parts/suppliers/search.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";

const GOODS_IN_ROLES = [
  "parts",
  "parts manager",
  "service",
  "service manager",
  "workshop manager",
  "after sales manager",
  "aftersales manager",
];
const SUPPLIER_SELECT = `
  account_id,
  billing_name,
  billing_email,
  billing_phone,
  billing_address_line1,
  billing_address_line2,
  billing_city,
  billing_postcode,
  account_type,
  status
`;

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { q = "", limit = "20" } = req.query || {};
  const size = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);

  try {
    let query = supabase
      .from("accounts")
      .select(SUPPLIER_SELECT)
      .order("updated_at", { ascending: false })
      .limit(size);

    if (q) {
      const term = `%${q.trim()}%`;
      query = query.or(
        `account_id.ilike.${term},billing_name.ilike.${term},billing_phone.ilike.${term},billing_city.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ success: true, suppliers: data || [] });
  } catch (error) {
    console.error("Failed to search suppliers:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to search supplier accounts",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
