// file location: src/hooks/useVerifiedSessionStatus.js
//
// Tells "this user is signed out" apart from "we could not ask".
//
// NextAuth's useSession() collapses both into status === "unauthenticated".
// fetchData() in next-auth/react catches every network failure, logs
// CLIENT_FETCH_ERROR and resolves to null, and the provider records that as
// "unauthenticated" — indistinguishable from a real signed-out session. It then
// stops: there is no retry, and refetchOnWindowFocus cannot help because the tab
// that failed never lost focus.
//
// That single collapsed state is what breaks a restored pinned tab. The tab
// loads while the network is still coming up, /api/auth/session fails once, and
// the app concludes the user is signed out even though the session cookie is
// valid and the edge guard has already accepted it. StaffLayout then bounces
// every gated route to /login, /login is holding the same poisoned state so its
// already-signed-in auto-forward never fires, and the user is left on a login
// form. Only a fresh document load rebuilds the provider and retries the fetch —
// which is exactly why typing the bare origin was the only way out.
//
// So an "unauthenticated" is not believed until it has been confirmed against
// the server:
//
//   HTTP 200 with a user   -> signed in. getSession() re-syncs the provider so
//                             useSession() everywhere else recovers too.
//   HTTP 200, empty body   -> genuinely signed out. Report it.
//   throw / non-2xx        -> unknown. Stay "loading" and retry with backoff.
//
// Fail-closed is preserved throughout: an unconfirmed state reports "loading",
// never "authenticated", so nothing renders protected content or grants access
// on the strength of a failed request. The only thing that changes is that a
// failed request no longer *revokes* a session it was never able to read.
//
// Two bounded escape hatches stop this from ever becoming a hang:
//
//   * If the server stays unreachable for MAX_PROBES, the unauthenticated
//     answer is accepted and the normal expired-session path runs — a user with
//     no network lands on /login rather than waiting forever.
//   * If the server says signed-in but the provider will not come back (its
//     internal state is already poisoned and nothing re-runs the effect), the
//     route is reloaded once. That is the manual workaround — a fresh document
//     load — done automatically, on the SAME url so the route is kept. A
//     sessionStorage marker makes it strictly once per tab per session, so a
//     server that keeps disagreeing can never produce a reload loop.

import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";

const MAX_PROBES = 3;
const PROBE_BACKOFF_MS = [400, 1200, 2500]; // ~4s of retries before giving up
const PROBE_TIMEOUT_MS = 8000;
const RESYNC_GRACE_MS = 1500; // time given to getSession() to update the provider
const RELOAD_MARKER_KEY = "hnp-session-resync-reloaded";

/**
 * Ask the session endpoint directly.
 * @returns {Promise<"signed-in"|"signed-out"|"unreachable">}
 */
async function probeSession() {
  if (typeof window === "undefined") return "unreachable";
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null;
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store", // the provider may hold a cached failure; force a real request
      headers: { accept: "application/json" },
      signal: controller?.signal,
    });
    if (!response.ok) return "unreachable"; // 5xx / edge failure is not an answer
    const payload = await response.json().catch(() => null);
    // NextAuth answers a signed-out session with `{}` (or null) and a signed-in
    // one with a `user`. Anything unparseable counts as unreachable.
    if (payload === null) return "unreachable";
    return payload && payload.user ? "signed-in" : "signed-out";
  } catch {
    return "unreachable"; // offline, DNS, abort, TLS — all "could not ask"
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Once per tab per browsing session. sessionStorage (not localStorage) so a
// genuinely new session can still recover, and unavailable storage degrades to
// "never reload" rather than "reload every time".
function claimReloadOnce() {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(RELOAD_MARKER_KEY)) return false;
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Called once a session is confirmed good, so a later recovery can reload again. */
export function clearSessionResyncMarker() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RELOAD_MARKER_KEY);
  } catch {
    // nothing to do — the marker is an optimisation, not a correctness gate
  }
}

/**
 * @param {"loading"|"authenticated"|"unauthenticated"} sessionStatus from useSession()
 * @param {{ disabled?: boolean }} [options] disabled: pass through unchanged and
 *   run no probe. Used while an intentional sign-out is in flight, where
 *   "unauthenticated" is the wanted answer and confirming it would race the
 *   cookie being cleared.
 * @returns {{ status: "loading"|"authenticated"|"unauthenticated", recovering: boolean }}
 *   `status` is a drop-in for sessionStatus.
 *   `recovering` is true while an unauthenticated answer is being confirmed.
 */
export default function useVerifiedSessionStatus(sessionStatus, { disabled = false } = {}) {
  // "unconfirmed" is the state NextAuth does not have: told unauthenticated, but
  // not yet established whether that is true.
  const [verdict, setVerdict] = useState("unconfirmed");
  const runRef = useRef(0);

  useEffect(() => {
    if (disabled) {
      // Cancel anything in flight so a probe started before the logout cannot
      // land after it and resurrect the session.
      runRef.current += 1;
      return undefined;
    }
    if (sessionStatus === "authenticated") {
      // Proven good — allow a future recovery to use its one reload.
      clearSessionResyncMarker();
      if (verdict !== "unconfirmed") {
        runRef.current += 1;
        setVerdict("unconfirmed");
      }
      return undefined;
    }
    if (sessionStatus !== "unauthenticated") return undefined; // still loading
    if (verdict === "signed-out") return undefined; // already settled

    const run = ++runRef.current;
    let cancelled = false;
    let timer = null;
    const alive = () => !cancelled && run === runRef.current;

    const attempt = async (index, resyncTried) => {
      const outcome = await probeSession();
      if (!alive()) return;

      if (outcome === "signed-out") {
        setVerdict("signed-out");
        return;
      }

      if (outcome === "signed-in") {
        if (!resyncTried) {
          // The cookie is good and the provider is simply wrong. getSession()
          // refetches and broadcasts, which flips useSession() back to
          // "authenticated" for every consumer — this effect included.
          getSession().catch(() => {});
          timer = setTimeout(() => {
            if (alive()) attempt(index, true);
          }, RESYNC_GRACE_MS);
          return;
        }
        // getSession() did not bring the provider back. Reload the current URL
        // once; a fresh document rebuilds SessionProvider against the same valid
        // cookie. Same url in, same url out, so the route is preserved.
        if (claimReloadOnce()) {
          window.location.reload();
          return;
        }
        // Already used the reload this session — do not loop. Report the
        // unauthenticated state and let the normal /login path (which carries
        // ?redirectedFrom=) take over.
        setVerdict("signed-out");
        return;
      }

      // Unreachable — retry, then accept the answer rather than hanging.
      if (index + 1 >= MAX_PROBES) {
        setVerdict("signed-out");
        return;
      }
      timer = setTimeout(() => {
        if (alive()) attempt(index + 1, resyncTried);
      }, PROBE_BACKOFF_MS[index] ?? 2500);
    };

    attempt(0, false);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionStatus, verdict, disabled]);

  // While disabled the raw status is passed straight through, so a sign-out
  // reaches its unauthenticated state exactly as it did before this hook.
  if (disabled) return { status: sessionStatus, recovering: false };
  if (sessionStatus === "authenticated") return { status: "authenticated", recovering: false };
  if (sessionStatus === "loading") return { status: "loading", recovering: false };
  // unauthenticated: report it only once confirmed. Until then this is a loading
  // state, which every existing caller already handles fail-closed.
  return verdict === "signed-out"
    ? { status: "unauthenticated", recovering: false }
    : { status: "loading", recovering: true };
}
