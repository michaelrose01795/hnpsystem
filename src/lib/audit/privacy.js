const REDACTED = "[REDACTED]";
const MAX_DEPTH = 4;
const MAX_KEYS = 40;
const MAX_STRING_LENGTH = 240;

const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|session.?token|api.?key|private.?key|card|cvv|cvc|sort.?code|bank|account.?number|national.?insurance|ni.?number|licen[cs]e|address|phone|email.?body|message.?body|full.?text|form.?content)/i;

const FREE_TEXT_KEY_PATTERN =
  /(^|_)(description|notes?|comments?|message|body|content|text|reason)($|_)/i;

const SAFE_METADATA_KEYS = new Set([
  "action",
  "action_category",
  "affected_fields",
  "api_route",
  "button_type",
  "changed_fields",
  "count",
  "error_code",
  "field_names",
  "http_method",
  "http_status",
  "link_target",
  "source",
  "work_type",
]);

const truncate = (value) =>
  String(value).length > MAX_STRING_LENGTH
    ? `${String(value).slice(0, MAX_STRING_LENGTH)}...`
    : String(value);

function sanitiseValue(value, key, depth) {
  if (value === null || value === undefined) return null;
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string") {
    if (FREE_TEXT_KEY_PATTERN.test(key) && !SAFE_METADATA_KEYS.has(key)) {
      return `[OMITTED:${value.length}]`;
    }
    return truncate(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitiseValue(item, key, depth + 1));
  }
  if (typeof value === "object") {
    return sanitiseAuditData(value, depth + 1);
  }
  return truncate(value);
}

export function sanitiseAuditData(value, depth = 0) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value).slice(0, MAX_KEYS);
  return Object.fromEntries(
    entries.map(([key, item]) => [key, sanitiseValue(item, key, depth)])
  );
}

export function sanitiseActionLabel(value) {
  if (!value) return null;
  return truncate(String(value).replace(/\s+/g, " ").trim());
}

export function sanitiseRoute(value) {
  if (!value) return null;
  const route = String(value).split("#")[0].split("?")[0];
  return route.startsWith("/") ? truncate(route) : null;
}

export function extractSafeMutationMetadata(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const fieldNames = Object.keys(body)
    .filter(
      (key) =>
        !SENSITIVE_KEY_PATTERN.test(key) &&
        (!FREE_TEXT_KEY_PATTERN.test(key) || SAFE_METADATA_KEYS.has(key))
    )
    .slice(0, 30);
  const identifiers = {};
  for (const key of fieldNames) {
    if (!/(^id$|_id$|Id$|number$|Number$|action$|status$|type$)/.test(key)) continue;
    const value = body[key];
    if (["string", "number", "boolean"].includes(typeof value)) {
      identifiers[key] = sanitiseValue(value, key, 0);
    }
  }
  return { field_names: fieldNames, identifiers };
}

export const AUDIT_REDACTED_VALUE = REDACTED;
