import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import {
  buildDefaultWidgetData,
  buildDefaultWidgets,
  getWidgetDefinition,
  normaliseWidgetRecord,
  sanitiseWidgetLayout,
  sortWidgetsForDisplay,
} from "@/lib/profile/personalWidgets";

export const PERSONAL_TABLES = {
  security: "user_personal_security",
  state: "user_personal_state",
  widgets: "user_personal_widgets",
  widgetData: "user_personal_widget_data",
  layout: "user_personal_layout",
  transactions: "personal_transactions",
  savings: "personal_savings",
  bills: "personal_bills",
  goals: "personal_goals",
  notes: "personal_notes",
  attachments: "personal_attachments",
};

export const PERSONAL_UNLOCK_COOKIE = "hnp-personal-unlock";
const PERSONAL_UNLOCK_TTL_MS = 1000 * 60 * 60 * 12;

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getPersonalSigningSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "personal-dashboard-dev-secret";
}

function createSignedToken(payload) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getPersonalSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedToken(token) {
  if (!token || !token.includes(".")) return null;

  const [encoded, providedSignature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", getPersonalSigningSecret())
    .update(encoded)
    .digest("base64url");

  const providedBuffer = Buffer.from(providedSignature || "");
  const expectedBuffer = Buffer.from(expectedSignature || "");
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  const payload = JSON.parse(fromBase64Url(encoded));
  if (!payload?.exp || Date.now() > Number(payload.exp)) return null;

  return payload;
}

function serialiseCookie(name, value, options = {}) {
  const segments = [`${name}=${value}`];
  segments.push(`Path=${options.path || "/"}`);
  segments.push(`SameSite=${options.sameSite || "Lax"}`);

  if (options.httpOnly !== false) segments.push("HttpOnly");
  if (options.secure || process.env.NODE_ENV === "production") segments.push("Secure");
  if (Number.isFinite(options.maxAge)) segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires instanceof Date) segments.push(`Expires=${options.expires.toUTCString()}`);

  return segments.join("; ");
}

function appendSetCookie(res, nextCookie) {
  const previous = res.getHeader("Set-Cookie");
  const values = Array.isArray(previous) ? previous : previous ? [previous] : [];
  res.setHeader("Set-Cookie", [...values, nextCookie]);
}

export function getPersonalDb() {
  return supabaseService || supabase;
}

export function setPersonalUnlockCookie(res, userId) {
  const now = Date.now();
  const token = createSignedToken({ userId, iat: now, exp: now + PERSONAL_UNLOCK_TTL_MS });

  appendSetCookie(
    res,
    serialiseCookie(PERSONAL_UNLOCK_COOKIE, token, {
      maxAge: PERSONAL_UNLOCK_TTL_MS / 1000,
    })
  );
}

export function clearPersonalUnlockCookie(res) {
  appendSetCookie(
    res,
    serialiseCookie(PERSONAL_UNLOCK_COOKIE, "", {
      maxAge: 0,
      expires: new Date(0),
    })
  );
}

function allowDevBypass(req) {
  const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
  return devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));
}

export async function resolvePersonalUserId(req, res) {
  if (allowDevBypass(req)) {
    const queryUserId = Number.parseInt(String(req.query.userId || req.body?.userId || ""), 10);
    if (Number.isInteger(queryUserId) && queryUserId > 0) return queryUserId;

    const { data: firstUser, error } = await getPersonalDb()
      .from("users")
      .select("user_id")
      .order("user_id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !firstUser?.user_id) {
      const nextError = new Error("Unable to resolve a user for the personal dashboard.");
      nextError.statusCode = 500;
      throw nextError;
    }

    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await resolveSessionUserId(session);
  } catch (sessionError) {
    sessionError.statusCode = sessionError.statusCode || 401;
    throw sessionError;
  }
}

export async function getPersonalSecurityRow(userId, db = getPersonalDb()) {
  const { data, error } = await db
    .from(PERSONAL_TABLES.security)
    .select("id, user_id, passcode_hash, is_setup, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getPersonalSecurityState(req, res, db = getPersonalDb()) {
  const userId = await resolvePersonalUserId(req, res);
  const security = await getPersonalSecurityRow(userId, db);
  const token = verifySignedToken(req.cookies?.[PERSONAL_UNLOCK_COOKIE] || "");
  const isUnlocked = Boolean(token && Number(token.userId) === Number(userId));

  return {
    userId,
    security,
    isSetup: Boolean(security?.is_setup && security?.passcode_hash),
    isUnlocked,
  };
}

export async function requirePersonalAccess(req, res, { requireUnlock = true } = {}) {
  const state = await getPersonalSecurityState(req, res);
  if (!state.isSetup) {
    const error = new Error("Personal passcode setup is required.");
    error.statusCode = 428;
    throw error;
  }

  if (requireUnlock && !state.isUnlocked) {
    const error = new Error("Personal dashboard is locked.");
    error.statusCode = 423;
    throw error;
  }

  return {
    ...state,
    db: getPersonalDb(),
  };
}

function buildDefaultWidgetState(userId) {
  const baseWidgets = buildDefaultWidgets(userId).map((row) => normaliseWidgetRecord(row));
  const widgets = sortWidgetsForDisplay(sanitiseWidgetLayout(baseWidgets));
  const widgetData = {};
  widgets.forEach((widget) => {
    widgetData[widget.widgetType] = {
      id: null,
      widgetType: widget.widgetType,
      data: buildDefaultWidgetData(widget.widgetType),
      updatedAt: null,
    };
  });
  return { widgets, widgetData };
}

function mapWidgetDataFromState(widgetDataMap = {}) {
  return Object.values(widgetDataMap || {}).map((entry) => ({
    id: entry?.id || null,
    widgetType: entry?.widgetType,
    data: entry?.data && typeof entry.data === "object" ? entry.data : {},
    updatedAt: entry?.updatedAt || null,
  }));
}

function normalisePersonalState(rawState = {}, userId) {
  const defaults = buildDefaultWidgetState(userId);
  const widgetsInput = Array.isArray(rawState.widgets) ? rawState.widgets : defaults.widgets;
  const widgets = sortWidgetsForDisplay(sanitiseWidgetLayout(widgetsInput.map((widget, index) => normaliseWidgetRecord(widget, index))));

  const nextWidgetData = { ...(rawState.widgetData || {}) };
  widgets.forEach((widget) => {
    const existing = nextWidgetData[widget.widgetType];
    nextWidgetData[widget.widgetType] = {
      id: existing?.id || null,
      widgetType: widget.widgetType,
      data: existing?.data && typeof existing.data === "object" ? existing.data : buildDefaultWidgetData(widget.widgetType),
      updatedAt: existing?.updatedAt || null,
    };
  });

  // v2 → v3 migration: promote financeState from widgetData["net-position"].data
  // to a top-level field so it has its own canonical location in the state blob
  let financeState = rawState.financeState || null;
  if (!financeState && nextWidgetData["net-position"]?.data?.financeState) {
    financeState = nextWidgetData["net-position"].data.financeState;
    const { financeState: _promoted, ...restNetPositionData } = nextWidgetData["net-position"].data;
    nextWidgetData["net-position"] = {
      ...nextWidgetData["net-position"],
      data: restNetPositionData,
    };
  }

  return {
    version: 3,
    widgets,
    widgetData: nextWidgetData,
    collections: {
      transactions: Array.isArray(rawState.collections?.transactions) ? rawState.collections.transactions : [],
      bills: Array.isArray(rawState.collections?.bills) ? rawState.collections.bills : [],
      goals: Array.isArray(rawState.collections?.goals) ? rawState.collections.goals : [],
      notes: Array.isArray(rawState.collections?.notes) ? rawState.collections.notes : [],
      attachments: Array.isArray(rawState.collections?.attachments) ? rawState.collections.attachments : [],
      savings: rawState.collections?.savings || null,
    },
    financeState,
    preferences: {
      selectedMonthKey: rawState.preferences?.selectedMonthKey || null,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function buildLegacyFallbackState(userId, db = getPersonalDb()) {
  const [
    widgetsResponse,
    widgetDataResponse,
    transactionsResponse,
    billsResponse,
    goalsResponse,
    notesResponse,
    attachmentsResponse,
    savingsResponse,
  ] = await Promise.all([
    db.from(PERSONAL_TABLES.widgets).select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.widgetData).select("id, user_id, widget_type, data_json, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.transactions).select("id, user_id, type, category, amount, date, is_recurring, notes, created_at, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.bills).select("id, user_id, name, amount, due_day, is_recurring, created_at, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.goals).select("id, user_id, type, target, current, deadline, created_at, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.notes).select("id, user_id, content, created_at, updated_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.attachments).select("id, user_id, file_url, file_name, mime_type, file_size, created_at").eq("user_id", userId),
    db.from(PERSONAL_TABLES.savings).select("id, user_id, target_amount, current_amount, monthly_contribution, created_at, updated_at").eq("user_id", userId).maybeSingle(),
  ]);

  const widgets = widgetsResponse.error
    ? []
    : sortWidgetsForDisplay(sanitiseWidgetLayout((widgetsResponse.data || []).map((row) => normaliseWidgetRecord(row))));

  const widgetDataMap = {};
  (widgetDataResponse.error ? [] : widgetDataResponse.data || []).forEach((row) => {
    const widgetType = row.widget_type;
    widgetDataMap[widgetType] = {
      id: row.id,
      widgetType,
      data: row.data_json || buildDefaultWidgetData(widgetType),
      updatedAt: row.updated_at || null,
    };
  });

  return normalisePersonalState(
    {
      widgets,
      widgetData: widgetDataMap,
      collections: {
        transactions: transactionsResponse.error ? [] : (transactionsResponse.data || []).map(mapTransactionRow),
        bills: billsResponse.error ? [] : (billsResponse.data || []).map(mapBillRow),
        goals: goalsResponse.error ? [] : (goalsResponse.data || []).map(mapGoalRow),
        notes: notesResponse.error ? [] : (notesResponse.data || []).map(mapNoteRow),
        attachments: attachmentsResponse.error ? [] : (attachmentsResponse.data || []).map(mapAttachmentRow),
        savings: savingsResponse.error || !savingsResponse.data ? null : mapSavingsRow(savingsResponse.data),
      },
    },
    userId
  );
}

export async function getPersonalStateRow(userId, db = getPersonalDb()) {
  const { data, error } = await db
    .from(PERSONAL_TABLES.state)
    .select("id, user_id, state_json, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function savePersonalState(userId, nextState, db = getPersonalDb()) {
  const normalised = normalisePersonalState(nextState, userId);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(PERSONAL_TABLES.state)
    .upsert(
      {
        user_id: userId,
        state_json: normalised,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select("id, user_id, state_json, created_at, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPersonalState(userId, db = getPersonalDb()) {
  const existing = await getPersonalStateRow(userId, db);
  if (existing?.state_json && typeof existing.state_json === "object") {
    return normalisePersonalState(existing.state_json, userId);
  }

  const fallback = await buildLegacyFallbackState(userId, db);
  await savePersonalState(userId, fallback, db);
  return fallback;
}

export async function ensureDefaultPersonalSetup(userId, db = getPersonalDb()) {
  return getPersonalState(userId, db);
}

export function mapWidgetRow(row = {}) {
  return normaliseWidgetRecord(row);
}

export function mapWidgetDataRow(row = {}) {
  const widgetType = row.widget_type || row.widgetType;
  return {
    id: row.id || null,
    userId: row.user_id ?? row.userId ?? null,
    widgetType,
    data: row.data_json || row.data || buildDefaultWidgetData(widgetType),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function mapWidgetDataRowsFromPersonalState(state = {}) {
  return mapWidgetDataFromState(state.widgetData || {});
}

export function mapTransactionRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    type: row.type || "expense",
    category: row.category || "General",
    amount: Number(row.amount || 0),
    date: row.date || null,
    isRecurring: row.is_recurring === true || row.isRecurring === true,
    notes: row.notes || "",
  };
}

export function mapSavingsRow(row = {}) {
  return {
    id: row.id || null,
    userId: row.user_id || row.userId || null,
    targetAmount: Number(row.target_amount ?? row.targetAmount ?? 0),
    currentAmount: Number(row.current_amount ?? row.currentAmount ?? 0),
    monthlyContribution: Number(row.monthly_contribution ?? row.monthlyContribution ?? 0),
  };
}

export function mapBillRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    name: row.name || "Bill",
    amount: Number(row.amount || 0),
    dueDay: Number(row.due_day ?? row.dueDay ?? 1),
    isRecurring: row.is_recurring !== false && row.isRecurring !== false,
  };
}

export function mapGoalRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    type: row.type || "custom",
    target: Number(row.target || 0),
    current: Number(row.current || 0),
    deadline: row.deadline || null,
  };
}

export function mapNoteRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    content: row.content || "",
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function mapAttachmentRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    fileName: row.file_name || row.fileName || "",
    fileUrl: row.file_url || row.fileUrl || "",
    createdAt: row.created_at || row.createdAt || null,
    mimeType: row.mime_type || row.mimeType || "application/octet-stream",
    fileSize: Number(row.file_size ?? row.fileSize ?? 0),
  };
}

export function validateWidgetType(widgetType) {
  const definition = getWidgetDefinition(widgetType);
  if (!definition || definition.type !== widgetType) {
    const error = new Error("Unsupported widget type.");
    error.statusCode = 400;
    throw error;
  }
}

export function buildPersonalApiError(res, error, fallbackMessage) {
  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage,
  });
}

// === Passcode utilities (merged from passcode.js) ===

const PASSCODE_PATTERN = /^\d{4}$/;
const HASH_PREFIX = "scrypt";

export function isValidPasscode(passcode) {
  return PASSCODE_PATTERN.test(String(passcode || ""));
}

export function hashPasscode(passcode) {
  if (!isValidPasscode(passcode)) {
    throw new Error("Passcode must be exactly 4 digits.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(passcode), salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPasscode(passcode, storedHash) {
  if (!isValidPasscode(passcode) || typeof storedHash !== "string") {
    return false;
  }

  const [prefix, salt, expectedHash] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(String(passcode), salt, 64).toString("hex");
  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

// === Personal attachments utilities (merged from personalAttachments.js) ===

const ATTACHMENTS_ROOT = path.join(process.cwd(), "private_uploads", "personal-attachments");

export function ensurePersonalAttachmentsRoot() {
  fs.mkdirSync(ATTACHMENTS_ROOT, { recursive: true });
  return ATTACHMENTS_ROOT;
}

export function sanitiseAttachmentFileName(fileName = "") {
  return String(fileName || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 180) || "attachment";
}

export function buildPersonalAttachmentRelativePath(userId, fileName) {
  const safeName = sanitiseAttachmentFileName(fileName);
  return path.posix.join(String(userId), `${Date.now()}-${safeName}`);
}

export function resolvePersonalAttachmentPath(relativePath) {
  const root = ensurePersonalAttachmentsRoot();
  const resolvedPath = path.resolve(root, relativePath);
  const resolvedRoot = path.resolve(root);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid personal attachment path.");
  }

  return resolvedPath;
}
