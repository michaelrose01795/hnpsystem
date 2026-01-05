// file location: src/pages/api/parts/goods-in/[goodsInId]/items.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";
import { isValidUuid, resolveAuditIds } from "@/lib/utils/ids";

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
  part_catalog_id,
  part_number,
  main_part_number,
  description,
  bin_location,
  franchise,
  retail_price,
  cost_price,
  discount_code,
  surcharge,
  quantity,
  claim_number,
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
  added_to_job,
  job_id,
  job_number,
  job_allocation_payload,
  notes,
  created_by_user_id,
  created_by_auth_uuid,
  created_at,
  updated_at
`;

const normaliseNumber = (value, { defaultValue = null, min = null } = {}) => {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  if (min !== null && parsed < min) {
    return min;
  }
  return parsed;
};

const normaliseQuantity = (value) =>
  normaliseNumber(value, { defaultValue: 1, min: 0 }) || 1;

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

const normaliseSalePrices = (value) => {
  const parsed = Array.isArray(value) ? value : normaliseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .slice(0, 4)
    .map((entry, index) => {
      if (entry === null || entry === undefined) return null;
      if (typeof entry === "number") {
        return { tier: index + 1, price: entry };
      }
      const price = normaliseNumber(entry.price ?? entry.amount, { defaultValue: null });
      if (price === null) return null;
      return {
        tier: entry.tier || entry.label || `Sale ${index + 1}`,
        price,
        note: entry.note || entry.description || null,
      };
    })
    .filter(Boolean);
};

const cleanText = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const ensureGoodsInRecord = async (goodsInId) => {
  const { data, error } = await supabase
    .from("parts_goods_in")
    .select("id, goods_in_number")
    .eq("id", goodsInId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
};

const nextLineNumber = async (goodsInId) => {
  const { data, error } = await supabase
    .from("parts_goods_in_items")
    .select("line_number")
    .eq("goods_in_id", goodsInId)
    .order("line_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Unable to fetch next line number:", error);
    return 1;
  }

  const current = Number.parseInt(data?.line_number, 10);
  if (Number.isNaN(current)) {
    return 1;
  }

  return current + 1;
};

async function handler(req, res, session) {
  const { goodsInId } = req.query || {};

  if (!goodsInId || !isValidUuid(goodsInId)) {
    return res.status(400).json({ success: false, message: "Valid goods-in ID is required" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("parts_goods_in_items")
        .select(ITEM_SELECT)
        .eq("goods_in_id", goodsInId)
        .order("line_number", { ascending: true });

      if (error) throw error;

      return res.status(200).json({ success: true, items: data || [] });
    } catch (error) {
      console.error("Failed to load goods-in items:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load goods-in items",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const goodsIn = await ensureGoodsInRecord(goodsInId);
    if (!goodsIn) {
      return res.status(404).json({ success: false, message: "Goods-in record not found" });
    }

    const {
      partId,
      partNumber,
      mainPartNumber,
      description,
      binLocation,
      franchise,
      retailPrice,
      costPrice,
      discountCode,
      surcharge,
      quantity,
      claimNumber,
      packSize,
      vatRate,
      salePrices,
      purchaseDetails,
      dealerDetails,
      stockDetails,
      userDefined,
      linkMetadata,
      salesHistory,
      audiMetadata,
      additionalFields,
      onlineStore,
      customAttributes,
      notes,
      jobId,
      jobNumber,
      jobAllocationPayload,
      addedToJob,
      userId,
      userNumericId,
    } = req.body || {};

    const { uuid: auditUuid, numeric: auditNumeric } = resolveAuditIds(userId, userNumericId);

    try {
      const payload = {
        goods_in_id: goodsInId,
        line_number: await nextLineNumber(goodsInId),
        part_catalog_id: partId || null,
        part_number: cleanText(partNumber),
        main_part_number: cleanText(mainPartNumber),
        description: cleanText(description),
        bin_location: cleanText(binLocation),
        franchise: cleanText(franchise),
        retail_price: normaliseNumber(retailPrice, { defaultValue: null }),
        cost_price: normaliseNumber(costPrice, { defaultValue: null }),
        discount_code: cleanText(discountCode),
        surcharge: normaliseNumber(surcharge, { defaultValue: null }),
        quantity: normaliseQuantity(quantity),
        claim_number: cleanText(claimNumber),
        pack_size: cleanText(packSize),
        vat_rate: cleanText(vatRate),
        sales_prices: normaliseSalePrices(salePrices),
        purchase_details: normaliseJson(purchaseDetails, {}),
        dealer_details: normaliseJson(dealerDetails, {}),
        stock_details: normaliseJson(stockDetails, {}),
        user_defined: normaliseJson(userDefined, {}),
        link_metadata: normaliseJson(linkMetadata, {}),
        sales_history: normaliseJson(salesHistory, {}),
        audi_metadata: normaliseJson(audiMetadata, {}),
        additional_fields: normaliseJson(additionalFields, {}),
        online_store: normaliseJson(onlineStore, {}),
        attributes: normaliseJson(customAttributes, {}),
        notes: cleanText(notes),
        added_to_job: Boolean(addedToJob),
        job_id: jobId || null,
        job_number: cleanText(jobNumber),
        job_allocation_payload: normaliseJson(jobAllocationPayload, {}),
        created_by_user_id: auditNumeric,
        created_by_auth_uuid: auditUuid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("parts_goods_in_items")
        .insert([payload])
        .select(ITEM_SELECT)
        .single();

      if (error) throw error;

      await supabase
        .from("parts_goods_in")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", goodsInId);

      return res.status(201).json({ success: true, item: data });
    } catch (error) {
      console.error("Failed to add goods-in item:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to add goods-in item",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
