// file location: src/lib/auth/rolePrecedence.js
//
// Centralised, reusable "primary role" selection for users who hold more than
// one role. The staff top bar (and any other identity surface) must show ONE
// role, so we need a single, well-ordered precedence rather than "pick the first
// role in the array" — which is order-dependent and gives a Workshop Manager who
// also holds "Techs" the wrong, junior label.
//
// PURE DATA + PURE FUNCTIONS ONLY. No React, no Supabase — safe to import from
// client components, hooks, and (if ever needed) the edge chain.
//
// HOW TO ADD / RE-RANK A ROLE: edit ROLE_PRECEDENCE below. Everything that shows
// a primary role (top bar today, future profile/menus) picks the change up with
// no further edits. Roles not present in the list fall to the bottom and are
// resolved in their original array order, so an unknown role never crashes the
// identity line.

// Most significant → least significant. Leadership first, then department
// managers/controllers, then senior operational roles, then operational, then
// support/ancillary. Strings are the lowercase canonical role ids used across
// the app (see src/config/users.js roleCategories + src/lib/auth/roles.js).
export const ROLE_PRECEDENCE = [
  // Executive / leadership
  "owner",
  "general manager",
  "admin manager",
  "sales director",
  "buying director",
  "after sales director",
  "after sales manager",
  "aftersales manager",
  // Department managers / leads
  "hr manager",
  "accounts manager",
  "service manager",
  "workshop manager",
  "workshop controller",
  "parts manager",
  "manager",
  // Senior operational
  "mot tester",
  "techs",
  "mobile technician",
  // Operational
  "service",
  "parts",
  "parts driver",
  "valet service",
  "valet sales",
  "painters",
  "accounts",
  "sales",
  "second hand buying",
  "vehicle processor & photographer",
  // Support / ancillary
  "receptionist",
  "admin",
  "contractors",
  // Developer platform (only ever present in the dev login)
  "dev",
];

// Precomputed rank lookup so getPrimaryRole is O(n) over the user's roles rather
// than O(n·m) over the precedence list.
const ROLE_RANK = ROLE_PRECEDENCE.reduce((acc, role, index) => {
  acc[role] = index;
  return acc;
}, {});

// Roles whose display label contains an acronym that must stay upper-cased
// ("mot tester" → "MOT Tester", not "Mot Tester").
const ACRONYM_WORDS = new Set(["mot", "hr"]);

function normalise(role) {
  return role == null ? "" : String(role).toLowerCase().trim();
}

// Title-case a raw role string for display, preserving known acronyms.
// "service manager" → "Service Manager"; "mot tester" → "MOT Tester".
export function formatRoleLabel(role) {
  const value = normalise(role);
  if (!value) return "";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      ACRONYM_WORDS.has(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

// Pick the single most significant role from a user's role set. Returns the
// lowercase canonical role id, or null when no roles are supplied. Roles not in
// ROLE_PRECEDENCE are ranked after every known role and, among themselves, keep
// their original order (so the result is deterministic, never a crash).
export function getPrimaryRole(roles = []) {
  const list = (Array.isArray(roles) ? roles : [])
    .map(normalise)
    .filter(Boolean);
  if (list.length === 0) return null;

  let best = list[0];
  let bestRank = ROLE_RANK[best] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i < list.length; i += 1) {
    const rank = ROLE_RANK[list[i]] ?? Number.POSITIVE_INFINITY;
    if (rank < bestRank) {
      best = list[i];
      bestRank = rank;
    }
  }
  return best;
}

// Convenience: the display label for the user's primary role.
export function getPrimaryRoleLabel(roles = []) {
  return formatRoleLabel(getPrimaryRole(roles));
}
