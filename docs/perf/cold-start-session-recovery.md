# Restored tabs and direct deep links: why an authenticated route would not load

## The symptom

Reopening a pinned tab, or restoring the browser directly onto an authenticated
route such as `/newsfeed`, could leave the page unable to load. Typing the bare
origin (`https://hnpsystem.vercel.app`) fixed it every time. Normal client-side
navigation was never affected.

## Root cause

`useSession()` reports a **failed** `/api/auth/session` request exactly the same
way it reports a real signed-out session: `status === "unauthenticated"`.
`fetchData()` in `next-auth/react` catches every network error, logs
`CLIENT_FETCH_ERROR`, and resolves to `null`; the provider records that as
unauthenticated and then stops. There is no retry, and `refetchOnWindowFocus`
cannot help because the tab that failed never lost focus.

A restored pinned tab is the case that hits this: the browser loads it the moment
it starts, often before the network is up. One failed request then does all of
this:

1. `/api/auth/session` fails once. The session **cookie is perfectly valid** —
   the edge guard in `src/proxy.js` has already accepted it and served the page.
2. `useSession()` reports `unauthenticated`.
3. `UserContext` maps that to `user = null`, `loading = false`.
4. `StaffLayout` sees `user === null` on a gated route and redirects to
   `/login?redirectedFrom=…`.
5. `/login` is holding the *same* poisoned provider state, so its
   already-signed-in auto-forward never fires. The user gets a login form.
6. Nothing retries. Only a fresh document load rebuilds `SessionProvider` and
   re-issues the fetch — which is precisely why typing the origin was the only
   way out.

This is why it is a cold-start problem specifically. During client-side
navigation the provider already holds a good session, so a later failed refresh
has nothing to poison.

### Reproduced

Production build, real browser, valid session cookie, one aborted
`/api/auth/session` request on first load:

```
scenario                      route                verdict      (before)
session endpoint fails once   /newsfeed            -> /login
session endpoint fails once   /jobs                -> /login
session endpoint fails once   /tech                -> /login
session endpoint fails once   /tech/ENR00087       -> /login
session endpoint fails once   /job-cards/00046     -> /login
session endpoint fails once   /profile             -> /login
```

Every protected route, with a valid cookie, from a single dropped request.

## The fix

`src/hooks/useVerifiedSessionStatus.js` — an unauthenticated answer is not
believed until it has been confirmed against the server:

| probe result | meaning | action |
|---|---|---|
| 200 with a `user` | signed in; the provider is wrong | `getSession()` re-syncs the provider |
| 200, empty body | genuinely signed out | report `unauthenticated` |
| throws / non-2xx | could not ask | stay `loading`, retry with backoff |

`UserContext` consumes the verified status instead of the raw one. That is a
two-line change at the single point where session status becomes `user`, so
every consumer downstream — `StaffLayout`, `ProtectedRoute`, `PageAccessGuard`,
every page — inherits it without being touched.

**Fail-closed is unchanged.** An unconfirmed state reports `loading`, never
`authenticated`, so nothing renders protected content or grants access on the
strength of a failed request. The only behaviour that changed is that a failed
request no longer *revokes* a session it was never able to read. A genuinely
expired cookie still produces a 200 with an empty body, so it still redirects to
`/login?redirectedFrom=…` exactly as before.

### Two bounded escape hatches

Neither can hang and neither can loop:

- **Server unreachable** for 3 probes (~4 s) → accept the unauthenticated answer
  and run the normal expired-session path. A user with no network lands on
  `/login` rather than waiting forever.
- **Server says signed-in but the provider will not recover** (its internal state
  is already poisoned and nothing re-runs the effect) → reload the current URL
  once. This is the manual workaround — a fresh document load — done
  automatically, on the *same* URL so the route is kept. A `sessionStorage`
  marker makes it strictly once per tab per browsing session, so a server that
  keeps disagreeing can never produce a reload loop. The marker is cleared as
  soon as a session is confirmed good, so a later genuine recovery can use it.

The probe only ever runs when `unauthenticated` is reported, so the happy path
costs nothing.

### Sign-out is excluded

The hook is disabled while a logout is in flight (`authSyncBlocked`). Signing out
is the one case where `unauthenticated` is the intended answer, and re-confirming
it there would race the cookie being cleared — a probe that caught the session
still alive would try to restore the very session the user is leaving.

## Also fixed: cross-user shell bootstrap attribution

`src/lib/shell/bootstrapClient.js` documents that "a user switch can never read
the previous user's shell data", but on a key change it set `inflight = null`
without preventing the orphaned request from writing its result into the cache —
under the *new* key. The request is now pinned to the key it was issued for and
may only populate the cache if that key is still current. It is still returned to
whoever awaited it; it is just barred from being cached against somebody else.

## Verified

Production build, real browser, median of the full matrix:

```
PASS  persistent session outage        landed /login?redirectedFrom=%2Ftech%2FENR00087 after 16.7s, 3 navigations
PASS  poisoned provider recovers       landed /tech/ENR00087, 2 document load(s), nav=6
PASS  sign-out settles on /login       landed /login
PASS  user switch swaps navigation     tech=[…/tracking] admin=[…]
PASS  restored tab deep link           landed /tech/ENR00087
PASS  hard refresh x2                  landed /tech/ENR00087
PASS  back / forward                   back=/newsfeed forward=/tech/ENR00087
PASS  expired -> login -> back         login=?redirectedFrom=%2Ftech%2FENR00087 after-signin=/tech/ENR00087
8/8
```

And the original reproduction, after the fix — every route loads through a
dropped session request, while a genuinely expired cookie still fails closed:

```
scenario                      route                verdict      (after)
session endpoint fails once   /newsfeed            ok
session endpoint fails once   /tech/ENR00087       ok
session endpoint fails once   /job-cards/00046     ok
expired session cookie        /tech/ENR00087       -> /login?redirectedFrom=…
```

## Investigated and found NOT to be causes

- **`/jobs`, `/appointments`, `/tracking`, `/clocking` redirecting to
  `/newsfeed`.** This looked like a deep-link race but is correct RBAC. The
  discriminator is that client-side navigation to the same route for the same
  user produces the identical redirect — a premature guard would differ between
  the two paths. `PageAccessGuard` was left alone.
- **A stale cached document referencing a dead build's chunks.** `/newsfeed` is
  statically prerendered and `generateBuildId` is pinned to the commit SHA, which
  makes this plausible, but it does not reproduce and it does not explain
  recovery via the origin — that path also returns cached HTML.
- **Service worker / PWA.** There is none in this project.
- **`bfcache`.** Not involved: a restored tab after a browser restart is a fresh
  document load, not a bfcache restore. Back/forward is covered in the matrix.
- **Vercel rewrites/redirects.** `vercel.json` carries only the `lhr1` region
  pin; the redirects in `next.config.mjs` are all legacy path moves and none
  touch the auth flow.
- **Shell bootstrap failure.** Every path through `refreshSidebarAccess` ends in
  `setSidebarAccessLoading(false)`, and a dropped `/api/shell/bootstrap` request
  was measured as harmless on every route.

## Preserved

`StaffProviders` and `Layout` remain **static** imports in `_app` — the
orphaned-duplicate-shell fix is untouched, and nothing here reintroduces dynamic
shell hydration. Server-side identity resolution, fail-closed behaviour on
genuine identity lookup errors, RBAC, the edge guard, the shell bootstrap
round-trip, the `lhr1` region pin and the route-bundle work all stand.
