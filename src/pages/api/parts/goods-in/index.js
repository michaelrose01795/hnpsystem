// file location: src/pages/api/parts/goods-in/index.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/supabaseClient";
import { resolveAuditIds } from "@/lib/utils/ids";

const GOODS_IN_ROLES = [
  "parts",
  "parts manager",
  "service",
  "service manager",
  "workshop manager",
  "after sales manager",
  "aftersales manager",
];
const GOODS_IN_NUMBER_PREFIX = "GIN-";
const GOODS_IN_PAD_LENGTH = 5;
const GOODS_IN_SELECT = `
  id,
  goods_in_number,
  supplier_account_id,
  supplier_name,
  supplier_address,
  supplier_contact,
  invoice_number,
  delivery_note_number,
  invoice_date,
  price_level,
  notes,
  scan_payload,
  status,
  created_by_user_id,
  created_by_auth_uuid,
  completed_at,
  created_at,
  updated_at
`;

const parseDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const sanitizeText = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parsePriceLevel = (value) => {
  const allowed = ["stock_order_rate", "retail", "trade", "other"];
  const normalised = sanitizeText(value);
  if (!normalised) return "stock_order_rate";
  const safe = normalised.toLowerCase().replace(/\s+/g, "_");
  return allowed.includes(safe) ? safe : normalised;
};

const parseScanPayload = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Unable to parse scan payload, storing raw string.");
    return { raw: String(value) };
  }
};

const fetchNextGoodsInNumber = async () => {
  const { data, error } = await supabase
    .from("parts_goods_in")
    .select("goods_in_number")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load latest goods in number:", error);
    return `${GOODS_IN_NUMBER_PREFIX}${String(1).padStart(GOODS_IN_PAD_LENGTH, "0")}`;
  }

  if (!data?.goods_in_number) {
    return `${GOODS_IN_NUMBER_PREFIX}${String(1).padStart(GOODS_IN_PAD_LENGTH, "0")}`;
  }

  const numericPortion = Number.parseInt(data.goods_in_number.replace(/\D/g, ""), 10);
  if (Number.isNaN(numericPortion)) {
    return `${GOODS_IN_NUMBER_PREFIX}${String(Date.now()).slice(-GOODS_IN_PAD_LENGTH)}`;
  }

  return `${GOODS_IN_NUMBER_PREFIX}${String(numericPortion + 1).padStart(
    GOODS_IN_PAD_LENGTH,
    "0"
  )}`;
};

const createGoodsInRecord = async (payload) => {
  let attempt = 0;
  const maxAttempts = 3;
  let lastError = null;

  while (attempt < maxAttempts) {
    const goodsInNumber = await fetchNextGoodsInNumber();
    const insertPayload = {
      ...payload,
      goods_in_number: goodsInNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("parts_goods_in")
      .insert([insertPayload])
      .select(GOODS_IN_SELECT)
      .single();

    if (!error) {
      return data;
    }

    lastError = error;
    if (error.code === "23505" || error.message?.includes("duplicate key value")) {
      attempt += 1;
      continue;
    }
    break;
  }

  throw lastError || new Error("Unable to create goods-in record");
};

async function handler(req, res, session) {
  if (req.method === "GET") {
    const {
      goodsInId,
      goodsInNumber,
      status = "all",
      limit = "20",
      offset = "0",
      includeItems = "false",
      search = "",
    } = req.query || {};

    try {
      if (goodsInId || goodsInNumber) {
        let query = supabase.from("parts_goods_in").select(
          includeItems === "true"
            ? `${GOODS_IN_SELECT}, items:parts_goods_in_items(*)`
            : GOODS_IN_SELECT
        );

        if (goodsInId) {
          query = query.eq("id", goodsInId);
        } else {
          query = query.eq("goods_in_number", goodsInNumber);
        }

        const { data, error } = await query.single();
        if (error) {
          if (error.code === "PGRST116") {
            return res.status(404).json({ success: false, message: "Goods in record not found" });
          }
          throw error;
        }

        return res.status(200).json({ success: true, goodsIn: data });
      }

      const from = Number.parseInt(offset, 10) || 0;
      const to = from + (Number.parseInt(limit, 10) || 20) - 1;
      const includeItemRows = includeItems === "true";
      let listQuery = supabase
        .from("parts_goods_in")
        .select(includeItemRows ? `${GOODS_IN_SELECT}, items:parts_goods_in_items(*)` : GOODS_IN_SELECT, {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (status !== "all") {
        listQuery = listQuery.eq("status", status);
      }

      if (search) {
        const term = `%${search.trim()}%`;
        listQuery = listQuery.or(
          `goods_in_number.ilike.${term},invoice_number.ilike.${term},supplier_name.ilike.${term}`
        );
      }

      const { data, error, count } = await listQuery;
      if (error) throw error;

      return res.status(200).json({
        success: true,
        goodsIn: data || [],
        count: count || 0,
      });
    } catch (error) {
      console.error("Failed to fetch goods-in records:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load goods-in records",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const {
      supplierAccountId,
      supplierName,
      supplierAddress,
      supplierContact,
      invoiceNumber,
      deliveryNoteNumber,
      invoiceDate,
      priceLevel,
      notes,
      scanPayload,
      userId,
      userNumericId,
    } = req.body || {};

    if (!supplierName) {
      return res.status(400).json({ success: false, message: "Supplier name is required" });
    }

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required" });
    }

    const { uuid: auditUuid, numeric: auditNumeric } = resolveAuditIds(userId, userNumericId);
    const invoiceDateValue = parseDateOnly(invoiceDate) || new Date().toISOString().slice(0, 10);

    try {
      const created = await createGoodsInRecord({
        supplier_account_id: sanitizeText(supplierAccountId),
        supplier_name: supplierName.trim(),
        supplier_address: sanitizeText(supplierAddress),
        supplier_contact: sanitizeText(supplierContact),
        invoice_number: invoiceNumber.trim(),
        delivery_note_number: sanitizeText(deliveryNoteNumber),
        invoice_date: invoiceDateValue,
        price_level: parsePriceLevel(priceLevel),
        notes: sanitizeText(notes),
        scan_payload: parseScanPayload(scanPayload),
        status: "draft",
        created_by_user_id: auditNumeric,
        created_by_auth_uuid: auditUuid,
      });

      return res.status(201).json({ success: true, goodsIn: created });
    } catch (error) {
      console.error("Failed to create goods-in record:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to create goods-in record",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
