import { supabaseService } from "@/lib/supabaseClient";

const extractRequestOne = (requests = []) => {
  const req = requests.find((item) => Number(item.request_number) === 1) || null;
  if (!req) return "";
  return req.title || req.notes || "";
};

async function fetchInvoiceInfo(jobNumber) {
  if (!jobNumber) return { description: "", cost: null };
  const { data: invoice, error: invoiceError } = await supabaseService
    .from("invoices")
    .select("id, invoice_total, job_number, created_at")
    .eq("job_number", jobNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (invoiceError || !invoice) {
    return { description: "", cost: null };
  }

  let description = "";
  const { data: requests } = await supabaseService
    .from("invoice_requests")
    .select("request_number, title, notes")
    .eq("invoice_id", invoice.id);
  description = extractRequestOne(requests || []);

  return {
    description,
    cost: invoice.invoice_total ?? null,
  };
}

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key missing" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { vehicleId, registration, userName } = req.body || {};
    if (!vehicleId || !registration || !userName) {
      return res.status(400).json({
        success: false,
        error: "vehicleId, registration, and userName are required",
      });
    }

    const { data: jobs, error: jobsError } = await supabaseService
      .from("jobs")
      .select("id, job_number, customer, description, job_description_snapshot, created_at, updated_at, completed_at, vehicle_reg")
      .eq("vehicle_reg", registration)
      .ilike("customer", userName);

    if (jobsError) {
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ success: true, added: [] });
    }

    const jobIds = jobs.map((job) => job.id);
    const { data: existingHistory } = await supabaseService
      .from("staff_vehicle_history")
      .select("job_id")
      .eq("vehicle_id", vehicleId)
      .in("job_id", jobIds);

    const existingJobIds = new Set((existingHistory || []).map((row) => row.job_id));

    const inserts = [];
    const addedHistory = [];

    for (const job of jobs) {
      if (existingJobIds.has(job.id)) continue;

      const invoiceInfo = await fetchInvoiceInfo(job.job_number);
      const description =
        invoiceInfo.description ||
        job.description ||
        job.job_description_snapshot ||
        "Workshop visit";

      const cost = invoiceInfo.cost ?? 0;
      const recordedAt = job.completed_at || job.updated_at || job.created_at || new Date().toISOString();

      inserts.push({
        vehicle_id: vehicleId,
        job_id: job.id,
        description,
        cost: Number(cost ?? 0),
        deduct_from_payroll: true,
        recorded_at: recordedAt,
      });
    }

    if (inserts.length === 0) {
      return res.status(200).json({ success: true, added: [] });
    }

    const { data: insertedRows, error: insertError } = await supabaseService
      .from("staff_vehicle_history")
      .insert(inserts)
      .select(
        `
          history_id,
          vehicle_id,
          job_id,
          description,
          cost,
          deduct_from_payroll,
          recorded_at,
          payroll_processed_at
        `
      );

    if (insertError) {
      throw insertError;
    }

    (insertedRows || []).forEach((row) => {
      addedHistory.push({
        id: row.history_id,
        vehicleId: row.vehicle_id,
        jobId: row.job_id,
        description: row.description || "",
        cost: Number(row.cost ?? 0),
        deductFromPayroll: row.deduct_from_payroll !== false,
        recordedAt: row.recorded_at,
        payrollProcessedAt: row.payroll_processed_at || null,
      });
    });

    return res.status(200).json({ success: true, added: addedHistory });
  } catch (error) {
    console.error("❌ staff/vehicle-history sync error", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to sync vehicle history",
    });
  }
}
