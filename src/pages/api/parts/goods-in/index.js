// file location: src/pages/api/parts/goods-in/index.js

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/database/supabaseClient";
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
  } catch {
    console.warn("Unable to parse scan payload, storing raw string.");
    return { raw: String(value) };
  }
};

const normalizeInvoiceNumber = (value) => {
  const cleaned = sanitizeText(value);
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, " ");
};

const findExistingSupplierInvoice = async ({ supplierAccountId, invoiceNumber }) => {
  const supplierId = sanitizeText(supplierAccountId);
  const invoice = normalizeInvoiceNumber(invoiceNumber);
  if (!supplierId || !invoice) return null;

  const { data, error } = await supabase
    .from("parts_goods_in")
    .select("id, goods_in_number, invoice_number")
    .eq("supplier_account_id", supplierId)
    .ilike("invoice_number", invoice)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const isDuplicateKeyError = (error) =>
  error?.code === "23505" || error?.message?.includes("duplicate key value");

const parseGoodsInSequence = (goodsInNumber) => {
  if (typeof goodsInNumber !== "string") return null;
  if (!goodsInNumber.startsWith(GOODS_IN_NUMBER_PREFIX)) return null;

  const numericPortion = Number.parseInt(
    goodsInNumber.slice(GOODS_IN_NUMBER_PREFIX.length),
    10
  );

  return Number.isFinite(numericPortion) ? numericPortion : null;
};

const formatGoodsInNumber = (sequence) =>
  `${GOODS_IN_NUMBER_PREFIX}${String(sequence).padStart(GOODS_IN_PAD_LENGTH, "0")}`;

const fetchNextGoodsInNumber = async (minimumSequence = 1) => {
  // Fetch every GIN- record and derive the max sequence numerically. We must
  // NOT rely on text ordering + a small limit: seeded rows like `GIN-FILL-00062`
  // sort ABOVE the real `GIN-000XX` numbers in text order (because 'F' > '0'),
  // so a top-N text slice can be entirely non-numeric junk that parses to null,
  // making us restart at GIN-00001 and collide with existing rows. Parsing all
  // rows and letting parseGoodsInSequence reject the non-numeric ones is robust.
  const { data, error } = await supabase
    .from("parts_goods_in")
    .select("goods_in_number")
    .like("goods_in_number", `${GOODS_IN_NUMBER_PREFIX}%`);

  if (error) {
    console.error("Failed to load latest goods in number:", error);
    return formatGoodsInNumber(
      Math.max(minimumSequence, Number(String(Date.now()).slice(-GOODS_IN_PAD_LENGTH)))
    );
  }

  const highestSequence = (data || []).reduce((highest, record) => {
    const sequence = parseGoodsInSequence(record?.goods_in_number);
    return sequence && sequence > highest ? sequence : highest;
  }, 0);

  return formatGoodsInNumber(Math.max(highestSequence + 1, minimumSequence));
};

const createGoodsInRecord = async (payload) => {
  let attempt = 0;
  const maxAttempts = 5;
  let lastError = null;
  let minimumSequence = 1;

  while (attempt < maxAttempts) {
    const goodsInNumber = await fetchNextGoodsInNumber(minimumSequence);
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
    if (isDuplicateKeyError(error)) {
      const failedSequence = parseGoodsInSequence(goodsInNumber);
      if (failedSequence) {
        minimumSequence = failedSequence + 1;
      }
      attempt += 1;
      continue;
    }
    break;
  }

  throw lastError || new Error("Unable to create goods-in record");
};

async function handler(req, res) {
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

    if (!supplierAccountId) {
      return res.status(400).json({
        success: false,
        message: "Supplier account is missing a linked ledger account. Open the supplier and set a linked account.",
      });
    }

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required" });
    }

    const { uuid: auditUuid, numeric: auditNumeric } = resolveAuditIds(userId, userNumericId);
    const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);
    const invoiceDateValue = parseDateOnly(invoiceDate) || new Date().toISOString().slice(0, 10);

    try {
      const existing = await findExistingSupplierInvoice({
        supplierAccountId,
        invoiceNumber: normalizedInvoiceNumber,
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Invoice number ${normalizedInvoiceNumber} already exists for this supplier (Goods In ${existing.goods_in_number}).`,
        });
      }

      const created = await createGoodsInRecord({
        supplier_account_id: sanitizeText(supplierAccountId),
        supplier_name: supplierName.trim(),
        supplier_address: sanitizeText(supplierAddress),
        supplier_contact: sanitizeText(supplierContact),
        invoice_number: normalizedInvoiceNumber,
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
      let message = "Unable to create goods-in record";
      if (
        error?.code === "23503" ||
        error?.message?.includes("supplier_account_id_fkey") ||
        error?.message?.includes("parts_goods_in_supplier_account_id_fkey")
      ) {
        message =
          "The selected supplier does not have a valid linked ledger account. Open the supplier and set a linked account.";
      } else if (error?.message) {
        message = `Unable to create goods-in record: ${error.message}`;
      }
      return res.status(500).json({
        success: false,
        message,
        error: error?.message || "Unknown error",
      });
    }
  }

  res.setHeader("Allow", "GET,POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { allow: GOODS_IN_ROLES });
