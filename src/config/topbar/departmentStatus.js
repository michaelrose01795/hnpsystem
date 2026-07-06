// file location: src/config/topbar/departmentStatus.js
//
// THE TOP-BAR DEPARTMENT STATUS REGISTRY.
//
// Single source of truth for the short "operational status" line shown beneath
// the user's role in the staff top bar. It turns a snapshot of live signals into
// a concise, department-appropriate summary (technician availability, desk
// cover, departmental activity), and falls back to fixed contextual copy when no
// live signal is available.
//
// PURE DATA + PURE FUNCTIONS ONLY. No React, no fetching, no Supabase. The live
// signals are gathered elsewhere (src/hooks/useDepartmentStatus.js) and passed
// in; this module only decides what text to show. That keeps the top-bar
// component presentational and lets any future surface reuse the same copy.
//
// HOW TO ADD A DEPARTMENT'S LIVE SUMMARY (no top-bar edit required):
//   1. Add a fallback string to DEPARTMENT_STATUS_FALLBACKS (keyed on the
//      canonical department code from ROLE_DEPARTMENT_MAP).
//   2. Optionally add a builder to DEPARTMENT_STATUS_BUILDERS that reads the
//      `signals` object and returns a concise string (or null to fall back).
//   3. If you need a new live signal, add it to the `signals` shape produced by
//      useDepartmentStatus — the builder contract below documents what exists.
//
// signals shape (all fields optional / defensively read):
//   {
//     role,            // primary role id (lowercase) — for role-aware phrasing
//     department,      // resolved department code
//     isPresentation,  // demo shell — live signals are suppressed upstream
//     headcount: {     // real roster counts (already loaded in RosterContext)
//       techs, motTesters, valeters, parts, service
//     },
//     self: {          // the signed-in user's own live state (UserContext)
//       status, currentJobNumber
//     },
//   }

// Static, always-safe copy per department. Used when no live builder produces a
// summary (or in the presentation shell, where live data is suppressed).
export const DEPARTMENT_STATUS_FALLBACKS = {
  workshop: "Workshop floor active",
  parts: "Parts desk open",
  service: "Service reception open",
  mot: "MOT bay ready",
  valeting: "Valeting bay ready",
  paint: "Bodyshop active",
  accounts: "Accounts office open",
  admin: "Front office open",
  hr: "HR office",
  management: "Company overview",
};

export const DEFAULT_DEPARTMENT_STATUS = "On shift";

// Small pluralisation helper: count(1, "technician") → "1 technician",
// count(3, "technician") → "3 technicians". Optional custom plural for
// irregular words.
function count(n, singular, plural) {
  const value = Number(n) || 0;
  const word = value === 1 ? singular : plural || `${singular}s`;
  return `${value} ${word}`;
}

// Per-department live builders. Each receives the signals snapshot and returns a
// concise string, or null to defer to the fallback copy. Keep these cheap and
// pure — they run on every render of the chrome.
export const DEPARTMENT_STATUS_BUILDERS = {
  workshop: ({ headcount }) => {
    const techs = headcount?.techs || 0;
    // The technician's own status already shows in the right-hand tech control,
    // so the left line surfaces floor availability instead of duplicating it.
    return techs > 0 ? `${count(techs, "technician")} on the floor` : null;
  },
  mot: ({ headcount }) => {
    const testers = headcount?.motTesters || 0;
    return testers > 0 ? `${count(testers, "MOT tester")} on shift` : null;
  },
  valeting: ({ headcount }) => {
    const valeters = headcount?.valeters || 0;
    return valeters > 0 ? `${count(valeters, "valeter")} on shift` : null;
  },
  parts: ({ headcount }) => {
    const staff = headcount?.parts || 0;
    return staff > 0 ? `${count(staff, "person", "people")} on the parts desk` : null;
  },
  service: ({ headcount }) => {
    const advisors = headcount?.service || 0;
    return advisors > 0 ? `${count(advisors, "advisor")} on duty` : null;
  },
  // paint / accounts / admin / hr / management have no cheap live signal yet, so
  // they intentionally have no builder and use the fallback copy above. Add a
  // builder here when a live signal becomes available — no top-bar change needed.
};

// Resolve the status line for a department from a signals snapshot.
// Returns { text, isLive }: `isLive` is true when a builder produced the copy
// from real data, false when the static fallback was used. `isLive` is currently
// internal-only (no visual treatment, per the "no visual change" constraint) but
// is surfaced for tests and future use.
export function buildDepartmentStatus(departmentCode, signals = {}) {
  const builder = DEPARTMENT_STATUS_BUILDERS[departmentCode];
  if (builder && !signals.isPresentation) {
    try {
      const live = builder(signals);
      if (live) return { text: live, isLive: true };
    } catch {
      // Never let a status builder break the chrome — fall through to fallback.
    }
  }
  const fallback =
    (departmentCode && DEPARTMENT_STATUS_FALLBACKS[departmentCode]) ||
    DEFAULT_DEPARTMENT_STATUS;
  return { text: fallback, isLive: false };
}
