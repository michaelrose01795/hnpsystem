// file location: src/pages/api/parts/goods-in/items/[itemId].js

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
const ITEM_SELECT = `
  id,
  goods_in_id,
  line_number,
  part_number,
  main_part_number,
  description,
  quantity,
  retail_price,
  cost_price,
  bin_location,
  franchise,
  discount_code,
  surcharge,
  pack_size,
  vat_rate,
  sales_prices,
  purchase_details,
  dealer_details,
  stock_details,
  user_defined,
  link_metadata,
  sales_history,
  audi_metadata,
  additional_fields,
  online_store,
  attributes,
  part_catalog_id,
  added_to_job,
  job_id,
  job_number,
  job_allocation_payload,
  notes,
  updated_at
`;

const cleanText = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normaliseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Unable to parse JSON payload, using fallback.", value);
    return fallback;
  }
};

const ensureCatalogLink = async (item, { applyStock }) => {
  if (!item?.part_number) {
    return null;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("parts_catalog")
    .select("id, qty_in_stock, unit_cost, unit_price, storage_location")
    .eq("part_number", item.part_number)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw lookupError;
  }

  const timestamp = new Date().toISOString();
  const unitCost = item.cost_price ?? 0;
  const unitPrice = item.retail_price ?? 0;
  const storageLocation = item.bin_location || null;

  if (existing) {
    if (applyStock) {
      const nextStock = Number(existing.qty_in_stock || 0) + Number(item.quantity || 0);
      const { error: updateError } = await supabase
        .from("parts_catalog")
        .update({
          qty_in_stock: nextStock,
          unit_cost: unitCost || existing.unit_cost,
          unit_price: unitPrice || existing.unit_price,
          storage_location: storageLocation || existing.storage_location,
          updated_at: timestamp,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("parts_catalog")
    .insert({
      part_number: item.part_number,
      name: item.description || item.part_number,
      description: item.description || null,
      supplier: item.franchise || null,
      category: item.franchise || null,
      storage_location: storageLocation,
      unit_cost: unitCost || 0,
      unit_price: unitPrice || 0,
      qty_in_stock: applyStock ? Number(item.quantity || 0) : 0,
      qty_reserved: 0,
      qty_on_order: 0,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  return created?.id || null;
};

async function handler(req, res, session) {
  const { itemId } = req.query || {};

  if (!itemId || !isValidUuid(itemId)) {
    return res.status(400).json({ success: false, message: "Valid goods-in item ID is required" });
  }

  if (req.method === "DELETE") {
    try {
      const { data, error } = await supabase
        .from("parts_goods_in_items")
        .delete()
        .eq("id", itemId)
        .select("id")
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Goods-in item not found" });
        }
        throw error;
      }

      return res.status(200).json({ success: true, deletedId: data?.id || itemId });
    } catch (error) {
      console.error("Failed to delete goods-in item:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to delete goods-in item",
        error: error.message,
      });
    }
  }

  if (req.method !== "PATCH" && req.method !== "PUT") {
    res.setHeader("Allow", "PATCH,PUT,DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const {
    binLocation,
    franchise,
    discountCode,
    packSize,
    vatRate,
    addedToJob,
    jobId,
    jobNumber,
    jobAllocationPayload,
    notes,
    customAttributes,
    purchaseDetails,
    dealerDetails,
    stockDetails,
    userDefined,
    linkMetadata,
    salesHistory,
    audiMetadata,
    additionalFields,
    onlineStore,
  } = req.body || {};

  const updates = {};
  if (binLocation !== undefined) {
    updates.bin_location = cleanText(binLocation);
  }
  if (franchise !== undefined) {
    updates.franchise = cleanText(franchise);
  }
  if (discountCode !== undefined) {
    updates.discount_code = cleanText(discountCode);
  }
  if (packSize !== undefined) {
    updates.pack_size = cleanText(packSize);
  }
  if (vatRate !== undefined) {
    updates.vat_rate = cleanText(vatRate);
  }
  if (addedToJob !== undefined) {
    updates.added_to_job = Boolean(addedToJob);
  }
  if (jobId !== undefined) {
    updates.job_id = jobId || null;
  }
  if (jobNumber !== undefined) {
    updates.job_number = cleanText(jobNumber);
  }
  if (jobAllocationPayload !== undefined) {
    updates.job_allocation_payload = normaliseJson(jobAllocationPayload, {});
  }
  if (notes !== undefined) {
    updates.notes = cleanText(notes);
  }
  if (customAttributes !== undefined) {
    updates.attributes = normaliseJson(customAttributes, {});
  }
  if (purchaseDetails !== undefined) {
    updates.purchase_details = normaliseJson(purchaseDetails, {});
  }
  if (dealerDetails !== undefined) {
    updates.dealer_details = normaliseJson(dealerDetails, {});
  }
  if (stockDetails !== undefined) {
    updates.stock_details = normaliseJson(stockDetails, {});
  }
  if (userDefined !== undefined) {
    updates.user_defined = normaliseJson(userDefined, {});
  }
  if (linkMetadata !== undefined) {
    updates.link_metadata = normaliseJson(linkMetadata, {});
  }
  if (salesHistory !== undefined) {
    updates.sales_history = normaliseJson(salesHistory, {});
  }
  if (audiMetadata !== undefined) {
    updates.audi_metadata = normaliseJson(audiMetadata, {});
  }
  if (additionalFields !== undefined) {
    updates.additional_fields = normaliseJson(additionalFields, {});
  }
  if (onlineStore !== undefined) {
    updates.online_store = normaliseJson(onlineStore, {});
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "No valid updates supplied" });
  }

  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("parts_goods_in_items")
      .update(updates)
      .eq("id", itemId)
      .select(ITEM_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Goods-in item not found" });
      }
      throw error;
    }

    if (addedToJob === true) {
      const catalogId = data.part_catalog_id
        ? data.part_catalog_id
        : await ensureCatalogLink(data, { applyStock: false });

      if (catalogId && catalogId !== data.part_catalog_id) {
        const { data: relinked, error: relinkError } = await supabase
          .from("parts_goods_in_items")
          .update({ part_catalog_id: catalogId, updated_at: new Date().toISOString() })
          .eq("id", itemId)
          .select(ITEM_SELECT)
          .single();

        if (!relinkError && relinked) {
          return res.status(200).json({ success: true, item: relinked });
        }
      }
    }

    return res.status(200).json({ success: true, item: data });
  } catch (error) {
    console.error("Failed to update goods-in item:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update goods-in item",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
