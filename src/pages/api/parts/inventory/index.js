// file location: src/pages/api/parts/inventory/index.js

import { supabase } from "@/lib/supabaseClient";

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const sanitizeTextField = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const parseNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const deriveStockStatus = (part) => {
  if (!part?.is_active) return "inactive";
  const inStock = Number(part?.qty_in_stock ?? 0);
  const reorderLevel = Number(part?.reorder_level ?? 0);
  const onOrder = Number(part?.qty_on_order ?? 0);

  if (inStock <= 0 && onOrder > 0) return "back_order";
  if (inStock <= reorderLevel) return "low_stock";
  return "in_stock";
};

const mapPartRecord = (record, jobCounts = {}, linkedJobs = {}) => ({
  ...record,
  stock_status: deriveStockStatus(record),
  open_job_count: jobCounts[record.id] || 0,
  linked_jobs: linkedJobs[record.id] || [],
});

const CLOSED_PART_STATUSES = new Set(["fitted", "cancelled"]);
const OPEN_REQUEST_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
];

const buildLinkedJobsMap = async (partIds = []) => {
  if (!partIds || partIds.length === 0) {
    return { linkedJobs: {}, jobCounts: {} };
  }

  const { data: jobItems, error: jobItemsError } = await supabase
    .from("parts_job_items")
    .select("part_id, job_id, status, origin, quantity_requested")
    .in("part_id", partIds);

  if (jobItemsError) throw jobItemsError;

  const activeJobItems = (jobItems || []).filter(
    (item) => item.job_id && !CLOSED_PART_STATUSES.has(item.status)
  );

  const { data: requestRows, error: requestError } = await supabase
    .from("parts_requests")
    .select("request_id, job_id, part_id, status, quantity, source")
    .in("part_id", partIds)
    .in("status", OPEN_REQUEST_STATUSES);

  if (requestError) throw requestError;

  const jobIds = new Set();
  activeJobItems.forEach((item) => jobIds.add(item.job_id));
  (requestRows || []).forEach((req) => {
    if (req.job_id) jobIds.add(req.job_id);
  });

  let jobMap = {};
  if (jobIds.size > 0) {
    const { data: jobsData, error: jobsError } = await supabase
      .from("jobs")
      .select("id, job_number, waiting_status, status")
      .in("id", Array.from(jobIds));

    if (jobsError) throw jobsError;

    jobMap = (jobsData || []).reduce((acc, job) => {
      acc[job.id] = job;
      return acc;
    }, {});
  }

  const linkedJobs = {};
  const pushLink = (partId, entry) => {
    if (!partId) return;
    if (!linkedJobs[partId]) linkedJobs[partId] = [];
    linkedJobs[partId].push(entry);
  };

  activeJobItems.forEach((item) => {
    const job = jobMap[item.job_id];
    if (!job) return;
    pushLink(item.part_id, {
      type: "job_item",
      job_id: item.job_id,
      job_number: job.job_number || `#${item.job_id}`,
      job_waiting_status: job.waiting_status || job.status || null,
      status: item.status,
      source: item.origin || "manual",
      quantity: item.quantity_requested || 1,
    });
  });

  (requestRows || []).forEach((req) => {
    if (!req.part_id || !req.job_id) return;
    const job = jobMap[req.job_id];
    if (!job) return;
    pushLink(req.part_id, {
      type: "request",
      job_id: req.job_id,
      job_number: job.job_number || `#${req.job_id}`,
      job_waiting_status: job.waiting_status || job.status || null,
      status: req.status || "waiting_authorisation",
      source: req.source || "tech_request",
      quantity: req.quantity || 1,
      request_id: req.request_id,
    });
  });

  const jobCounts = Object.keys(linkedJobs).reduce((acc, partId) => {
    acc[partId] = linkedJobs[partId].length;
    return acc;
  }, {});

  return { linkedJobs, jobCounts };
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const {
      search = "",
      includeInactive = "false",
      limit = "50",
      offset = "0",
    } = req.query;

    try {
      const from = Number.parseInt(offset, 10) || 0;
      const to = from + (Number.parseInt(limit, 10) || 50) - 1;

      let query = supabase
        .from("parts_catalog")
        .select(
          `id, part_number, name, description, category, supplier, oem_reference, storage_location,
           service_default_zone, qty_in_stock, qty_reserved, qty_on_order, reorder_level,
           unit_cost, unit_price, is_active, notes, created_at, updated_at`,
          { count: "exact" }
        )
        .order("part_number", { ascending: true })
        .range(from, to);

      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        const safeSearch = trimmedSearch.replace(/,/g, "");
        const pattern = `%${safeSearch}%`;
        query = query.or(
          `part_number.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern},oem_reference.ilike.${pattern}`
        );
      }

      if (includeInactive !== "true") {
        query = query.eq("is_active", true);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const parts = data || [];
      const partIds = parts.map((part) => part.id).filter(Boolean);
      const { linkedJobs, jobCounts } = await buildLinkedJobsMap(partIds);

      return res.status(200).json({
        success: true,
        parts: parts.map((row) => mapPartRecord(row, jobCounts, linkedJobs)),
        count: count || 0,
      });
    } catch (error) {
      console.error("Error fetching parts inventory:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load parts inventory",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const { userId, ...partData } = req.body || {};

    try {
      const partNumber =
        sanitizeTextField(partData.partNumber || partData.part_number)?.toUpperCase() || null;
      const partName =
        sanitizeTextField(partData.partName || partData.part_name) || partNumber;

      if (!partNumber) {
        return res.status(400).json({
          success: false,
          message: "Part number is required",
        });
      }

      if (!partName) {
        return res.status(400).json({
          success: false,
          message: "Part name is required",
        });
      }

      const payload = {
        part_number: partNumber,
        name: partName,
        description: sanitizeTextField(partData.description),
        category: sanitizeTextField(partData.category),
        supplier: sanitizeTextField(partData.supplier),
        storage_location: sanitizeTextField(partData.storageLocation || partData.storage_location),
        qty_in_stock: parseNumber(partData.qtyInStock ?? partData.qty_in_stock, 0),
        qty_reserved: parseNumber(partData.qtyReserved ?? partData.qty_reserved, 0),
        qty_on_order: parseNumber(partData.qtyOnOrder ?? partData.qty_on_order, 0),
        reorder_level: parseNumber(partData.reorderLevel ?? partData.reorder_level, 0),
        unit_cost: parseNumberOrNull(partData.unitCost ?? partData.unit_cost),
        unit_price: parseNumberOrNull(partData.unitPrice ?? partData.unit_price),
        is_active: partData.isActive ?? partData.is_active ?? true,
        created_by: userId || null,
        notes: sanitizeTextField(partData.notes),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("parts_catalog")
        .insert([payload])
        .select()
        .single();

      if (error) {
        const description =
          error.code === "23505"
            ? "A part with this part number already exists"
            : error.message || "Unable to create part record";
        return res.status(error.code === "23505" ? 409 : 500).json({
          success: false,
          message: description,
          details: error.details || null,
        });
      }

      return res.status(201).json({
        success: true,
        part: mapPartRecord(data, {}, {}),
      });
    } catch (error) {
      console.error("Error creating part:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create part",
        error: error.message,
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
