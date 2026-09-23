// file location: src/lib/news/notify.js
//
// Should this reader be told about this post?
//
// Pure, and deliberately separate from the preferences data module: the feed
// hook needs this rule in the browser, and importing it from the database
// module would drag the Supabase server plumbing into the client bundle for
// the sake of one function.

/**
 * @param {object} preferences  as returned by /api/news/preferences
 * @param {object} post         a decorated feed post
 */
export function shouldNotify(preferences, post) {
  if (!preferences || !post) return false;

  // "Off" means off, for everything.
  if (preferences.digestFrequency === "off") return false;

  // Urgent overrides every other mute — that is the whole point of urgent.
  if (post.priority === "urgent") return Boolean(preferences.notifyUrgent);

  // On a daily digest, nothing interrupts during the day.
  if (preferences.digestFrequency === "daily") return false;

  if (!preferences.notifyAll) return false;
  if (post.source === "system" && !preferences.notifySystemPosts) return false;
  if ((preferences.mutedCategories || []).includes(post.category)) return false;

  const departments = Array.isArray(post.departments) ? post.departments : [];
  const muted = preferences.mutedDepartments || [];
  if (departments.length > 0 && departments.every((department) => muted.includes(department))) {
    return false;
  }

  return true;
}

export default shouldNotify;
