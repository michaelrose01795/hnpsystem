// file location: src/lib/database/messageTemplates.js
// DB helper for the customer-facing quick message templates used by the job-card
// Contact tab. Templates are shared, editable defaults stored in the
// public.message_templates table. If the table is empty (fresh install) the
// helper falls back to the seeded code defaults below so the UI always has a set
// to show. Mirrors the supabase access pattern in src/lib/database/messages.js.
import { supabase, supabaseService } from "@/lib/database/supabaseClient";

const dbClient = supabaseService || supabase;
const isServiceClient = Boolean(supabaseService);

const assertWriteAccess = () => {
  if (!isServiceClient) {
    throw new Error(
      "Server missing SUPABASE_SERVICE_ROLE_KEY; message-template writes are blocked by RLS."
    );
  }
};

// Customer-friendly default wording. Placeholders {customerName}, {jobNumber} and
// {reg} are interpolated client-side before the message is sent.
export const DEFAULT_MESSAGE_TEMPLATES = [
  {
    templateKey: "vehicle-ready",
    title: "Vehicle Ready",
    body: "Hi {customerName}, good news — your vehicle ({reg}) is ready for collection (job {jobNumber}). Please let us know when you'd like to pick it up. Thank you, Humphries & Parks.",
    sortOrder: 10,
  },
  {
    templateKey: "awaiting-approval",
    title: "Awaiting Approval",
    body: "Hi {customerName}, we've found some work on your vehicle ({reg}) that needs your approval before we continue with job {jobNumber}. Please get in touch at your earliest convenience. Thank you, Humphries & Parks.",
    sortOrder: 20,
  },
  {
    templateKey: "parts-delayed",
    title: "Parts Delayed",
    body: "Hi {customerName}, we're currently waiting on parts for your vehicle ({reg}) on job {jobNumber}. We'll keep you updated and let you know as soon as they arrive. Apologies for any inconvenience. Humphries & Parks.",
    sortOrder: 30,
  },
  {
    templateKey: "collection-reminder",
    title: "Collection Reminder",
    body: "Hi {customerName}, just a friendly reminder that your vehicle ({reg}) is ready and waiting for collection (job {jobNumber}). Please pop in whenever is convenient. Thank you, Humphries & Parks.",
    sortOrder: 40,
  },
  {
    templateKey: "additional-work-found",
    title: "Additional Work Found",
    body: "Hi {customerName}, during work on your vehicle ({reg}) we've found some additional items that may need attention (job {jobNumber}). We'll send over the details and a quote for your approval. Humphries & Parks.",
    sortOrder: 50,
  },
  {
    templateKey: "courtesy-car-available",
    title: "Courtesy Car Available",
    body: "Hi {customerName}, a courtesy car is now available for you while we work on your vehicle ({reg}) (job {jobNumber}). Please contact us to arrange collection. Humphries & Parks.",
    sortOrder: 60,
  },
  {
    templateKey: "payment-link",
    title: "Payment Link",
    body: "Hi {customerName}, your invoice for job {jobNumber} ({reg}) is ready. You can pay securely online using the link we'll send through shortly. Thank you, Humphries & Parks.",
    sortOrder: 70,
  },
  {
    templateKey: "booking-confirmation",
    title: "Booking Confirmation",
    body: "Hi {customerName}, this confirms your booking for {reg} (job {jobNumber}). We look forward to seeing you. Humphries & Parks.",
    sortOrder: 80,
  },
  {
    templateKey: "running-behind",
    title: "Running Behind",
    body: "Hi {customerName}, we're running a little behind on your vehicle ({reg}) for job {jobNumber}. We'll have it ready as soon as possible and will keep you posted. Apologies for the wait. Humphries & Parks.",
    sortOrder: 90,
  },
  {
    templateKey: "mot-service-due",
    title: "MOT / Service Due",
    body: "Hi {customerName}, our records show your vehicle ({reg}) is due for its MOT/service soon. Reply to this message and we'll get you booked in. Humphries & Parks.",
    sortOrder: 100,
  },
];

const formatTemplateRow = (row) => ({
  id: row.id ?? null,
  templateKey: row.template_key,
  title: row.title,
  body: row.body,
  isActive: row.is_active !== false,
  sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
});

// Merge DB rows over the code defaults keyed by templateKey, so newly added code
// defaults appear even before they're persisted, while DB edits win for wording.
const mergeWithDefaults = (rows) => {
  const byKey = new Map(
    DEFAULT_MESSAGE_TEMPLATES.map((tpl) => [tpl.templateKey, { ...tpl, id: null, isActive: true }])
  );
  for (const row of rows) {
    const formatted = formatTemplateRow(row);
    byKey.set(formatted.templateKey, formatted);
  }
  return Array.from(byKey.values())
    .filter((tpl) => tpl.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
};

/**
 * Returns the active templates, merging any DB overrides over the code defaults.
 * Never throws for a missing table — falls back to defaults so the UI still works
 * before the migration is applied.
 */
export const getActiveTemplates = async () => {
  try {
    const { data, error } = await dbClient
      .from("message_templates")
      .select("id, template_key, title, body, is_active, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("getActiveTemplates: falling back to defaults:", error.message);
      return DEFAULT_MESSAGE_TEMPLATES.map((tpl) => ({ ...tpl, id: null, isActive: true }));
    }

    return mergeWithDefaults(Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn("getActiveTemplates: unexpected error, using defaults:", err?.message);
    return DEFAULT_MESSAGE_TEMPLATES.map((tpl) => ({ ...tpl, id: null, isActive: true }));
  }
};

/**
 * Insert or update a template by its stable template_key.
 */
export const upsertTemplate = async ({ templateKey, title, body, updatedBy = null }) => {
  assertWriteAccess();

  const key = (templateKey || "").trim();
  if (!key) throw new Error("templateKey is required");
  if (!title || !title.trim()) throw new Error("title is required");
  if (!body || !body.trim()) throw new Error("body is required");

  const seed = DEFAULT_MESSAGE_TEMPLATES.find((tpl) => tpl.templateKey === key);

  const { data, error } = await dbClient
    .from("message_templates")
    .upsert(
      {
        template_key: key,
        title: title.trim(),
        body: body.trim(),
        is_active: true,
        sort_order: seed?.sortOrder ?? 0,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "template_key" }
    )
    .select("id, template_key, title, body, is_active, sort_order")
    .single();

  if (error) throw error;
  return formatTemplateRow(data);
};
