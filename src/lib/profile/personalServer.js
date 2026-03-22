import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { supabase, supabaseService } from "@/lib/supabaseClient";
import {
  buildDefaultWidgetConfig,
  buildDefaultWidgetData,
  buildDefaultWidgets,
  getWidgetDefinition,
  normaliseWidgetRecord,
  sanitiseWidgetLayout,
} from "@/lib/profile/personalWidgets";

export const PERSONAL_TABLES = {
  security: "user_personal_security",
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
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, providedSignature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", getPersonalSigningSecret())
    .update(encoded)
    .digest("base64url");

  const providedBuffer = Buffer.from(providedSignature || "");
  const expectedBuffer = Buffer.from(expectedSignature || "");
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(encoded));
  if (!payload?.exp || Date.now() > Number(payload.exp)) {
    return null;
  }

  return payload;
}

function serialiseCookie(name, value, options = {}) {
  const segments = [`${name}=${value}`];
  segments.push(`Path=${options.path || "/"}`);
  segments.push(`SameSite=${options.sameSite || "Lax"}`);

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }
  if (options.secure || process.env.NODE_ENV === "production") {
    segments.push("Secure");
  }
  if (Number.isFinite(options.maxAge)) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

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
  const token = createSignedToken({
    userId,
    iat: now,
    exp: now + PERSONAL_UNLOCK_TTL_MS,
  });

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
    if (Number.isInteger(queryUserId) && queryUserId > 0) {
      return queryUserId;
    }

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

  if (error) {
    throw error;
  }

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

async function ensureWidgetDataRows(userId, widgetTypes = [], db = getPersonalDb()) {
  if (!widgetTypes.length) {
    return [];
  }

  const { data: existingRows, error: existingError } = await db
    .from(PERSONAL_TABLES.widgetData)
    .select("id, user_id, widget_type, data_json, updated_at")
    .eq("user_id", userId)
    .in("widget_type", widgetTypes);

  if (existingError) {
    throw existingError;
  }

  const existingTypes = new Set((existingRows || []).map((row) => row.widget_type));
  const missingRows = widgetTypes
    .filter((widgetType) => !existingTypes.has(widgetType))
    .map((widgetType) => ({
      user_id: userId,
      widget_type: widgetType,
      data_json: buildDefaultWidgetData(widgetType),
      updated_at: new Date().toISOString(),
    }));

  if (missingRows.length > 0) {
    const { error: insertError } = await db.from(PERSONAL_TABLES.widgetData).insert(missingRows);
    if (insertError) {
      throw insertError;
    }
  }

  return existingRows || [];
}

export async function syncPersonalLayout(userId, widgets = [], db = getPersonalDb()) {
  const layoutJson = widgets.map((widget) => ({
    id: widget.id,
    widgetType: widget.widgetType,
    isVisible: widget.isVisible,
    positionX: widget.positionX,
    positionY: widget.positionY,
    width: widget.width,
    height: widget.height,
  }));

  const { error } = await db
    .from(PERSONAL_TABLES.layout)
    .upsert(
      {
        user_id: userId,
        layout_json: layoutJson,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw error;
  }
}

export async function ensureDefaultPersonalSetup(userId, db = getPersonalDb()) {
  const { data: existingRows, error: existingError } = await db
    .from(PERSONAL_TABLES.widgets)
    .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at")
    .eq("user_id", userId);

  if (existingError) {
    throw existingError;
  }

  let widgetRows = existingRows || [];

  if (widgetRows.length === 0) {
    const { data: insertedRows, error: insertError } = await db
      .from(PERSONAL_TABLES.widgets)
      .insert(buildDefaultWidgets(userId))
      .select("id, user_id, widget_type, is_visible, position_x, position_y, width, height, config_json, created_at, updated_at");

    if (insertError) {
      throw insertError;
    }

    widgetRows = insertedRows || [];
  }

  const sanitised = sanitiseWidgetLayout(widgetRows).map((widget) => ({
    ...widget,
    config: widget.config || buildDefaultWidgetConfig(widget.widgetType),
  }));

  await ensureWidgetDataRows(
    userId,
    sanitised.map((widget) => widget.widgetType),
    db
  );
  await syncPersonalLayout(userId, sanitised, db);

  return sanitised;
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

export function mapTransactionRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || "expense",
    category: row.category || "General",
    amount: Number(row.amount || 0),
    date: row.date || null,
    isRecurring: row.is_recurring === true,
    notes: row.notes || "",
  };
}

export function mapSavingsRow(row = {}) {
  return {
    id: row.id || null,
    userId: row.user_id || null,
    targetAmount: Number(row.target_amount || 0),
    currentAmount: Number(row.current_amount || 0),
    monthlyContribution: Number(row.monthly_contribution || 0),
  };
}

export function mapBillRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || "Bill",
    amount: Number(row.amount || 0),
    dueDay: Number(row.due_day || 1),
    isRecurring: row.is_recurring !== false,
  };
}

export function mapGoalRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || "custom",
    target: Number(row.target || 0),
    current: Number(row.current || 0),
    deadline: row.deadline || null,
  };
}

export function mapNoteRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapAttachmentRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name || "",
    fileUrl: row.file_url || "",
    createdAt: row.created_at || null,
    mimeType: row.mime_type || "application/octet-stream",
    fileSize: Number(row.file_size || 0),
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
