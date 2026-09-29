// file location: src/lib/support/reportDetails.js
//
// The ONE place that turns a stored support report (row + sanitised diagnostics
// blob + any automatically-captured error events linked to it) into the plain
// set of facts a human reads: what the user wrote, the page and action, the
// exact time with timezone, device / OS / browser, a plain-language error
// summary, the reference code, and — only when a real error exists — the full
// technical detail.
//
// It is consumed by BOTH the notification email (server) and the Support Centre
// report view (client), so the two can never disagree about a report.
//
// Rules:
//   • PURE — no I/O, no window/document. Runs identically in Node and the browser.
//   • Never invent a value. A fact that was not captured is returned with
//     `value: null` and a short `missing` reason, and every renderer shows
//     "Not available (reason)" instead of a guess.
//   • Defence in depth: every string that leaves this module is re-run through
//     the shared sanitiser, even though the inputs were scrubbed at capture and
//     again on ingest.

import { sanitiseValue, scrubString } from "@/lib/support/sanitise";

// Staff are UK-based, so the canonical report time is UK time, labelled with its
// zone (GMT/BST) and UTC offset so it is never ambiguous.
export const REPORT_TIMEZONE = "Europe/London";

export const NOT_AVAILABLE = "Not available";

// Reference codes: "ERR-…" is minted by the error experience (toast, recovery
// screen); "SUP-…" is minted on ingest for reports that had no error code.
const REFERENCE_CODE_RE = /^[A-Z]{3}-[A-Z0-9]{4,16}$/;

const MAX_STACK_LINES = 60;

const arr = (value) => (Array.isArray(value) ? value : []);
const str = (value) => (value == null ? "" : String(value).trim());
const obj = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

/** A fact that exists. */
const known = (value) => ({ value: String(value), missing: null });
/** A fact that was not captured, with the honest reason why. */
const unknown = (reason) => ({ value: null, missing: reason });
/** Pick `known` when the value is non-empty, else `unknown(reason)`. */
const fact = (value, reason) => (str(value) ? known(str(value)) : unknown(reason));

/**
 * Render a fact as display text: the value, or "Not available (reason)".
 * @param {{ value: string|null, missing: string|null }} f
 * @returns {string}
 */
export function factText(f) {
  if (f && f.value) return f.value;
  return f?.missing ? `${NOT_AVAILABLE} (${f.missing})` : NOT_AVAILABLE;
}

// ---------------------------------------------------------------------------
// Reference codes
// ---------------------------------------------------------------------------

/** True for a well-formed "ERR-…" / "SUP-…" style reference code. */
export function isValidReferenceCode(value) {
  return typeof value === "string" && REFERENCE_CODE_RE.test(value.trim());
}

/**
 * Mint a short, quotable reference for a report that arrived without an error
 * code, e.g. "SUP-K3F9Q2". Same shape as the error codes so staff quote either
 * the same way. `now` / `random` are injectable for tests.
 */
export function mintSupportReferenceCode(now = Date.now(), random = Math.random) {
  const time = Number(now).toString(36).toUpperCase().slice(-4);
  const tail = Math.floor(random() * 36 * 36)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `SUP-${time}${tail}`;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

function zoneParts(date, timeZone) {
  const parts = {};
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .forEach((p) => {
        if (p.type === "timeZoneName") parts.abbr = p.value;
      });
  } catch {
    // unknown zone — handled by the caller
  }
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .forEach((p) => {
        if (p.type === "timeZoneName") parts.offset = p.value === "GMT" ? "UTC+00:00" : p.value.replace("GMT", "UTC");
      });
  } catch {
    // older runtimes without longOffset — the abbreviation still identifies it
  }
  return parts;
}

/**
 * Format an instant as an unambiguous, human-readable time in a named zone,
 * e.g. "Wed 24 Sep 2026, 14:03:22 BST (UTC+01:00, Europe/London)".
 *
 * @param {string|number|Date} value
 * @param {string} [timeZone]
 * @returns {{ value: string|null, missing: string|null, iso?: string, timeZone?: string }}
 */
export function formatReportTime(value, timeZone = REPORT_TIMEZONE) {
  if (value == null || value === "") return unknown("time was not recorded");
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return unknown("time could not be read");
  let body;
  try {
    body = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return formatReportTime(date, "UTC");
  }
  const { abbr, offset } = zoneParts(date, timeZone);
  const zoneLabel = [offset, timeZone].filter(Boolean).join(", ");
  return {
    ...known(`${body} ${abbr || ""}${zoneLabel ? ` (${zoneLabel})` : ""}`.replace(/\s+/g, " ").trim()),
    iso: date.toISOString(),
    timeZone,
  };
}

// ---------------------------------------------------------------------------
// Device / OS / browser
// ---------------------------------------------------------------------------

const WINDOWS_NT = { "10.0": "10 or 11", "6.3": "8.1", "6.2": "8", "6.1": "7" };

/**
 * Parse the operating system, browser and device model from a user-agent string,
 * refined with User-Agent Client Hints when the browser shared them. Returns only
 * what can actually be read; anything unknowable is null with a reason.
 *
 * @param {string} [ua]
 * @param {{ platform?: string, platformVersion?: string, model?: string, mobile?: boolean,
 *           brands?: {brand:string,version:string}[] }} [hints]
 * @param {{ touchPoints?: number }} [extra]
 */
export function parseUserAgent(ua = "", hints = {}, extra = {}) {
  const u = str(ua);
  const h = obj(hints);
  let os = null;
  let osVersion = null;
  let deviceModel = null;
  let modelMissing = "the browser did not share the device model";
  let deviceType = null;

  // ---- operating system + model ----
  let m;
  if ((m = u.match(/\((iPhone|iPad|iPod)[^)]*OS (\d+(?:_\d+)*)/))) {
    os = m[1] === "iPad" ? "iPadOS" : "iOS";
    osVersion = m[2].replace(/_/g, ".");
    deviceModel = m[1];
    modelMissing = null;
    deviceType = m[1] === "iPad" ? "Tablet" : "Phone";
  } else if ((m = u.match(/Android\s?([\d.]+)?(?:;\s*([^;)]+?))?(?:\s+Build\/[^;)]*)?[;)]/))) {
    os = "Android";
    osVersion = m[1] || null;
    const model = str(m[2]);
    // Chrome's reduced UA replaces the model with "K" — that is NOT a model.
    if (model && model !== "K" && !/^(Linux|U|wv|Mobile)$/i.test(model)) {
      deviceModel = model;
      modelMissing = null;
    }
    deviceType = /Mobile/.test(u) ? "Phone" : "Tablet";
  } else if ((m = u.match(/Windows NT ([\d.]+)/))) {
    os = "Windows";
    osVersion = WINDOWS_NT[m[1]] || m[1];
    deviceType = "Desktop";
    modelMissing = "desktop browsers do not share the computer model";
  } else if (/Macintosh|Mac OS X/.test(u)) {
    // iPadOS 13+ requests the desktop site and reports as a Mac; touch gives it away.
    if (Number(extra.touchPoints) > 1) {
      os = "iPadOS";
      deviceModel = "iPad";
      modelMissing = null;
      deviceType = "Tablet";
    } else {
      os = "macOS";
      deviceType = "Desktop";
      modelMissing = "desktop browsers do not share the computer model";
    }
    // Safari/Chrome freeze the macOS version at 10.15.7, so it is not reported.
  } else if (/CrOS/.test(u)) {
    os = "ChromeOS";
    deviceType = "Laptop";
  } else if (/Linux/.test(u)) {
    os = "Linux";
    deviceType = "Desktop";
  }

  // Client Hints are more precise when present (Chromium only).
  if (h.platform) {
    const platform = String(h.platform);
    if (platform === "Windows" && h.platformVersion) {
      const major = Number.parseInt(String(h.platformVersion), 10);
      os = "Windows";
      osVersion = Number.isFinite(major) ? (major >= 13 ? "11" : "10") : osVersion;
    } else if (platform === "Android" && h.platformVersion) {
      os = "Android";
      osVersion = String(h.platformVersion);
    } else if (platform === "macOS" && h.platformVersion) {
      os = "macOS";
      osVersion = String(h.platformVersion);
    } else if (!os) {
      os = platform;
    }
  }
  if (str(h.model)) {
    deviceModel = str(h.model);
    modelMissing = null;
  }
  if (typeof h.mobile === "boolean" && !deviceType) deviceType = h.mobile ? "Phone" : "Desktop";

  // ---- browser ----
  let browser = null;
  let browserVersion = null;
  const tests = [
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Edge", /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/],
    ["Opera", /(?:OPR|OPiOS)\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /(?:CriOS)\/([\d.]+)/],
    ["Chrome", /Chrome\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of tests) {
    const match = u.match(re);
    if (match) {
      browser = name;
      browserVersion = match[1];
      break;
    }
  }
  if (!browser && /AppleWebKit/.test(u) && /Mobile\//.test(u)) {
    browser = "In-app browser (WebKit)";
  }
  if (!browser) {
    const brand = arr(h.brands).find((b) => b && !/Not.?A.?Brand|Chromium/i.test(b.brand || ""));
    if (brand) {
      browser = brand.brand;
      browserVersion = brand.version || null;
    }
  }

  return {
    os: os ? fact(osVersion ? `${os} ${osVersion}` : os, "") : unknown(u ? "could not be identified from the browser" : "the browser was not recorded"),
    browser: browser
      ? known(browserVersion ? `${browser} ${browserVersion.split(".")[0]}` : browser)
      : unknown(u ? "could not be identified" : "the browser was not recorded"),
    deviceModel: deviceModel ? known(deviceModel) : unknown(u ? modelMissing : "the device was not recorded"),
    deviceType: deviceType ? known(deviceType) : unknown("not recorded"),
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

// Clicks that open the report itself are not "what the user was doing".
const REPORT_LAUNCH_LABEL = /report (a|this) problem|send report|help & support/i;

const ORIGIN_PHRASES = {
  "error-toast": "Reported from an error notification",
  "error-boundary": "Reported from the recovery screen after part of the page stopped working",
  "page-error": "Reported from an error page",
  "support-modal": "Reported using the “Report a problem” button",
};

/**
 * Describe what the user was doing: how the report was opened and the last
 * meaningful action (click or navigation) captured before it.
 * @param {object} diagnostics
 * @returns {{ value: string|null, missing: string|null, origin: string }}
 */
export function describeReportAction(diagnostics = {}) {
  const d = obj(diagnostics);
  const origin = str(d.trigger?.origin) || "support-modal";
  const actions = arr(d.recent_actions);
  let last = null;
  for (let i = actions.length - 1; i >= 0; i -= 1) {
    const a = obj(actions[i]);
    if (/^boundary_/.test(a.type || "")) continue;
    if (a.type === "click" && REPORT_LAUNCH_LABEL.test(str(a.label))) continue;
    if (a.type === "click" && !str(a.label)) continue;
    last = a;
    break;
  }
  let lastText = null;
  if (last?.type === "route_change") {
    lastText = `Navigated from ${str(last.from) || "?"} to ${str(last.to) || "?"}`;
  } else if (last?.type === "render_error") {
    lastText = "The screen stopped working while it was being displayed";
  } else if (last) {
    const label = str(last.label).replace(/\s+/g, " ").slice(0, 120);
    lastText = label ? `Clicked “${label}”` : null;
  }
  const how = ORIGIN_PHRASES[origin] || ORIGIN_PHRASES["support-modal"];
  return {
    ...(lastText ? known(`${lastText}. ${how}.`) : known(`${how}. No earlier action was recorded on this page.`)),
    lastAction: lastText,
    origin,
  };
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

// The toast's devInfo is a fixed-format block (buildErrorAlert). Read the
// technical fields back out of it so they can be shown as structured facts.
function parseDevInfo(devInfo) {
  const text = str(devInfo);
  if (!text) return {};
  const line = (label) => {
    const m = text.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : null;
  };
  const stackIndex = text.indexOf("Stack Trace:");
  const context = {};
  const ctxMatch = text.match(/\nContext:\n([\s\S]*?)(?:\n\n|\nStack Trace:|$)/);
  if (ctxMatch) {
    for (const row of ctxMatch[1].split("\n")) {
      const kv = row.match(/^\s+([^:]+):\s*(.*)$/);
      if (kv) context[kv[1].trim()] = kv[2].trim();
    }
  }
  return {
    message: line("Technical Error"),
    name: line("Error Type"),
    userMessage: line("User Message"),
    stack: stackIndex >= 0 ? text.slice(stackIndex + "Stack Trace:".length).trim() : null,
    context,
  };
}

const capStack = (stack) => {
  const s = str(stack);
  if (!s) return null;
  const lines = s.split("\n");
  return lines.length > MAX_STACK_LINES
    ? `${lines.slice(0, MAX_STACK_LINES).join("\n")}\n… (${lines.length - MAX_STACK_LINES} more lines)`
    : s;
};

const statusFromText = (text) => {
  const m = str(text).match(/\b(?:status|HTTP)\s*:?\s*([1-5]\d\d)\b/i);
  return m ? Number(m[1]) : null;
};

/**
 * Work out the error this report is about, if any. Priority:
 *   1. the error the user launched the report FROM (toast / recovery screen),
 *   2. automatically-captured error events linked by reference code,
 *   3. an error recorded in the session shortly before the report (flagged as
 *      "possibly related" — it was not the thing the user clicked).
 * Returns null when no actual error exists, so renderers show no technical block.
 *
 * @param {object} diagnostics
 * @param {object[]} [errorEvents] support_error_events rows linked to the report
 */
export function resolveReportError(diagnostics = {}, errorEvents = []) {
  const d = obj(diagnostics);
  const trigger = obj(d.trigger);
  const events = arr(errorEvents).filter(Boolean);
  const event = events[0] ? obj(events[0]) : null;
  const fromTrigger = Boolean(trigger.origin && trigger.origin !== "support-modal" && (trigger.devInfo || trigger.message || trigger.errorMessage));

  if (!fromTrigger && !event) {
    const recent = arr(d.unhandled_errors).slice(-1)[0];
    const failed = arr(d.failed_requests).filter((r) => r && (r.status === 0 || r.status >= 500)).slice(-1)[0];
    if (!recent && !failed) return null;
    if (recent) {
      return {
        certainty: "possible",
        source: "Recorded in the session before the report",
        kind: "runtime",
        name: null,
        code: null,
        statusCode: null,
        message: str(recent.message) || null,
        stack: capStack(recent.stack),
        componentStack: capStack(recent.componentStack),
        endpoint: null,
        devInfo: null,
        occurrences: arr(d.unhandled_errors).length,
        userMessage: null,
      };
    }
    return {
      certainty: "possible",
      source: "Failed request recorded before the report",
      kind: "api",
      name: null,
      code: null,
      statusCode: Number.isFinite(failed.status) ? failed.status : null,
      message: `${str(failed.method) || "GET"} ${str(failed.url)} → ${failed.status === 0 ? "network error" : `HTTP ${failed.status}`}`,
      stack: null,
      componentStack: null,
      endpoint: str(failed.url) || null,
      devInfo: null,
      occurrences: arr(d.failed_requests).length,
      userMessage: null,
    };
  }

  const parsed = parseDevInfo(trigger.devInfo);
  const ctx = { ...obj(event?.context), ...parsed.context };
  const originKind = {
    "error-boundary": "render",
    "page-error": "page",
    "error-toast": "api",
  }[trigger.origin];
  const statusCode =
    (Number.isInteger(trigger.statusCode) && trigger.statusCode) ||
    (Number.isInteger(event?.status_code) && event.status_code) ||
    statusFromText(parsed.message) ||
    statusFromText(trigger.devInfo) ||
    null;

  return {
    certainty: "confirmed",
    source: {
      "error-toast": "Error notification the user reported from",
      "error-boundary": "Screen crash the user reported from",
      "page-error": "Error page the user reported from",
    }[trigger.origin] || "Error captured automatically for this reference",
    kind: str(event?.kind) || originKind || "runtime",
    name: str(trigger.errorName) || parsed.name || null,
    code: str(trigger.errorCode) || str(ctx.code) || str(ctx.errorCode) || null,
    statusCode,
    message: str(trigger.errorMessage) || parsed.message || str(event?.message) || null,
    stack: capStack(trigger.stack || parsed.stack || event?.stack),
    componentStack: capStack(trigger.componentStack || event?.component_stack),
    endpoint: str(ctx.endpoint || ctx.url) || null,
    component: str(trigger.component || event?.component) || null,
    devInfo: str(trigger.devInfo) || null,
    occurrences: events.reduce((n, e) => n + (Number(e?.occurrences) || 1), 0) || null,
    userMessage: str(trigger.message) || parsed.userMessage || null,
    context: Object.keys(ctx).length ? ctx : null,
  };
}

/**
 * One short, plain-English sentence about what went wrong — for people, not
 * developers. Never includes a stack or code.
 * @param {ReturnType<typeof resolveReportError>} error
 */
export function describeErrorPlainly(error) {
  if (!error) {
    return "No technical error was recorded. The user described the problem in their own words.";
  }
  const status = error.statusCode;
  const lead = error.certainty === "possible" ? "No error was shown to the user, but " : "";
  const said = error.userMessage
    ? ` The user was shown: “${String(error.userMessage).replace(/[.!?]+$/, "")}”.`
    : "";
  // A real HTTP status is trusted over message text; the message is only read
  // for the browser's own network-failure wording (Chrome / Firefox / Safari).
  const networkText = /\b(failed to fetch|networkerror|network error)\b|^load failed$/i.test(String(error.message || "").trim());
  let what;
  if (error.kind === "render") what = "part of the screen stopped working while it was being displayed";
  else if (status === 0 || (!status && networkText)) what = "the app could not reach the server (network or connection problem)";
  else if (status === 401) what = "the user's sign-in had expired or was not recognised";
  else if (status === 403 || error.kind === "permission") what = "the user was not allowed to do this (permission denied)";
  else if (status === 404) what = error.kind === "page" ? "the page could not be found" : "something the app asked for could not be found";
  else if (status === 409) what = "the change clashed with someone else's change";
  else if (status === 413) what = "the upload or request was too large";
  else if (status === 429) what = "too many requests were sent in a short time";
  else if (status && status >= 500) what = "the server hit an error while handling the request";
  else if (status && status >= 400) what = "the server rejected the request";
  else if (error.kind === "data_load") what = "data for the page failed to load";
  else if (error.kind === "page") what = "the page failed to load";
  else what = "an unexpected error happened in the app";
  const statusNote = status ? ` (HTTP ${status})` : "";
  const sentence = `${lead}${what}${statusNote}.`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}${said}`;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build every human-facing fact for a report.
 *
 * @param {object} args
 * @param {object} args.report       Report row (snake_case) or submit input (camelCase),
 *                                   including `diagnostics` when available.
 * @param {object[]} [args.errorEvents] Linked support_error_events rows.
 * @returns {object} sanitised facts (see renderers in supportReportEmail.js and
 *   SupportReportDetail.js)
 */
export function buildReportFacts({ report = {}, errorEvents = [] } = {}) {
  const r = obj(report);
  const d = obj(r.diagnostics);
  const ctx = obj(d.report_context);
  const device = obj(d.device);
  const route = obj(d.route);
  const trigger = obj(d.trigger);

  // Reference code: stamped on ingest; older reports fall back to the trigger
  // or the linked error events.
  const refCandidate =
    str(r.referenceCode) ||
    str(ctx.reference_code) ||
    str(trigger.referenceCode) ||
    str(arr(errorEvents)[0]?.reference_code);
  const referenceCode = isValidReferenceCode(refCandidate)
    ? known(refCandidate)
    : unknown("this report was filed before reference codes were issued");

  const submittedIso = r.created_at ?? r.createdAt ?? ctx.received_at ?? null;
  const submittedAt = formatReportTime(submittedIso, REPORT_TIMEZONE);
  const userZone = str(device.timezone);
  const localTime =
    userZone && userZone !== REPORT_TIMEZONE && submittedIso
      ? formatReportTime(submittedIso, userZone)
      : null;

  const ua = str(device.ua) || str(ctx.request_user_agent);
  const parsed = parseUserAgent(ua, obj(device.ua_ch), { touchPoints: device.touch_points });
  const viewport = obj(device.viewport);
  const screenSize =
    Number(viewport.w) && Number(viewport.h)
      ? known(`${viewport.w}×${viewport.h}${device.dpr ? ` @${device.dpr}x` : ""}`)
      : unknown("not recorded");

  const error = resolveReportError(d, errorEvents);

  const page = str(r.route) || str(route.asPath);
  const facts = {
    referenceCode,
    referenceSource: str(ctx.reference_source) || (str(trigger.referenceCode) ? "error" : null),
    submittedText: str(r.description),
    page: fact(page, "the page address was not captured"),
    pageTitle: fact(route.title, "the page title was not captured"),
    pageTemplate: fact(route.pathname && route.pathname !== page ? route.pathname : "", "same as the page"),
    action: describeReportAction(d),
    submittedAt,
    userLocalTime: localTime,
    userTimezone: fact(userZone, "the browser did not report its timezone"),
    deviceModel: parsed.deviceModel,
    deviceType: parsed.deviceType,
    os: parsed.os,
    browser: parsed.browser,
    screen: screenSize,
    language: fact(device.lang || device.language, "not recorded"),
    online: typeof device.online === "boolean" ? known(device.online ? "Online" : "Offline") : unknown("not recorded"),
    userAgent: fact(ua, "the browser was not recorded"),
    errorSummary: describeErrorPlainly(error),
    error,
  };
  return sanitiseValue(facts);
}

/**
 * The technical block as plain text (email text part, copy-to-clipboard).
 * Empty string when there is no error.
 */
export function technicalErrorText(error) {
  if (!error) return "";
  const lines = [
    `Certainty:     ${error.certainty === "possible" ? "Possibly related (recorded before the report)" : "Confirmed"}`,
    `Source:        ${error.source}`,
    `Kind:          ${error.kind || NOT_AVAILABLE}`,
    `Error type:    ${error.name || NOT_AVAILABLE}`,
    `Error code:    ${error.code || NOT_AVAILABLE}`,
    `HTTP status:   ${error.statusCode ?? NOT_AVAILABLE}`,
    `Endpoint:      ${error.endpoint || NOT_AVAILABLE}`,
    `Component:     ${error.component || NOT_AVAILABLE}`,
    `Occurrences:   ${error.occurrences ?? NOT_AVAILABLE}`,
    `Message:       ${error.message || NOT_AVAILABLE}`,
  ];
  if (error.context) {
    lines.push("", "Context:");
    for (const [k, v] of Object.entries(error.context)) lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  if (error.stack) lines.push("", "Stack trace:", error.stack);
  if (error.componentStack) lines.push("", "Component stack:", error.componentStack);
  return scrubString(lines.join("\n"));
}
