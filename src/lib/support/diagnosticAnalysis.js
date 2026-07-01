// file location: src/lib/support/diagnosticAnalysis.js
//
// Help & Diagnostics ("support") — the "intelligent assistant". Turns a captured
// (already-sanitised) diagnostics snapshot into a structured analysis:
//   - a unified, human-readable TIMELINE of recent activity + errors,
//   - INCIDENTS: related console errors / failed requests / render exceptions
//     grouped by time-proximity into one incident,
//   - the TRIGGER event (the first event that likely started the incident),
//   - DUPLICATE + CASCADING error detection,
//   - a PROBABLE CAUSE with a CONFIDENCE score and supporting evidence,
//   - the AFFECTED page / pathname / route / section key / component / code owner.
//
// Plus buildEnrichedDescription(), which writes a meaningful description draft
// (cause + confidence + affected + timeline) instead of a bare action list.
//
// PURE + dependency-free (reads only the sanitised snapshot — adds no new privacy
// surface) so it is fully unit-testable in node and safe to run on the server too.

import { describeAction } from "@/lib/support/actionSummary";

// Errors arriving within this window of each other are treated as one incident.
const INCIDENT_GAP_MS = 8000;

const num = (v) => (Number.isFinite(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);

// Collapse volatile bits (numbers, uuids, hex) so "the same error" groups even
// when ids/line numbers differ.
function signature(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const statusClass = (status) => {
  const s = num(status);
  if (s == null) return "err";
  if (s === 0) return "network";
  return `${Math.floor(s / 100)}xx`;
};

const reducePath = (url) => String(url || "").split("?")[0];

// ---------------------------------------------------------------------------
// Normalise every error-ish signal + action into one event stream.
// ---------------------------------------------------------------------------
function toEvents(snapshot) {
  const events = [];

  arr(snapshot?.unhandled_errors).forEach((e, i) => {
    events.push({
      kind: "error",
      severity: 3,
      ts: num(e?.ts) ?? i,
      signature: signature(e?.message),
      summary: `Error: ${e?.message || "unknown"}`,
      componentStack: e?.componentStack || null,
      raw: e,
    });
  });

  arr(snapshot?.failed_requests).forEach((r, i) => {
    const cls = statusClass(r?.status);
    events.push({
      kind: "request",
      severity: cls === "5xx" || cls === "network" ? 3 : 2,
      ts: num(r?.ts) ?? i,
      signature: signature(`${r?.method} ${reducePath(r?.url)} ${cls}`),
      summary: `${r?.method || "GET"} ${reducePath(r?.url)} → ${r?.status ?? "failed"}`,
      raw: r,
    });
  });

  arr(snapshot?.console_errors).forEach((c, i) => {
    events.push({
      kind: "console",
      severity: c?.level === "error" ? 2 : 1,
      ts: num(c?.ts) ?? i,
      signature: signature(c?.msg),
      summary: `Console ${c?.level || "log"}: ${c?.msg || ""}`.slice(0, 160),
      raw: c,
    });
  });

  return events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
}

// ---------------------------------------------------------------------------
// Duplicate detection — same signature seen more than once.
// ---------------------------------------------------------------------------
function findDuplicates(events) {
  const counts = new Map();
  for (const e of events) {
    if (!e.signature) continue;
    const prev = counts.get(e.signature) || { signature: e.signature, count: 0, summary: e.summary };
    prev.count += 1;
    counts.set(e.signature, prev);
  }
  return Array.from(counts.values())
    .filter((d) => d.count > 1)
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Incident grouping — cluster error-ish events by time proximity.
// ---------------------------------------------------------------------------
function groupIncidents(events) {
  const incidents = [];
  let current = null;
  events.forEach((event, index) => {
    if (!current || (event.ts ?? 0) - (current.lastTs ?? 0) > INCIDENT_GAP_MS) {
      current = {
        id: `incident-${incidents.length + 1}`,
        startedAt: event.ts ?? index,
        lastTs: event.ts ?? index,
        events: [],
      };
      incidents.push(current);
    }
    current.events.push(event);
    current.lastTs = event.ts ?? index;
  });

  return incidents.map((inc) => {
    const sigs = new Set(inc.events.map((e) => e.signature));
    const trigger = inc.events[0] || null;
    const cascade = inc.events.length > 1 && sigs.size > 1; // different errors followed the trigger
    const duplicateCount = inc.events.length - sigs.size; // repeats within the incident
    const maxSeverity = inc.events.reduce((m, e) => Math.max(m, e.severity), 0);
    return {
      id: inc.id,
      startedAt: inc.startedAt,
      endedAt: inc.lastTs,
      events: inc.events,
      trigger,
      cascade,
      duplicateCount,
      distinctCount: sigs.size,
      maxSeverity,
    };
  });
}

function pickPrimaryIncident(incidents) {
  if (!incidents.length) return null;
  // Most severe, then most events, then most recent.
  return [...incidents].sort(
    (a, b) =>
      b.maxSeverity - a.maxSeverity ||
      b.events.length - a.events.length ||
      (b.startedAt ?? 0) - (a.startedAt ?? 0)
  )[0];
}

// ---------------------------------------------------------------------------
// Affected location.
// ---------------------------------------------------------------------------
function topComponent(componentStack) {
  if (!componentStack || typeof componentStack !== "string") return null;
  const line = componentStack.split("\n").map((l) => l.trim()).find(Boolean);
  const match = line && line.match(/^(?:in|at)\s+([A-Za-z0-9_$.]+)/);
  return match ? match[1] : null;
}

function buildAffected(snapshot, primary) {
  const ownership = snapshot?.code_ownership || {};
  // Prefer a component name from any error in the incident (the trigger may be a
  // failed request with no component stack).
  const stackEvent = arr(primary?.events).find((e) => e?.componentStack);
  const triggerComponent = topComponent(stackEvent?.componentStack);
  return {
    page: snapshot?.route?.asPath || snapshot?.route?.pathname || null,
    pathname: snapshot?.route?.pathname || null,
    route: snapshot?.route?.asPath || null,
    sectionKey: ownership.section_key || null,
    component: triggerComponent || ownership.section_key || null,
    codeOwnership: ownership.file ? { file: ownership.file, line: num(ownership.line) } : null,
  };
}

// ---------------------------------------------------------------------------
// Probable cause + confidence.
// ---------------------------------------------------------------------------
function buildProbableCause(primary, duplicates) {
  if (!primary || !primary.trigger) {
    return {
      summary: "No clear error was captured. The description below is built from your recent activity.",
      confidence: 0.1,
      evidence: [],
    };
  }

  const trigger = primary.trigger;
  const evidence = [];
  let confidence = 0.2; // we at least have a trigger event

  if (trigger.kind === "error") {
    confidence += 0.4;
    evidence.push("An unhandled / render error was captured.");
  }
  if (trigger.kind === "request") {
    confidence += 0.3;
    evidence.push(`A failed request (${trigger.summary}) preceded the issue.`);
  }
  if (primary.events.length > 1) {
    confidence += 0.15;
    evidence.push(`${primary.events.length} related events occurred close together.`);
  }
  if (primary.cascade) {
    confidence += 0.1;
    evidence.push("Follow-on (cascading) errors were detected after the trigger.");
  }
  if (duplicates.length) {
    confidence += 0.05;
    evidence.push(`${duplicates[0].count}× repeated: ${duplicates[0].summary}`.slice(0, 160));
  }

  confidence = Math.min(0.95, Number(confidence.toFixed(2)));

  const summary =
    trigger.kind === "request"
      ? `A failed ${trigger.summary} likely triggered the problem${
          primary.cascade ? `, followed by ${primary.events.length - 1} further error(s).` : "."
        }`
      : `${trigger.summary}${
          primary.cascade ? ` — this appears to have caused ${primary.events.length - 1} follow-on error(s).` : "."
        }`;

  return { summary: summary.slice(0, 400), confidence, evidence };
}

// ---------------------------------------------------------------------------
// Human-readable timeline (actions + errors), trigger flagged.
// ---------------------------------------------------------------------------
function buildTimeline(snapshot, events, primary, limit) {
  const actionEvents = arr(snapshot?.recent_actions).map((a, i) => ({
    kind: "action",
    ts: num(a?.ts) ?? i,
    text: describeAction(a),
  }));
  const errorEvents = events.map((e) => ({ kind: e.kind, ts: e.ts, text: e.summary, signature: e.signature }));

  const triggerSig = primary?.trigger?.signature;
  const triggerTs = primary?.trigger?.ts;

  const merged = [...actionEvents, ...errorEvents]
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
    .slice(-limit)
    .map((e) => ({
      kind: e.kind,
      text: e.text,
      isTrigger:
        e.kind !== "action" && e.signature === triggerSig && (triggerTs == null || e.ts === triggerTs),
    }));

  // Ensure exactly one trigger flag survives the slice.
  let flagged = false;
  for (const item of merged) {
    if (item.isTrigger && !flagged) flagged = true;
    else item.isTrigger = false;
  }
  return merged;
}

/**
 * Analyse a sanitised diagnostics snapshot.
 * @param {object} snapshot
 * @param {{ timelineLimit?: number }} [opts]
 * @returns {object} analysis
 */
export function analyseDiagnostics(snapshot = {}, { timelineLimit = 12 } = {}) {
  const events = toEvents(snapshot);
  const duplicates = findDuplicates(events);
  const incidents = groupIncidents(events);
  const primary = pickPrimaryIncident(incidents);

  return {
    affected: buildAffected(snapshot, primary),
    probableCause: buildProbableCause(primary, duplicates),
    incidents: incidents.map((inc) => ({
      id: inc.id,
      startedAt: inc.startedAt,
      endedAt: inc.endedAt,
      eventCount: inc.events.length,
      distinctCount: inc.distinctCount,
      duplicateCount: inc.duplicateCount,
      cascade: inc.cascade,
      trigger: inc.trigger ? { kind: inc.trigger.kind, summary: inc.trigger.summary } : null,
    })),
    primaryIncidentId: primary?.id || null,
    duplicates,
    timeline: buildTimeline(snapshot, events, primary, timelineLimit),
    counts: {
      consoleErrors: arr(snapshot?.console_errors).length,
      failedRequests: arr(snapshot?.failed_requests).length,
      unhandledErrors: arr(snapshot?.unhandled_errors).length,
      actions: arr(snapshot?.recent_actions).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Enriched, human-readable description draft.
// ---------------------------------------------------------------------------
/**
 * Build a meaningful description draft from the snapshot (+ optional pre-computed
 * analysis). Replaces the bare action-history draft with cause/confidence/
 * affected context, then the timeline, then editable space for the user.
 *
 * @param {object} snapshot
 * @param {object} [analysis] result of analyseDiagnostics; computed if omitted
 * @returns {string}
 */
export function buildEnrichedDescription(snapshot, analysis) {
  const a = analysis || analyseDiagnostics(snapshot || {});
  const lines = [];
  lines.push("[Auto-filled by the diagnostic assistant — please edit or correct anything below.]");
  lines.push("");

  const conf = Math.round((a.probableCause?.confidence || 0) * 100);
  lines.push(`Probable cause (${conf}% confidence): ${a.probableCause?.summary || "unknown"}`);

  const aff = a.affected || {};
  const affBits = [];
  if (aff.page) affBits.push(`page ${aff.page}`);
  if (aff.component) affBits.push(`component ${aff.component}`);
  if (aff.sectionKey && aff.sectionKey !== aff.component) affBits.push(`section ${aff.sectionKey}`);
  if (aff.codeOwnership?.file) {
    affBits.push(`code ${aff.codeOwnership.file}${aff.codeOwnership.line ? `:${aff.codeOwnership.line}` : ""}`);
  }
  if (affBits.length) lines.push(`Affected: ${affBits.join(" · ")}`);

  const c = a.counts || {};
  const detected = [];
  const errs = (c.unhandledErrors || 0) + (c.consoleErrors || 0);
  if (errs) detected.push(`${errs} error${errs === 1 ? "" : "s"}`);
  if (c.failedRequests) detected.push(`${c.failedRequests} failed request${c.failedRequests === 1 ? "" : "s"}`);
  if (a.duplicates?.length) detected.push(`${a.duplicates.length} repeated pattern${a.duplicates.length === 1 ? "" : "s"}`);
  if (detected.length) lines.push(`Detected: ${detected.join(", ")}.`);

  lines.push("");
  if (a.timeline?.length) {
    lines.push("Timeline:");
    a.timeline.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.text}${t.isTrigger ? "   ← likely trigger" : ""}`);
    });
  } else {
    lines.push("Timeline: no recent activity was captured.");
  }

  lines.push("");
  lines.push("What went wrong / what I expected:");
  lines.push("");
  return lines.join("\n");
}
