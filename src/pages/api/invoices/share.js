// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/invoices/share.js
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "buffer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for invoice sharing");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);
const DOCUMENT_BUCKET = "job-documents";

const insertNotification = async ({ jobNumber, targetRole, message }) => {
  if (!jobNumber || !targetRole) return;
  await dbClient.from("notifications").insert({
    user_id: null,
    type: "invoice_delivery",
    message,
    target_role: targetRole,
    job_number: jobNumber,
    created_at: new Date().toISOString()
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    jobId,
    jobNumber,
    invoiceId,
    customerEmail,
    fileData,
    fileName,
    action
  } = req.body || {};

  if (!jobId || !fileData || !fileName) {
    return res
      .status(400)
      .json({ success: false, error: "Missing jobId, fileData, or fileName" });
  }

  try {
    const decoded = Buffer.from(fileData, "base64");
    const folderPath = `jobs/${jobId}/invoices`;
    const storagePath = `${folderPath}/${fileName}`;

    const { error: uploadError } = await dbClient.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, decoded, {
        contentType: "application/pdf",
        upsert: true
      });
    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = dbClient.storage
      .from(DOCUMENT_BUCKET)
      .getPublicUrl(storagePath);
    const fileUrl = publicUrlData?.publicUrl || "";

    const { error: fileInsertError } = await dbClient.from("job_files").insert({
      job_id: jobId,
      file_name: fileName,
      file_url: fileUrl,
      file_type: "application/pdf",
      folder: "invoices",
      uploaded_at: new Date().toISOString()
    });
    if (fileInsertError) {
      throw fileInsertError;
    }

    if (action === "email" && customerEmail) {
      await insertNotification({
        jobNumber,
        targetRole: "customer",
        message: `Invoice ${invoiceId || fileName} emailed to ${customerEmail}`
      });
    }

    return res.status(200).json({ success: true, fileUrl });
  } catch (error) {
    console.error("❌ share invoice error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to share invoice" });
  }
}
