// file location: src/lib/dev-platform/developerDirectory.js
//
// Phase 9 — Developer Platform assignment directory. PURE, node-testable. The
// `dev` platform role is synthetic (no users FK — see Help & Diagnostics §Known
// limitations), so there is no staff directory to page. Instead the searchable
// developer picker is built from the identities we ALREADY hold on the reports:
// every distinct assignee and reporter (id + username). This gives assignment a
// real, searchable list of people who have touched the queue, with counts, and
// without widening any data surface.
//
// No React, no I/O, no window.

const arr = (v) => (Array.isArray(v) ? v : []);
const intOrNull = (v) => (Number.isInteger(v) ? v : Number.isInteger(Number(v)) ? Number(v) : null);

/**
 * Build a de-duplicated developer directory from report rows.
 * @param {object[]} reports  light rows carrying reporter/assignee identity
 * @param {{ currentUser?: { id?: number, username?: string } }} [opts]
 * @returns {Array<{ id: number|null, username: string, assignedCount: number, reportedCount: number, isCurrent: boolean }>}
 */
export function buildDeveloperDirectory(reports = [], { currentUser } = {}) {
  const byId = new Map();
  const byName = new Map();

  const upsert = ({ id, username }, field) => {
    const cleanId = intOrNull(id);
    const cleanName = username ? String(username).trim() : null;
    if (cleanId == null && !cleanName) return;
    // Key on id when present, else on the username, so the same person merges.
    const key = cleanId != null ? `id:${cleanId}` : `name:${cleanName.toLowerCase()}`;
    const store = cleanId != null ? byId : byName;
    if (!store.has(key)) {
      store.set(key, { id: cleanId, username: cleanName || (cleanId != null ? `User #${cleanId}` : "Unknown"), assignedCount: 0, reportedCount: 0 });
    }
    const entry = store.get(key);
    if (cleanName && (!entry.username || entry.username.startsWith("User #"))) entry.username = cleanName;
    entry[field] += 1;
  };

  for (const r of arr(reports)) {
    if (r.assigned_to != null) upsert({ id: r.assigned_to, username: null }, "assignedCount");
    if (r.reporter_user_id != null || r.reporter_username) {
      upsert({ id: r.reporter_user_id, username: r.reporter_username }, "reportedCount");
    }
  }

  const curId = intOrNull(currentUser?.id);
  const curName = currentUser?.username ? String(currentUser.username).trim().toLowerCase() : null;

  return [...byId.values(), ...byName.values()]
    .map((e) => ({
      ...e,
      isCurrent:
        (curId != null && e.id === curId) ||
        (curName != null && e.username.toLowerCase() === curName),
    }))
    .sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        b.assignedCount - a.assignedCount ||
        b.reportedCount - a.reportedCount ||
        a.username.localeCompare(b.username)
    );
}

/**
 * Filter the directory by a free-text query (username or #id).
 * @param {object[]} directory
 * @param {string} q
 * @returns {object[]}
 */
export function searchDirectory(directory = [], q = "") {
  const term = String(q || "").trim().toLowerCase();
  if (!term) return arr(directory);
  return arr(directory).filter(
    (e) => e.username.toLowerCase().includes(term) || (e.id != null && `#${e.id}`.includes(term)) || (e.id != null && String(e.id).includes(term))
  );
}
