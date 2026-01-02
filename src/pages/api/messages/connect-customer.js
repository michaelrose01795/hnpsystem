// file location: src/pages/api/messages/connect-customer.js

import { createGroupThread } from "@/lib/database/messages";
import { supabase } from "@/lib/supabaseClient";

const CUSTOMER_SELECT_FIELDS =
  "id, firstname, lastname, email, mobile, telephone, name";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const slugify = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const sanitizeIlikeTerm = (value = "") =>
  String(value || "").replace(/[%_]/g, "").trim();

const normalizeQuery = (value = "") =>
  String(value || "")
    .replace(/^\[|\]$/g, "")
    .trim();

const buildCustomerDisplayName = (row = {}) => {
  const combined = [row.firstname, row.lastname].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (row.name) return row.name.trim();
  if (row.email) return row.email.trim();
  return "Customer";
};

const lookupCustomerRow = async (rawQuery) => {
  const trimmed = normalizeQuery(rawQuery);
  if (!trimmed) {
    throw createHttpError(400, "Customer name or email is required.");
  }

  const normalized = trimmed.toLowerCase();
  let query = supabase.from("customers").select(CUSTOMER_SELECT_FIELDS).limit(5);

  if (normalized.includes("@")) {
    query = query.ilike("email", normalized);
  } else if (/^[0-9a-f-]{32,}$/i.test(trimmed)) {
    query = query.eq("id", trimmed);
  } else {
    const safeTerm = sanitizeIlikeTerm(trimmed);
    if (!safeTerm) {
      throw createHttpError(
        400,
        "Provide at least one letter from the customer's name."
      );
    }
    const filter = [
      `firstname.ilike.%${safeTerm}%`,
      `lastname.ilike.%${safeTerm}%`,
      `name.ilike.%${safeTerm}%`,
      `email.ilike.%${safeTerm}%`,
    ].join(",");
    query = query.or(filter);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    throw createHttpError(404, "No customer matched that name or email.");
  }

  const exactSlug = slugify(trimmed);
  const slugMatch = data.find((row) => {
    const rowName = slugify(
      row.name || [row.firstname, row.lastname].filter(Boolean).join(" ")
    );
    return rowName && exactSlug && rowName === exactSlug;
  });

  if (slugMatch) return slugMatch;

  const exactEmail = data.find(
    (row) => row.email && row.email.toLowerCase() === normalized
  );
  if (exactEmail) return exactEmail;

  if (data.length > 1) {
    throw createHttpError(
      409,
      "Multiple customers matched that name. Include their email address to target a single record."
    );
  }

  return data[0];
};

const ensureCustomerUser = async (customerRow) => {
  const email = String(customerRow.email || "").trim().toLowerCase();
  if (!email) {
    throw createHttpError(
      400,
      "Customer is missing an email address. Add an email before inviting them to chat."
    );
  }

  const { data: existingUser, error: lookupError } = await supabase
    .from("users")
    .select("user_id, role")
    .ilike("email", email)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw lookupError;
  }

  if (existingUser?.user_id) {
    const role = existingUser.role || "";
    if (!role.toLowerCase().includes("customer")) {
      await supabase
        .from("users")
        .update({ role: "Customer Portal" })
        .eq("user_id", existingUser.user_id);
    }
    return existingUser.user_id;
  }

  const fallbackFirst =
    customerRow.firstname ||
    (customerRow.name ? customerRow.name.split(" ")[0] : null) ||
    (email.includes("@") ? email.split("@")[0] : null) ||
    "Customer";
  const fallbackLast =
    customerRow.lastname ||
    (customerRow.name ? customerRow.name.split(" ").slice(1).join(" ") : null) ||
    "Portal";

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      first_name: fallbackFirst || "Customer",
      last_name: fallbackLast || "Portal",
      email,
      password_hash: "customer_portal",
      role: "Customer Portal",
      phone: customerRow.mobile || customerRow.telephone || null,
      name: `${fallbackFirst || ""} ${fallbackLast || ""}`.trim() || email,
    })
    .select("user_id")
    .single();

  if (insertError) throw insertError;

  return inserted.user_id;
};

const fetchThreadMembers = async (threadId) => {
  const { data, error } = await supabase
    .from("message_thread_members")
    .select("user_id")
    .eq("thread_id", threadId);

  if (error) throw error;
  return data || [];
};

const fetchThreadMeta = async (threadId) => {
  const { data, error } = await supabase
    .from("message_threads")
    .select("thread_id, thread_type, title")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw createHttpError(404, "Thread not found.");
  }
  return data;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { threadId, actorId, customerQuery } = req.body || {};
    const threadIdNum = Number(threadId);
    const actorUserId = Number(actorId);

    if (!Number.isFinite(threadIdNum) || threadIdNum <= 0) {
      throw createHttpError(400, "threadId must be a valid number.");
    }
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw createHttpError(400, "actorId must be a valid number.");
    }

    const members = await fetchThreadMembers(threadIdNum);
    if (!members.some((entry) => entry.user_id === actorUserId)) {
      throw createHttpError(
        403,
        "You must be part of the conversation to invite a customer."
      );
    }

    const baseThread = await fetchThreadMeta(threadIdNum);
    const customerRow = await lookupCustomerRow(customerQuery);
    const customerUserId = await ensureCustomerUser(customerRow);

    const existingMemberIds = members.map((entry) => entry.user_id);
    const combinedMemberIds = Array.from(
      new Set([...existingMemberIds, customerUserId])
    );

    if (!combinedMemberIds.includes(actorUserId)) {
      combinedMemberIds.push(actorUserId);
    }

    if (combinedMemberIds.length < 2) {
      throw createHttpError(
        400,
        "Unable to create a conversation without additional members."
      );
    }

    const fallbackTitle =
      baseThread.title ||
      `Customer · ${buildCustomerDisplayName(customerRow)}` ||
      "Customer Conversation";

    const newThread = await createGroupThread({
      title: fallbackTitle,
      memberIds: combinedMemberIds,
      createdBy: actorUserId,
    });

    return res.status(200).json({
      success: true,
      thread: newThread,
      customer: {
        id: customerRow.id,
        name: buildCustomerDisplayName(customerRow),
        email: customerRow.email,
        userId: customerUserId,
      },
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("❌ connect-customer error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Unable to connect customer to chat.",
    });
  }
}
