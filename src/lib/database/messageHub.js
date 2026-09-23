// file location: src/lib/database/messageHub.js
//
// Server-side helpers for the /messages conversation hub that are not about
// threads themselves:
//
//   • resolveMessageReferences — turns the records a message references
//     (/job 123, /reg AB12CDE, /cust Jane …) into real, linkable DMS records.
//     A job also brings its vehicle and customer along ("smart linking").
//   • saveMessageAttachment / getMessageAttachmentUrl — files shared in a
//     conversation. Bytes live in the PRIVATE "message-attachments" bucket
//     under <threadId>/…; the path's thread prefix is what the download route
//     checks membership against, so no metadata table is needed — the
//     attachment descriptor travels on the message itself.
//
// Columns verified against src/lib/database/schema/schemaReference.sql:
//   jobs(id, job_number, customer, customer_id, vehicle_reg, vehicle_make_model)
//   vehicles(vehicle_id, reg_number, make, model)
//   customers(id, firstname, lastname, name, email, slug_key)
//   parts_catalog(part_number, name)
//   appointments(appointment_id, job_id, scheduled_time, status)
//   invoices(invoice_number, job_number, grand_total)

import crypto from "node:crypto";
import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { assertThreadMember } from "@/lib/database/messages";
import { isAllowedAttachmentMime } from "@/lib/news/constants";
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_MAX_BYTES,
  getLinkType,
  sanitizeLinks,
} from "@/lib/messages/conversationModel";

const db = supabaseService || supabase;
const SIGNED_URL_TTL_SECONDS = 60;

const clean = (value) => String(value || "").trim();
const compactReg = (value) => clean(value).toUpperCase().replace(/\s+/g, "");
const escapeLike = (value) => clean(value).replace(/[,%()]/g, " ").trim();

const link = (recordType, recordId, label) => {
  const [row] = sanitizeLinks([{ recordType, recordId, label }]);
  return row || null;
};

// ---------------------------------------------------------------------------
// Record resolution
// ---------------------------------------------------------------------------
const resolveJob = async (query) => {
  const jobNumber = clean(query).replace(/^#/, "");
  if (!jobNumber) return null;
  const { data } = await db
    .from("jobs")
    .select("id, job_number, customer, customer_id, vehicle_reg, vehicle_make_model")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (!data) return null;

  const related = [];
  if (data.vehicle_reg) {
    related.push(
      link(
        "vehicle",
        data.vehicle_reg,
        [data.vehicle_reg, data.vehicle_make_model].filter(Boolean).join(" · ")
      )
    );
  }
  if (data.customer_id) {
    const { data: customer } = await db
      .from("customers")
      .select("id, slug_key, name, firstname, lastname")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (customer) {
      const name =
        clean(customer.name) ||
        [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
        clean(data.customer);
      related.push(link("customer", customer.slug_key || customer.id, name || "Customer"));
    }
  }
  return {
    link: link(
      "job_card",
      data.job_number,
      ["Job " + data.job_number, data.vehicle_reg].filter(Boolean).join(" · ")
    ),
    related: related.filter(Boolean),
  };
};

const resolveVehicle = async (query) => {
  const reg = compactReg(query);
  if (!reg) return null;
  const { data } = await db
    .from("vehicles")
    .select("reg_number, make, model")
    .or(`reg_number.ilike.${reg},reg_number.ilike.${reg.slice(0, 4)} ${reg.slice(4)}`)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    link: link(
      "vehicle",
      row.reg_number,
      [row.reg_number, [row.make, row.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")
    ),
    related: [],
  };
};

const resolveCustomer = async (query) => {
  const term = escapeLike(query);
  if (!term) return null;
  let request = db.from("customers").select("id, slug_key, name, firstname, lastname, email").limit(1);
  request = term.includes("@")
    ? request.ilike("email", term)
    : request.or(`name.ilike.%${term}%,email.ilike.%${term}%,slug_key.eq.${term.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
  const { data } = await request;
  const row = data?.[0];
  if (!row) return null;
  const name = clean(row.name) || [row.firstname, row.lastname].filter(Boolean).join(" ") || row.email;
  return { link: link("customer", row.slug_key || row.id, name), related: [] };
};

const resolvePart = async (query) => {
  const term = escapeLike(query);
  if (!term) return null;
  const { data } = await db
    .from("parts_catalog")
    .select("part_number, name")
    .ilike("part_number", term)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return { link: link("part", row.part_number, `${row.part_number} · ${row.name}`), related: [] };
};

const resolveAppointment = async (query) => {
  const jobNumber = clean(query).replace(/^#/, "");
  if (!jobNumber) return null;
  const { data: job } = await db
    .from("jobs")
    .select("id, job_number")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (!job) return null;
  const { data } = await db
    .from("appointments")
    .select("appointment_id, scheduled_time, status")
    .eq("job_id", job.id)
    .order("scheduled_time", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const when = new Date(row.scheduled_time).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { link: link("appointment", job.job_number, `Appointment ${when} · Job ${job.job_number}`), related: [] };
};

const resolveInvoice = async (query) => {
  const term = escapeLike(query);
  if (!term) return null;
  const { data } = await db
    .from("invoices")
    .select("invoice_number, job_number")
    .or(`invoice_number.ilike.${term},job_number.eq.${term}`)
    .limit(1);
  const row = data?.[0];
  if (!row?.invoice_number) return null;
  return {
    link: link("invoice", row.invoice_number, `Invoice ${row.invoice_number}${row.job_number ? ` · Job ${row.job_number}` : ""}`),
    related: [],
  };
};

const RESOLVERS = {
  job_card: resolveJob,
  vehicle: resolveVehicle,
  customer: resolveCustomer,
  part: resolvePart,
  appointment: resolveAppointment,
  invoice: resolveInvoice,
};

/**
 * @param {Array<{ recordType: string, query: string }>} references
 * @returns {Promise<{ links: object[], unresolved: object[] }>}
 */
export async function resolveMessageReferences(references = []) {
  const list = (Array.isArray(references) ? references : []).slice(0, 12);
  const links = [];
  const unresolved = [];

  for (const reference of list) {
    const resolver = RESOLVERS[reference?.recordType];
    const query = clean(reference?.query);
    if (!resolver || !query) continue;
    try {
      const result = await resolver(query);
      if (result?.link) {
        links.push(result.link, ...(result.related || []));
      } else {
        unresolved.push({
          recordType: reference.recordType,
          query,
          label: `${getLinkType(reference.recordType)?.label || "Record"} ${query}`,
        });
      }
    } catch {
      unresolved.push({ recordType: reference.recordType, query, label: query });
    }
  }

  return { links: sanitizeLinks(links), unresolved };
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------
const safeFileName = (name) =>
  clean(name || "attachment")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(-120) || "attachment";

const bucketMissing = (error) => /bucket not found|not found/i.test(String(error?.message || ""));

export async function saveMessageAttachment({ threadId, userId, file }) {
  await assertThreadMember(threadId, userId);

  if (!file?.buffer?.length) throw new Error("No file was received.");
  if (file.buffer.length > ATTACHMENT_MAX_BYTES) {
    throw new Error(`That file is too large. The limit is ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.`);
  }
  if (!isAllowedAttachmentMime(file.mimeType)) {
    throw new Error("That file type cannot be shared in messages.");
  }

  const path = `${Number(threadId)}/${crypto.randomUUID()}-${safeFileName(file.fileName)}`;
  const { error } = await db.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimeType, upsert: false });

  if (error) {
    if (bucketMissing(error)) {
      throw new Error(
        "Attachments need the message-attachments storage bucket (created by migration 20260924120000_messages_conversation_hub.sql)."
      );
    }
    throw new Error(`Failed to upload the file: ${error.message}`);
  }

  return {
    path,
    fileName: clean(file.fileName).slice(0, 255) || "attachment",
    mimeType: file.mimeType,
    sizeBytes: file.buffer.length,
    isImage: String(file.mimeType || "").startsWith("image/"),
    uploadedBy: Number(userId),
    uploadedAt: new Date().toISOString(),
  };
}

export async function getMessageAttachmentUrl({ threadId, userId, path, download = false }) {
  await assertThreadMember(threadId, userId);
  const cleanPath = clean(path);
  // The path must sit under this thread's folder — membership of thread A
  // never unlocks a file shared in thread B.
  if (!cleanPath.startsWith(`${Number(threadId)}/`) || cleanPath.includes("..")) {
    const error = new Error("That file is not part of this conversation.");
    error.statusCode = 403;
    throw error;
  }
  const fileName = cleanPath.split("/").pop().replace(/^[0-9a-f-]{36}-/, "");
  const { data, error } = await db.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(cleanPath, SIGNED_URL_TTL_SECONDS, download ? { download: fileName } : undefined);
  if (error || !data?.signedUrl) {
    const missing = new Error("That file is no longer available.");
    missing.statusCode = 404;
    throw missing;
  }
  return data.signedUrl;
}
