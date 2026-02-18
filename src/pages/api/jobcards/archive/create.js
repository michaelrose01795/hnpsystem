// file location: src/pages/api/jobcards/archive/create.js
import { supabaseService } from "@/lib/supabaseClient";
import { getJobByNumber } from "@/lib/database/jobs";
import { getNotesByJob } from "@/lib/database/notes";

const fetchRows = async (builder, label) => {
  const { data, error } = await builder;
  if (error) {
    throw new Error(`${label} fetch failed: ${error.message}`);
  }
  return data || [];
};

const mergeUniqueById = (rows = [], idKey = "id") => {
  const seen = new Set();
  const merged = [];
  rows.forEach((row) => {
    const key = row?.[idKey] ?? null;
    if (key == null) {
      merged.push(row);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });
  return merged;
};

const deleteByIds = async (table, idField, ids) => {
  if (!ids || ids.length === 0) return;
  const { error } = await supabaseService.from(table).delete().in(idField, ids);
  if (error) {
    throw new Error(`${table} delete failed: ${error.message}`);
  }
};

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key not configured" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { jobNumber } = req.body || {};
    const normalizedJobNumber = String(jobNumber || "").trim();

    if (!normalizedJobNumber) {
      return res.status(400).json({ success: false, error: "Job number is required" });
    }

    const { data, error } = await getJobByNumber(normalizedJobNumber);
    if (error || !data?.jobCard) {
      return res.status(404).json({
        success: false,
        error: error?.message || `Job ${normalizedJobNumber} not found`,
      });
    }

    const { jobCard, customer, vehicle } = data;
    const jobId = jobCard.id;
    const nowIso = new Date().toISOString();

    const notes = jobId ? await getNotesByJob(jobId) : [];
    const sharedNote = notes[0] || null;

    const snapshotTables = {};

    const jobRow = await supabaseService
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    snapshotTables.jobs = jobRow?.data ? [jobRow.data] : [];

    snapshotTables.appointments = await fetchRows(
      supabaseService.from("appointments").select("*").eq("job_id", jobId),
      "appointments"
    );
    snapshotTables.job_booking_requests = await fetchRows(
      supabaseService.from("job_booking_requests").select("*").eq("job_id", jobId),
      "job_booking_requests"
    );
    snapshotTables.job_check_sheets = await fetchRows(
      supabaseService.from("job_check_sheets").select("*").eq("job_id", jobId),
      "job_check_sheets"
    );

    const sheetIds = snapshotTables.job_check_sheets.map((row) => row.sheet_id);
    snapshotTables.job_check_sheet_checkboxes = sheetIds.length
      ? await fetchRows(
          supabaseService
            .from("job_check_sheet_checkboxes")
            .select("*")
            .in("sheet_id", sheetIds),
          "job_check_sheet_checkboxes"
        )
      : [];

    snapshotTables.job_clocking = await fetchRows(
      supabaseService
        .from("job_clocking")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "job_clocking"
    );
    snapshotTables.job_status_history = await fetchRows(
      supabaseService.from("job_status_history").select("*").eq("job_id", jobId),
      "job_status_history"
    );
    snapshotTables.job_customer_statuses = await fetchRows(
      supabaseService.from("job_customer_statuses").select("*").eq("job_id", jobId),
      "job_customer_statuses"
    );
    snapshotTables.job_cosmetic_damage = await fetchRows(
      supabaseService.from("job_cosmetic_damage").select("*").eq("job_id", jobId),
      "job_cosmetic_damage"
    );
    snapshotTables.job_notes = await fetchRows(
      supabaseService.from("job_notes").select("*").eq("job_id", jobId),
      "job_notes"
    );
    snapshotTables.job_files = await fetchRows(
      supabaseService.from("job_files").select("*").eq("job_id", jobId),
      "job_files"
    );
    snapshotTables.job_requests = await fetchRows(
      supabaseService.from("job_requests").select("*").eq("job_id", jobId),
      "job_requests"
    );
    snapshotTables.job_writeups = await fetchRows(
      supabaseService.from("job_writeups").select("*").eq("job_id", jobId),
      "job_writeups"
    );
    snapshotTables.job_writeup_tasks = await fetchRows(
      supabaseService.from("job_writeup_tasks").select("*").eq("job_id", jobId),
      "job_writeup_tasks"
    );
    snapshotTables.writeup_rectification_items = await fetchRows(
      supabaseService
        .from("writeup_rectification_items")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "writeup_rectification_items"
    );
    snapshotTables.job_share_links = await fetchRows(
      supabaseService
        .from("job_share_links")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "job_share_links"
    );

    snapshotTables.parts_job_items = await fetchRows(
      supabaseService.from("parts_job_items").select("*").eq("job_id", jobId),
      "parts_job_items"
    );
    snapshotTables.parts_requests = await fetchRows(
      supabaseService.from("parts_requests").select("*").eq("job_id", jobId),
      "parts_requests"
    );
    snapshotTables.parts_goods_in_items = await fetchRows(
      supabaseService
        .from("parts_goods_in_items")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "parts_goods_in_items"
    );

    const partsJobItemIds = snapshotTables.parts_job_items.map((row) => row.id);
    snapshotTables.parts_delivery_items = await fetchRows(
      supabaseService.from("parts_delivery_items").select("*").eq("job_id", jobId),
      "parts_delivery_items"
    );
    snapshotTables.parts_delivery_runs = await fetchRows(
      supabaseService.from("parts_delivery_runs").select("*").eq("job_id", jobId),
      "parts_delivery_runs"
    );
    snapshotTables.parts_delivery_jobs = await fetchRows(
      supabaseService.from("parts_delivery_jobs").select("*").eq("job_id", jobId),
      "parts_delivery_jobs"
    );

    const deliveryItemIds = snapshotTables.parts_delivery_items.map((row) => row.id);

    const stockMovementsByJobItem = partsJobItemIds.length
      ? await fetchRows(
          supabaseService
            .from("parts_stock_movements")
            .select("*")
            .in("job_item_id", partsJobItemIds),
          "parts_stock_movements"
        )
      : [];
    const stockMovementsByDelivery = deliveryItemIds.length
      ? await fetchRows(
          supabaseService
            .from("parts_stock_movements")
            .select("*")
            .in("delivery_item_id", deliveryItemIds),
          "parts_stock_movements"
        )
      : [];
    snapshotTables.parts_stock_movements = mergeUniqueById(
      [...stockMovementsByJobItem, ...stockMovementsByDelivery],
      "id"
    );

    snapshotTables.vhc_checks = await fetchRows(
      supabaseService.from("vhc_checks").select("*").eq("job_id", jobId),
      "vhc_checks"
    );
    snapshotTables.vhc_authorizations = await fetchRows(
      supabaseService.from("vhc_authorizations").select("*").eq("job_id", jobId),
      "vhc_authorizations"
    );
    snapshotTables.vhc_declinations = await fetchRows(
      supabaseService.from("vhc_declinations").select("*").eq("job_id", jobId),
      "vhc_declinations"
    );
    snapshotTables.vhc_send_history = await fetchRows(
      supabaseService.from("vhc_send_history").select("*").eq("job_id", jobId),
      "vhc_send_history"
    );

    snapshotTables.invoices = await fetchRows(
      supabaseService
        .from("invoices")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "invoices"
    );
    const invoiceIds = snapshotTables.invoices.map((row) => row.id);
    snapshotTables.invoice_items = invoiceIds.length
      ? await fetchRows(
          supabaseService.from("invoice_items").select("*").in("invoice_id", invoiceIds),
          "invoice_items"
        )
      : [];
    snapshotTables.invoice_payments = invoiceIds.length
      ? await fetchRows(
          supabaseService.from("invoice_payments").select("*").in("invoice_id", invoiceIds),
          "invoice_payments"
        )
      : [];
    snapshotTables.invoice_requests = invoiceIds.length
      ? await fetchRows(
          supabaseService.from("invoice_requests").select("*").in("invoice_id", invoiceIds),
          "invoice_requests"
        )
      : [];

    const invoiceRequestIds = snapshotTables.invoice_requests.map((row) => row.id);
    snapshotTables.invoice_request_items = invoiceRequestIds.length
      ? await fetchRows(
          supabaseService
            .from("invoice_request_items")
            .select("*")
            .in("request_id", invoiceRequestIds),
          "invoice_request_items"
        )
      : [];
    snapshotTables.payment_links = invoiceIds.length
      ? await fetchRows(
          supabaseService.from("payment_links").select("*").in("invoice_id", invoiceIds),
          "payment_links"
        )
      : [];

    const paymentPlansByJob = await fetchRows(
      supabaseService.from("payment_plans").select("*").eq("job_id", jobId),
      "payment_plans"
    );
    const paymentPlansByInvoice = invoiceIds.length
      ? await fetchRows(
          supabaseService.from("payment_plans").select("*").in("invoice_id", invoiceIds),
          "payment_plans"
        )
      : [];
    snapshotTables.payment_plans = mergeUniqueById(
      [...paymentPlansByJob, ...paymentPlansByInvoice],
      "plan_id"
    );

    snapshotTables.time_records = await fetchRows(
      supabaseService
        .from("time_records")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "time_records"
    );
    snapshotTables.overtime_sessions = await fetchRows(
      supabaseService.from("overtime_sessions").select("*").eq("job_id", jobId),
      "overtime_sessions"
    );
    snapshotTables.key_tracking_events = await fetchRows(
      supabaseService.from("key_tracking_events").select("*").eq("job_id", jobId),
      "key_tracking_events"
    );
    snapshotTables.vehicle_tracking_events = await fetchRows(
      supabaseService.from("vehicle_tracking_events").select("*").eq("job_id", jobId),
      "vehicle_tracking_events"
    );
    snapshotTables.delivery_stops = await fetchRows(
      supabaseService.from("delivery_stops").select("*").eq("job_id", jobId),
      "delivery_stops"
    );
    snapshotTables.workshop_consumable_usage = await fetchRows(
      supabaseService.from("workshop_consumable_usage").select("*").eq("job_id", jobId),
      "workshop_consumable_usage"
    );
    snapshotTables.staff_vehicle_history = await fetchRows(
      supabaseService.from("staff_vehicle_history").select("*").eq("job_id", jobId),
      "staff_vehicle_history"
    );
    snapshotTables.customer_activity_events = await fetchRows(
      supabaseService.from("customer_activity_events").select("*").eq("job_id", jobId),
      "customer_activity_events"
    );
    snapshotTables.customer_job_history = await fetchRows(
      supabaseService
        .from("customer_job_history")
        .select("*")
        .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`),
      "customer_job_history"
    );
    snapshotTables.notifications = await fetchRows(
      supabaseService.from("notifications").select("*").eq("job_number", normalizedJobNumber),
      "notifications"
    );
    snapshotTables.account_transactions = await fetchRows(
      supabaseService
        .from("account_transactions")
        .select("*")
        .eq("job_number", normalizedJobNumber),
      "account_transactions"
    );

    const snapshot = {
      archivedAt: nowIso,
      jobCard,
      customer,
      vehicle,
      sharedNote,
      notes,
      tables: snapshotTables,
    };

    const customerName =
      jobCard.customer ||
      [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
      null;
    const vehicleReg = jobCard.reg || jobCard.vehicleReg || vehicle?.reg || null;
    const vehicleMakeModel =
      jobCard.makeModel || jobCard.vehicleMakeModel || vehicle?.makeModel || null;

    const archivePayload = {
      job_id: jobId,
      job_number: jobCard.jobNumber || normalizedJobNumber,
      customer_id: jobCard.customerId || customer?.customerId || null,
      customer_name: customerName,
      vehicle_id: jobCard.vehicleId || vehicle?.vehicleId || null,
      vehicle_reg: vehicleReg,
      vehicle_make_model: vehicleMakeModel,
      status: jobCard.status || null,
      completed_at: nowIso,
      snapshot,
    };

    const { error: archiveError } = await supabaseService
      .from("job_archive")
      .upsert(archivePayload, { onConflict: "job_id" });

    if (archiveError) {
      throw new Error(archiveError.message);
    }

    // Break circular references and VHC links
    const { error: nullPartsError } = await supabaseService
      .from("parts_job_items")
      .update({ allocated_to_request_id: null, vhc_item_id: null })
      .eq("job_id", jobId);
    if (nullPartsError) throw new Error(nullPartsError.message);

    const { error: nullRequestsError } = await supabaseService
      .from("job_requests")
      .update({ parts_job_item_id: null, vhc_item_id: null })
      .eq("job_id", jobId);
    if (nullRequestsError) throw new Error(nullRequestsError.message);

    // Parts stock movements
    await deleteByIds("parts_stock_movements", "job_item_id", partsJobItemIds);
    await deleteByIds("parts_stock_movements", "delivery_item_id", deliveryItemIds);

    // Parts delivery / job links (delete before invoices due to FK)
    const partsDeliveryTables = ["parts_delivery_items", "parts_delivery_runs", "parts_delivery_jobs"];
    for (const table of partsDeliveryTables) {
      const { error: partsDeliveryError } = await supabaseService
        .from(table)
        .delete()
        .eq("job_id", jobId);
      if (partsDeliveryError) throw new Error(partsDeliveryError.message);
    }

    // Invoice-linked tables
    await deleteByIds("invoice_request_items", "request_id", invoiceRequestIds);
    await deleteByIds("invoice_requests", "invoice_id", invoiceIds);
    await deleteByIds("invoice_items", "invoice_id", invoiceIds);
    await deleteByIds("invoice_payments", "invoice_id", invoiceIds);
    await deleteByIds("payment_links", "invoice_id", invoiceIds);
    await deleteByIds("payment_plans", "invoice_id", invoiceIds);

    const { error: paymentPlansError } = await supabaseService
      .from("payment_plans")
      .delete()
      .eq("job_id", jobId);
    if (paymentPlansError) throw new Error(paymentPlansError.message);

    const { error: invoicesError } = await supabaseService
      .from("invoices")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (invoicesError) throw new Error(invoicesError.message);

    // Job check sheets
    await deleteByIds("job_check_sheet_checkboxes", "sheet_id", sheetIds);
    const { error: checkSheetsError } = await supabaseService
      .from("job_check_sheets")
      .delete()
      .eq("job_id", jobId);
    if (checkSheetsError) throw new Error(checkSheetsError.message);

    // Writeups + rectification
    const { error: writeupRectError } = await supabaseService
      .from("writeup_rectification_items")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (writeupRectError) throw new Error(writeupRectError.message);

    const { error: writeupTasksError } = await supabaseService
      .from("job_writeup_tasks")
      .delete()
      .eq("job_id", jobId);
    if (writeupTasksError) throw new Error(writeupTasksError.message);

    const { error: writeupsError } = await supabaseService
      .from("job_writeups")
      .delete()
      .eq("job_id", jobId);
    if (writeupsError) throw new Error(writeupsError.message);

    // Notes/files/status/history
    const jobDeleteTables = [
      "job_notes",
      "job_files",
      "job_status_history",
      "job_customer_statuses",
      "job_cosmetic_damage",
    ];
    for (const table of jobDeleteTables) {
      const { error: tableError } = await supabaseService.from(table).delete().eq("job_id", jobId);
      if (tableError) throw new Error(tableError.message);
    }

    const { error: shareLinksError } = await supabaseService
      .from("job_share_links")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (shareLinksError) throw new Error(shareLinksError.message);

    // Tech clocking / time
    const { error: clockingError } = await supabaseService
      .from("job_clocking")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (clockingError) throw new Error(clockingError.message);

    const { error: timeRecordsError } = await supabaseService
      .from("time_records")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (timeRecordsError) throw new Error(timeRecordsError.message);

    const { error: overtimeError } = await supabaseService
      .from("overtime_sessions")
      .delete()
      .eq("job_id", jobId);
    if (overtimeError) throw new Error(overtimeError.message);

    // VHC
    const vhcDeleteTables = [
      "vhc_authorizations",
      "vhc_declinations",
      "vhc_send_history",
    ];
    for (const table of vhcDeleteTables) {
      const { error: vhcError } = await supabaseService.from(table).delete().eq("job_id", jobId);
      if (vhcError) throw new Error(vhcError.message);
    }

    const { error: vhcChecksError } = await supabaseService
      .from("vhc_checks")
      .delete()
      .eq("job_id", jobId);
    if (vhcChecksError) throw new Error(vhcChecksError.message);

    // Job requests
    const { error: jobRequestsError } = await supabaseService
      .from("job_requests")
      .delete()
      .eq("job_id", jobId);
    if (jobRequestsError) throw new Error(jobRequestsError.message);

    // Parts: items, allocations, requests, goods-in
    const { error: partsJobItemsError } = await supabaseService
      .from("parts_job_items")
      .delete()
      .eq("job_id", jobId);
    if (partsJobItemsError) throw new Error(partsJobItemsError.message);

    const { error: partsRequestsError } = await supabaseService
      .from("parts_requests")
      .delete()
      .eq("job_id", jobId);
    if (partsRequestsError) throw new Error(partsRequestsError.message);

    const { error: goodsInError } = await supabaseService
      .from("parts_goods_in_items")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (goodsInError) throw new Error(goodsInError.message);

    // Other job-linked tables
    const { error: activityError } = await supabaseService
      .from("customer_activity_events")
      .delete()
      .eq("job_id", jobId);
    if (activityError) throw new Error(activityError.message);

    const { error: historyError } = await supabaseService
      .from("customer_job_history")
      .delete()
      .or(`job_id.eq.${jobId},job_number.eq.${normalizedJobNumber}`);
    if (historyError) throw new Error(historyError.message);

    const { error: appointmentsError } = await supabaseService
      .from("appointments")
      .delete()
      .eq("job_id", jobId);
    if (appointmentsError) throw new Error(appointmentsError.message);

    const { error: bookingError } = await supabaseService
      .from("job_booking_requests")
      .delete()
      .eq("job_id", jobId);
    if (bookingError) throw new Error(bookingError.message);

    const otherJobTables = [
      "delivery_stops",
      "key_tracking_events",
      "vehicle_tracking_events",
      "workshop_consumable_usage",
      "staff_vehicle_history",
    ];
    for (const table of otherJobTables) {
      const { error: otherError } = await supabaseService
        .from(table)
        .delete()
        .eq("job_id", jobId);
      if (otherError) throw new Error(otherError.message);
    }

    // Job-number-only tables
    const { error: notificationsError } = await supabaseService
      .from("notifications")
      .delete()
      .eq("job_number", normalizedJobNumber);
    if (notificationsError) throw new Error(notificationsError.message);

    const { error: accountTxnError } = await supabaseService
      .from("account_transactions")
      .delete()
      .eq("job_number", normalizedJobNumber);
    if (accountTxnError) throw new Error(accountTxnError.message);

    return res.status(200).json({
      success: true,
      message: `Job ${normalizedJobNumber} archived`,
      archiveId: archivePayload.job_id,
    });
  } catch (error) {
    console.error("❌ archive job error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to archive job" });
  }
}
