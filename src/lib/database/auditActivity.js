import crypto from "crypto";
import { supabaseService } from "@/lib/database/supabaseClient";
import { sanitiseAuditData } from "@/lib/audit/privacy";
import { ALL_ACCESS_EMAIL } from "@/lib/database/allAccessVisibility";

const requireServiceClient = () => {
  if (!supabaseService) {
    throw new Error("Audit storage requires SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabaseService;
};

const normaliseUuid = (value) => {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
};

export async function getAuditActor(userId) {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  const { data, error } = await requireServiceClient()
    .from("users")
    .select("user_id, first_name, last_name, email, role, department")
    .eq("user_id", numericId)
    .maybeSingle();
  if (error) throw new Error(`Unable to resolve audit actor: ${error.message}`);
  if (!data) return null;
  return {
    userId: data.user_id,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || `User ${data.user_id}`,
    email: data.email || null,
    role: data.role || null,
    department: data.department || null,
  };
}

export async function startAuditSession({
  clientSessionId,
  actor,
  ip,
  userAgent,
  device,
  appMode,
}) {
  const clientId = normaliseUuid(clientSessionId);
  if (!clientId || !actor?.userId) throw new Error("A valid audit session identity is required.");
  const { data: existing, error: existingError } = await requireServiceClient()
    .from("audit_sessions")
    .select("id, status")
    .eq("user_id", actor.userId)
    .eq("client_session_id", clientId)
    .maybeSingle();
  if (existingError) throw new Error(`Unable to resolve audit session: ${existingError.message}`);
  const resolvedClientId = existing && existing.status !== "active"
    ? crypto.randomUUID()
    : clientId;
  const payload = {
    client_session_id: resolvedClientId,
    user_id: actor.userId,
    user_name: actor.name,
    user_email: actor.email,
    role: actor.role,
    department: actor.department,
    ip_address: ip || null,
    device_category: device?.deviceCategory || null,
    operating_system: device?.operatingSystem || null,
    browser_name: device?.browserName || null,
    browser_version: device?.browserVersion || null,
    app_mode: appMode || "browser",
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    last_activity_at: new Date().toISOString(),
    status: "active",
  };
  const { data, error } = await requireServiceClient()
    .from("audit_sessions")
    .upsert(payload, { onConflict: "user_id,client_session_id", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error) throw new Error(`Unable to start audit session: ${error.message}`);
  return data;
}

export async function getOwnedAuditSession(sessionId, userId) {
  const id = normaliseUuid(sessionId);
  if (!id) return null;
  const { data, error } = await requireServiceClient()
    .from("audit_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", Number(userId))
    .maybeSingle();
  if (error) throw new Error(`Unable to resolve audit session: ${error.message}`);
  return data || null;
}

export async function touchAuditSession({ sessionId, userId, at = new Date().toISOString() }) {
  const current = await getOwnedAuditSession(sessionId, userId);
  if (!current || current.status !== "active") return current;
  const { data, error } = await requireServiceClient()
    .from("audit_sessions")
    .update({ last_activity_at: at })
    .eq("id", current.id)
    .eq("user_id", Number(userId))
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update audit session: ${error.message}`);
  return data;
}

export async function endAuditSession({
  sessionId,
  userId,
  status = "logged_out",
  endReason = "explicit_logout",
  endedAt = new Date().toISOString(),
}) {
  const current = await getOwnedAuditSession(sessionId, userId);
  if (!current) return null;
  if (current.status !== "active") return current;
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(current.started_at).getTime()) / 1000)
  );
  const { data, error } = await requireServiceClient()
    .from("audit_sessions")
    .update({
      ended_at: endedAt,
      last_activity_at: endedAt,
      duration_seconds: durationSeconds,
      end_reason: endReason,
      status,
    })
    .eq("id", current.id)
    .eq("user_id", Number(userId))
    .select("*")
    .single();
  if (error) throw new Error(`Unable to end audit session: ${error.message}`);
  return data;
}

// Sanitise and write one already-enriched event. Shared by the single-event and
// batch paths so both produce byte-identical rows.
async function writeAuditEventRow(enrichedEvent) {
  const payload = {
    ...enrichedEvent,
    before_data: sanitiseAuditData(enrichedEvent.before_data),
    after_data: sanitiseAuditData(enrichedEvent.after_data),
    metadata: sanitiseAuditData(enrichedEvent.metadata) || {},
  };
  const { data, error } = await requireServiceClient().rpc("record_audit_event", {
    p_event: payload,
  });
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`Unable to record audit event: ${error.message}`);
  }
  return data;
}

export async function recordAuditEvent(event) {
  let enrichedEvent = event;
  if (event.actor_user_id && (!event.actor_name || !event.actor_department)) {
    const actor = await getAuditActor(event.actor_user_id);
    if (actor) {
      enrichedEvent = {
        ...event,
        actor_name: event.actor_name || actor.name,
        actor_role: event.actor_role || actor.role,
        actor_department: event.actor_department || actor.department,
      };
    }
  }
  return writeAuditEventRow(enrichedEvent);
}

// Resolve several audit actors in one query.
//
// recordAuditEvent enriches each event with the actor's name/role/department by
// querying `users` per event. A flush carries up to 50 events, and in practice
// they nearly all share one actor — the person using the app — so that was up to
// 50 identical lookups.
async function getAuditActors(userIds = []) {
  const ids = [...new Set(userIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return new Map();
  const { data, error } = await requireServiceClient()
    .from("users")
    .select("user_id, first_name, last_name, email, role, department")
    .in("user_id", ids);
  if (error) throw new Error(`Unable to resolve audit actors: ${error.message}`);
  return new Map(
    (data || []).map((row) => [
      Number(row.user_id),
      {
        userId: row.user_id,
        name: [row.first_name, row.last_name].filter(Boolean).join(" ") || `User ${row.user_id}`,
        email: row.email || null,
        role: row.role || null,
        department: row.department || null,
      },
    ])
  );
}

// Concurrency cap for the per-event RPC. The rows are independent (each carries
// its own occurred_at and its own dedupe key, and a duplicate is swallowed via
// 23505), so ordering within a flush is not meaningful — but firing all 50 at
// once would take 50 pooled connections for a background telemetry write, so it
// is bounded.
const AUDIT_WRITE_CONCURRENCY = 6;

export async function recordAuditEvents(events = []) {
  const batch = events.slice(0, 50);
  if (batch.length === 0) return [];

  // One lookup for every actor in the batch instead of one per event.
  const actorsById = await getAuditActors(
    batch.filter((e) => e.actor_user_id && (!e.actor_name || !e.actor_department)).map((e) => e.actor_user_id)
  );

  const enriched = batch.map((event) => {
    const actor = actorsById.get(Number(event.actor_user_id));
    if (!actor) return event;
    return {
      ...event,
      actor_name: event.actor_name || actor.name,
      actor_role: event.actor_role || actor.role,
      actor_department: event.actor_department || actor.department,
    };
  });

  // Bounded parallelism instead of a strict await-per-event loop. Results stay
  // in input order so callers that map ids back to events are unaffected.
  const results = new Array(enriched.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < enriched.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await writeAuditEventRow(enriched[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(AUDIT_WRITE_CONCURRENCY, enriched.length) }, worker)
  );
  return results;
}

const applyEventFilters = (query, filters) => {
  if (filters.userId) query = query.eq("actor_user_id", filters.userId);
  if (filters.role) query = query.eq("actor_role", filters.role);
  if (filters.department) query = query.eq("actor_department", filters.department);
  if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
  if (filters.page) query = query.ilike("route", `%${filters.page}%`);
  if (filters.actionCategory) query = query.eq("action_category", filters.actionCategory);
  if (filters.recordType) query = query.eq("record_type", filters.recordType);
  if (filters.recordId) query = query.eq("record_id", filters.recordId);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", filters.to);
  if (filters.search) {
    const safe = String(filters.search)
      .replace(/[^a-zA-Z0-9\s./:-]/g, " ")
      .trim()
      .slice(0, 100);
    if (safe) {
      query = query.or(
        `actor_name.ilike.%${safe}%,event_name.ilike.%${safe}%,action_label.ilike.%${safe}%,feature.ilike.%${safe}%,route.ilike.%${safe}%,record_id.ilike.%${safe}%`
      );
    }
  }
  return query;
};

export async function listAuditEvents(filters = {}) {
  const page = Math.max(1, Number(filters.pageNumber) || 1);
  const pageSize = Math.min(1000, Math.max(10, Number(filters.pageSize) || 25));
  const fromRow = (page - 1) * pageSize;
  let matchingSessionIds = null;
  if (filters.device || filters.browser) {
    let sessionQuery = requireServiceClient().from("audit_sessions").select("id");
    if (filters.device) sessionQuery = sessionQuery.eq("device_category", filters.device);
    if (filters.browser) sessionQuery = sessionQuery.eq("browser_name", filters.browser);
    const sessionResult = await sessionQuery.limit(10000);
    if (sessionResult.error) {
      throw new Error(`Unable to filter audit sessions: ${sessionResult.error.message}`);
    }
    matchingSessionIds = (sessionResult.data || []).map((session) => session.id);
    if (!matchingSessionIds.length) return { rows: [], total: 0, page, pageSize };
  }
  let query = requireServiceClient()
    .from("audit_events")
    .select("*, audit_sessions(id, user_name, role, department, ip_address, device_category, operating_system, browser_name, browser_version, app_mode, started_at, ended_at, last_activity_at, status, duration_seconds)", { count: "exact" });
  query = applyEventFilters(query, filters);
  if (matchingSessionIds) query = query.in("session_id", matchingSessionIds);
  const { data, error, count } = await query
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(fromRow, fromRow + pageSize - 1);
  if (error) throw new Error(`Unable to load audit events: ${error.message}`);
  return { rows: data || [], total: count || 0, page, pageSize };
}

export async function listAuditFilterOptions({ department = null } = {}) {
  let userQuery = requireServiceClient()
    .from("users")
    .select("user_id, first_name, last_name, role, department")
    .neq("email", ALL_ACCESS_EMAIL) // the demo account is invisible to everyone else
    .order("first_name");
  let sessionQuery = requireServiceClient()
    .from("audit_sessions")
    .select("id, user_name, started_at, status, role, department, device_category, browser_name")
    .order("started_at", { ascending: false })
    .limit(2000);
  if (department) {
    userQuery = userQuery.eq("department", department);
    sessionQuery = sessionQuery.eq("department", department);
  }
  const [users, sessions] = await Promise.all([
    userQuery,
    sessionQuery,
  ]);
  if (users.error) throw new Error(`Unable to load audit users: ${users.error.message}`);
  if (sessions.error) throw new Error(`Unable to load audit filters: ${sessions.error.message}`);
  const unique = (key) =>
    Array.from(new Set((sessions.data || []).map((row) => row[key]).filter(Boolean))).sort();
  return {
    users: (users.data || []).map((user) => ({
      id: user.user_id,
      name: [user.first_name, user.last_name].filter(Boolean).join(" "),
      role: user.role,
      department: user.department,
    })),
    roles: unique("role"),
    departments: unique("department"),
    devices: unique("device_category"),
    browsers: unique("browser_name"),
    sessions: (sessions.data || []).slice(0, 500).map((session) => ({
      id: session.id,
      userName: session.user_name,
      startedAt: session.started_at,
      status: session.status,
    })),
  };
}

export async function getAuditSessionSummaries(sessionIds = []) {
  const ids = sessionIds.map(normaliseUuid).filter(Boolean).slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await requireServiceClient()
    .from("audit_sessions")
    .select("*")
    .in("id", ids)
    .order("started_at", { ascending: false });
  if (error) throw new Error(`Unable to load audit sessions: ${error.message}`);
  return data || [];
}

export async function runAuditMaintenance({ archive = false } = {}) {
  const expired = await requireServiceClient().rpc("expire_stale_audit_sessions");
  if (expired.error) throw new Error(`Unable to expire audit sessions: ${expired.error.message}`);
  let archival = null;
  if (archive) {
    const result = await requireServiceClient().rpc("archive_expired_audit_events", {
      p_limit: 10000,
    });
    if (result.error) throw new Error(`Unable to archive audit events: ${result.error.message}`);
    archival = result.data;
  }
  return { expiredSessions: expired.data || 0, archival };
}

export async function getAuditRetentionSettings() {
  const { data, error } = await requireServiceClient()
    .from("audit_retention_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Unable to load audit retention settings: ${error.message}`);
  return data;
}

export async function updateAuditRetentionSettings({
  liveDays,
  archiveDays,
  sessionTimeoutMinutes,
  updatedBy,
}) {
  const payload = {
    live_days: Math.max(30, Math.min(3650, Number(liveDays))),
    archive_days: Math.max(365, Math.min(7300, Number(archiveDays))),
    session_timeout_minutes: Math.max(5, Math.min(1440, Number(sessionTimeoutMinutes))),
    updated_by: Number(updatedBy) || null,
    updated_at: new Date().toISOString(),
  };
  if (payload.archive_days < payload.live_days) {
    throw new Error("Archive retention must be at least as long as live retention.");
  }
  const { data, error } = await requireServiceClient()
    .from("audit_retention_settings")
    .update(payload)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update audit retention settings: ${error.message}`);
  return data;
}
