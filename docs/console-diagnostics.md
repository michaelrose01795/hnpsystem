# The F12 console — what is allowed in it

The browser console is a diagnostic instrument, not a log file. If it prints
during a normal page load, the thing it printed had better be something a
developer needs to act on. Everything else is opt-in.

This is the policy, the four moving parts that enforce it, and how to turn the
detail back on when you actually want it.

---

## The policy

A clean boot on a healthy page prints **one line**:

```
[HNP] hnpPerf() for a stage breakdown · hnpDebug("trace,nav") for load/navigation timelines
```

That is the only unconditional output. Anything else in the console is either a
real failure, or a diagnostic channel someone deliberately switched on.

| What | Default | Where it comes from |
|---|---|---|
| Errors (`console.error`) | **shown** | `logFailure()`, React, Next.js |
| Warnings (`console.warn`) | **shown in dev**, hidden in production | call sites |
| `console.log` / `.info` / `.debug` | hidden | silenced by `quietConsole.js` |
| `[HNP-TRACE]` load timeline | **off** | `loadTrace.js`, channel `trace` |
| `[NAV]` navigation banners | **off** | `_app.js`, channel `nav` |
| `[PERF]` stage tables | on demand | `hnpPerf()` |

**Nothing calls `console.clear()`.** It used to fire on every app boot and on
every link click, which meant the console wiped the error you had just stopped
to read. Clearing the console is the developer's decision, not the app's.

---

## Turning diagnostics on

From the console, persisted across reloads:

```js
hnpDebug("trace")        // load/mount/state timeline
hnpDebug("nav")          // navigation banners + router event log
hnpDebug("trace,nav")    // both
hnpDebug("all")          // everything
hnpDebug(false)          // back to quiet
hnpDebug()               // what is currently on
```

Or for a single visit, without persisting: `?debug=trace,nav` on the URL.

Channels install their listeners at mount, so **reload after switching one on**.
`hnpDebug()` says so in its return value.

Once `trace` is on:

```js
copy(window.__hnpTrace)   // the whole timeline to the clipboard
hnpTraceTable()           // print it as a table
hnpTraceClear()           // start a clean capture
```

The trace buffer is persisted to `sessionStorage`, so it survives the hard
navigation from login → `/newsfeed` and the whole boot sequence stays in one
place.

Performance is separate and always available, because it costs nothing until
called: `hnpPerf()` for the stage breakdown, `hnpPerf.interactions()` for INP
and long tasks, `copy(hnpPerf.raw())` for the full record.

---

## Reporting a failure

Two reporters exist and they are **not** interchangeable.

### `logFailure()` — developer-facing, console only

`src/lib/utils/logFailure.js`. This is what a DB helper, a service or a hook
uses when something failed and there is no UI in scope to say so. It replaced
every direct `console.error()` call outside `src/pages/api/`.

```js
import { logFailure } from "@/lib/utils/logFailure";

logFailure("getAllJobs error", error);
logFailure("upload failed", error, { jobNumber, bucket });
```

What it does that a bare `console.error` did not:

- **Normalises** the failure. An `Error`, a Supabase `PostgrestError`, a
  fetch-ish response and a plain object all print the same shape: the message
  first, then only the fields carrying information (`code`, `details`, `hint`,
  `status`). No more `{message: undefined, details: null, hint: null}` noise.
- **De-duplicates.** The same failure inside 3 seconds is counted, not
  reprinted. A retry loop that fails 40 times a second produces one line, then
  `(x40)` when it next prints. This is the single biggest reduction in console
  volume — failures in this app cluster, they do not arrive alone.
- **Cleans the label.** The `❌`/`⚠️` prefixes and trailing colons that grew up
  across ~700 call sites are stripped, so labels sort and filter cleanly in the
  DevTools filter box. A deliberate `[reporting]`-style namespace is kept.

It prints through `console.error`, not the stashed native console, because
`installBrowserCapture()` in `src/lib/support/diagnostics.js` patches
`console.error` to feed support diagnostics — handled failures belong in that
capture.

### `reportError()` — user-facing, raises a toast

`src/lib/notifications/report.js`. Part of the Frontend Feedback & Error
System. It shows a plain-English sentence and a reference code to the person
using the app, and files the technical detail into `devInfo`.

**Choosing between them:** if a human using the app needs to know something
went wrong, that is `reportError()`. If only a developer reading F12 needs to
know, that is `logFailure()`. A call site that does both should call
`reportError()` — it already captures the detail.

---

## The four files

| File | Role |
|---|---|
| `src/utils/quietConsole.js` | Decides the log level. Stashes the native console methods on `globalThis.__HNP_NATIVE_CONSOLE__` before silencing, so diagnostics can still print at any level. Installs `hnpDebug()`. |
| `src/utils/debugChannels.js` | The opt-in switch. Resolves enabled channels once per document from `localStorage` + `?debug=`, and exposes `isDebugChannelEnabled()`. |
| `src/utils/loadTrace.js` | The `trace` channel — `[HNP-TRACE]` timeline, mount/unmount and state-change hooks. |
| `src/lib/utils/logFailure.js` | The failure log — normalisation and de-duplication. |

`NEXT_PUBLIC_LOG_LEVEL` / `LOG_LEVEL` (`silent` \| `error` \| `warn` \| `info` \|
`debug`) still overrides the level wholesale if you want the raw firehose.

---

## Adding a channel

1. Add its name to `DEBUG_CHANNELS` in `src/utils/debugChannels.js`.
2. Gate its listeners on `isDebugChannelEnabled("<name>")` — at module load if
   the cost is per-render, at effect time if it installs listeners.
3. Print through `globalThis.__HNP_NATIVE_CONSOLE__` so the channel works even
   when the log level is lowered.

A channel that prints when nobody asked for it is a bug, not a feature.
