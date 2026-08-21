// file location: src/pages/api/shell/bootstrap.js
//
// One request for everything the authenticated shell needs before it is usable.
//
// The boot sequence used to fan out from the browser after hydration:
//
//   /api/auth/session          (NextAuth — still separate, it owns the cookie)
//   /api/profile/sidebar-access   gates the sidebar
//   /api/users/roster             gates roster-derived chrome
//   /api/profile/clock            gates the clock button
//   /api/messages/unread-count    gates the message badge
//
// Four of those are independent of each other, but each was a separate browser
// round trip to a separate function instance — so the shell paid four sets of
// latency (and, before the region pin, four transatlantic hops) in sequence with
// hydration. This route resolves them together, in parallel, inside one function
// that sits next to the database.
//
// Design rules:
//   * PURELY ADDITIVE. Every existing endpoint still works and is still the
//     refresh path. This only seeds initial state, so if it fails or is slow the
//     providers fall back to exactly what they did before.
//   * Never fails as a whole. Each section resolves independently; a section
//     that errors comes back null and its provider fetches for itself.
//   * Returns only what the shell renders before first interaction.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { getUserSidebarAccessById } from "@/lib/database/users";
import { buildRosterPayload } from "@/lib/users/rosterPayload";
import { getUnreadThreadCountForUser } from "@/lib/database/messages";
import { createServerTimer } from "@/lib/perf/serverTiming";

// Resolve a section without letting it fail the whole response.
const settle = async (timer, label, fn) => {
  try {
    return await timer.db(label, fn);
  } catch (error) {
    console.warn(`[shell/bootstrap] ${label} failed:`, error?.message || error);
    return null;
  }
};

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const timer = createServerTimer();

  let userId = null;
  try {
    userId = await timer.db("resolveUser", () => resolveSessionUserId(session));
  } catch {
    // Synthetic sessions (dev platform, presentation) have no users row. The
    // shell handles a null id already — role-derived navigation is the default.
    userId = null;
  }

  const numericUserId = Number.isInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;

  const [sidebarAccess, roster, unreadCount] = await Promise.all([
    numericUserId
      ? settle(timer, "sidebarAccess", () => getUserSidebarAccessById(numericUserId))
      : Promise.resolve(null),
    settle(timer, "roster", () => buildRosterPayload()),
    numericUserId
      ? settle(timer, "unreadCount", () => getUnreadThreadCountForUser(numericUserId))
      : Promise.resolve(null),
  ]);

  // Per-user and session-bound: never store it anywhere shared.
  res.setHeader("Cache-Control", "private, no-store");
  timer.applyTo(res);

  return res.status(200).json({
    success: true,
    data: {
      userId: numericUserId,
      sidebarAccess: sidebarAccess ?? null,
      roster: roster ?? null,
      unreadCount: typeof unreadCount === "number" ? unreadCount : null,
    },
  });
}

export default withRoleGuard(handler);
