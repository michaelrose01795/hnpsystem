// file location: src/lib/database/realtimeClient.js
//
// Deferred access to the Supabase browser client, for realtime subscriptions.
//
// Why this exists
// ---------------
// @supabase/supabase-js is 213 KB (postgrest + realtime + GoTrue). Any module
// that imports it statically puts all of it in the first-load bundle of every
// route that reaches that module — measured against production, that was the
// single largest item on /new-job, /appointments, /nextjobs and the customer VHC
// link.
//
// A realtime subscription never needs the client in order to RENDER. It runs
// from an effect after mount, so the import can happen in parallel with paint
// instead of blocking it. StaffLayout and useMessagesBadge already did this by
// hand; this is the same move, in one place, so the pages that open channels do
// not each re-implement the teardown race.
//
// Behaviour is unchanged: the channel still subscribes as soon as its effect
// runs.

/** Resolve the shared Supabase browser client, importing it on first use. */
export const loadSupabaseClient = async () =>
  (await import("@/lib/database/supabaseClient")).default;

/**
 * Subscribe to a realtime channel with the deferred client.
 *
 * The subtlety this exists to contain: between the effect running and the
 * dynamic import resolving, React may already have torn the effect down. Without
 * a guard the subscription would be created after cleanup and never removed —
 * an orphaned channel that keeps firing into an unmounted component. `cancelled`
 * closes that window, and the cleanup removes the channel if it did get created.
 *
 * @param {(supabase: object) => object} build
 *   Receives the client, returns a SUBSCRIBED channel (call .subscribe() inside).
 * @returns {() => void} cleanup, to return directly from useEffect.
 *
 * @example
 *   useEffect(() => subscribeWithDeferredClient((supabase) =>
 *     supabase.channel("jobs").on("postgres_changes", opts, onChange).subscribe()
 *   ), [onChange]);
 */
export function subscribeWithDeferredClient(build) {
  let cancelled = false;
  let client = null;
  let channel = null;

  void (async () => {
    try {
      const supabase = await loadSupabaseClient();
      if (cancelled) return;
      client = supabase;
      channel = build(supabase);
    } catch (error) {
      // Realtime is an enhancement — the pages that use it all have their own
      // refresh path. Failing to subscribe must never break the render.
      console.warn("Realtime subscription unavailable:", error?.message || error);
    }
  })();

  return () => {
    cancelled = true;
    if (client && channel) client.removeChannel(channel);
  };
}

/**
 * Same idea for the subscribe helpers that live in the database modules
 * (subscribeToJobChanges, subscribeToJobsOverviewChanges, …). Those already
 * return their own unsubscribe function, so this defers the MODULE rather than
 * the client and hands the teardown straight back.
 *
 * Importing one of those helpers statically pulls the whole database module —
 * and therefore the Supabase client — into the page's first load, purely to open
 * a subscription that could not run until after mount anyway.
 *
 * @param {() => Promise<object>} loadModule  e.g. () => import("@/lib/database/jobs")
 * @param {(mod: object) => (() => void)} subscribe  returns the unsubscribe fn
 * @returns {() => void} cleanup, to return directly from useEffect.
 *
 * @example
 *   useEffect(() => subscribeViaDeferredModule(
 *     () => import("@/lib/database/jobs"),
 *     (m) => m.subscribeToJobsOverviewChanges("jobs-page", onChange)
 *   ), [onChange]);
 */
export function subscribeViaDeferredModule(loadModule, subscribe) {
  let cancelled = false;
  let unsubscribe = null;

  void (async () => {
    try {
      const mod = await loadModule();
      if (cancelled) return;
      const teardown = subscribe(mod);
      if (typeof teardown === "function") unsubscribe = teardown;
      // Torn down while subscribe() itself was running.
      if (cancelled && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    } catch (error) {
      console.warn("Realtime subscription unavailable:", error?.message || error);
    }
  })();

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}

export default subscribeWithDeferredClient;
