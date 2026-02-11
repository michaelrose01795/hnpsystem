// Single source of truth for building a user display name.
// Accepts either a snake_case DB row or a camelCase mapped object.
// Returns "first last" trimmed, falling back to email, then "Unknown user".
// file location: src/lib/users/displayName.js

export function getDisplayName(user) {
  if (!user) return "Unknown user";
  const first = user.first_name || user.firstName || "";
  const last = user.last_name || user.lastName || "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (user.email) return user.email;
  return "Unknown user";
}
