// file location: src/pages/api/messages/connect-customer.js

import { createGroupThread, ensureUserForCustomer } from "@/lib/database/messages";
import { supabase } from "@/lib/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const CUSTOMER_SELECT_FIELDS =
  "id, firstname, lastname, email, mobile, telephone, name";

const createHttpError = (status, message) => {
  // Build a tagged Error so the outer handler can map to a status code.
  const error = new Error(message);
  error.status = status;
  return error;
};

const slugify = (value = "") =>
  // Lowercase + strip non-alphanumerics so name comparisons ignore spacing/case.
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const sanitizeIlikeTerm = (value = "") =>
  // Strip ilike wildcards so a user-supplied term cannot widen the query.
  String(value || "").replace(/[%_]/g, "").trim();

const normalizeQuery = (value = "") =>
  // Trim and remove the optional [bracket] wrapper produced by /addcust[...].
  String(value || "")
    .replace(/^\[|\]$/g, "")
    .trim();

const buildCustomerDisplayName = (row = {}) => {
  // Prefer firstname+lastname, then the legacy "name" column, then email.
  const combined = [row.firstname, row.lastname].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (row.name) return row.name.trim();
  if (row.email) return row.email.trim();
  return "Customer";
};

const lookupCustomerRow = async (rawQuery) => {
  // Resolve the user-supplied query to a single customers row.
  const trimmed = normalizeQuery(rawQuery);
  if (!trimmed) {
    throw createHttpError(400, "Customer name or email is required.");
  }

  const normalized = trimmed.toLowerCase();
  let query = supabase.from("customers").select(CUSTOMER_SELECT_FIELDS).limit(5);

  if (normalized.includes("@")) {
    // Email lookup is exact (case-insensitive).
    query = query.ilike("email", normalized);
  } else if (/^[0-9a-f-]{32,}$/i.test(trimmed)) {
    // UUID lookup hits the customers PK directly.
    query = query.eq("id", trimmed);
  } else {
    // Free-text search across the name + email columns.
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

  // Prefer an exact slug (firstname+lastname) match if available.
  const exactSlug = slugify(trimmed);
  const slugMatch = data.find((row) => {
    const rowName = slugify(
      row.name || [row.firstname, row.lastname].filter(Boolean).join(" ")
    );
    return rowName && exactSlug && rowName === exactSlug;
  });

  if (slugMatch) return slugMatch;

  // Fall back to an exact email match.
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
  // Map the customers row onto a users row (creating one when missing) so the
  // customer can participate in the messages_* tables, which all reference
  // users.user_id. Linking strategy is email-based — see ensureUserForCustomer
  // in src/lib/database/messages.js for the full provisioning rules.
  try {
    return await ensureUserForCustomer(customerRow);
  } catch (error) {
    // Surface the missing-email error as a 400, everything else as 500.
    if (error?.message?.includes("missing an email address")) {
      throw createHttpError(400, error.message);
    }
    throw error;
  }
};

const fetchThreadMembers = async (threadId) => {
  // Pull the membership list so we can verify the actor + merge the customer.
  const { data, error } = await supabase
    .from("message_thread_members")
    .select("user_id")
    .eq("thread_id", threadId);

  if (error) throw error;
  return data || [];
};

const fetchThreadMeta = async (threadId) => {
  // Used for the fallback title when the existing thread has no name set.
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

async function handler(req, res, session) {
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

    // The actor must already be a member of the conversation they're inviting into.
    const members = await fetchThreadMembers(threadIdNum);
    if (!members.some((entry) => entry.user_id === actorUserId)) {
      throw createHttpError(
        403,
        "You must be part of the conversation to invite a customer."
      );
    }

    const baseThread = await fetchThreadMeta(threadIdNum);
    const customerRow = await lookupCustomerRow(customerQuery);
    // Provisions the matching users row when none exists yet.
    const customerUserId = await ensureCustomerUser(customerRow);

    // Merge the new customer user_id into the existing membership set, dedup,
    // then build a fresh group thread containing everyone.
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
    console.error("connect-customer error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Unable to connect customer to chat.",
    });
  }
}

export default withRoleGuard(handler);
