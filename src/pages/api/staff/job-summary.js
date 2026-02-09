import { supabaseService } from "@/lib/supabaseClient";

const extractRequestOne = (requests = []) => {
  const req = requests.find((item) => Number(item.request_number) === 1) || null;
  if (!req) return "";
  return req.title || req.notes || "";
};

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key missing" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const jobNumber = String(req.query?.jobNumber || "").trim();
    if (!jobNumber) {
      return res.status(400).json({ success: false, error: "jobNumber is required" });
    }

    let invoiceTotal = null;
    let requestDescription = "";

    const { data: invoice, error: invoiceError } = await supabaseService
      .from("invoices")
      .select("id, invoice_total, job_number")
      .eq("job_number", jobNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!invoiceError && invoice) {
      invoiceTotal = invoice.invoice_total ?? null;
      const { data: requests } = await supabaseService
        .from("invoice_requests")
        .select("request_number, title, notes")
        .eq("invoice_id", invoice.id);
      requestDescription = extractRequestOne(requests || []);
    }

    if (!requestDescription) {
      const { data: archiveRow } = await supabaseService
        .from("job_archive")
        .select("snapshot, job_number")
        .eq("job_number", jobNumber)
        .single();

      const snapshotTables = archiveRow?.snapshot?.tables || {};
      requestDescription = extractRequestOne(snapshotTables.invoice_requests || []);

      if (!requestDescription) {
        requestDescription =
          archiveRow?.snapshot?.jobCard?.description ||
          archiveRow?.snapshot?.jobCard?.jobDescriptionSnapshot ||
          "";
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        jobNumber,
        invoiceTotal,
        requestDescription,
      },
    });
  } catch (error) {
    console.error("❌ staff/job-summary error", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to load job summary",
    });
  }
}
