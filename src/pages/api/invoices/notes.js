// file location: src/pages/api/invoices/notes.js
// Persists free-text invoice notes to the invoices.invoice_notes column.
// Used by the job-card Invoice workspace (InvoiceWorkspace) notes editor.
import { createClient } from "@supabase/supabase-js";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "@/lib/auth/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { invoiceId, notes } = req.body || {};

  // A persisted invoice row is required — proforma previews have no invoice id yet.
  if (!invoiceId || typeof invoiceId !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "invoiceId is required (invoice must be created first)" });
  }

  const noteValue = notes === null || notes === undefined ? "" : String(notes);

  const { data, error } = await dbClient
    .from("invoices")
    .update({ invoice_notes: noteValue, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("id, invoice_notes")
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true, data });
}

export default withRoleGuard(handler, { allow: [...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES] });
