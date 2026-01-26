// file location: src/pages/api/parts/jobs/index.js

import { supabase } from "@/lib/supabaseClient";
import { resolveAuditIds } from "@/lib/utils/ids";

const PRE_PICK_LOCATIONS = new Set([
  "service_rack_1",
  "service_rack_2",
  "service_rack_3",
  "service_rack_4",
  "sales_rack_1",
  "sales_rack_2",
  "sales_rack_3",
  "sales_rack_4",
  "stairs_pre_pick",
  "no_pick",
  "on_order",
]);

const PART_COLUMNS = [
  "id",
  "part_number",
  "name",
  "description",
  "supplier",
  "storage_location",
  "service_default_zone",
  "qty_in_stock",
  "qty_reserved",
  "qty_on_order",
  "reorder_level",
  "unit_cost",
  "unit_price",
].join(",");

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return Boolean(value);
};

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const mapJobRecord = (job) => ({
  id: job.id,
  jobNumber: job.job_number,
  reg: job.vehicle_reg || job.reg || job.vehicle_registration || null,
  makeModel: job.vehicle_make_model || job.vehicle_make || job.vehicle_model || null,
  description: job.description || job.job_description_snapshot || "",
  status: job.status,
  waitingStatus: job.waiting_status,
  customer: job.customer,
});

const fetchJobParts = async (jobId) => {
  const { data, error } = await supabase
    .from("parts_job_items")
    .select(
      `id, job_id, part_id, quantity_requested, quantity_allocated, quantity_fitted, status, origin,
       vhc_item_id, pre_pick_location, storage_location, unit_cost, unit_price, request_notes, created_at, updated_at,
       part:parts_catalog(${PART_COLUMNS})`
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchJobRequests = async (jobId) => {
  const { data, error } = await supabase
    .from("parts_requests")
    .select("request_id, job_id, part_id, quantity, status, description, source, created_at, updated_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = data || [];
  const partIds = requests.filter((req) => req.part_id).map((req) => req.part_id);
  if (partIds.length === 0) {
    return requests;
  }

  const { data: partDetails, error: partError } = await supabase
    .from("parts_catalog")
    .select("id, part_number, name")
    .in("id", partIds);

  if (partError) throw partError;

  const partMap = (partDetails || []).reduce((acc, part) => {
    acc[part.id] = part;
    return acc;
  }, {});

  return requests.map((req) => ({
    ...req,
    part: req.part_id ? partMap[req.part_id] || null : null,
  }));
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { search } = req.query;

    if (!search || !search.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query (job number or registration) is required",
      });
    }

    try {
      const trimmed = search.trim();
      const pattern = `%${trimmed}%`;
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select(
          "id, job_number, vehicle_reg, vehicle_make_model, status, waiting_status, description, job_description_snapshot, customer"
        )
        .or(`job_number.ilike.${pattern},vehicle_reg.ilike.${pattern}`)
        .limit(1)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job card not found for provided search term",
        });
      }

      const parts = await fetchJobParts(job.id);
      const requests = await fetchJobRequests(job.id);

      return res.status(200).json({
        success: true,
        job: mapJobRecord(job),
        parts,
        requests,
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch job card details",
        error: error.message,
      });
    }
  }

  if (req.method === "POST") {
    const {
      jobId,
      partId,
      quantityRequested,
      quantity,
      allocateFromStock,
      prePickLocation,
      storageLocation,
      status,
      origin,
      unitCost,
      unitPrice,
      requestNotes,
      userId,
      userNumericId,
      vhcItemId,
    } = req.body || {};

    console.log("[api/parts/jobs] POST", {
      jobId,
      partId,
      vhcItemId,
      quantityRequested,
      quantity,
      origin,
      status,
      userId,
      userNumericId,
    });

    if (!jobId || !partId) {
      return res.status(400).json({
        success: false,
        message: "Job ID and part ID are required",
      });
    }

    try {
      const { uuid: auditUserId } = resolveAuditIds(userId, userNumericId);

      const resolvedQuantity = Math.max(
        1,
        Number.parseInt(quantityRequested ?? quantity ?? 1, 10) || 1
      );
      const shouldAllocate = toBoolean(allocateFromStock);

      const { data: part, error: partError } = await supabase
        .from("parts_catalog")
        .select("id, qty_in_stock, qty_reserved, storage_location, unit_cost, unit_price")
        .eq("id", partId)
        .single();

      if (partError || !part) {
        return res.status(404).json({
          success: false,
          message: "Part not found in catalogue",
          error: partError?.message,
        });
      }

      if (shouldAllocate && part.qty_in_stock < resolvedQuantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock. Available: ${part.qty_in_stock}`,
        });
      }

      const resolvedUnitCost = parseNumber(unitCost, part.unit_cost || 0);
      const resolvedUnitPrice = parseNumber(unitPrice, part.unit_price || 0);
      const resolvedStorage = storageLocation || part.storage_location || null;
      const sanitizedPrePick =
        typeof prePickLocation === "string" && PRE_PICK_LOCATIONS.has(prePickLocation)
          ? prePickLocation
          : null;

      // Determine status based on origin:
      // - job_card: "booked" (added to job, not VHC reserved)
      // - vhc: "stock" (VHC authorized, reserved)
      // - other: "stock" or "on_order" based on allocation
      const resolvedOrigin = origin || "parts_workspace";
      const resolvedStatus = status || (
        shouldAllocate
          ? (resolvedOrigin === "job_card" ? "booked" : "stock")
          : "on_order"
      );

      const payload = {
        job_id: jobId,
        part_id: partId,
        quantity_requested: resolvedQuantity,
        quantity_allocated: shouldAllocate ? resolvedQuantity : 0,
        quantity_fitted: 0,
        status: resolvedStatus,
        origin: resolvedOrigin,
        vhc_item_id: vhcItemId || null,
        pre_pick_location: sanitizedPrePick,
        storage_location: resolvedStorage,
        unit_cost: resolvedUnitCost,
        unit_price: resolvedUnitPrice,
        request_notes: requestNotes || null,
        allocated_by: shouldAllocate ? auditUserId || null : null,
        created_by: auditUserId || null,
        updated_by: auditUserId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newJobPart, error: insertError } = await supabase
        .from("parts_job_items")
        .insert([payload])
        .select(`*, part:parts_catalog(${PART_COLUMNS})`)
        .single();

      if (insertError) throw insertError;

      console.log("[api/parts/jobs] Inserted", {
        id: newJobPart?.id,
        job_id: newJobPart?.job_id,
        vhc_item_id: newJobPart?.vhc_item_id,
        origin: newJobPart?.origin,
        status: newJobPart?.status,
      });

      if (shouldAllocate) {
        // For job_card origin: only decrement stock, don't add to reserved (booked parts)
        // For VHC/other origins: decrement stock AND add to reserved
        const isBookedPart = resolvedOrigin === "job_card";

        const stockUpdate = {
          qty_in_stock: part.qty_in_stock - resolvedQuantity,
          updated_at: new Date().toISOString(),
          updated_by: auditUserId || null,
        };

        // Only increment qty_reserved for non-job_card parts (VHC authorized parts)
        if (!isBookedPart) {
          stockUpdate.qty_reserved = (part.qty_reserved || 0) + resolvedQuantity;
        }

        const { error: stockError } = await supabase
          .from("parts_catalog")
          .update(stockUpdate)
          .eq("id", partId);

        if (stockError) {
          await supabase.from("parts_job_items").delete().eq("id", newJobPart.id);
          throw stockError;
        }

        await supabase.from("parts_stock_movements").insert([
          {
            part_id: partId,
            job_item_id: newJobPart.id,
            movement_type: isBookedPart ? "booked" : "allocation",
            quantity: resolvedQuantity,
            unit_cost: resolvedUnitCost,
            unit_price: resolvedUnitPrice,
            performed_by: auditUserId || null,
            reference: `job:${jobId}`,
            notes: requestNotes || null,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      return res.status(201).json({
        success: true,
        jobPart: newJobPart,
      });
    } catch (error) {
      console.error("Error creating job part:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create job part entry",
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
