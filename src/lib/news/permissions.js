// file location: src/lib/news/permissions.js
//
// Role-based permissions for the communication hub. Pure functions over the
// role list, so the same rules run in the browser (to decide what to render)
// and in every API route (to decide what to allow). The server is the
// authority — the client checks are only there to avoid showing dead controls.
//
// Roles are never hard-coded here as free strings: they come from
// src/lib/auth/roles.js, per CLAUDE.md section 6.

import {
  AUDIT_ADMIN_ROLES,
  HR_CORE_ROLES,
  MANAGER_SCOPED_ROLES,
  hasAllAccessRole,
  hasAnyRole,
  normalizeRoles,
} from "@/lib/auth/roles";

// Anyone whose role reads as a manager or director runs the feed for their
// area. The regex catches the long tail of "<Department> Manager" /
// "<Area> Director" roles in src/config/users.js without listing each one.
const MANAGERIAL_PATTERN = /(manager|director)/i;

const isManagerial = (roles = []) =>
  roles.some((role) => MANAGERIAL_PATTERN.test(String(role || "")));

/**
 * Can publish, edit and delete their own announcements, pin posts, and target
 * departments. This is the same test the pre-hub feed used for "Add Update",
 * so nobody who could post before loses the ability.
 */
export function canPublishNews(userRoles = []) {
  const roles = normalizeRoles(userRoles);
  if (hasAllAccessRole(roles)) return true;
  if (hasAnyRole(roles, MANAGER_SCOPED_ROLES)) return true;
  if (hasAnyRole(roles, HR_CORE_ROLES)) return true;
  return isManagerial(roles);
}

/**
 * Can see the acknowledgement tracker and per-post analytics — i.e. who has
 * read and signed off a post. Same population as publishers: a manager who can
 * require an acknowledgement must be able to chase it.
 */
export function canTrackAcknowledgements(userRoles = []) {
  return canPublishNews(userRoles);
}

/**
 * Can see hub-wide analytics (reach, read rates, engagement across all posts).
 * Narrower than the publisher set: management, HR core and audit admins.
 */
export function canViewNewsAnalytics(userRoles = []) {
  const roles = normalizeRoles(userRoles);
  if (hasAllAccessRole(roles)) return true;
  if (hasAnyRole(roles, HR_CORE_ROLES)) return true;
  if (hasAnyRole(roles, AUDIT_ADMIN_ROLES)) return true;
  return isManagerial(roles);
}

/**
 * Can pin a post to the top of the feed for everyone.
 */
export function canPinNews(userRoles = []) {
  return canPublishNews(userRoles);
}

/**
 * Can edit or delete somebody else's post. Deliberately narrower than
 * canPublishNews: a department manager owns their own posts, but only HR core
 * / all-access can rewrite another manager's announcement.
 */
export function canModerateNews(userRoles = []) {
  const roles = normalizeRoles(userRoles);
  if (hasAllAccessRole(roles)) return true;
  return hasAnyRole(roles, HR_CORE_ROLES);
}

/**
 * Per-post edit rights: the author always keeps them; moderators have them
 * everywhere. System-generated posts are never editable by hand — they are
 * rewritten by the job that owns them.
 */
export function canEditPost(post, { userRoles = [], userId = null } = {}) {
  if (!post) return false;
  if (post.source === "system") return false;
  if (canModerateNews(userRoles)) return true;
  if (!userId || post.createdBy == null) return false;
  return String(post.createdBy) === String(userId);
}

/**
 * Per-post delete rights. Same shape as edit, but a system post CAN be removed
 * by a moderator (an alert that fired wrongly should be clearable).
 */
export function canDeletePost(post, { userRoles = [], userId = null } = {}) {
  if (!post) return false;
  if (canModerateNews(userRoles)) return true;
  if (post.source === "system") return false;
  if (!userId || post.createdBy == null) return false;
  return String(post.createdBy) === String(userId);
}

/**
 * Everyone signed in can comment, react, save and acknowledge. Kept as a named
 * function so a future policy change has one place to land.
 */
export function canEngageWithNews(userRoles = []) {
  return normalizeRoles(userRoles).length > 0;
}

/**
 * The full capability set for a viewer, in one object — what the page hands
 * down to the UI so no component re-derives permissions of its own.
 */
export function getNewsCapabilities(userRoles = []) {
  return {
    canPublish: canPublishNews(userRoles),
    canPin: canPinNews(userRoles),
    canModerate: canModerateNews(userRoles),
    canTrackAcknowledgements: canTrackAcknowledgements(userRoles),
    canViewAnalytics: canViewNewsAnalytics(userRoles),
    canEngage: canEngageWithNews(userRoles),
  };
}
