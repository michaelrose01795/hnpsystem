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
  part_catalog_id,
  part_number,
  description,
  quantity,
  retail_price,
  cost_price,
  bin_location,
  franchise,
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

    // Process items and add/update them in the parts catalog
    const catalogUpdates = [];
    const errors = [];

    for (const item of data.items || []) {
      try {
        if (!item.part_number || !item.quantity || item.quantity <= 0) {
          continue; // Skip invalid items
        }

        const applyStock = !item.added_to_job;

        // Check if part exists in catalog
        const { data: existingPart } = await supabase
          .from("parts_catalog")
          .select("id, qty_in_stock, unit_cost, unit_price, storage_location")
          .eq("part_number", item.part_number)
          .maybeSingle();

        if (existingPart) {
          // UPDATE existing part: increase stock quantity
          if (applyStock) {
            const { error: updateError } = await supabase
              .from("parts_catalog")
              .update({
                qty_in_stock: existingPart.qty_in_stock + item.quantity,
                unit_cost: item.cost_price || existingPart.unit_cost,
                unit_price: item.retail_price || existingPart.unit_price,
                storage_location: item.bin_location || existingPart.storage_location,
                updated_at: timestamp,
              })
              .eq("id", existingPart.id);

            if (updateError) throw updateError;
          }

          // Link goods-in item to catalog part
          await supabase
            .from("parts_goods_in_items")
            .update({ part_catalog_id: existingPart.id })
            .eq("id", item.id);

          catalogUpdates.push({
            partNumber: item.part_number,
            action: applyStock ? "updated" : "linked",
            catalogId: existingPart.id,
            quantityAdded: applyStock ? item.quantity : 0,
          });
        } else {
          // INSERT new part into catalog
          const { data: newPart, error: insertError } = await supabase
            .from("parts_catalog")
            .insert({
              part_number: item.part_number,
              name: item.description || item.part_number,
              qty_in_stock: applyStock ? item.quantity : 0,
              unit_cost: item.cost_price || 0,
              unit_price: item.retail_price || 0,
              storage_location: item.bin_location || null,
              supplier: item.franchise || null,
              category: item.franchise || null,
              is_active: true,
              created_at: timestamp,
              updated_at: timestamp,
            })
            .select("id")
            .single();

          if (insertError) throw insertError;

          // Link goods-in item to new catalog part
          await supabase
            .from("parts_goods_in_items")
            .update({ part_catalog_id: newPart.id })
            .eq("id", item.id);

          catalogUpdates.push({
            partNumber: item.part_number,
            action: "created",
            catalogId: newPart.id,
            quantityAdded: applyStock ? item.quantity : 0,
          });
        }
      } catch (err) {
        console.error(`Failed to process part ${item.part_number}:`, err);
        errors.push({
          partNumber: item.part_number,
          error: err.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      goodsIn: data,
      catalogUpdates: {
        successful: catalogUpdates,
        failed: errors,
      },
    });
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
