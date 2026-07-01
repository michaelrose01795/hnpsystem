// file location: src/lib/support/reportSubmission.js
//
// Phase 3 — pure, server-side helpers that turn an untrusted POST body from the
// Support modal into the validated input for createSupportReport(), and decode
// the user-supplied screenshot data URL into an upload buffer.
//
// This module is PURE (no I/O, no Supabase, no next-auth) so the submit flow —
// validation, server-side re-sanitisation, secret redaction, identity-from-
// session (never from the client), and column derivation — is unit-testable in
// the node Vitest environment without standing up the API route.
//
// Privacy (plan §4): the client already scrubbed the diagnostics blob once, but
// the client is untrusted, so buildReportInsert() re-runs the shared sanitiser
// and enforces the size cap here at the route boundary (defence in depth, in
// addition to the third pass inside createSupportReport()).

import { sanitiseDiagnostics, isWithinSizeCap } from "@/lib/support/sanitise";
import { normalizeRoles } from "@/lib/auth/roles";

// User-facing category list (value + plain-English label). The popup renders
// these; the server validates against the value set. Values mirror the CHECK
// constraint enforced in createSupportReport()/the schema.
export const SUPPORT_CATEGORIES = Object.freeze([
  { value: "bug", label: "Something is broken" },
  { value: "visual", label: "Looks wrong / layout issue" },
  { value: "data", label: "Wrong or missing data" },
  { value: "question", label: "I have a question" },
  { value: "suggestion", label: "Suggestion / idea" },
  { value: "other", label: "Something else" },
]);

export const SUPPORT_CATEGORY_VALUES = new Set(SUPPORT_CATEGORIES.map((c) => c.value));
export const DEFAULT_SUPPORT_CATEGORY = "bug";

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 5000;

// Screenshot constraints — must match the private bucket service caps.
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_SCREENSHOTS = 6; // upper bound on attachments per report
const SCREENSHOT_DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
};

const MAX_ANNOTATION = 500;

// A screenshot entry may be a bare data-URL string (legacy) or an object
// { src, annotation }. These helpers read either shape.
export function screenshotEntries(input) {
  if (Array.isArray(input)) return input;
  if (input == null || input === "") return [];
  return [input];
}
export function screenshotSrc(entry) {
  if (typeof entry === "string") return entry;
  return entry && typeof entry === "object" ? entry.src : null;
}
export function screenshotAnnotation(entry) {
  if (entry && typeof entry === "object" && typeof entry.annotation === "string") {
    return entry.annotation.trim().slice(0, MAX_ANNOTATION);
  }
  return "";
}

/**
 * Validate + assemble the createSupportReport() input from an untrusted request
 * body and the authenticated session. Reporter identity is taken ONLY from the
 * session — never from the client. Diagnostics-derived columns (route, code
 * ownership, build) are read from the (re-sanitised) diagnostics blob.
 *
 * @param {{ body?: object, session?: object }} args
 * @returns {{ ok: true, input: object } | { ok: false, error: string }}
 */
export function buildReportInsert({ body = {}, session = {} } = {}) {
  const description = String(body?.description || "").trim();
  if (!description) {
    return { ok: false, error: "Please describe what happened." };
  }

  const category = SUPPORT_CATEGORY_VALUES.has(body?.category)
    ? body.category
    : DEFAULT_SUPPORT_CATEGORY;

  const title = body?.title ? String(body.title).trim().slice(0, MAX_TITLE) : null;

  // Screenshot ATTACHMENT METADATA (order + user annotation). The actual image
  // paths are added to the columns after upload; here we capture the per-image
  // annotation aligned by order, merged into the diagnostics blob so it is
  // scrubbed in the same pass and counted against the size cap. (Storage paths
  // are NOT known yet — the admin viewer pairs screenshot_paths[order] with
  // attachments[order].)
  const attachments = screenshotEntries(body?.screenshots)
    .map((entry, order) => ({ order, annotation: screenshotAnnotation(entry) }))
    .filter((a) => a.annotation);

  // Defence in depth: re-scrub the client-supplied diagnostics at the route
  // boundary and enforce the size cap before anything else looks at it.
  const rawDiagnostics =
    body?.diagnostics && typeof body.diagnostics === "object" ? { ...body.diagnostics } : {};
  if (attachments.length) rawDiagnostics.attachments = attachments;
  const diagnostics = sanitiseDiagnostics(rawDiagnostics);
  if (!isWithinSizeCap(diagnostics)) {
    return { ok: false, error: "Diagnostics payload exceeds the size limit." };
  }

  // Pull durable + snapshot columns out of the sanitised diagnostics blob so we
  // never trust separate top-level fields from the client for these.
  const route =
    diagnostics?.route?.asPath ? String(diagnostics.route.asPath).slice(0, 500) : null;
  const ownership = diagnostics?.code_ownership || {};
  const build = diagnostics?.build || {};

  // Identity comes from the session, not the client payload.
  const sessionUser = session?.user || {};
  const reporterUserId = toInt(sessionUser.id);
  const reporterRoles = normalizeRoles(
    Array.isArray(sessionUser.roles) ? sessionUser.roles : []
  );
  const reporterUsername = sessionUser.name
    ? String(sessionUser.name).slice(0, 200)
    : sessionUser.email
    ? String(sessionUser.email).slice(0, 200)
    : null;

  return {
    ok: true,
    input: {
      title,
      description: description.slice(0, MAX_DESCRIPTION),
      category,
      reporterUserId,
      reporterUsername,
      reporterRoles: reporterRoles.length ? reporterRoles : null,
      route,
      sectionKey: ownership.section_key ? String(ownership.section_key).slice(0, 300) : null,
      sourceFile: ownership.file ? String(ownership.file).slice(0, 500) : null,
      sourceLine: Number.isInteger(ownership.line) ? ownership.line : null,
      appVersion: build.version ? String(build.version).slice(0, 50) : null,
      commitSha: build.commit_sha ? String(build.commit_sha).slice(0, 80) : null,
      commitRef: build.commit_ref ? String(build.commit_ref).slice(0, 200) : null,
      buildId: build.build_id ? String(build.build_id).slice(0, 200) : null,
      diagnostics,
    },
  };
}

/**
 * Decode the user-previewed screenshot (a base64 image data URL) into an upload
 * buffer. Returns ok:true with file:null when no screenshot was attached.
 * Rejects unsupported formats, empty payloads, and anything over the size cap.
 *
 * @param {string|null|undefined} dataUrl
 * @returns {{ ok: true, file: { buffer: Buffer, mimeType: string }|null } | { ok: false, error: string }}
 */
export function decodeScreenshot(dataUrl) {
  if (dataUrl == null || dataUrl === "") return { ok: true, file: null };
  if (typeof dataUrl !== "string") {
    return { ok: false, error: "Unsupported screenshot format." };
  }

  const match = SCREENSHOT_DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    return { ok: false, error: "Unsupported screenshot format." };
  }

  const mimeType = match[1];
  const base64 = match[2].replace(/\s+/g, "");
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Could not read the screenshot." };
  }

  if (!buffer.length) return { ok: false, error: "The screenshot was empty." };
  if (buffer.length > SCREENSHOT_MAX_BYTES) {
    return { ok: false, error: "The screenshot is too large (5 MB max)." };
  }

  return { ok: true, file: { buffer, mimeType } };
}

/**
 * Decode a list of user-previewed screenshot data URLs into upload buffers.
 * Accepts the new `screenshots` array (preferred) and tolerates a legacy single
 * `screenshot` value. Returns ok:true with files:[] when none were attached.
 * Any malformed / oversized / non-image entry fails the whole batch with a clean
 * error (so the route never produces a half-attached report). Caps the count.
 *
 * @param {string[]|string|null|undefined} input
 * @returns {{ ok: true, files: { buffer: Buffer, mimeType: string }[] } | { ok: false, error: string }}
 */
export function decodeScreenshots(input) {
  const list = screenshotEntries(input);
  if (list.length === 0) return { ok: true, files: [] };
  if (list.length > MAX_SCREENSHOTS) {
    return { ok: false, error: `Too many screenshots (max ${MAX_SCREENSHOTS}).` };
  }

  const files = [];
  for (const entry of list) {
    const decoded = decodeScreenshot(screenshotSrc(entry));
    if (!decoded.ok) return { ok: false, error: decoded.error };
    if (decoded.file) files.push(decoded.file);
  }
  return { ok: true, files };
}
