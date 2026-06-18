// file location: src/lib/reporting/envelope.js
//
// The standard reporting API envelope (Phase-1 §9.4). EVERY /api/reports/*
// endpoint returns this exact shape so clients can treat all reporting responses
// uniformly (data + meta + scope + warnings).
//
//   { data, meta:{ asOf, source, formulaVersion, rangeApplied, generatedAt },
//     scope:{ level, departments }, warnings:[...] }

export function buildEnvelope({
  data = null,
  provenance = null,
  scope = null,
  rangeApplied = null,
  warnings = [],
} = {}) {
  const prov = provenance || {};
  const mergedWarnings = [...(Array.isArray(warnings) ? warnings : []), ...(prov.warnings || [])];
  return {
    success: true,
    data,
    meta: {
      asOf: prov.asOf || new Date().toISOString(),
      source: prov.source || "none",
      formulaVersion: prov.formulaVersion || "v1",
      live: Boolean(prov.live),
      rangeApplied: rangeApplied || null,
      generatedAt: new Date().toISOString(),
    },
    scope: scope
      ? {
          level: scope.level || "self",
          departments: scope.departments || [],
        }
      : null,
    warnings: Array.from(new Set(mergedWarnings)).filter(Boolean),
  };
}

// Standard error envelope (keeps the { success:false, message } convention used
// across the existing API routes, while still carrying the reporting shape).
export function buildErrorEnvelope(message, { warnings = [] } = {}) {
  return {
    success: false,
    message: message || "Reporting error",
    data: null,
    meta: { generatedAt: new Date().toISOString() },
    scope: null,
    warnings,
  };
}

export default buildEnvelope;
