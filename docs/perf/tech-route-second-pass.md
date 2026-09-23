# /tech/[jobNumber] — second pass: what is left, and what is genuinely required

Follows [tech-job-card-extraction.md](./tech-job-card-extraction.md), which
removed the job-card page dependency. This pass re-audits the route from its new
baseline and targets the remaining weight from measured attribution.

## Correcting the previous attribution

The first pass split the route's weight by **build chunk**: ~476 kB base, ~455 kB
"shared staff shell", ~392 kB extracted components, ~362 kB technician page. That
split is not a cost breakdown. Turbopack's chunk grouping moves between builds —
after an unrelated `_app` change landed, the same route reported a 1170 kB `_app`
bucket and a 545 kB route bucket for almost exactly the same total.

"How much of the shared staff shell is genuinely required on this route" can only
be answered at **module** level: which modules would still be in the technician
route's eager import graph if the shell did not exist?

```
Shell-only on /tech/[jobNumber]: 14 modules, 107.0 kB of source
    33.8 kB  src/pages/_app.js
    18.0 kB  src/components/support/SupportErrorBoundary.js
    13.3 kB  src/lib/support/recoveryModel.js
    11.6 kB  src/lib/perf/stageTimings.js
     7.1 kB  src/lib/auth/returnRoute.js
     5.7 kB  src/lib/support/errorBoundaryDiagnostics.js
     ... 8 more, all under 5 kB
```

**The staff shell adds 107 kB that the technician route would not otherwise
load.** `StaffLayout`, `StaffSidebar`, `StaffTopbar`, the workspace manifest,
`UserContext`, the dropdown family, the theme runtime and `lib/database/jobs.js`
are all imported by the technician page or by the components it renders. They are
not shell overhead on this route; they are the route's own dependencies that the
shell happens to share. The "455 kB shared staff shell" was an artefact of chunk
attribution.

## What was deferred

### Capture surfaces behind the camera / customer-video launchers

`VhcCameraButton` and `CustomerVideoButton` are launchers — `CustomerVideoButton`
says exactly that in its own header. Both statically imported everything they can
open: `FullScreenCapture`, `CameraCaptureModal`, `MediaUploadConfirmModal`,
`PhotoEditorModal`, `VideoEditorModal`. Each of those renders **nothing** until
its own open flag is true (they bottom out in `VHCModalShell` or
`FullScreenCapture`, both of which return null when closed) and every effect
inside them early-returns while closed, so mounting them only while open produces
the same DOM and runs the same effects.

The launcher buttons stay in the first-load bundle — the controls are immediately
available, unchanged. The surfaces are code-split and **warmed on idle** via the
new `useIdleWarm` hook, so the first press finds the chunk in cache instead of
waiting on a request. Measured effect on opening the customer-video surface:
639 ms down to 414 ms — it got faster, not slower.

**190.2 kB of source, 11 modules, off the technician route's eager graph.**

### Top-bar overlay panels

`WorkspaceCommandCenter` hosts the command palette, workspace panel, customise
overlay, shortcut hints, team panel and assistant panel. Its header notes it adds
nothing to the top bar: every surface is keyboard/overlay-driven, and all six
return null until opened. The controller and all of its hooks stay eager, so
shortcuts, presence, activity and reminders register exactly when they do now;
only the six panels are split.

They are **not** idle-warmed. Warming them cost 6 extra requests on every staff
page load for surfaces most sessions — and no technician — ever open; measured as
88 requests going to 94 for no benefit. They load on first open instead.

**52.6 kB of source, 7 modules** — and this one helps every staff route, not just
this one.

`ssr: false` on both sets is required, not incidental: with SSR on, `dynamic()`
puts a lazy boundary around a server-rendered subtree whose chunk may not be
loaded at hydration. That is the failure that forced `_app` to import
`StaffProviders` and `Layout` statically. These surfaces render nothing on the
server anyway.

## What is genuinely required — and why it was left alone

| Candidate | Weight | Why it stays |
|---|---|---|
| `WriteUpWorkspace` | 80.5 kB | The technician page-ui keeps it **mounted** and hides it with `display: none`. That is deliberate — it preserves in-progress write-up text across tab switches. Deferring saves nothing while it is always mounted, and gating the mount would discard unsaved work. |
| `CustomerRequestsTab` | 68.3 kB | The technician's default tab — first paint. |
| `lib/database/jobs.js` | 240 kB subtree | `getJobByNumber` runs on mount to load the card. Required at initial paint. |
| `StaffProviders`, `Layout` | — | Static in `_app` on purpose; making them dynamic reintroduces the frozen-skeleton-sidebar hydration bug. |
| `StaffSidebar`, `StaffTopbar`, workspace manifest | 74.5 / 67.8 / 61.4 kB | Painted at first load. |
| `RequestPresetAutosuggestInput` | 37.0 kB | Inside the default tab's typing path. |
| `SupportErrorBoundary` + recovery model | 37 kB | Must be mounted to catch errors. Only the ~19 kB recovery/diagnostics payload could load lazily on an actual error — identified, not taken: global provider, in files another session is actively changing. |
| `tracking`, `clocking`, `notes`, `vhc` DB helpers | 43 / 20 / 18 / 24 kB | All called during the initial load sequence. |

## Measured, before and after

Build-manifest first-load JS (`npm run report:bundles`):

| Route | Before | After | Change |
|---|---|---|---|
| `/tech/[jobNumber]` | 1715.2 kB | **1619.5 kB** | **95.7 kB smaller (5.6 %)** |
| `/job-cards/[jobNumber]` | 1757.1 kB | 1742.8 kB | 14.3 kB smaller |

Eager import graph for `/tech/[jobNumber]`: 239 modules / 2298.4 kB of source
becomes **219 modules / 2048.7 kB**, a reduction of 249.7 kB.

Production build, real browser, cold cache, technician session on an active job,
median of 5 runs:

| | Before | After |
|---|---|---|
| JS transferred (compressed) | 941.7 kB | 927.3 kB |
| JS decoded | 3287.2 kB | 3227.1 kB |
| JS requests | 88 | 87 |
| Long tasks | 7 (1017 ms total, 256 ms max) | 6 (638 ms total, 200 ms max) |
| Open customer-video surface | 639 ms | 414 ms |
| Switch to VHC tab | 221 ms | 178 ms |
| Switch to Write-up tab | 195 ms | 106 ms |

Note the gap between 95.7 kB of first-load JS and 14.4 kB of transferred bytes:
the capture chunks are still fetched, just on idle rather than on the critical
path. That is the point of the change — it moves bytes off first load, it does
not delete them. The decoded-bytes and long-task figures reflect the parse and
execute work actually removed from startup.

Timings come from a local production server and carry run-to-run noise; the
first-load and module-graph figures are deterministic.

## No fixed target

The remaining ~1620 kB is ~1145 kB of shell shared with every staff route (only
107 kB of it shell-exclusive here), ~162 kB of job-card domain code shared with
`/job-cards`, and ~280 kB of technician page. `/tech/dashboard`, a light staff
route, measures 1242.5 kB — the floor any staff route pays today. Closing further
would mean splitting the staff shell itself: separate work, with its own
hydration risk, not a technician-route change.

## Also fixed in this pass

`handleVhcClick` in the technician page called `setSelectedTab("vhc")` — a
binding that has never existed in that file. It would have thrown a
`ReferenceError` the moment it ran; it never ran, because the helper is
unreferenced. The live VHC entry point is the tab bar in the page-ui, which calls
`setActiveTab` directly, and `visibleTabs` already omits the VHC tab when the job
does not require one. The call now points at `setActiveTab`, the real owner of
that state. No UI or workflow changed.

## Tooling

- `npm run report:bundles` — first-load JS per route from the build manifest,
  with `--save` / `--diff` for before/after.
- `hnpPerf()` in the console — stage timings; `hnpPerf.interactions()` for INP
  and long tasks.
- `src/hooks/useIdleWarm.js` — warms a split chunk once the browser is idle, for
  the case where a control must stay instant but its surface need not be in the
  first load.
