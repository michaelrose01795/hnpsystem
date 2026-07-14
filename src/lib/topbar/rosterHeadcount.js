// file location: src/lib/topbar/rosterHeadcount.js
//
// Derives per-department headcounts from the already-loaded staff roster
// (RosterContext `usersByRole`). These are real, free, client-side signals that
// complement the endpoint metrics — e.g. MOT / valeting have no cheap count
// query, so their "on shift" number comes from the roster.
//
// PURE — takes the usersByRole map, returns a flat metrics object. Roster keys
// match the canonical role display names in src/config/users.js roleCategories.

const HEADCOUNT_SOURCES = {
  techsOnShift: ["Techs", "Mobile Technician"],
  motTesters: ["MOT Tester"],
  valeters: ["Valet Service"],
  partsStaff: ["Parts", "Parts Driver"],
  serviceAdvisors: ["Service"],
};

function sumRoles(usersByRole, keys) {
  if (!usersByRole) return 0;
  return keys.reduce((total, key) => {
    const list = usersByRole[key];
    return total + (Array.isArray(list) ? list.length : 0);
  }, 0);
}

export function buildRosterMetrics(usersByRole) {
  return Object.entries(HEADCOUNT_SOURCES).reduce((acc, [metric, keys]) => {
    acc[metric] = sumRoles(usersByRole, keys);
    return acc;
  }, {});
}
