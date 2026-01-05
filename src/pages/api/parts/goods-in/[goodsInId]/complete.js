// file location: src/pages/api/parts/goods-in/[goodsInId]/complete.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";
import { isValidUuid } from "@/lib/utils/ids";

const GOODS_IN_ROLES = [
  "parts",
  "parts manager",
  "service",
  "service manager",
  "workshop manager",
  "after sales manager",
  "aftersales manager",
];
const GOODS_IN_SELECT = `
  id,
  goods_in_number,
  supplier_account_id,
  supplier_name,
  invoice_number,
  delivery_note_number,
  invoice_date,
  price_level,
  notes,
  status,
  completed_at,
  created_at,
  updated_at
`;
const ITEM_SUMMARY_SELECT = `
  id,
  goods_in_id,
  line_number,
  part_number,
  description,
  quantity,
  retail_price,
  cost_price,
  added_to_job,
  job_number
`;

async function handler(req, res, session) {
  const { goodsInId } = req.query || {};

  if (!goodsInId || !isValidUuid(goodsInId)) {
    return res.status(400).json({ success: false, message: "Valid goods-in ID is required" });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST,PATCH");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
      .from("parts_goods_in")
      .update({
        status: "completed",
        completed_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", goodsInId)
      .select(`${GOODS_IN_SELECT}, items:parts_goods_in_items(${ITEM_SUMMARY_SELECT})`)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Goods-in record not found" });
      }
      throw error;
    }

    return res.status(200).json({ success: true, goodsIn: data });
  } catch (error) {
    console.error("Failed to complete goods-in record:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to complete goods-in record",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
