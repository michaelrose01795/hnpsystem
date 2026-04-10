// file location: src/lib/invoices/persistence.js
// Helpers that write a complete, immutable structured snapshot of an invoice into
// invoice_requests + invoice_request_items at creation time. The matching read
// helper hydrates the metadata jsonb back onto top-level fields so the existing
// detailService normaliser does not need to know about the storage shape.
//
// Resilience: if the matching migration has not yet been applied (columns
// metadata / snapshot_version / meta missing), the helpers retry the insert
// without the new fields and surface a one-time warning. This keeps deploys
// safe in either order (code-first or migration-first).

const COLUMN_MISSING_CODE = "42703"; // Postgres error code for "undefined column"
const SNAPSHOT_VERSION_CURRENT = 1; // bump this when persistence schema changes
let warnedMissingMetadata = false; // log the column-missing warning at most once per process

const round2 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};

const looksLikeMissingColumn = (error) => {
  if (!error) return false;
  if (error.code === COLUMN_MISSING_CODE) return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("metadata") && message.includes("column");
};

const stripStructuredRequestMetadata = (rows = []) =>
  rows.map((row) => {
    const { metadata, ...rest } = row;
    return rest;
  });

const stripStructuredItemMetadata = (rows = []) =>
  rows.map((row) => {
    const { metadata, ...rest } = row;
    return rest;
  });

const buildRequestRow = ({ invoiceId, request, index }) => {
  const labour = request?.labour || {};
  const totals = request?.totals || {};
  const labourHours = Number(labour.hours);
  const labourNet = round2(labour.net);
  const labourVat = round2(labour.vat);
  const labourVatRate = Number(labour.rate) || 20;

  const metadata = {
    request_id: request?.request_id ?? null,
    request_kind: request?.request_kind || "request",
    request_source: request?.request_source || null,
    request_label: request?.request_label || null,
    request_sort_order: request?.request_sort_order ?? null,
    job_type: request?.job_type || "",
    labour_hours: Number.isFinite(labourHours) ? labourHours : 0,
    writeup: request?.writeup || null,
    proforma_key: request?.proforma_key || null,
    proforma_override: request?.proforma_override || null,
    totals_snapshot: {
      request_total_net: round2(totals.request_total_net),
      request_total_vat: round2(totals.request_total_vat),
      request_total_gross: round2(totals.request_total_gross),
    },
  };

  return {
    invoice_id: invoiceId,
    request_number: Number(request?.request_number) || index + 1,
    title: String(request?.title || metadata.request_label || `Request ${index + 1}`),
    notes: String(request?.summary || ""),
    labour_net: labourNet,
    labour_vat: labourVat,
    labour_vat_rate: labourVatRate,
    metadata,
  };
};

const buildItemRows = ({ requestId, parts = [], requestMeta = {} }) =>
  (Array.isArray(parts) ? parts : []).map((part) => {
    const qty = Number(part?.qty) || 0;
    const unitNet = round2(part?.price);
    const vatAmount = round2(part?.vat);
    const vatRate = Number(part?.rate) || 20;
    return {
      request_id: requestId,
      part_number: part?.part_number || null,
      description: String(part?.description || "Part"),
      retail: part?.retail !== null && part?.retail !== undefined ? round2(part.retail) : null,
      qty,
      net_price: unitNet,
      vat_amount: vatAmount,
      vat_rate: vatRate,
      metadata: {
        line_net_total: round2(unitNet * qty),
        line_gross_total: round2(unitNet * qty + vatAmount),
        request_kind: requestMeta.request_kind || null,
        vhc_item_id: requestMeta.vhc_item_id || null,
      },
    };
  });

/**
 * Insert structured invoice_requests + invoice_request_items rows for the given
 * invoice. Returns { requestCount, itemCount } on success.
 *
 * Resilient to the metadata column being missing (pre-migration deploys).
 */
export async function persistStructuredInvoiceRequests({
  client,
  invoiceId,
  structuredRequests = [],
}) {
  if (!client) throw new Error("persistStructuredInvoiceRequests requires a client");
  if (!invoiceId) throw new Error("persistStructuredInvoiceRequests requires invoiceId");
  if (!Array.isArray(structuredRequests) || structuredRequests.length === 0) {
    return { requestCount: 0, itemCount: 0, columnsMissing: false };
  }

  const requestRows = structuredRequests.map((request, index) =>
    buildRequestRow({ invoiceId, request, index })
  );

  let columnsMissing = false;

  // Insert request headers (with metadata first, retry without on missing column).
  let insertHeaders = await client
    .from("invoice_requests")
    .insert(requestRows)
    .select("id, request_number, metadata");

  if (insertHeaders.error && looksLikeMissingColumn(insertHeaders.error)) {
    columnsMissing = true;
    if (!warnedMissingMetadata) {
      console.warn(
        "[invoices] invoice_requests.metadata column missing — falling back to legacy insert. Apply migration 20260410120000_invoice_snapshot_v1.sql to enable full structured persistence."
      );
      warnedMissingMetadata = true;
    }
    insertHeaders = await client
      .from("invoice_requests")
      .insert(stripStructuredRequestMetadata(requestRows))
      .select("id, request_number");
  }

  if (insertHeaders.error) {
    throw insertHeaders.error;
  }

  const insertedHeaders = insertHeaders.data || [];
  const idByNumber = new Map(
    insertedHeaders.map((row) => [Number(row.request_number), row.id])
  );

  // Build line items keyed by the just-inserted request id.
  const itemRows = [];
  structuredRequests.forEach((request, index) => {
    const reqNum = Number(request?.request_number) || index + 1;
    const requestId = idByNumber.get(reqNum);
    if (!requestId) return; // shouldn't happen but skip silently if no id
    const requestMeta = {
      request_kind: request?.request_kind || null,
      vhc_item_id: request?.vhc_item_id || request?.proforma_override?.vhc_item_id || null,
    };
    const built = buildItemRows({ requestId, parts: request?.parts, requestMeta });
    built.forEach((row) => itemRows.push(row));
  });

  if (itemRows.length === 0) {
    return { requestCount: insertedHeaders.length, itemCount: 0, columnsMissing };
  }

  let insertItems = await client
    .from("invoice_request_items")
    .insert(itemRows)
    .select("id");

  if (insertItems.error && looksLikeMissingColumn(insertItems.error)) {
    columnsMissing = true;
    if (!warnedMissingMetadata) {
      console.warn(
        "[invoices] invoice_request_items.metadata column missing — falling back to legacy insert."
      );
      warnedMissingMetadata = true;
    }
    insertItems = await client
      .from("invoice_request_items")
      .insert(stripStructuredItemMetadata(itemRows))
      .select("id");
  }

  if (insertItems.error) {
    // Roll back the request headers we just wrote so we don't leave orphans.
    const ids = insertedHeaders.map((row) => row.id).filter(Boolean);
    if (ids.length > 0) {
      await client.from("invoice_requests").delete().in("id", ids);
    }
    throw insertItems.error;
  }

  return {
    requestCount: insertedHeaders.length,
    itemCount: (insertItems.data || []).length,
    columnsMissing,
  };
}

/**
 * Read invoice_requests + invoice_request_items for an invoice and hydrate the
 * metadata jsonb back onto the top-level fields the detailService normaliser
 * already understands. Returns an array of request rows ready to be passed to
 * normalizeInvoiceRequests().
 */
export async function loadStructuredInvoiceRequests({ client, invoiceId }) {
  if (!client || !invoiceId) return [];

  const { data: requests, error } = await client
    .from("invoice_requests")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("request_number", { ascending: true });

  if (error && error.code !== "PGRST116") {
    throw error;
  }
  if (!requests || requests.length === 0) return [];

  const ids = requests.map((req) => req.id);
  const { data: items, error: itemsError } = await client
    .from("invoice_request_items")
    .select("*")
    .in("request_id", ids);
  if (itemsError && itemsError.code !== "PGRST116") {
    throw itemsError;
  }

  const grouped = {};
  (items || []).forEach((item) => {
    if (!grouped[item.request_id]) grouped[item.request_id] = [];
    grouped[item.request_id].push(item);
  });

  return requests.map((row) => {
    const meta = (row && typeof row.metadata === "object" && row.metadata) || {};
    return {
      ...row,
      // Hydrate metadata onto the top-level fields the normaliser expects.
      request_id: meta.request_id ?? null,
      request_kind: meta.request_kind || null,
      request_source: meta.request_source || null,
      request_label: meta.request_label || null,
      request_sort_order: meta.request_sort_order ?? null,
      job_type: meta.job_type || "",
      labour_hours: Number(meta.labour_hours) || 0,
      writeup: meta.writeup || null,
      proforma_key: meta.proforma_key || null,
      proforma_override: meta.proforma_override || null,
      totals_snapshot: meta.totals_snapshot || null,
      items: grouped[row.id] || [],
    };
  });
}

export const SNAPSHOT_VERSION = SNAPSHOT_VERSION_CURRENT;
