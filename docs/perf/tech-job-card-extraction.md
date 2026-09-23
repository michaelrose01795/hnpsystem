# /tech/[jobNumber] — removing the job-card page dependency

## What was wrong

`src/pages/tech/[jobNumber].js` reused three components from the job-card page:

```js
import { CustomerRequestsTab, LocationUpdateModal, WriteUpWorkspace }
  from "@/pages/job-cards/[jobNumber]";
```

A static import of a module pulls in that module's *whole* dependency graph, so
the technician route paid for all 13,287 lines of `/job-cards/[jobNumber]` —
the scheduling tab, the parts tab, the messages tab, the documents tab, the
clocking tab, the invoice section, the goods-in panel — none of which a
technician can see. It was the heaviest important route in the app at
**1971.0 kB** of first-load JS.

## What changed

The dependency boundary was recomputed from the current tree rather than
trusted from the earlier note. Walking the module scope of the three exports
and taking the transitive closure gives **21 top-level symbols, 3,463 lines**
(the earlier estimate of 22 symbols / ~3,533 lines was measured before some
intervening edits). Every one of them moved out **verbatim** — the moved text
is byte-identical to what was in the page, which is what keeps behaviour,
styling, `staffglobal.css` classes and modal semantics unchanged:

| New module | Contents |
|---|---|
| `src/components/JobCards/CustomerRequestsTab.js` | `CustomerRequestsTab` (1,441 lines) |
| `src/components/JobCards/WriteUpWorkspace.js` | `WriteUpWorkspace` + its private `RequestCompleteIcon` (1,744 lines) |
| `src/components/JobCards/LocationUpdateModal.js` | `LocationUpdateModal` (130 lines) |
| `src/lib/jobCards/locations.js` | `CAR_LOCATIONS`, `KEY_LOCATION_GROUPS`, `KEY_LOCATIONS`, `CAR_LOCATION_OPTIONS`, `KEY_LOCATION_OPTIONS`, `normalizeKeyLocationLabel`, `ensureDropdownOption`, `emptyTrackingForm` |
| `src/lib/jobCards/vhcSeverity.js` | `deriveVhcSeverity`, `resolveVhcSeverity` |
| `src/lib/jobCards/requestHelpers.js` | `normalizeStatusId`, `SERVICE_CHOICE_LABELS`, `safeJsonParse`, `normalizeWriteUpCompletionStatus`, `isRemovedPartsRow`, `isBookedPartsRow`, `isPartsRowAllocated`, `getRowTimestamp`, `preferLatestPartRow` |

**Both** routes now import from these modules. Nothing is duplicated between
`/tech/[jobNumber]` and `/job-cards/[jobNumber]` — the job-card page imports
the same six modules back, and both pages keep passing the three components
down to their existing page-ui layers exactly as before, so no page-ui file
changed.

Deliberately *not* changed: the camera (`VhcCameraButton`) and customer-video
(`CustomerVideoButton`) buttons stay eagerly imported, as do the Customer
Requests default tab and `WriteUpWorkspace`. Every pre-existing `next/dynamic`
boundary (the six VHC section modals, the photo/video editors, `WriteUpForm`,
`NotesTab`, `VhcAssistantPanel`, `DocumentsUploadPopup`), the Supabase client
wiring, realtime coalescing, the shell bootstrap and the `lhr1` function region
pin are untouched.

## Measured result

Build-manifest first-load JS (`npm run report:bundles`, see below):

| Route | Before | After | Change |
|---|---|---|---|
| `/tech/[jobNumber]` | 1971.0 kB | **1685.9 kB** | **−285.1 kB (−14.5 %)** |
| `/job-cards/[jobNumber]` | 1725.4 kB | 1727.9 kB | +2.5 kB (extra module boundaries) |

Real browser cold load of `/tech/<job>` against `next start`, technician
session, empty cache — compressed bytes over the wire:

| | Before | After |
|---|---|---|
| JS transferred | 773.1 kB | **691.6 kB** (−81.5 kB, −10.5 %) |
| JS requests | 60 | 58 |

`hnpPerf()` stage marks were captured on the same runs; the page reaches the
same `app:mounted` state with the same rendered output. The wall-clock numbers
(TTFB, `loadEventEnd`) moved inside run-to-run noise on a local server and are
not claimed as a win.

## Why it did not reach ~1.1 MB

The earlier ~1.1 MB estimate assumed the whole job-card dependency was dead
weight for a technician. It is not — most of it is the three components the
technician workflow actually uses. Attributing what remains:

| Layer | Size | Notes |
|---|---|---|
| Base (`rootMainFiles` + polyfills + `/_app`) | 476.5 kB | Every route in the app pays this |
| Also loaded by `/tech/dashboard` (staff shell, sidebar, global search, Supabase client, theme) | 455.2 kB | Every *staff* route pays this |
| Shared with `/job-cards/[jobNumber]` (the three extracted components + their libs) | 392.2 kB | Genuinely used by the technician card |
| The technician page itself | 362.1 kB | 5,827 lines |

The floor for any staff route today is ~932 kB — `/tech/dashboard` measures
996.7 kB. Getting `/tech/[jobNumber]` to 1.1 MB would mean cutting ~586 kB out
of the 754 kB of code the technician workflow genuinely uses, which is a
different piece of work (splitting the shared staff shell, or deferring the
write-up workspace) and would change what loads when.

## Measuring it yourself

Next 16 + Turbopack only prints its route/size table when stdout is a TTY, so a
piped `npm run build` shows route names with no sizes. `tools/scripts/report-route-bundles.js`
reads the same numbers out of `.next/build-manifest.json`:

```
npm run build
npm run report:bundles                          # 20 heaviest routes
npm run report:bundles -- --save before.json    # snapshot
npm run report:bundles -- --diff before.json    # compare a later build
```

At runtime, open a technician job card and call `hnpPerf()` in the console for
the stage breakdown (see `src/lib/perf/stageTimings.js`).

## Governance metadata updated by this move

Moving code between files moves its baselined design debt with it. Nothing was
fixed and nothing new was introduced — each total is conserved exactly:

- `tools/design-baselines/design-governance.json` — `one-off-styling` for the
  job-card page 803 → 655, with 67 / 57 / 24 appearing against
  `CustomerRequestsTab` / `WriteUpWorkspace` / `LocationUpdateModal`
  (803 = 655 + 67 + 57 + 24). Re-baselined with `--accept-new`, which is the
  documented flag for a deliberate move.
- `tools/scripts/check-staff-controls.js` — `MIGRATION_BASELINE` 43 → 34 + 4 + 3 + 2.
- `tools/scripts/check-text-contrast-tokens.js` — `MIGRATION_BASELINE` 17 → 9 + 3 + 4 + 1.
- `src/lib/dev-layout/sectionSourceMap.generated.js` — regenerated with
  `npm run dev-layout:source-map`; the overlay's file/line pointers follow the
  sections into their new files.
