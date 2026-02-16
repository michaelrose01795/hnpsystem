// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/jobs.js
import { notifyJobStatusChange } from "@/codex/notify-status-change";
import { getDatabaseClient } from "@/lib/database/client";
import { ensureUserIdForDisplayName } from "@/lib/users/devUsers";
import {
  getMainStatusMetadata,
  resolveMainStatusId,
  resolveSubStatusId,
} from "@/lib/status/statusFlow";
import { syncHealthCheckToCanonicalVhc } from "@/lib/vhc/saveVhcItem";
import dayjs from "dayjs";

const supabase = getDatabaseClient();

const REQUIRED_INVOICE_SUB_STATUSES = new Set([
  "technician_work_completed",
  "vhc_completed",
  "pricing_completed",
]);

const normaliseJobNumberInput = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toUpperCase() : null;
  }

  return null;
};

export const formatJobNumberFromId = (jobId) => {
  if (!jobId) {
    return null;
  }

  const normalizedId = Number(jobId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return null;
  }

  return String(Math.floor(normalizedId)).padStart(5, "0");
};

const ensureJobNumberAssigned = async (jobRow, providedJobNumber = null) => {
  if (!jobRow) {
    return jobRow;
  }

  if (providedJobNumber) {
    // Job number supplied by caller already saved during insert
    return {
      ...jobRow,
      job_number: jobRow.job_number || providedJobNumber,
    };
  }

  if (jobRow.job_number) {
    return jobRow;
  }

  const fallbackJobNumber = formatJobNumberFromId(jobRow.id);
  if (!fallbackJobNumber) {
    return jobRow;
  }

  try {
    const { data: updatedRow, error: updateError } = await supabase
      .from("jobs")
      .update({ job_number: fallbackJobNumber })
      .eq("id", jobRow.id)
      .select("job_number")
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      ...jobRow,
      job_number: updatedRow?.job_number || fallbackJobNumber,
    };
  } catch (error) {
    console.error("⚠️ Unable to persist generated job number, using fallback:", error);
    return {
      ...jobRow,
      job_number: fallbackJobNumber,
    };
  }
};

const formatBulletText = (text = "") => {
  if (!text || typeof text !== "string") {
    return "";
  }

  const paragraphs = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map((line) => (line.startsWith("-") ? line : `- ${line}`))
    .join("\n");
};

const normaliseRectificationStatus = (status) => {
  if (status === true) {
    return "complete";
  }

  if (!status || typeof status !== "string") {
    return "waiting";
  }

  const trimmed = status.trim().toLowerCase();

  if (["complete", "completed", "done", "finished"].includes(trimmed)) {
    return "complete";
  }

  return "waiting";
};

const fetchJobSubStatusSet = async (jobId) => {
  const { data, error } = await supabase
    .from("job_status_history")
    .select("to_status, from_status")
    .eq("job_id", jobId);

  if (error) {
    throw error;
  }

  const set = new Set();
  (data || []).forEach((row) => {
    const toId = resolveSubStatusId(row.to_status);
    const fromId = resolveSubStatusId(row.from_status);
    if (toId) set.add(toId);
    if (fromId) set.add(fromId);
  });

  return set;
};

const hasInvoiceForJob = async (jobId) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("job_id", jobId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
};

const hasPaidInvoiceForJob = async (jobId) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("paid, payment_status")
    .eq("job_id", jobId);

  if (error) {
    throw error;
  }

  return (data || []).some((row) => {
    if (row?.paid === true) return true;
    const status = String(row?.payment_status || "").trim().toLowerCase();
    return status === "paid";
  });
};

const mapRectificationRow = (row) => ({
  recordId: row.id,
  description: row.description || "",
  status: normaliseRectificationStatus(row.status),
  isAdditionalWork: row.is_additional_work !== false,
  vhcItemId: row.vhc_item_id ?? null,
  authorizationId: row.authorization_id ?? null,
  authorizedAmount:
    row.authorized_amount !== null && row.authorized_amount !== undefined
      ? Number(row.authorized_amount)
      : null,
  source: "database",
});

const extractAuthorizedItems = (authRows = []) => {
  const items = [];

  authRows.forEach((authorization) => {
    const rawItems = Array.isArray(authorization.authorized_items)
      ? authorization.authorized_items
      : [];

    rawItems.forEach((item, index) => {
      const description =
        (typeof item === "string" && item) ||
        item?.description ||
        item?.title ||
        item?.name ||
        item?.issue ||
        item?.concern ||
        "";

      if (!description) {
        return;
      }

      items.push({
        recordId: null,
        description,
        status: normaliseRectificationStatus(item?.status),
        isAdditionalWork: true,
        vhcItemId: item?.vhc_item_id ?? item?.vhcItemId ?? item?.id ?? index ?? null,
        authorizationId: authorization.id,
        authorizedAmount:
          item?.amount !== null && item?.amount !== undefined
            ? Number(item.amount)
            : null,
        source: "vhc",
      });
    });
  });

  return items;
};

const mergeRectificationSources = (stored = [], authorized = []) => {
  const merged = [...stored];
  const vhcIndex = new Map();

  merged.forEach((item, idx) => {
    if (item.vhcItemId !== null && item.vhcItemId !== undefined) {
      vhcIndex.set(String(item.vhcItemId), idx);
    }
  });

  authorized.forEach((authorizedItem) => {
    const key =
      authorizedItem.vhcItemId !== null && authorizedItem.vhcItemId !== undefined
        ? String(authorizedItem.vhcItemId)
        : null;

    if (key && vhcIndex.has(key)) {
      const existingIndex = vhcIndex.get(key);
      const existingItem = merged[existingIndex];

      merged[existingIndex] = {
        ...existingItem,
        description: existingItem.description || authorizedItem.description,
        status: existingItem.status || authorizedItem.status,
        isAdditionalWork: true,
        authorizationId: authorizedItem.authorizationId ?? existingItem.authorizationId ?? null,
        authorizedAmount:
          authorizedItem.authorizedAmount ?? existingItem.authorizedAmount ?? null,
        source: existingItem.source || authorizedItem.source,
      };
    } else {
      merged.push(authorizedItem);
    }
  });

  return merged;
};

const buildRectificationSummary = (items = []) => {
  if (!items || items.length === 0) {
    return "";
  }

  const lines = items.map((item, index) => {
    const statusLabel = item.status === "complete" ? "Complete" : "Waiting Additional Work";
    return `${index + 1}. ${item.description} (${statusLabel})`;
  });

  return formatBulletText(lines.join("\n"));
};

const normaliseCauseEntries = (entries = []) => {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => {
      const requestKey = entry?.requestKey || entry?.request_id || entry?.requestId || "";
      if (!requestKey) {
        return null;
      }

      return {
        id: entry?.id || `${requestKey}-${index}-${Math.random().toString(36).slice(2)}`,
        requestKey,
        text: entry?.text || entry?.cause_text || entry?.notes || "",
        createdBy: entry?.createdBy || entry?.created_by || "",
        jobNumber: entry?.jobNumber || entry?.job_number || "",
        updatedAt: entry?.updatedAt || entry?.updated_at || new Date().toISOString(),
      };
    })
    .filter(Boolean);
};

const syncWriteUpRectificationItems = async ({
  jobId,
  jobNumber,
  writeupId,
  items,
}) => {
  const filteredItems = (items || [])
    .filter((item) => item && item.description && item.description.trim().length > 0)
    .map((item) => ({
      id: item.recordId ?? undefined,
      job_id: jobId,
      job_number: jobNumber,
      writeup_id: writeupId,
      description: item.description.trim(),
      status: item.status === "complete" ? "complete" : "waiting",
      is_additional_work: item.isAdditionalWork !== false,
      vhc_item_id: item.vhcItemId ?? null,
      authorization_id: item.authorizationId ?? null,
      authorized_amount:
        item.authorizedAmount !== null && item.authorizedAmount !== undefined
          ? Number(item.authorizedAmount)
          : null,
      updated_at: new Date().toISOString(),
      ...(item.recordId ? {} : { created_at: new Date().toISOString() }),
    }));

  const { data: existingRows, error: existingError } = await supabase
    // ⚠️ Verify: table or column not found in Supabase schema
    .from("writeup_rectification_items")
    .select("id")
    .eq("writeup_id", writeupId);

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (filteredItems.length > 0) {
    const { error: upsertError } = await supabase
      // ⚠️ Verify: table or column not found in Supabase schema
      .from("writeup_rectification_items")
      .upsert(filteredItems, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  const keepIds = filteredItems
    .map((item) => item.id)
    .filter((id) => id !== null && id !== undefined);

  const staleIds = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => !keepIds.includes(id));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      // ⚠️ Verify: table or column not found in Supabase schema
      .from("writeup_rectification_items")
      .delete()
      .in("id", staleIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  return { success: true };
};

/* ============================================
   FETCH ALL JOBS
   Gets all jobs along with linked vehicles, customers,
   technicians, appointments, VHC checks, parts, notes, write-ups, and files
============================================ */
export const getAllJobs = async () => {
  console.log("🔍 getAllJobs: Starting fetch..."); // Debug log
  
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      completion_status,
      tech_completion_status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_division,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      checked_in_at,
      vhc_completed_at,
      maintenance_info,
      warranty_linked_job_id,
      warranty_vhc_master_job_id,
      linked_warranty_job:warranty_linked_job_id(
        id,
        job_number,
        status,
        job_source,
        job_division,
        vehicle_reg,
        vehicle_make_model
      ),
      vhc_master_job:warranty_vhc_master_job_id(
        id,
        job_number,
        status,
        job_source,
        job_division
      ),
      created_at,
      updated_at,
      vehicle:vehicle_id(
        vehicle_id,
        registration,
        reg_number,
        make,
        model,
        make_model,
        year,
        colour,
        vin,
        chassis,
        engine_number,
        engine,
        mileage,
        fuel_type,
        transmission,
        body_style,
        mot_due,
        service_history,
        warranty_type,
        warranty_expiry,
        insurance_provider,
        insurance_policy_number,
        customer:customer_id(
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone,
          address,
          postcode,
          contact_preference
        )
      ),
      technician:assigned_to(user_id, first_name, last_name, email, role),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at, approval_status, display_status, severity, labour_hours, parts_cost, total_override, labour_complete, parts_complete, approved_at, approved_by),
      parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, pre_pick_location, created_at, updated_at),
      parts_job_items!parts_job_items_job_id_fkey(
        id,
        part_id,
        authorised,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        allocated_to_request_id,
        status,
        origin,
        vhc_item_id,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        labour_hours,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        parts_catalog:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      goods_in_items:parts_goods_in_items(
        id,
        goods_in_id,
        job_id,
        job_number,
        part_catalog_id,
        part_number,
        description,
        quantity,
        cost_price,
        retail_price,
        bin_location,
        surcharge,
        added_to_job,
        created_at,
        updated_at,
        goods_in:goods_in_id(
          goods_in_number,
          supplier_name,
          invoice_number
        )
      ),
      job_notes(note_id, note_text, user_id, created_at, updated_at, linked_request_index, linked_vhc_id, linked_request_indices, linked_vhc_ids, linked_part_id, linked_part_ids),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, labour_time, technician_id, completion_status, created_at, updated_at),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at),
      vhc_authorizations(id, authorized_items, authorized_at),
      booking_request:job_booking_requests(
        request_id,
        job_id,
        status,
        description,
        waiting_status,
        submitted_by,
        submitted_by_name,
        submitted_at,
        approved_by,
        approved_by_name,
        approved_at,
        confirmation_sent_at,
        price_estimate,
        estimated_completion,
        loan_car_details,
        confirmation_notes
      )
    `)
    .order('created_at', { ascending: false }); // Order by newest first

  if (error) {
    console.error("❌ getAllJobs error:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return [];
  }

  console.log("✅ getAllJobs fetched:", data?.length || 0, "jobs"); // Debug log

  return data.map((job) => formatJobData(job));
};

/* ============================================
   GET DASHBOARD DATA
   Returns all jobs and today's appointments
============================================ */
export const getDashboardData = async () => {
  const allJobs = await getAllJobs();

  const today = dayjs().format("YYYY-MM-DD");
  const { data: appointmentsData, error } = await supabase
    .from("appointments")
    .select(`
      appointment_id,
      scheduled_time,
      notes,
      status,
      created_at,
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        vehicle:vehicle_id(
          registration,
          reg_number,
          make,
          model,
          make_model
        )
      )
    `)
    .gte("scheduled_time", `${today}T00:00:00`)
    .lte("scheduled_time", `${today}T23:59:59`)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error("❌ Error fetching today's appointments:", error);
    return { allJobs, appointments: [] };
  }

  const appointments = (appointmentsData || []).map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    status: a.status,
    createdAt: a.created_at,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle_reg || a.job?.vehicle?.registration || a.job?.vehicle?.reg_number || "",
      make: a.job?.vehicle?.make || "",
      model: a.job?.vehicle?.model || "",
      makeModel: a.job?.vehicle_make_model || a.job?.vehicle?.make_model || "",
    },
  }));

  return { allJobs, appointments };
};

/* ============================================
   GET WRITE-UP RECTIFICATION ITEMS FOR JOB
   Returns saved rectification checklist entries
============================================ */
export const getRectificationItemsByJob = async (jobId) => {
  try {
    const { data, error } = await supabase
      // ⚠️ Verify: table or column not found in Supabase schema
      .from("writeup_rectification_items")
      .select("id, job_id, job_number, writeup_id, description, status, is_additional_work, vhc_item_id, authorization_id, authorized_amount")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST116") {
        return [];
      }

      throw error;
    }

    return (data || []).map((row) => mapRectificationRow(row));
  } catch (error) {
    console.error("❌ getRectificationItemsByJob error:", error);
    return [];
  }
};

/* ============================================
   GET AUTHORIZED ADDITIONAL WORK FOR JOB
   Pulls authorized VHC items and authorized parts to seed rectification
============================================ */
export const getAuthorizedAdditionalWorkByJob = async (jobId) => {
  try {
    // Fetch VHC authorizations
    const { data: vhcData, error: vhcError } = await supabase
      .from("vhc_authorizations")
      .select("id, job_id, authorized_at, authorized_items")
      .eq("job_id", jobId)
      .order("authorized_at", { ascending: false });

    if (vhcError && vhcError.code !== "PGRST116") {
      throw vhcError;
    }

    // Fetch authorized parts
    const { data: partsData, error: partsError } = await supabase
      .from("parts_job_items")
      .select(`
        id,
        job_id,
        authorised,
        allocated_to_request_id,
        quantity_requested,
        parts_catalog (
          name,
          description,
          part_number
        ),
        job_requests (
          description
        )
      `)
      .eq("job_id", jobId)
      .eq("authorised", true);

    if (partsError && partsError.code !== "PGRST116") {
      console.error("⚠️ Error fetching authorized parts:", partsError);
    }

    const hasAuthorizations = Array.isArray(vhcData) && vhcData.length > 0;

    // Fetch authorized VHC checks directly (fallback when vhc_authorizations is not populated)
    let vhcChecksData = [];
    if (hasAuthorizations) {
      const { data, error: vhcChecksError } = await supabase
        .from("vhc_checks")
        .select("vhc_id, section, issue_title, issue_description, approval_status")
        .eq("job_id", jobId)
        .eq("approval_status", "authorized");

      if (vhcChecksError && vhcChecksError.code !== "PGRST116") {
        console.error("⚠️ Error fetching authorized VHC checks:", vhcChecksError);
      } else {
        vhcChecksData = data || [];
      }
    }

    // Extract VHC authorized items
    const vhcItems = extractAuthorizedItems(vhcData || []);
    const vhcItemIds = new Set(
      vhcItems
        .map((item) => item?.vhcItemId)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value))
    );

    // Add authorized items from vhc_checks if missing
    const vhcChecksItems = (vhcChecksData || []).reduce((acc, check) => {
      const description =
        (check.issue_title || check.issue_description || check.section || "").toString().trim();
      if (!description) return acc;
      const vhcId = check.vhc_id ?? null;
      if (vhcId !== null && vhcItemIds.has(String(vhcId))) {
        return acc;
      }
      acc.push({
        recordId: null,
        description,
        label: description || `Authorised item ${acc.length + 1}`,
        status: "additional_work",
        isAdditionalWork: true,
        vhcItemId: vhcId,
        authorizationId: null,
        authorizedAmount: null,
        source: "vhc_check",
        sourceKey: `vhc-check-${vhcId ?? description}`,
      });
      return acc;
    }, []);

    // Extract authorized parts and format them
    const partsItems = (partsData || []).map((part, index) => {
      const partName = part.parts_catalog?.name || part.parts_catalog?.description || "Part";
      const partNumber = part.parts_catalog?.part_number || "";
      const requestDesc = part.job_requests?.description || "";
      const description = `${partName}${partNumber ? ` (${partNumber})` : ""}${requestDesc ? ` - ${requestDesc}` : ""}`;

      return {
        recordId: null,
        description,
        label: description || `Authorised part ${index + 1}`,
        status: "additional_work",
        isAdditionalWork: true,
        vhcItemId: null,
        authorizationId: part.id,
        authorizedAmount: null,
        source: "parts",
        sourceKey: `parts-${part.id}`,
      };
    });

    // Combine both sources
    return [...vhcItems, ...vhcChecksItems, ...partsItems];
  } catch (error) {
    console.error("❌ getAuthorizedAdditionalWorkByJob error:", error);
    return [];
  }
};

/* ============================================
   GET AUTHORIZED VHC ITEMS WITH DETAILS
   Returns authorized VHC items with pre-joined:
   - labour hours, parts cost (from vhc_checks)
   - linked notes (from job_notes)
   - pre-pick location (from parts_job_items)
   This is the canonical source for all tabs.
============================================ */
export const getAuthorizedVhcItemsWithDetails = async (jobId) => {
  try {
    const { data: authorizedRows, error: authorizedError } = await supabase
      .from("vhc_authorized_items")
      .select("*")
      .eq("job_id", jobId)
      .order("approved_at", { ascending: false });

    if (authorizedError) {
      console.error("❌ Error fetching authorized VHC items:", authorizedError);
      return [];
    }

    let rows = Array.isArray(authorizedRows) ? authorizedRows : [];

    const { data: authorizationRows, error: authorizationError } = await supabase
      .from("vhc_authorizations")
      .select("id")
      .eq("job_id", jobId)
      .limit(1);

    if (authorizationError && authorizationError.code !== "PGRST116") {
      console.error("❌ Error fetching VHC authorizations:", authorizationError);
      return rows;
    }

    const hasAuthorizations =
      Array.isArray(authorizationRows) && authorizationRows.length > 0;

    // Reconcile only when authorizations exist: avoid re-creating rows before any selection
    const { data: jobRow, error: jobError } = await supabase
      .from("jobs")
      .select("job_number")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("❌ Reconcile: failed to load job number:", jobError);
      return [];
    }

    if (hasAuthorizations) {
      const { data: checks, error: checksError } = await supabase
        .from("vhc_checks")
        .select("*")
        .eq("job_id", jobId)
        .in("approval_status", ["authorized", "completed"]);

      if (checksError) {
        console.error("❌ Reconcile: failed to load authorized vhc_checks:", checksError);
        return rows;
      }

      const existingIds = new Set(rows.map((r) => String(r.vhc_item_id ?? r.vhc_id)));
      const missingChecks = (checks || []).filter((check) => !existingIds.has(String(check.vhc_id)));

      if (missingChecks.length > 0) {
        const payload = missingChecks.map((check) => ({
          job_id: jobId,
          job_number: jobRow?.job_number || "",
          vhc_item_id: check.vhc_id,
          section: check.section || null,
          issue_title: check.issue_title || null,
          issue_description: check.issue_description || null,
          measurement: check.measurement || null,
          approval_status: check.approval_status,
          display_status: check.display_status || null,
          labour_hours: check.labour_hours ?? null,
          parts_cost: check.parts_cost ?? null,
          total_override: check.total_override ?? null,
          labour_complete: check.labour_complete ?? false,
          parts_complete: check.parts_complete ?? false,
          approved_at: check.approved_at || null,
          approved_by: check.approved_by || null,
          note_text: null,
          pre_pick_location: null,
          request_id: null,
          updated_at: check.updated_at || check.approved_at || new Date().toISOString(),
        }));

        const { error: upsertError } = await supabase
          .from("vhc_authorized_items")
          .upsert(payload, { onConflict: "job_number,vhc_item_id" });

        if (upsertError) {
          console.error("❌ Reconcile: failed to upsert vhc_authorized_items:", upsertError);
        } else {
          const { data: refetched } = await supabase
            .from("vhc_authorized_items")
            .select("*")
            .eq("job_id", jobId)
            .order("approved_at", { ascending: false });
          rows = Array.isArray(refetched) ? refetched : rows;
        }
      }
    }

    return rows.map((row) => {
      const base = row.issue_title || row.section || "Authorised item";
      const detail =
        row.issue_description || row.note_text || null;
      const cleanedDetail =
        detail && base.toLowerCase().includes(detail.toLowerCase()) ? null : detail;
      const label = cleanedDetail ? `${base} - ${cleanedDetail}` : base;

      return {
        vhcItemId: row.vhc_item_id ?? row.vhc_id ?? null,
        description: row.issue_title || row.issue_description || row.section || "Authorised item",
        label,
        issueDescription: row.issue_description || row.note_text || null,
        section: row.section || "",
        labourHours: row.labour_hours ?? null,
        partsCost: row.parts_cost ?? null,
        approvedAt: row.approved_at ?? null,
        approvedBy: row.approved_by ?? null,
        noteText: row.note_text ?? null,
        prePickLocation: row.pre_pick_location ?? null,
        requestId: row.request_id ?? null,
      };
    });
  } catch (error) {
    console.error("❌ getAuthorizedVhcItemsWithDetails error:", error);
    return [];
  }
};

/* ============================================
   FETCH JOB BY JOB NUMBER
   Retrieves complete job data by job number
============================================ */
export const getJobByNumber = async (jobNumber, options = {}) => {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams();
      if (options?.archive) {
        params.set("archive", "1");
      }
      const query = params.toString();
      const response = await fetch(
        `/api/jobcards/${encodeURIComponent(jobNumber)}${query ? `?${query}` : ""}`,
        {
          cache: "no-store",
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.job) {
        return {
          data: null,
          error: { message: payload?.message || "Job not found" },
        };
      }
      return {
        data: {
          jobCard: payload.job,
          customer: payload.customer || null,
          vehicle: payload.vehicle || null,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: { message: error?.message || "Failed to load job card" },
      };
    }
  }
  
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      completion_status,
      tech_completion_status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_division,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      checked_in_at,
      vhc_completed_at,
      maintenance_info,
      warranty_linked_job_id,
      warranty_vhc_master_job_id,
      linked_warranty_job:warranty_linked_job_id(
        id,
        job_number,
        status,
        job_source,
        job_division,
        vehicle_reg,
        vehicle_make_model
      ),
      vhc_master_job:warranty_vhc_master_job_id(
        id,
        job_number,
        status,
        job_source,
        job_division
      ),
      created_at,
      updated_at,
      vehicle:vehicle_id(
        vehicle_id,
        registration,
        reg_number,
        make,
        model,
        make_model,
        year,
        colour,
        vin,
        chassis,
        engine_number,
        engine,
        mileage,
        fuel_type,
        transmission,
        body_style,
        mot_due,
        service_history,
        warranty_type,
        warranty_expiry,
        insurance_provider,
        insurance_policy_number,
        customer:customer_id(
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone,
          address,
          postcode,
          contact_preference,
          created_at,
          updated_at
        )
      ),
      technician:assigned_to(user_id, first_name, last_name, email, role, phone),
      appointments(appointment_id, scheduled_time, status, notes, created_at, updated_at),
      job_requests(
        request_id,
        job_id,
        description,
        hours,
        job_type,
        sort_order,
        status,
        request_source,
        vhc_item_id,
        parts_job_item_id,
        pre_pick_location,
        note_text,
        created_at,
        updated_at
      ),
      vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at, approval_status, display_status, severity, labour_hours, parts_cost, total_override, labour_complete, parts_complete, approved_at, approved_by),
      parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, pre_pick_location, created_at, updated_at),
      parts_job_items!parts_job_items_job_id_fkey(
        id,
        part_id,
        authorised,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        allocated_to_request_id,
        status,
        origin,
        vhc_item_id,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        labour_hours,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        parts_catalog:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      goods_in_items:parts_goods_in_items(
        id,
        goods_in_id,
        job_id,
        job_number,
        part_number,
        description,
        quantity,
        cost_price,
        retail_price,
        bin_location,
        surcharge,
        added_to_job,
        created_at,
        updated_at,
        goods_in:goods_in_id(
          goods_in_number,
          supplier_name,
          invoice_number
        )
      ),
      job_notes(note_id, note_text, user_id, created_at, updated_at, linked_request_index, linked_vhc_id, linked_request_indices, linked_vhc_ids, linked_part_id, linked_part_ids),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, labour_time, technician_id, completion_status, created_at, updated_at),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at)
    `)
    .eq("job_number", jobNumber)
    .maybeSingle();

  if (jobError) {
    console.error("❌ getJobByNumber error:", jobError);
    return { data: null, error: jobError };
  }

  if (!jobData) {
    console.log("⚠️ Job not found by job_number"); // Debug log
    return { data: null, error: { message: "Job not found" } };
  }

  // Debug: Log parts data from query
  console.log("🔍 getJobByNumber parts data:", {
    job_number: jobData.job_number,
    parts_job_items_count: jobData.parts_job_items?.length || 0,
    parts_job_items_ids: (jobData.parts_job_items || []).map(p => p.id).slice(0, 5),
  });

  const messagingThread = await fetchJobMessagingThread(jobData.job_number);
  const formattedJob = formatJobData(jobData);
  formattedJob.messagingThread = messagingThread;

  const { data: vhcItemAliases, error: vhcAliasError } = await supabase
    .from("vhc_item_aliases")
    .select("display_id, vhc_item_id, created_at, updated_at")
    .eq("job_id", jobData.id);

  if (vhcAliasError) {
    console.warn("⚠️ Unable to load VHC item aliases:", vhcAliasError.message || vhcAliasError);
  } else {
    formattedJob.vhcItemAliases = vhcItemAliases || [];
  }
  
  if (
    jobData.warranty_vhc_master_job_id &&
    jobData.warranty_vhc_master_job_id !== jobData.id
  ) {
    const { data: masterJobData, error: masterJobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        job_source,
        job_division,
        description,
        vehicle_reg,
        vehicle_make_model,
        job_requests(
          request_id,
          job_id,
          description,
          hours,
          job_type,
          sort_order,
          status,
          request_source,
          vhc_item_id,
          parts_job_item_id,
          pre_pick_location,
          note_text,
          created_at,
          updated_at
        ),
        vhc_checks(vhc_id, section, issue_title, issue_description, measurement, created_at, updated_at, approval_status, display_status, severity, labour_hours, parts_cost, total_override, labour_complete, parts_complete, approved_at, approved_by),
        parts_requests(request_id, part_id, quantity, status, requested_by, approved_by, pre_pick_location, created_at, updated_at),
        parts_job_items!parts_job_items_job_id_fkey(
          id,
          part_id,
          authorised,
          quantity_requested,
          quantity_allocated,
          quantity_fitted,
          allocated_to_request_id,
          status,
          origin,
          pre_pick_location,
          storage_location,
          unit_cost,
          unit_price,
          request_notes,
          allocated_by,
          picked_by,
          fitted_by,
          created_at,
          updated_at,
          part:part_id(
            id,
            part_number,
            name,
            description,
            unit_cost,
            unit_price,
            qty_in_stock,
            qty_reserved,
            qty_on_order,
            storage_location
          )
        )
        ,
        goods_in_items:parts_goods_in_items(
          id,
          goods_in_id,
          job_id,
          job_number,
          part_number,
          description,
          quantity,
          cost_price,
          retail_price,
          bin_location,
          surcharge,
          added_to_job,
          created_at,
          updated_at,
          goods_in:goods_in_id(
            goods_in_number,
            supplier_name,
            invoice_number
          )
        )
      `)
      .eq("id", jobData.warranty_vhc_master_job_id)
      .single();

    if (masterJobError) {
      console.warn(
        "⚠️ Unable to load warranty VHC master job data:",
        masterJobError.message || masterJobError
      );
    } else if (masterJobData) {
      const masterFormatted = formatJobData(masterJobData);
      formattedJob.vhcChecks = masterFormatted.vhcChecks;
      formattedJob.partsRequests = masterFormatted.partsRequests;
      formattedJob.partsAllocations = masterFormatted.partsAllocations;
    }
  }

  // Fetch authorized VHC items with all related data pre-joined
  // This is the canonical source for Customer Requests, Parts, and WriteUp tabs
  const authorizedVhcItems = await getAuthorizedVhcItemsWithDetails(jobData.id);
  formattedJob.authorizedVhcItems = authorizedVhcItems;

  // Return structured data with customer and vehicle history
  return {
    data: {
      jobCard: formattedJob,
      customer: jobData.vehicle?.customer ? {
        customerId: jobData.vehicle.customer.id,
        firstName: jobData.vehicle.customer.firstname,
        lastName: jobData.vehicle.customer.lastname,
        email: jobData.vehicle.customer.email,
        mobile: jobData.vehicle.customer.mobile,
        telephone: jobData.vehicle.customer.telephone,
        address: jobData.vehicle.customer.address,
        postcode: jobData.vehicle.customer.postcode,
        contactPreference: jobData.vehicle.customer.contact_preference,
        createdAt: jobData.vehicle.customer.created_at,
        updatedAt: jobData.vehicle.customer.updated_at,
      } : null,
      vehicle: jobData.vehicle ? {
        vehicleId: jobData.vehicle.vehicle_id,
        reg: jobData.vehicle.registration || jobData.vehicle.reg_number,
        make: jobData.vehicle.make,
        model: jobData.vehicle.model,
        makeModel: jobData.vehicle.make_model,
        year: jobData.vehicle.year,
        colour: jobData.vehicle.colour,
        vin: jobData.vehicle.vin,
        chassis: jobData.vehicle.chassis,
        engineNumber: jobData.vehicle.engine_number,
        engine: jobData.vehicle.engine,
        mileage: jobData.vehicle.mileage,
        fuelType: jobData.vehicle.fuel_type,
        transmission: jobData.vehicle.transmission,
        bodyStyle: jobData.vehicle.body_style,
        motDue: jobData.vehicle.mot_due,
        serviceHistory: jobData.vehicle.service_history,
        warrantyType: jobData.vehicle.warranty_type,
        warrantyExpiry: jobData.vehicle.warranty_expiry,
        insuranceProvider: jobData.vehicle.insurance_provider,
        insurancePolicyNumber: jobData.vehicle.insurance_policy_number,
      } : null,
      customerJobHistory: [], // TODO: Fetch customer's other jobs
      vehicleJobHistory: [], // TODO: Fetch vehicle's other jobs
    }, 
    error: null 
  };
};

/* ============================================
   FETCH JOB BY JOB NUMBER OR VEHICLE REG
   Updated to work with actual table structure
============================================ */
export const getJobByNumberOrReg = async (searchTerm) => {
  console.log("🔍 getJobByNumberOrReg: Searching for:", searchTerm); // Debug log
  
  // Try searching by job_number first
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      description,
      type,
      status,
      assigned_to,
      customer_id,
      vehicle_id,
      vehicle_reg,
      vehicle_make_model,
      waiting_status,
      job_source,
      job_division,
      job_categories,
      requests,
      cosmetic_notes,
      vhc_required,
      checked_in_at,
      maintenance_info,
      created_at,
      updated_at,
      vehicle:vehicle_id(
        vehicle_id,
        registration,
        reg_number,
        make,
        model,
        make_model,
        year,
        colour,
        vin,
        chassis,
        engine_number,
        engine,
        mileage,
        fuel_type,
        transmission,
        body_style,
        mot_due,
        customer:customer_id(
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone,
          address,
          postcode
        )
      ),
      technician:assigned_to(user_id, first_name, last_name, email),
      appointments(appointment_id, scheduled_time, status, notes),
      vhc_checks(vhc_id, section, issue_title, issue_description, severity),
      parts_requests(request_id, part_id, quantity, status, pre_pick_location),
      parts_job_items!parts_job_items_job_id_fkey(
        id,
        part_id,
        quantity_requested,
        quantity_allocated,
        quantity_fitted,
        allocated_to_request_id,
        status,
        origin,
        pre_pick_location,
        storage_location,
        unit_cost,
        unit_price,
        request_notes,
        allocated_by,
        picked_by,
        fitted_by,
        created_at,
        updated_at,
        parts_catalog:part_id(
          id,
          part_number,
          name,
          description,
          unit_cost,
          unit_price,
          qty_in_stock,
          qty_reserved,
          qty_on_order,
          storage_location
        )
      ),
      goods_in_items:parts_goods_in_items(
        id,
        goods_in_id,
        job_id,
        job_number,
        part_number,
        description,
        quantity,
        cost_price,
        retail_price,
        bin_location,
        surcharge,
        added_to_job,
        created_at,
        updated_at,
        goods_in:goods_in_id(
          goods_in_number,
          supplier_name,
          invoice_number
        )
      ),
      job_notes(note_id, note_text, created_at),
      job_writeups(writeup_id, work_performed, parts_used, recommendations, completion_status),
      job_files(file_id, file_name, file_url, file_type, folder, uploaded_at)
    `)
    .eq("job_number", searchTerm)
    .maybeSingle();

  if (jobError) {
    console.error("❌ getJobByNumberOrReg error:", jobError);
    return null;
  }

  if (!jobData) {
    console.log("⚠️ Job not found by job_number, trying registration..."); // Debug log
    
    // If not found by job number, try by vehicle_reg field
    const { data: vehicleJobs, error: vehicleError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        customer_id,
        vehicle_id,
        vehicle_reg,
        vehicle_make_model,
        waiting_status,
        job_source,
        job_division,
        job_categories,
        requests,
        cosmetic_notes,
        vhc_required,
        checked_in_at,
        maintenance_info,
        created_at,
        updated_at,
        vehicle:vehicle_id(
          vehicle_id,
          registration,
          reg_number,
          make,
          model,
          make_model,
          year,
          colour,
          vin,
          chassis,
          customer:customer_id(
            id,
            firstname,
            lastname,
            email,
            mobile,
            telephone,
            address,
            postcode
          )
        ),
        technician:assigned_to(user_id, first_name, last_name, email),
        appointments(appointment_id, scheduled_time, status, notes),
        vhc_checks(vhc_id, section, issue_title, issue_description, severity),
        parts_requests(request_id, part_id, quantity, status, pre_pick_location),
        parts_job_items!parts_job_items_job_id_fkey(
          id,
          part_id,
          quantity_requested,
          quantity_allocated,
          quantity_fitted,
          allocated_to_request_id,
          status,
          origin,
          pre_pick_location,
          storage_location,
          unit_cost,
          unit_price,
          request_notes,
          allocated_by,
          picked_by,
          fitted_by,
          created_at,
          updated_at,
          part:part_id(
            id,
            part_number,
            name,
            description,
            unit_cost,
            unit_price,
            qty_in_stock,
            qty_reserved,
            qty_on_order,
            storage_location
          )
        ),
        goods_in_items:parts_goods_in_items(
          id,
          goods_in_id,
          job_id,
          job_number,
          part_number,
          description,
          quantity,
          cost_price,
          retail_price,
          bin_location,
          surcharge,
          added_to_job,
          created_at,
          updated_at,
          goods_in:goods_in_id(
            goods_in_number,
            supplier_name,
            invoice_number
          )
        ),
        job_notes(note_id, note_text, created_at),
        job_writeups(writeup_id, work_performed, parts_used, recommendations, completion_status),
        job_files(file_id, file_name, file_url, file_type, folder, uploaded_at)
      `)
      .eq("vehicle_reg", searchTerm.toUpperCase());

    if (vehicleError || !vehicleJobs || vehicleJobs.length === 0) {
      console.log("❌ Job not found by registration either"); // Debug log
      return null;
    }

    const data = vehicleJobs[0];
    console.log("✅ Job found by registration:", data.job_number); // Debug log
    
    return formatJobData(data);
  }

  console.log("✅ Job found by job_number:", jobData.job_number); // Debug log
  return formatJobData(jobData);
};

const normalizeBooleanField = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return Boolean(value);
};

const JOB_THREAD_PREFIX = "job:";

const buildJobThreadHash = (jobNumber) => {
  const trimmed = (jobNumber || "").toString().trim();
  return trimmed ? `${JOB_THREAD_PREFIX}${trimmed}` : null;
};

const formatThreadParticipantRow = (row) => {
  if (!row) return null;
  const profile = row.user || {};
  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = fullName || profile.email || "Team Member";
  const derivedRole = row.role || profile.role || "";
  return {
    userId: row.user_id,
    role: derivedRole,
    name: displayName,
    email: profile.email || "",
    joinedAt: row.joined_at || null,
    lastReadAt: row.last_read_at || null,
  };
};

const formatThreadMessageRow = (row) => {
  if (!row) return null;
  const metadata = row.metadata || {};
  const staffOnly =
    metadata.audience === "staff" ||
    metadata.visibility === "staff" ||
    metadata.customerVisible === false;
  const senderProfile = row.sender || {};
  const senderName = [senderProfile.first_name, senderProfile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: row.message_id,
    threadId: row.thread_id,
    content: row.content,
    createdAt: row.created_at,
    metadata,
    customerVisible: !staffOnly,
    audience: staffOnly ? "staff" : "customer",
    sender: {
      userId: senderProfile.user_id || row.sender_id || null,
      name: senderName || senderProfile.email || "Team Member",
      role: senderProfile.role || "",
      email: senderProfile.email || "",
    },
  };
};

const fetchJobMessagingThread = async (jobNumber) => {
  const hash = buildJobThreadHash(jobNumber);
  if (!hash) return null;

  try {
    const { data: threadRow, error: threadError } = await supabase
      .from("message_threads")
      .select(
        `
        thread_id,
        thread_type,
        title,
        unique_hash,
        created_by,
        created_at,
        updated_at
      `
      )
      .eq("unique_hash", hash)
      .maybeSingle();

    if (threadError) {
      if (threadError.code !== "PGRST116") {
        console.error("❌ fetchJobMessagingThread error:", threadError);
      }
      return null;
    }

    if (!threadRow) {
      return null;
    }

    const [participantsResult, messagesResult] = await Promise.all([
      supabase
        .from("message_thread_members")
        .select(
          `
          user_id,
          role,
          joined_at,
          last_read_at,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            role
          )
        `
        )
        .eq("thread_id", threadRow.thread_id),
      supabase
        .from("messages")
        .select(
          `
          message_id,
          thread_id,
          content,
          created_at,
          metadata,
          sender_id,
          sender:sender_id(
            user_id,
            first_name,
            last_name,
            email,
            role
          )
        `
        )
        .eq("thread_id", threadRow.thread_id)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);

    if (participantsResult?.error) {
      console.error("❌ Failed to load thread participants:", participantsResult.error);
    }
    if (messagesResult?.error) {
      console.error("❌ Failed to load thread messages:", messagesResult.error);
    }

    const participants = (participantsResult?.data || [])
      .map(formatThreadParticipantRow)
      .filter(Boolean);

    const messages = (messagesResult?.data || [])
      .map(formatThreadMessageRow)
      .filter(Boolean);

    return {
      id: threadRow.thread_id,
      title: threadRow.title || `Job ${jobNumber} Conversation`,
      type: threadRow.thread_type,
      createdAt: threadRow.created_at,
      updatedAt: threadRow.updated_at,
      hash,
      participants,
      messages,
    };
  } catch (threadError) {
    console.error("❌ Unexpected messaging thread error:", threadError);
    return null;
  }
};

// ✅ Ensure note fields always render with bullet (-) prefixes per requirements
const ensureBulletFormat = (value = "") => {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const cleaned = trimmed.replace(/^-+\s*/, "");
      return `- ${cleaned}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
};

// ✅ Convert stored requests (array/object/string) into numbered checklist items
const normaliseRequestsForWriteUp = (requests) => {
  if (!requests) return [];

  let requestArray = [];

  if (Array.isArray(requests)) {
    requestArray = requests;
  } else if (typeof requests === "string") {
    try {
      const parsed = JSON.parse(requests);
      if (Array.isArray(parsed)) {
        requestArray = parsed;
      } else if (requests.includes("\n")) {
        requestArray = requests.split(/\r?\n/);
      } else if (requests.trim()) {
        requestArray = [requests];
      }
    } catch (error) {
      const segments = requests.split(/\r?\n/).map((segment) => segment.trim()).filter(Boolean);
      requestArray = segments;
    }
  }

  return requestArray
    .map((entry, index) => {
      const rawText =
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry !== null
            ? entry.text ?? entry.note ?? entry.description ?? ""
            : "";
      const cleaned = (rawText || "").toString().trim();
      if (!cleaned) return null;
      return {
        source: "request",
        sourceKey: `req-${index + 1}`,
        label: `Request ${index + 1}: ${cleaned}`,
        raw: cleaned,
      };
    })
    .filter(Boolean);
};

// ✅ Extract authorised VHC items for checklist integration
const deriveAuthorisedWorkItems = (authorizationRows = []) => {
  if (!Array.isArray(authorizationRows) || authorizationRows.length === 0) {
    return [];
  }

  const latestAuthorization = authorizationRows[0];
  const rawItems = Array.isArray(latestAuthorization?.authorized_items)
    ? latestAuthorization.authorized_items
    : [];

  return rawItems
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const descriptorParts = [
        item.category,
        item.item ?? item.description ?? item.text ?? item.note ?? "",
      ].filter((segment) => Boolean(segment && `${segment}`.trim()));

      const amountCandidate =
        item.total_price ?? item.amount ?? item.authorized ?? item.price ?? item.cost ?? null;

      if (amountCandidate !== null && amountCandidate !== undefined) {
        const numericAmount = Number.parseFloat(amountCandidate);
        if (Number.isFinite(numericAmount)) {
          descriptorParts.push(`£${numericAmount.toFixed(2)}`);
        } else if (typeof amountCandidate === "string" && amountCandidate.trim()) {
          descriptorParts.push(amountCandidate.trim());
        }
      }

      const descriptor = descriptorParts.join(" • ");
      if (!descriptor) return null;

      return {
        source: "vhc",
        sourceKey: `vhc-${latestAuthorization.id}-${item.id ?? index + 1}`,
        label: `Authorized Work: ${descriptor}`,
        raw: descriptor,
        authorizationId: latestAuthorization.id,
      };
    })
    .filter(Boolean);
};

// ✅ Normalise stored task status values
const sanitiseTaskStatus = (status) =>
  status === "complete" || status === "inprogress" ? status : "additional_work";

// ✅ Merge stored tasks with live request/VHC sources
const buildWriteUpTaskList = ({ storedTasks = [], requestItems = [], authorisedItems = [] }) => {
  const registry = new Map();

  (storedTasks || []).forEach((task) => {
    if (!task) return;
    const key = `${task.source}:${task.source_key}`;
    registry.set(key, {
      taskId: task.task_id,
      source: task.source,
      sourceKey: task.source_key,
      label: task.label,
      status: sanitiseTaskStatus(task.status),
    });
  });

  const merged = [];

  requestItems.forEach((item) => {
    const key = `${item.source}:${item.sourceKey}`;
    const existing = registry.get(key);
    if (existing) {
      merged.push({ ...existing, label: existing.label || item.label });
      registry.delete(key);
    } else {
      merged.push({
        taskId: null,
        source: item.source,
        sourceKey: item.sourceKey,
        label: item.label,
        status: "additional_work",
      });
    }
  });

  authorisedItems.forEach((item) => {
    const key = `${item.source}:${item.sourceKey}`;
    const existing = registry.get(key);
    if (existing) {
      merged.push({ ...existing, label: existing.label || item.label });
      registry.delete(key);
    } else {
      merged.push({
        taskId: null,
        source: item.source,
        sourceKey: item.sourceKey,
        label: item.label,
        status: "additional_work",
      });
    }
  });

  // Drop stale request/VHC tasks that no longer exist in live sources.
  // Keep only "manual"/other task sources that aren't driven by requests or VHC authorisations.
  registry.forEach((task) => {
    if (!task) return;
    const source = (task.source || "").toString();
    if (source === "request" || source === "vhc") {
      return;
    }
    merged.push(task);
  });

  return merged;
};

const createSectionEditorsState = () => ({
  fault: [],
  cause: [],
  rectification: [],
});

const normalizeSectionEditorList = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      )
    );
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

const normalizeSectionEditors = (value = {}) => ({
  fault: normalizeSectionEditorList(value.fault),
  cause: normalizeSectionEditorList(value.cause),
  rectification: normalizeSectionEditorList(value.rectification),
});

const buildTaskChecklistPayload = (tasks = [], sectionEditors = createSectionEditorsState()) => ({
  version: 2,
  tasks: (Array.isArray(tasks) ? tasks : []).map((task) => ({
    source: task?.source || "request",
    sourceKey: task?.sourceKey || task?.source_key || `${task?.source || "request"}-${task?.label || ""}`,
    label: task?.label || "",
    status:
      task?.status === "complete"
        ? "complete"
        : task?.status === "inprogress"
        ? "inprogress"
        : "additional_work",
  })),
  meta: {
    sectionEditors: normalizeSectionEditors(sectionEditors),
  },
});

const parseTaskChecklistPayload = (raw = null) => {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw;
  }

  return null;
};

const extractSectionEditorsFromChecklist = (rawChecklist) => {
  const parsed = parseTaskChecklistPayload(rawChecklist);
  if (!parsed || typeof parsed !== "object") {
    return createSectionEditorsState();
  }

  if (Array.isArray(parsed)) {
    return createSectionEditorsState();
  }

  return normalizeSectionEditors(parsed.meta?.sectionEditors);
};

// ✅ Decide write-up completion state from checklist
const determineCompletionStatus = (tasks, fallbackStatus = "additional_work") => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return fallbackStatus || "additional_work";
  }
  return tasks.every((task) => task.status === "complete") ? "complete" : "additional_work";
};

/* ============================================
   HELPER: FORMAT JOB DATA
   Converts database format to application format
   NOW INCLUDES ALL FIELDS FROM DATABASE
============================================ */
const hydrateVhcChecks = (checks = []) =>
  (checks || []).map((check) => {
    if (!check || typeof check !== "object") return check;

    let structuredData = null;
    const candidate = check.data ?? check.issue_description;

    if (candidate) {
      try {
        const parsed =
          typeof candidate === "string" ? JSON.parse(candidate) : candidate;

        if (parsed && typeof parsed === "object") {
          structuredData = parsed;
        }
      } catch (_err) {
        // Ignore parse errors – some legacy rows store plain text
      }
    }

    return { ...check, data: structuredData };
  });

const formatJobData = (data) => {
  if (!data) return null;
  const statusMeta = getMainStatusMetadata(data.status);
  const normalizedStatus = statusMeta?.label || data.status || null;
  const rawStatus = data.status || null;

  // Normalise technician information so UI layers can rely on assignedTech
  const assignedTech = (() => {
    const technicianRecord =
      (data.technician_user && typeof data.technician_user === "object"
        ? data.technician_user
        : null) ||
      (data.technician && typeof data.technician === "object"
        ? data.technician
        : null);

    if (technicianRecord) {
      const firstName = technicianRecord.first_name?.trim() || "";
      const lastName = technicianRecord.last_name?.trim() || "";
      const derivedName = [firstName, lastName].filter(Boolean).join(" ").trim();

      return {
        id: technicianRecord.user_id || null,
        name: derivedName || firstName || technicianRecord.email || "",
        fullName: derivedName || firstName || technicianRecord.email || "",
        email: technicianRecord.email || "",
        role: technicianRecord.role || "",
      };
    }

    const assignedName =
      typeof data.technician === "string"
        ? data.technician.trim()
        : typeof data.assigned_to === "string"
        ? data.assigned_to.trim()
        : null;

    if (assignedName) {
      return {
        id: null,
        name: assignedName,
        fullName: assignedName,
        email: "",
        role: "",
      };
    }

    return null;
  })();

  const partsRequests = (data.parts_requests || []).map((partRequest) => ({
    requestId: partRequest.request_id,
    request_id: partRequest.request_id,
    partId: partRequest.part_id,
    part_id: partRequest.part_id,
    quantity: partRequest.quantity ?? null,
    status: partRequest.status || null,
    prePickLocation: partRequest.pre_pick_location || null,
    requestedBy: partRequest.requested_by || null,
    approvedBy: partRequest.approved_by || null,
    createdAt: partRequest.created_at || null,
    updatedAt: partRequest.updated_at || null,
    part: partRequest.part
      ? {
          id: partRequest.part.id || null,
          partNumber: partRequest.part.part_number || "",
          name: partRequest.part.name || "",
        }
      : null,
  }));

  const jobRequests = (data.job_requests || []).map((request) => ({
    requestId: request.request_id ?? null,
    jobId: request.job_id ?? null,
    description: request.description || "",
    hours: request.hours ?? null,
    jobType: request.job_type || "Customer",
    sortOrder:
      request.sort_order !== null && request.sort_order !== undefined
        ? Number(request.sort_order)
        : null,
    status: request.status || null,
    requestSource: request.request_source || "customer_request",
    vhcItemId: request.vhc_item_id ?? null,
    partsJobItemId: request.parts_job_item_id ?? null,
    prePickLocation: request.pre_pick_location || null,
    noteText: request.note_text || "",
    createdAt: request.created_at || null,
    updatedAt: request.updated_at || null,
  }));

  const partsAllocations = (data.parts_job_items || []).map((item) => {
    // Handle both 'part' (old) and 'parts_catalog' (new) field names for backward compatibility
    const partData = item.parts_catalog || item.part;

    // Debug VHC allocations
    if (item.vhc_item_id) {
      console.log("[formatJobData] Part with VHC allocation:", {
        id: item.id,
        vhc_item_id: item.vhc_item_id,
        allocated_to_request_id: item.allocated_to_request_id,
      });
    }

    return {
      id: item.id,
      partId: item.part_id,
      authorised: item.authorised === true,
      allocatedToRequestId: item.allocated_to_request_id ?? item.allocatedToRequestId ?? null,
      vhcItemId: item.vhc_item_id ?? null,
      quantityRequested: item.quantity_requested ?? 0,
      quantityAllocated: item.quantity_allocated ?? 0,
      quantityFitted: item.quantity_fitted ?? 0,
      status: item.status || "pending",
      origin: item.origin || null,
      prePickLocation: item.pre_pick_location || null,
      storageLocation: item.storage_location || partData?.storage_location || null,
      unitCost: item.unit_cost ?? partData?.unit_cost ?? 0,
      unitPrice: item.unit_price ?? partData?.unit_price ?? 0,
      requestNotes: item.request_notes || "",
      allocatedBy: item.allocated_by || null,
      pickedBy: item.picked_by || null,
      fittedBy: item.fitted_by || null,
      createdAt: item.created_at || null,
      updatedAt: item.updated_at || null,
      part: partData
        ? {
            id: partData.id,
            partNumber: partData.part_number,
            name: partData.name,
            description: partData.description,
            unitCost: partData.unit_cost,
            unitPrice: partData.unit_price,
            qtyInStock: partData.qty_in_stock,
            qtyReserved: partData.qty_reserved,
            qtyOnOrder: partData.qty_on_order,
            storageLocation: partData.storage_location,
          }
        : null,
    };
  });

  const goodsInParts = (data.goods_in_items || []).map((item) => ({
    id: item.id,
    goodsInId: item.goods_in_id,
    goodsInNumber: item.goods_in?.goods_in_number || null,
    supplierName: item.goods_in?.supplier_name || null,
    invoiceNumber: item.goods_in?.invoice_number || null,
    partCatalogId: item.part_catalog_id || null,
    partNumber: item.part_number || "",
    description: item.description || "",
    quantity: Number(item.quantity || 0),
    costPrice: Number(item.cost_price || 0),
    retailPrice: Number(item.retail_price || 0),
    binLocation: item.bin_location || "",
    surcharge: item.surcharge || "",
    addedToJob: item.added_to_job !== false,
    createdAt: item.created_at || null,
    updatedAt: item.updated_at || null,
  }));

  const bookingRequestRow = Array.isArray(data.booking_request)
    ? data.booking_request[0]
    : data.booking_request;

  const bookingRequest = bookingRequestRow
    ? {
        requestId: bookingRequestRow.request_id,
        jobId: bookingRequestRow.job_id,
        status: bookingRequestRow.status || "pending",
        description: bookingRequestRow.description || "",
        waitingStatus: bookingRequestRow.waiting_status || "Neither",
        submittedBy: bookingRequestRow.submitted_by || null,
        submittedByName: bookingRequestRow.submitted_by_name || "",
        submittedAt: bookingRequestRow.submitted_at || null,
        approvedBy: bookingRequestRow.approved_by || null,
        approvedByName: bookingRequestRow.approved_by_name || "",
        approvedAt: bookingRequestRow.approved_at || null,
        confirmationSentAt: bookingRequestRow.confirmation_sent_at || null,
        priceEstimate: bookingRequestRow.price_estimate || null,
        estimatedCompletion: bookingRequestRow.estimated_completion || null,
        loanCarDetails: bookingRequestRow.loan_car_details || "",
        confirmationNotes: bookingRequestRow.confirmation_notes || ""
      }
    : null;

  return {
    id: data.id,
    jobNumber: data.job_number,
    description: data.description,
    type: data.type,
    status: normalizedStatus,
    rawStatus,
    
    // ✅ Vehicle info from both direct fields and joined table
    vehicleId: data.vehicle_id || data.vehicle?.vehicle_id || null,
    reg: data.vehicle_reg || data.vehicle?.registration || data.vehicle?.reg_number || "",
    make: data.vehicle?.make || "",
    model: data.vehicle?.model || "",
    makeModel: data.vehicle_make_model || data.vehicle?.make_model || "",
    year: data.vehicle?.year || "",
    colour: data.vehicle?.colour || "",
    vin: data.vehicle?.vin || "",
    chassis: data.vehicle?.chassis || "",
    engineNumber: data.vehicle?.engine_number || "",
    engine: data.vehicle?.engine || "",
    mileage: data.vehicle?.mileage || "",
    fuelType: data.vehicle?.fuel_type || "",
    transmission: data.vehicle?.transmission || "",
    bodyStyle: data.vehicle?.body_style || "",
    motDue: data.vehicle?.mot_due || "",
    
    // ✅ NEW: Job-specific fields
    waitingStatus: data.waiting_status || "Neither",
    jobSource: data.job_source || "Retail",
    jobDivision: data.job_division || data.jobDivision || "Retail",
    jobCategories: data.job_categories || [],
    requests: data.requests || [],
    cosmeticNotes: data.cosmetic_notes || "",
    completionStatus: data.completion_status || null,
    techCompletionStatus: data.tech_completion_status || null,
    vhcRequired: normalizeBooleanField(data.vhc_required),
    vhcCompletedAt: data.vhc_completed_at || null,
    maintenanceInfo: data.maintenance_info || {},
    checkedInAt: data.checked_in_at || null,
    
    // ✅ Technician info
    technician: data.technician
      ? `${data.technician.first_name} ${data.technician.last_name}`
      : assignedTech?.name || "",
    technicianEmail: data.technician?.email || assignedTech?.email || "",
    technicianRole: data.technician?.role || assignedTech?.role || "",
    assignedTo: data.assigned_to,
    assignedTech,
    
    // ✅ Customer info
    customer: data.vehicle?.customer
      ? `${data.vehicle.customer.firstname} ${data.vehicle.customer.lastname}`
      : "",
    customerId: data.customer_id || data.vehicle?.customer?.id || null,
    customerPhone: data.vehicle?.customer?.mobile || data.vehicle?.customer?.telephone || "",
    customerEmail: data.vehicle?.customer?.email || "",
    customerAddress: data.vehicle?.customer?.address || "",
    customerPostcode: data.vehicle?.customer?.postcode || "",
    customerContactPreference: data.vehicle?.customer?.contact_preference || "email",
    
    // ✅ Appointment info
    appointment: data.appointments?.[0]
      ? {
          appointmentId: data.appointments[0].appointment_id,
          date: dayjs(data.appointments[0].scheduled_time).format("YYYY-MM-DD"),
          time: dayjs(data.appointments[0].scheduled_time).format("HH:mm"),
          status: data.appointments[0].status,
          notes: data.appointments[0].notes || "",
          createdAt: data.appointments[0].created_at,
          updatedAt: data.appointments[0].updated_at,
        }
      : null,
    
    // ✅ Related data
    vhcChecks: hydrateVhcChecks(data.vhc_checks),
    jobRequests,
    partsRequests,
    partsAllocations,
    parts_job_items: data.parts_job_items || [], // ✅ Raw parts_job_items for Parts tab
    goodsInParts,
    notes: data.job_notes || [],
    writeUp: data.job_writeups?.[0] || null,
    files: data.job_files || [], // ✅ NEW: File attachments
    vhcAuthorizations: data.vhc_authorizations || [],
    linkedWarrantyJobId: data.warranty_linked_job_id || null,
    warrantyVhcMasterJobId: data.warranty_vhc_master_job_id || null,
    linkedWarrantyJobNumber: data.linked_warranty_job?.job_number || null,
    linkedWarrantyJobStatus: data.linked_warranty_job?.status || null,
    linkedWarrantyJobSource: data.linked_warranty_job?.job_source || null,
    linkedWarrantyJob: data.linked_warranty_job
      ? {
          id: data.linked_warranty_job.id,
          jobNumber: data.linked_warranty_job.job_number,
          status: data.linked_warranty_job.status,
          jobSource: data.linked_warranty_job.job_source,
          reg: data.linked_warranty_job.vehicle_reg || "",
          makeModel: data.linked_warranty_job.vehicle_make_model || "",
        }
      : null,
    warrantyVhcMasterJobNumber: data.vhc_master_job?.job_number || null,
    messagingThread: data.messagingThread || null,
    bookingRequest,

    // ✅ Prime/Sub-job linking
    primeJobNumber: data.prime_job_number || null,
    primeJobId: data.prime_job_id || null,
    isPrimeJob: data.is_prime_job === true,
    subJobSequence: data.sub_job_sequence || null,
    primeJob: data.prime_job
      ? {
          id: data.prime_job.id,
          jobNumber: data.prime_job.job_number,
          status: data.prime_job.status,
          customerId: data.prime_job.customer_id,
          vehicleId: data.prime_job.vehicle_id,
          reg: data.prime_job.vehicle_reg || "",
          makeModel: data.prime_job.vehicle_make_model || "",
        }
      : null,
    subJobs: (data.sub_jobs || []).map((sub) => ({
      id: sub.id,
      jobNumber: sub.job_number,
      description: sub.description || "",
      type: sub.type || "",
      status: sub.status || "",
      assignedTo: sub.assigned_to || null,
      subJobSequence: sub.sub_job_sequence || null,
    })),

    // ✅ Timestamps
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

/* ============================================
   ADD JOB TO DATABASE
   Creates a new job and links it to vehicle and customer
   ✅ NOW SAVES ALL FIELDS
============================================ */
export const addJobToDatabase = async ({
  regNumber,
  jobNumber,
  description,
  type,
  assignedTo,
  customerId,
  vehicleId,
  waitingStatus,
  jobSource,
  jobDivision,
  jobCategories,
  requests,
  cosmeticNotes,
  vhcRequired,
  maintenanceInfo,
  // Prime/Sub-job parameters
  primeJobId = null,
  asPrimeJob = false,
}) => {
  try {
    const normalizedJobNumber = normaliseJobNumberInput(jobNumber);

    console.log("➕ addJobToDatabase called with:", { 
      regNumber,
      jobNumber: normalizedJobNumber || jobNumber,
      description,
      type,
      assignedTo,
      customerId,
      vehicleId,
      waitingStatus,
      jobSource,
      jobDivision,
      jobCategories,
      requests,
      cosmeticNotes,
      vhcRequired,
      maintenanceInfo
    });

    // Find the vehicle by registration number if vehicleId not provided
    let finalVehicleId = vehicleId;
    let vehicleData = null;
    
    if (!finalVehicleId && regNumber) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .select("vehicle_id, registration, reg_number, make_model, customer_id")
        .or(`registration.eq.${regNumber},reg_number.eq.${regNumber}`)
        .maybeSingle();

      if (vehicleError) {
        console.error("❌ Error finding vehicle:", vehicleError);
        throw vehicleError;
      }

      if (!vehicle) {
        console.error("❌ Vehicle not found for reg:", regNumber);
        return { 
          success: false, 
          error: { message: `Vehicle with registration ${regNumber} not found` } 
        };
      }

      finalVehicleId = vehicle.vehicle_id;
      vehicleData = vehicle;
      console.log("✅ Vehicle found:", vehicle);
    }

    // ✅ Handle prime/sub-job linking
    let primeJobData = null;
    let subJobSequence = null;
    let primeJobNumber = null;

    if (primeJobId) {
      // Creating a sub-job - fetch prime job data and inherit customer/vehicle
      const { data: primeJob, error: primeJobError } = await supabase
        .from("jobs")
        .select("id, job_number, customer_id, vehicle_id, vehicle_reg, vehicle_make_model, prime_job_number")
        .eq("id", primeJobId)
        .single();

      if (primeJobError || !primeJob) {
        console.error("❌ Prime job not found:", primeJobError);
        return {
          success: false,
          error: { message: `Prime job with ID ${primeJobId} not found` }
        };
      }

      primeJobData = primeJob;
      primeJobNumber = primeJob.prime_job_number || primeJob.job_number;

      // Inherit customer/vehicle from prime job
      if (!finalVehicleId) finalVehicleId = primeJob.vehicle_id;
      if (!customerId) customerId = primeJob.customer_id;
      if (!regNumber) regNumber = primeJob.vehicle_reg;

      // Get the next sub-job sequence number
      const { data: existingSubJobs, error: seqError } = await supabase
        .from("jobs")
        .select("sub_job_sequence")
        .eq("prime_job_number", primeJobNumber)
        .not("sub_job_sequence", "is", null)
        .order("sub_job_sequence", { ascending: false })
        .limit(1);

      if (!seqError && existingSubJobs?.length > 0) {
        subJobSequence = (existingSubJobs[0].sub_job_sequence || 0) + 1;
      } else {
        subJobSequence = 1;
      }

      console.log("✅ Creating sub-job under prime:", primeJobNumber, "sequence:", subJobSequence);
    } else if (asPrimeJob) {
      // Creating as a prime job - will set prime_job_number after insert
      console.log("✅ Creating as prime job");
    }

    // ✅ Create the job with ALL fields
    const jobInsert = {
      job_number: normalizedJobNumber,
      vehicle_id: finalVehicleId,
      customer_id: customerId || vehicleData?.customer_id || null,
      vehicle_reg: regNumber?.toUpperCase() || primeJobData?.vehicle_reg || "",
      vehicle_make_model: vehicleData?.make_model || primeJobData?.vehicle_make_model || "",
      assigned_to: assignedTo || null,
      type: type || "Service",
      description: description || "",
      status: "Open",
      waiting_status: waitingStatus || "Neither",
      job_source: jobSource || "Retail",
      job_division: jobDivision || "Retail",
      job_categories: jobCategories || [],
      requests: requests || [],
      cosmetic_notes: cosmeticNotes || null,
      vhc_required: normalizeBooleanField(vhcRequired),
      // Prime/Sub-job fields
      prime_job_id: primeJobId || null,
      prime_job_number: primeJobNumber || null,
      is_prime_job: asPrimeJob && !primeJobId,
      sub_job_sequence: subJobSequence,
      maintenance_info: maintenanceInfo || {},
      created_at: new Date().toISOString(),
    };

    console.log("📝 Inserting job with data:", jobInsert);

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert([jobInsert])
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle_reg,
        vehicle_make_model,
        waiting_status,
        job_source,
        job_division,
        job_categories,
        requests,
        cosmetic_notes,
        vhc_required,
        maintenance_info,
        created_at,
        prime_job_number,
        prime_job_id,
        is_prime_job,
        sub_job_sequence,
        vehicle:vehicle_id(
          vehicle_id,
          registration,
          reg_number,
          make,
          model,
          make_model,
          customer:customer_id(
            id,
            firstname,
            lastname,
            email,
            mobile
          )
        )
      `)
      .single();

    if (jobError) {
      console.error("❌ Error creating job:", jobError);
      throw jobError;
    }

    let jobWithNumber = await ensureJobNumberAssigned(job, normalizedJobNumber);

    // If this is a prime job, set prime_job_number to the job's own job_number
    if (asPrimeJob && !primeJobId && jobWithNumber.job_number) {
      const { error: updatePrimeError } = await supabase
        .from("jobs")
        .update({ prime_job_number: jobWithNumber.job_number })
        .eq("id", jobWithNumber.id);

      if (!updatePrimeError) {
        jobWithNumber = {
          ...jobWithNumber,
          prime_job_number: jobWithNumber.job_number,
        };
      }
      console.log("✅ Set prime_job_number for prime job:", jobWithNumber.job_number);
    }

    console.log("✅ Job successfully added:", jobWithNumber);

    return { success: true, data: formatJobData(jobWithNumber) };
  } catch (error) {
    console.error("❌ Error adding job:", error);
    return { 
      success: false, 
      error: { message: error.message || "Failed to create job" } 
    };
  }
};

/* ============================================
   UPDATE JOB
   ✅ NEW: Update any job field
============================================ */
export const updateJob = async (jobId, updates) => {
  try {
    console.log("🔄 Updating job:", jobId, "with updates:", updates);

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(updates, "vhc_required")) {
      payload.vhc_required = normalizeBooleanField(updates.vhc_required);
    }

    const hasStatusUpdate = Object.prototype.hasOwnProperty.call(
      updates,
      "status"
    );
    let statusSnapshot = null;
    let targetMainStatusId = null;
    let shouldAutoArchive = false;

    if (hasStatusUpdate) {
      targetMainStatusId = resolveMainStatusId(updates.status);
      if (!targetMainStatusId) {
        return {
          success: false,
          error: { message: "Main job status required." },
        };
      }

      const targetMeta = getMainStatusMetadata(updates.status);
      if (targetMeta?.label) {
        payload.status = targetMeta.label;
      }

      const { data: currentStatusRow, error: statusFetchError } = await supabase
        .from("jobs")
        .select("job_number, status")
        .eq("id", jobId)
        .single();

      if (statusFetchError) {
        console.error(
          "❌ Unable to read current status before job update:",
          statusFetchError
        );
      } else {
        statusSnapshot = currentStatusRow;
      }
    }
    
    if (hasStatusUpdate && targetMainStatusId === "invoiced") {
      try {
        const subStatusSet = await fetchJobSubStatusSet(jobId);
        const missing = Array.from(REQUIRED_INVOICE_SUB_STATUSES).filter(
          (status) => !subStatusSet.has(status)
        );
        if (missing.length) {
          return {
            success: false,
            error: { message: `Job missing sub-statuses: ${missing.join(", ")}` },
          };
        }
      } catch (subStatusError) {
        console.error("❌ Failed to validate invoicing prerequisites:", subStatusError);
        return {
          success: false,
          error: { message: "Unable to validate invoicing prerequisites" },
        };
      }
    }

    if (hasStatusUpdate && targetMainStatusId === "complete") {
      try {
        const hasInvoice = await hasInvoiceForJob(jobId);
        if (!hasInvoice) {
          return {
            success: false,
            error: { message: "Invoice required before completion" },
          };
        }
        const hasPaidInvoice = await hasPaidInvoiceForJob(jobId);
        if (!hasPaidInvoice) {
          return {
            success: false,
            error: { message: "Invoice must be paid before completion" },
          };
        }
        shouldAutoArchive = true;
      } catch (invoiceError) {
        console.error("❌ Failed to check invoice before completion:", invoiceError);
        return {
          success: false,
          error: { message: "Unable to validate invoice before completion" },
        };
      }
    }

    const { data, error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", jobId)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating job:", error);
      return { success: false, error };
    }

    console.log("✅ Job updated successfully:", data);

    if (hasStatusUpdate && statusSnapshot && data) {
      const jobNumberForNotification =
        statusSnapshot.job_number ??
        data.job_number ??
        data.jobNumber ??
        null;

      try {
        await supabase.from("job_status_history").insert([
          {
            job_id: jobId,
            from_status: statusSnapshot.status || null,
            to_status: updates.status,
            changed_by: updates.status_updated_by || null,
            reason: updates.status_change_reason || null,
            changed_at: updates.status_updated_at || new Date().toISOString(),
          },
        ]);
      } catch (historyError) {
        console.error("❌ Failed to log job status history:", historyError);
      }

      if (jobNumberForNotification) {
        try {
          await notifyJobStatusChange({
            jobNumber: jobNumberForNotification,
            previousStatus: statusSnapshot.status,
            newStatus: updates.status,
          });
        } catch (notifyError) {
          console.error(
            "❌ Failed to dispatch job status notification:",
            notifyError
          );
        }
      }
    }

    if (hasStatusUpdate && shouldAutoArchive && data?.job_number) {
      if (typeof window !== "undefined") {
        try {
          await fetch("/api/jobcards/archive/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobNumber: data.job_number }),
          });
        } catch (archiveError) {
          console.error("❌ Failed to auto-archive job:", archiveError);
        }
      }
    }

    return { success: true, data: formatJobData(data) };
  } catch (error) {
    console.error("❌ Exception updating job:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   UPSERT JOB REQUESTS (customer_request only)
   Keeps job_requests in sync without touching VHC-authorised rows
============================================ */
export const upsertJobRequestsForJob = async (jobId, requestEntries = []) => {
  try {
    if (!jobId) {
      return { success: false, error: { message: "Job ID is required" } };
    }

    const timestamp = new Date().toISOString();
    const normalized = (Array.isArray(requestEntries) ? requestEntries : [])
      .map((entry, index) => {
        const description = (entry.text ?? entry.description ?? "").toString().trim();
        if (!description) return null;
        const rawHours = entry.time ?? entry.hours ?? null;
        const parsedHours =
          rawHours === "" || rawHours === null || rawHours === undefined
            ? null
            : Number(rawHours);
        const hours = Number.isFinite(parsedHours) ? parsedHours : null;
        const jobType = (entry.paymentType ?? entry.jobType ?? "Customer").toString().trim() || "Customer";
        const requestId = entry.requestId ?? entry.request_id ?? null;
        const noteText = entry.noteText ?? entry.note_text ?? null;

        return {
          requestId,
          description,
          hours,
          jobType,
          sortOrder: index + 1,
          noteText: noteText ? noteText.toString().trim() : null,
        };
      })
      .filter(Boolean);

    const { data: existingRows, error: existingError } = await supabase
      .from("job_requests")
      .select("request_id, request_source")
      .eq("job_id", jobId)
      .or("request_source.is.null,request_source.eq.customer_request");

    if (existingError) {
      throw existingError;
    }

    const existingIds = new Set(
      (existingRows || []).map((row) => String(row.request_id))
    );
    const keepIds = new Set(
      normalized
        .map((row) => row.requestId)
        .filter(Boolean)
        .map((value) => String(value))
    );

    const idsToDelete = (existingRows || [])
      .filter((row) => !keepIds.has(String(row.request_id)))
      .map((row) => row.request_id);

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("job_requests")
        .delete()
        .in("request_id", idsToDelete);
      if (deleteError) throw deleteError;
    }

    for (const row of normalized) {
      if (row.requestId && existingIds.has(String(row.requestId))) {
        const { error: updateError } = await supabase
          .from("job_requests")
          .update({
            description: row.description,
            hours: row.hours,
            job_type: row.jobType,
            sort_order: row.sortOrder,
            note_text: row.noteText,
            request_source: "customer_request",
            updated_at: timestamp,
          })
          .eq("request_id", row.requestId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("job_requests")
          .insert([
            {
              job_id: jobId,
              description: row.description,
              hours: row.hours,
              job_type: row.jobType,
              sort_order: row.sortOrder,
              status: "inprogress",
              request_source: "customer_request",
              note_text: row.noteText,
              created_at: timestamp,
              updated_at: timestamp,
            },
          ]);
        if (insertError) throw insertError;
      }
    }

    return { success: true };
  } catch (error) {
    console.error("❌ upsertJobRequestsForJob error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   UPDATE JOB STATUS
============================================ */
export const updateJobStatus = async (jobId, newStatus) => {
  return updateJob(jobId, { status: newStatus });
};

/* ============================================
   ASSIGN TECHNICIAN TO JOB
   Assigns a technician and updates status to "Assigned"
============================================ */
export const assignTechnicianToJob = async (
  jobId,
  technicianIdentifier,
  technicianName
) => {
  let resolvedTechnicianId = null;

  if (typeof technicianIdentifier !== "undefined" && technicianIdentifier !== null) {
    const parsed = Number(technicianIdentifier);
    if (Number.isInteger(parsed) && !Number.isNaN(parsed)) {
      resolvedTechnicianId = parsed;
    }
  }

  if (resolvedTechnicianId == null) {
    const displayName = String(technicianName || technicianIdentifier || "").trim();

    if (!displayName) {
      return {
        success: false,
        error: { message: "Technician name or id is required" },
      };
    }

    try {
      const ensuredId = await ensureUserIdForDisplayName(displayName);
      if (ensuredId != null) {
        resolvedTechnicianId = ensuredId;
      }
    } catch (err) {
      console.error("❌ Failed to resolve technician id:", err);
      return {
        success: false,
        error: { message: err?.message || "Failed to resolve technician id" },
      };
    }
  }

  if (resolvedTechnicianId == null) {
    return {
      success: false,
      error: { message: "Unable to resolve technician id" },
    };
  }

  return updateJob(jobId, {
    assigned_to: resolvedTechnicianId,
  });
};

/* ============================================
   UNASSIGN TECHNICIAN FROM JOB
   Removes technician and resets status to "Open"
============================================ */
export const unassignTechnicianFromJob = async (jobId) => {
  return updateJob(jobId, {
    assigned_to: null,
    status: "Open",
  });
};

/* ============================================
   CREATE OR UPDATE APPOINTMENT
   Handle appointment booking
============================================ */
export const createOrUpdateAppointment = async (jobNumber, appointmentDate, appointmentTime, notes) => {
  try {
    console.log("📅 createOrUpdateAppointment called with:", { jobNumber, appointmentDate, appointmentTime, notes });
    
    // Validate inputs
    if (!jobNumber || !appointmentDate || !appointmentTime) {
      return { 
        success: false, 
        error: { message: "Job number, date, and time are required" } 
      };
    }

    // Find the job first
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber, jobError);
      return { 
        success: false, 
        error: { message: `Job ${jobNumber} not found in database` } 
      };
    }

    // Combine date and time into a timestamp
    const scheduledDateTime = `${appointmentDate}T${appointmentTime}:00`;

    // Check if appointment already exists for this job
    const { data: existingAppointment, error: checkError } = await supabase
      .from("appointments")
      .select("appointment_id")
      .eq("job_id", job.id)
      .maybeSingle();

    let appointmentData;

    if (existingAppointment) {
      // Update existing appointment
      const { data, error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_time: scheduledDateTime,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("appointment_id", existingAppointment.appointment_id)
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log("✅ Appointment updated successfully:", appointmentData);
    } else {
      // Create new appointment
      const { data, error } = await supabase
        .from("appointments")
        .insert([{
          job_id: job.id,
          scheduled_time: scheduledDateTime,
          status: "Scheduled",
          notes: notes || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      appointmentData = data;
      console.log("✅ Appointment created successfully:", appointmentData);
    }

    // Update job status to "Booked"
    await updateJobStatus(job.id, "Booked");

    return { 
      success: true, 
      data: {
        appointment: appointmentData,
        jobId: job.id
      }
    };
  } catch (error) {
    console.error("❌ Error creating/updating appointment:", error);
    return { 
      success: false, 
      error: { message: error.message || "Failed to create/update appointment" } 
    };
  }
};

/* ============================================
   GET JOBS BY DATE
============================================ */
export const getJobsByDate = async (date) => {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      appointment_id,
      scheduled_time,
      notes,
      status,
      job:job_id(
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        vehicle:vehicle_id(
          registration,
          reg_number,
          make,
          model,
          customer:customer_id(
            firstname,
            lastname
          )
        )
      )
    `)
    .gte("scheduled_time", `${date}T00:00:00`)
    .lte("scheduled_time", `${date}T23:59:59`)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error("❌ Error fetching jobs by date:", error);
    return [];
  }

  return data.map((a) => ({
    appointmentId: a.appointment_id,
    scheduledTime: a.scheduled_time,
    notes: a.notes,
    status: a.status,
    job: {
      id: a.job?.id,
      jobNumber: a.job?.job_number,
      type: a.job?.type,
      status: a.job?.status,
      reg: a.job?.vehicle_reg || a.job?.vehicle?.registration || a.job?.vehicle?.reg_number || "",
      make: a.job?.vehicle?.make || "",
      model: a.job?.vehicle?.model || "",
      makeModel: a.job?.vehicle_make_model || "",
      customer: a.job?.vehicle?.customer
        ? `${a.job.vehicle.customer.firstname} ${a.job.vehicle.customer.lastname}`
        : "",
    },
  }));
};

/* ============================================
   ✅ NEW: ADD FILE TO JOB
============================================ */
export const addJobFile = async (jobId, fileName, fileUrl, fileType, folder, uploadedBy, visibleToCustomer = true) => {
  try {
    const { data, error } = await supabase
      .from("job_files")
      .insert([{
        job_id: jobId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        folder: folder || "general",
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
        visible_to_customer: visibleToCustomer,
      }])
      .select()
      .single();

    if (error) throw error;

    console.log("✅ File added to job:", data);
    return { success: true, data };
  } catch (error) {
    console.error("❌ Error adding file to job:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   ✅ NEW: GET JOB FILES
============================================ */
export const getJobFiles = async (jobId, folder = null) => {
  try {
    let query = supabase
      .from("job_files")
      .select("*")
      .eq("job_id", jobId)
      .order('uploaded_at', { ascending: false });

    if (folder) {
      query = query.eq("folder", folder);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log("✅ Job files retrieved:", data?.length || 0);
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting job files:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ NEW: DELETE JOB FILE
============================================ */
export const deleteJobFile = async (fileId) => {
  try {
    const { error } = await supabase
      .from("job_files")
      .delete()
      .eq("file_id", fileId);

    if (error) throw error;

    console.log("✅ File deleted from job");
    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting file:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   ✅ NEW: GET CUSTOMER JOB HISTORY
============================================ */
export const getCustomerJobHistory = async (customerId) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        type,
        status,
        vehicle_reg,
        vehicle_make_model,
        created_at,
        updated_at
      `)
      .eq("customer_id", customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log("✅ Customer job history retrieved:", data?.length || 0, "jobs");
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting customer job history:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ NEW: GET VEHICLE JOB HISTORY
============================================ */
export const getVehicleJobHistory = async (vehicleId) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        type,
        status,
        created_at,
        updated_at
      `)
      .eq("vehicle_id", vehicleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log("✅ Vehicle job history retrieved:", data?.length || 0, "jobs");
    return { success: true, data: data || [] };
  } catch (error) {
    console.error("❌ Error getting vehicle job history:", error);
    return { success: false, error: { message: error.message }, data: [] };
  }
};

/* ============================================
   ✅ FIX: UPDATE JOB POSITION
   Moves a job to a new position or stage (e.g., from 'waiting' to 'in progress')
============================================ */
export const updateJobPosition = async (jobId, newPosition) => {
  try {
    console.log("🔄 updateJobPosition:", jobId, newPosition); // Debug log

    const { data, error } = await supabase
      .from("jobs")
      .update({
        waiting_status: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select();

    if (error) throw error;
    console.log("✅ Job position updated:", data);
    return data;
  } catch (err) {
    console.error("❌ Error in updateJobPosition:", err.message);
    throw err;
  }
};

/* ============================================
   GET WRITE-UP BY JOB NUMBER (ENHANCED VERSION)
   ✅ WITH ALL FIELDS & CHECKLIST TASKS
============================================ */
export const getWriteUpByJobNumber = async (jobNumber) => {
  console.log("🔍 getWriteUpByJobNumber:", jobNumber);

  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, description, requests")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber);
      return null;
    }

    const [
      writeUpResponse,
      taskRowsResponse,
      authorizationRowsResponse,
      rectificationRows,
      authorisedVhcItems,
    ] = await Promise.all([
      supabase
        .from("job_writeups")
        .select("*")
        .eq("job_id", job.id)
        .maybeSingle(),
      supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("job_writeup_tasks")
        .select("task_id, source, source_key, label, status")
        .eq("job_id", job.id)
        .order("task_id", { ascending: true }),
      supabase
        .from("vhc_authorizations")
        .select("id, authorized_items, authorized_at")
        .eq("job_id", job.id)
        .order("authorized_at", { ascending: false }),
      getRectificationItemsByJob(job.id),
      // Canonical "Authorised VHC Items" source: vhc_checks (authorized) + linked parts.
      getAuthorizedVhcItemsWithDetails(job.id),
    ]);

    const { data: writeUp, error } = writeUpResponse;
    const { data: taskRows, error: taskError } = taskRowsResponse;
    const { data: authorizationRows, error: authorizationError } = authorizationRowsResponse;

    if (error && error.code !== "PGRST116") {
      console.error("❌ Error fetching write-up:", error);
      return null;
    }

    if (taskError) {
      console.error("⚠️ Error fetching write-up tasks:", taskError);
    }

    if (authorizationError) {
      console.error("⚠️ Error fetching VHC authorizations:", authorizationError);
    }

    const requestItems = normaliseRequestsForWriteUp(job.requests);

    // Keep the write-up Rectification list aligned with the Job Card "Authorised VHC Items" section.
    const canonicalAuthorisedVhcItems = Array.isArray(authorisedVhcItems) ? authorisedVhcItems : [];
    const authorisedTaskItems = canonicalAuthorisedVhcItems.map((item, index) => {
      const vhcId =
        item?.vhcItemId !== null && item?.vhcItemId !== undefined
          ? String(item.vhcItemId)
          : `idx-${index + 1}`;
      const labelBase = (item?.description || "").toString().trim() || `Authorised item ${index + 1}`;
      return {
        source: "vhc",
        sourceKey: `vhc-${job.id}-${vhcId}`,
        label: `Authorized Work: ${labelBase}`,
        vhcItemId: item?.vhcItemId ?? null,
      };
    });

    const tasks = buildWriteUpTaskList({
      storedTasks: taskRows || [],
      requestItems,
      authorisedItems: authorisedTaskItems,
    });

    // ⚠️ Verify: table or column not found in Supabase schema
    const completionStatus = determineCompletionStatus(tasks, writeUp?.completion_status);
    const latestAuthorizationId = authorizationRows?.[0]?.id ?? null;
    const rectificationItems = mergeRectificationSources(rectificationRows, canonicalAuthorisedVhcItems);

    const sectionEditors = extractSectionEditorsFromChecklist(writeUp?.task_checklist);

    const basePayload = {
      qty: writeUp?.qty || Array(10).fill(false),
      booked: writeUp?.booked || Array(10).fill(false),
      completionStatus,
      jobDescription: ensureBulletFormat(
        // ⚠️ Verify: table or column not found in Supabase schema
        job.description || writeUp?.job_description_snapshot || ""
      ),
      tasks,
      requests: requestItems,
      authorisedItems: canonicalAuthorisedVhcItems,
      rectificationItems,
      jobRequests: job.requests || [],
      vhcAuthorizationId: latestAuthorizationId,
      causeEntries: normaliseCauseEntries(writeUp?.cause_entries),
      sectionEditors,
    };

    if (!writeUp) {
      console.log("ℹ️ No write-up data for job:", jobNumber);
      return {
        ...basePayload,
        fault: ensureBulletFormat(job.description || ""),
        caused: "",
        rectification: buildRectificationSummary(rectificationItems),
        warrantyClaim: "",
        tsrNumber: "",
        pwaNumber: "",
        technicalBulletins: "",
        technicalSignature: "",
        qualityControl: "",
        additionalParts: "",
        sectionEditors,
      };
    }

    console.log("✅ Write-up found:", writeUp);

    return {
      ...basePayload,
      fault: ensureBulletFormat(writeUp.work_performed || job.description || ""),
      caused: ensureBulletFormat(writeUp.recommendations || ""),
      rectification:
        // ⚠️ Verify: table or column not found in Supabase schema
        ensureBulletFormat(writeUp.ratification || writeUp.rectification_notes || "") ||
        buildRectificationSummary(rectificationItems),
      warrantyClaim: writeUp.warranty_claim || "",
      tsrNumber: writeUp.tsr_number || "",
      pwaNumber: writeUp.pwa_number || "",
      technicalBulletins: ensureBulletFormat(writeUp.technical_bulletins || ""),
      technicalSignature: writeUp.technical_signature || "",
      qualityControl: writeUp.quality_control || "",
      additionalParts: ensureBulletFormat(writeUp.parts_used || ""),
      sectionEditors,
    };
  } catch (error) {
    console.error("❌ getWriteUpByJobNumber error:", error);
    return null;
  }
};

/* ============================================
   SAVE WRITE-UP TO DATABASE (ENHANCED VERSION)
   ✅ WITH ALL FIELDS
============================================ */
export const saveWriteUpToDatabase = async (jobNumber, writeUpData) => {
  console.log("💾 saveWriteUpToDatabase:", jobNumber);

  const sanitizeCauseEntriesForUpload = (entries = []) =>
    (Array.isArray(entries) ? entries : [])
      .map((entry) => ({
        id: entry?.id || null,
        job_number: entry?.jobNumber || entry?.job_number || jobNumber || null,
        request_id: entry?.requestKey || entry?.request_id || "",
        cause_text: entry?.text || entry?.cause_text || "",
        created_by: entry?.createdBy || entry?.created_by || "",
        updated_at: entry?.updatedAt || entry?.updated_at || new Date().toISOString(),
      }))
      .filter((entry) => entry.request_id);

  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, assigned_to, description, status, vhc_required, vhc_completed_at")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !job) {
      console.error("❌ Job not found:", jobNumber);
      return { success: false, error: "Job not found" };
    }

    const { data: existing } = await supabase
      .from("job_writeups")
      .select("writeup_id")
      .eq("job_id", job.id)
      .maybeSingle();

    const rectificationItems = Array.isArray(writeUpData?.rectificationItems)
      ? writeUpData.rectificationItems
      : [];

    const rawTasks = Array.isArray(writeUpData?.tasks) ? writeUpData.tasks : [];
    const filteredTasks = rawTasks
      .map((task) => {
        const source = task?.source || "request";
        const normalizedStatus = sanitiseTaskStatus(task?.status);
        const status =
          source === "request" && normalizedStatus !== "complete"
            ? "inprogress"
            : normalizedStatus;
        return {
          taskId: task?.taskId || null,
          source,
          sourceKey: task?.sourceKey || `${source}-${task?.label || "task"}`,
          label: (task?.label || "").toString().trim(),
          status,
        };
      })
      .filter((task) => Boolean(task.label));

    // ⚠️ Verify: table or column not found in Supabase schema
    const completionStatus = determineCompletionStatus(
      filteredTasks,
      writeUpData?.completionStatus
    );
    const sectionEditors = normalizeSectionEditors(writeUpData?.sectionEditors);
    const taskChecklistPayload = buildTaskChecklistPayload(filteredTasks, sectionEditors);

    const formattedFault = ensureBulletFormat(writeUpData?.fault || "");
    const formattedCaused = ensureBulletFormat(writeUpData?.caused || "");
    const formattedRectification = ensureBulletFormat(writeUpData?.rectification || "");
    const rectificationSummary = formattedRectification || buildRectificationSummary(rectificationItems);
    const formattedAdditionalParts = ensureBulletFormat(writeUpData?.additionalParts || "");
    const formattedBulletins = ensureBulletFormat(writeUpData?.technicalBulletins || "");
    const formattedJobDescription = ensureBulletFormat(
      writeUpData?.jobDescription || writeUpData?.fault || ""
    );

    if (formattedJobDescription && formattedJobDescription !== (job.description || "")) {
      const jobUpdateResult = await updateJob(job.id, { description: formattedJobDescription });
      if (!jobUpdateResult.success) {
        console.error("⚠️ Failed to synchronise job description:", jobUpdateResult.error);
      }
    }

    const writeUpIsComplete =
      completionStatus === "complete" || completionStatus === "waiting_additional_work";
    const vhcSatisfied = !Boolean(job.vhc_required) || Boolean(job.vhc_completed_at);
    if (writeUpIsComplete && vhcSatisfied) {
      const normalisedStatus = (job.status || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
      const alreadyCompleteLike =
        normalisedStatus.includes("technician work completed") ||
        normalisedStatus.includes("tech complete") ||
        normalisedStatus === "complete" ||
        normalisedStatus.includes("invoiced");
      if (!alreadyCompleteLike) {
        const statusResult = await updateJobStatus(job.id, "Technician Work Completed");
        if (!statusResult?.success) {
          console.warn("⚠️ Write-up saved but failed to promote status to Technician Work Completed.");
        }
      }
    }

    const { data: existingTasks, error: existingTasksError } = await supabase
      // ⚠️ Verify: table or column not found in Supabase schema
      .from("job_writeup_tasks")
      .select("task_id, source, source_key")
      .eq("job_id", job.id);

    if (existingTasksError) {
      console.error("❌ Error loading existing write-up tasks:", existingTasksError);
      return { success: false, error: existingTasksError.message };
    }

    const existingTaskMap = new Map(
      (existingTasks || []).map((task) => [`${task.source}:${task.source_key}`, task])
    );

    const seenTaskKeys = new Set();
    const tasksToInsert = [];
    const tasksToUpdate = [];

    filteredTasks.forEach((task) => {
      const taskKey = `${task.source}:${task.sourceKey}`;
      seenTaskKeys.add(taskKey);
      const payload = {
        job_id: job.id,
        source: task.source,
        source_key: task.sourceKey,
        label: task.label,
        status: task.status,
      };

      const existingTask = existingTaskMap.get(taskKey);
      if (existingTask) {
        tasksToUpdate.push({ taskId: existingTask.task_id, payload });
      } else {
        tasksToInsert.push(payload);
      }
    });

    if (tasksToInsert.length > 0) {
      const { error: insertTasksError } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("job_writeup_tasks")
        .insert(tasksToInsert);

      if (insertTasksError) {
        console.error("❌ Error inserting write-up tasks:", insertTasksError);
        return { success: false, error: insertTasksError.message };
      }
    }

    for (const task of tasksToUpdate) {
      const { error: updateTaskError } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("job_writeup_tasks")
        .update({ label: task.payload.label, status: task.payload.status })
        .eq("task_id", task.taskId);

      if (updateTaskError) {
        console.error("❌ Error updating write-up task:", updateTaskError);
        return { success: false, error: updateTaskError.message };
      }
    }

    const tasksToRemove = (existingTasks || []).filter(
      (task) => !seenTaskKeys.has(`${task.source}:${task.source_key}`)
    );

    if (tasksToRemove.length > 0) {
      const { error: deleteTasksError } = await supabase
        // ⚠️ Verify: table or column not found in Supabase schema
        .from("job_writeup_tasks")
        .delete()
        .in(
          "task_id",
          tasksToRemove.map((task) => task.task_id)
        );

      if (deleteTasksError) {
        console.error("❌ Error deleting stale write-up tasks:", deleteTasksError);
        return { success: false, error: deleteTasksError.message };
      }
    }

    const requestStatusUpdates = filteredTasks
      .filter((task) => task.source === "request")
      .map((task) => {
        const match = String(task.sourceKey || "").match(/^req-(\d+)$/i);
        if (!match) return null;
        return {
          sortOrder: Number(match[1]),
          status: task.status === "complete" ? "complete" : "inprogress",
        };
      })
      .filter(Boolean);

    if (requestStatusUpdates.length > 0) {
      const timestamp = new Date().toISOString();
      for (const update of requestStatusUpdates) {
        const { error: requestUpdateError } = await supabase
          .from("job_requests")
          .update({ status: update.status, updated_at: timestamp })
          .eq("job_id", job.id)
          .eq("sort_order", update.sortOrder);

        if (requestUpdateError) {
          console.error("⚠️ Error updating job request status:", requestUpdateError);
        }
      }
    }

    // Map ALL form fields to database fields
    const writeUpToSave = {
      job_id: job.id,
      work_performed: formattedFault || null,
      parts_used: formattedAdditionalParts || null,
      recommendations: formattedCaused || null,
      ratification: rectificationSummary || null,
      cause_entries: sanitizeCauseEntriesForUpload(writeUpData?.causeEntries),
      warranty_claim: writeUpData?.warrantyClaim || null,
      tsr_number: writeUpData?.tsrNumber || null,
      pwa_number: writeUpData?.pwaNumber || null,
      technical_bulletins: formattedBulletins || null,
      technical_signature: writeUpData?.technicalSignature || null,
      quality_control: writeUpData?.qualityControl || null,
      qty: writeUpData.qty || Array(10).fill(false),
      booked: writeUpData.booked || Array(10).fill(false),
      labour_time: null, // Calculate if needed
      technician_id: job.assigned_to || null, // Get from job
      updated_at: new Date().toISOString(),
      // ⚠️ Verify: table or column not found in Supabase schema
      completion_status: completionStatus,
      // ⚠️ Verify: table or column not found in Supabase schema
      rectification_notes: rectificationSummary || null,
      // ⚠️ Verify: table or column not found in Supabase schema
      job_description_snapshot: formattedJobDescription || null,
      // ⚠️ Verify: table or column not found in Supabase schema
      vhc_authorization_reference: writeUpData?.vhcAuthorizationId || null,
      // ⚠️ Verify: table or column not found in Supabase schema
      task_checklist: taskChecklistPayload,
    };

    let writeUpRecord = null;

    if (existing) {
      console.log("🔄 Updating existing write-up");
      const { data: updatedWriteUp, error: updateWriteUpError } = await supabase
        .from("job_writeups")
        .update(writeUpToSave)
        .eq("writeup_id", existing.writeup_id)
        .select()
        .single();

      if (updateWriteUpError) {
        console.error("❌ Error updating write-up:", updateWriteUpError);
        return { success: false, error: updateWriteUpError.message };
      }

      writeUpRecord = updatedWriteUp;
    } else {
      console.log("➕ Creating new write-up");
      writeUpToSave.created_at = new Date().toISOString();
      const { data: insertedWriteUp, error: insertWriteUpError } = await supabase
        .from("job_writeups")
        .insert([writeUpToSave])
        .select()
        .single();

      if (insertWriteUpError) {
        console.error("❌ Error inserting write-up:", insertWriteUpError);
        return { success: false, error: insertWriteUpError.message };
      }

      writeUpRecord = insertedWriteUp;
    }

    if (writeUpRecord?.writeup_id) {
      try {
        await syncWriteUpRectificationItems({
          jobId: job.id,
          jobNumber,
          writeupId: writeUpRecord.writeup_id,
          items: rectificationItems,
        });
      } catch (syncError) {
        console.error("⚠️ Failed to sync rectification items:", syncError);
      }
    }

    console.log("✅ Write-up saved successfully");
    return { success: true, data: writeUpRecord, completionStatus };
  } catch (error) {
    console.error("❌ saveWriteUpToDatabase error:", error);
    return { success: false, error: error.message };
  }
};

/* ============================================
   SAVE / UPDATE VHC CHECKSHEET
   Persists technician VHC builder data against a job
============================================ */
const upsertVhcJsonBlob = async ({ jobId, section, title, data }) => {
  const now = new Date().toISOString();
  const safeJson = data != null ? JSON.stringify(data) : null;

  const { data: existing, error: existingError } = await supabase
    .from("vhc_checks")
    .select("vhc_id")
    .eq("job_id", jobId)
    .eq("section", section)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  const payload = {
    job_id: jobId,
    section,
    issue_title: title,
    issue_description: safeJson,
    measurement: null,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase
      .from("vhc_checks")
      .update(payload)
      .eq("vhc_id", existing.vhc_id);

    if (error) throw error;
    return existing.vhc_id;
  }

  const insertPayload = {
    ...payload,
    created_at: now,
  };

  const { data: inserted, error } = await supabase
    .from("vhc_checks")
    .insert([insertPayload])
    .select("vhc_id")
    .single();

  if (error) throw error;
  return inserted.vhc_id;
};

export const saveChecksheet = async (jobNumber, vhcData) => {
  console.log("💾 saveChecksheet:", jobNumber);

  try {
    if (!jobNumber) {
      throw new Error("Job number is required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return { success: false, error: { message: "Job not found" } };
    }

    await upsertVhcJsonBlob({
      jobId: job.id,
      section: "VHC_CHECKSHEET",
      title: "Technician VHC Checksheet",
      data: vhcData,
    });

    await syncHealthCheckToCanonicalVhc({
      job_number: jobNumber,
      vhcData,
      labour_rate_gbp: 85,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ saveChecksheet error:", error);
    return { success: false, error: { message: error.message } };
  }
};

export const updateJobVhcCheck = async (jobNumber, checkData) => {
  console.log("💾 updateJobVhcCheck:", jobNumber);

  try {
    if (!jobNumber) {
      throw new Error("Job number is required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return { success: false, error: { message: "Job not found" } };
    }

    await upsertVhcJsonBlob({
      jobId: job.id,
      section: "TECHNICIAN_CHECKSHEET",
      title: "Technician Check Sheet",
      data: checkData,
    });

    return { success: true };
  } catch (error) {
    console.error("❌ updateJobVhcCheck error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET JOBS BY PRIME GROUP
   Fetches all jobs linked to a prime job number
============================================ */
export const getJobsByPrimeGroup = async (primeJobNumber) => {
  try {
    if (!primeJobNumber) {
      return { success: false, error: { message: "Prime job number is required" } };
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle_reg,
        vehicle_make_model,
        customer_id,
        vehicle_id,
        prime_job_number,
        prime_job_id,
        is_prime_job,
        sub_job_sequence,
        created_at,
        vhc_required,
        technician_user:assigned_to(user_id, first_name, last_name, email),
        vehicle:vehicle_id(
          vehicle_id,
          registration,
          make_model,
          customer:customer_id(id, firstname, lastname, email, mobile)
        )
      `)
      .eq("prime_job_number", primeJobNumber)
      .order("sub_job_sequence", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("❌ Error fetching prime job group:", error);
      throw error;
    }

    // Separate prime job from sub-jobs
    const primeJob = data.find((job) => job.is_prime_job || job.job_number === primeJobNumber);
    const subJobs = data.filter((job) => !job.is_prime_job && job.job_number !== primeJobNumber);

    return {
      success: true,
      data: {
        primeJobNumber,
        primeJob: primeJob ? formatJobData(primeJob) : null,
        subJobs: subJobs.map((job) => formatJobData(job)),
        allJobs: data.map((job) => formatJobData(job)),
        totalCount: data.length,
      },
    };
  } catch (error) {
    console.error("❌ getJobsByPrimeGroup error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   CONVERT TO PRIME JOB
   Converts a standalone job to a prime job
============================================ */
export const convertToPrimeJob = async (jobId) => {
  try {
    if (!jobId) {
      return { success: false, error: { message: "Job ID is required" } };
    }

    // Fetch the job to get its job_number
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("id, job_number, is_prime_job, prime_job_id")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      console.error("❌ Job not found:", fetchError);
      return { success: false, error: { message: "Job not found" } };
    }

    // Check if already a prime job or sub-job
    if (job.is_prime_job) {
      return { success: false, error: { message: "Job is already a prime job" } };
    }

    if (job.prime_job_id) {
      return { success: false, error: { message: "Cannot convert a sub-job to prime job" } };
    }

    // Update to prime job
    const { data: updated, error: updateError } = await supabase
      .from("jobs")
      .update({
        is_prime_job: true,
        prime_job_number: job.job_number,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error converting to prime job:", updateError);
      throw updateError;
    }

    console.log("✅ Converted job to prime:", job.job_number);
    return { success: true, data: formatJobData(updated) };
  } catch (error) {
    console.error("❌ convertToPrimeJob error:", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   GET GROUPED JOBS FOR DATE
   Returns jobs for a date, grouped by prime_job_number
============================================ */
export const getGroupedJobsForDate = async (date) => {
  try {
    if (!date) {
      return { success: false, error: { message: "Date is required" } };
    }

    const startOfDay = dayjs(date).startOf("day").toISOString();
    const endOfDay = dayjs(date).endOf("day").toISOString();

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        description,
        type,
        status,
        assigned_to,
        vehicle_reg,
        vehicle_make_model,
        customer_id,
        vehicle_id,
        prime_job_number,
        prime_job_id,
        is_prime_job,
        sub_job_sequence,
        created_at,
        vhc_required,
        checked_in_at,
        technician_user:assigned_to(user_id, first_name, last_name, email),
        vehicle:vehicle_id(
          vehicle_id,
          registration,
          make_model,
          customer:customer_id(id, firstname, lastname, email, mobile)
        ),
        appointments!inner(
          appointment_id,
          scheduled_time,
          status,
          notes
        )
      `)
      .gte("appointments.scheduled_time", startOfDay)
      .lte("appointments.scheduled_time", endOfDay)
      .order("appointments.scheduled_time", { ascending: true });

    if (error) {
      console.error("❌ Error fetching grouped jobs:", error);
      throw error;
    }

    // Group jobs by prime_job_number
    const standaloneJobs = [];
    const jobGroups = new Map();

    for (const job of data) {
      const formattedJob = formatJobData(job);

      if (job.prime_job_number) {
        // Part of a prime job group
        if (!jobGroups.has(job.prime_job_number)) {
          jobGroups.set(job.prime_job_number, {
            primeJobNumber: job.prime_job_number,
            primeJob: null,
            subJobs: [],
          });
        }

        const group = jobGroups.get(job.prime_job_number);
        if (job.is_prime_job || job.job_number === job.prime_job_number) {
          group.primeJob = formattedJob;
        } else {
          group.subJobs.push(formattedJob);
        }
      } else {
        // Standalone job
        standaloneJobs.push(formattedJob);
      }
    }

    // Sort sub-jobs by sequence
    for (const group of jobGroups.values()) {
      group.subJobs.sort((a, b) => (a.subJobSequence || 0) - (b.subJobSequence || 0));
    }

    return {
      success: true,
      data: {
        standaloneJobs,
        jobGroups: Array.from(jobGroups.values()),
        totalCount: data.length,
      },
    };
  } catch (error) {
    console.error("❌ getGroupedJobsForDate error:", error);
    return { success: false, error: { message: error.message } };
  }
};
