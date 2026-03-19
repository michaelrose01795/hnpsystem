# Job Progress Tracker — AI-Like Enhancement Layer

## Overview

The Job Progress Tracker has been enhanced with an intelligent display layer that makes the timeline section cleaner, smarter, and more helpful — without changing the underlying audit data or backend APIs.

All enhancements are **code-driven** (no external AI dependency). A feature flag (`ai_text_enhancement_enabled`) is reserved for optional future AI text refinement.

---

## What Was Added

### Smart Summary Block
A summary panel above the timeline that shows:
- Current job stage with colour-coded badge
- Latest meaningful update with relative time
- Technician name (if known)
- Tracking status (vehicle/key location)
- Wash/valet status
- Plain-English summary sentence
- Next likely step with description
- Blocking reasons (if any)

### Display Title Mapping
Raw status IDs and event labels are mapped to clean, user-facing titles:
- `technician_started` → "Technician Started"
- `initial` clocking → "Technician Started"
- `vehicle_tracking` with location → "Parking Updated: Bay 5"
- `tracking_registered` → "Added to Parking & Key Tracking"

### Timeline Enhancement Pipeline
A multi-step processing pipeline applied to raw timeline entries:
1. Display title mapping
2. Actor propagation (fills orphan entries from neighbours)
3. Deduplication (removes exact duplicates and overlapping clocking/technician_started events)
4. Visual grouping (collapses related entries)
5. Highlight tagging (mutes low-value noise)

### Visual Grouping
Related entries are collapsed into expandable groups:
- **Tracking clusters**: consecutive vehicle/key tracking events within 5 minutes
- **Clocking pairs**: clock-on + clock-off for the same technician
- **VHC workflow**: consecutive VHC sub-status events

Groups show a count label and expand/collapse with a click.

### Layout Polish
- Tighter card padding and entry spacing
- Performer + timestamp on a single row with dot separator
- Smaller, pill-shaped category badges
- Non-highlighted entries rendered at 70% opacity
- Thicker connector line (2.5px)
- Current status dot has a subtle glow
- Removed non-functional hover translate effect
- Cleaner detail blocks without heavy borders

---

## Files Changed

### New Files (6)

| File | Purpose |
|------|---------|
| `src/config/trackerFlags.js` | Feature flag configuration and helpers |
| `src/lib/status/timelineDisplayMap.js` | Display title and badge label mapping |
| `src/lib/status/timelineGrouping.js` | Visual grouping logic (tracking, clocking, VHC) |
| `src/lib/status/timelineEnhancer.js` | Enhancement pipeline orchestrator |
| `src/lib/status/smartSummaryBuilder.js` | Smart Summary generation from snapshot data |
| `src/components/StatusTracking/SmartSummaryBlock.js` | Smart Summary UI component |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/components/StatusTracking/StatusSidebar.js` | Imports + wiring: computes summary and enhanced timeline, renders SmartSummaryBlock, passes enhanced data to tracker |
| `src/components/StatusTracking/JobProgressTracker.js` | Layout polish, uses enhanced display titles, supports grouped entries with expand/collapse, accepts flags prop, debug mode |

---

## How Smart Summary Works

`buildSmartSummary(snapshot)` in `smartSummaryBuilder.js` takes the full job status snapshot (already fetched by StatusSidebar from `/api/status/snapshot`) and derives:

- **Stage**: from `snapshot.job.statusLabel`
- **Latest update**: most recent timeline entry's clean display title + relative time
- **Technician**: resolved from active clocking, then most recent clocking entry, then technician_started event
- **Tracking**: from `snapshot.workflows.tracking` (vehicleStatus + keyStatus)
- **Wash status**: checks timeline for wash_complete event, infers from job stage
- **Summary sentence**: template: "Job {number} is {stage}. {tech info}. {blocking info}."
- **Next step**: decision tree based on `overallStatus` + workflow states (parts, VHC, clocking, write-up)

---

## How Actor Resolution Works

Actor resolution happens at two levels:

1. **Server-side** (`jobStatusSnapshot.js`): `inferMissingActor()` cross-references clocking, tracking, and booking tables to fill missing actors on booked, checked_in, technician_started, and wash_complete entries.

2. **Client-side** (`timelineEnhancer.js`): `propagateActors()` fills orphan entries (no actor) when both adjacent entries share the same actor within 2 minutes. This is a conservative heuristic to avoid false attribution.

The component-level `resolvePerformer()` in `JobProgressTracker.js` checks `item.user`, `item.userName`, `item.performedBy`, and `item.meta.userName` before falling back to "System".

---

## How Duplicate Suppression Works

Deduplication in `timelineEnhancer.js`:

1. **Exact duplicates**: entries with identical kind, status, label, department, timestamp, userId, userName, description, and meta fields are deduplicated using a Set-based key.

2. **Clocking overlap**: initial clocking entries are suppressed when a matching `technician_started` status exists for the same user within 60 seconds — they represent the same event from different sources.

---

## How Grouping Works

`timelineGrouping.js` runs three grouping passes:

1. **Tracking clusters**: consecutive `vehicle_tracking`, `key_tracking`, or `tracking_registered` events within 5 minutes are collapsed into a "Tracking Updates (N)" group.

2. **Clocking pairs**: a clock-on entry immediately followed by a clock-off for the same user becomes a "Technician Session: Xh Ym" group showing the session duration.

3. **VHC workflow**: consecutive VHC sub-status events (vhc_started through customer_authorised/declined) become a "VHC Workflow (N)" group.

Groups are display-only — individual audit entries remain intact inside the group and are visible when expanded.

---

## What Is Rule-Based vs Optional AI-Enhanced

| Feature | Rule-based | Optional AI |
|---------|-----------|-------------|
| Display title mapping | Code mapping utility | Could refine wording |
| Smart Summary text | Template sentences | Could generate natural language |
| Next step inference | Decision tree | Could consider more context |
| Grouping | Pattern matching | N/A |
| Duplicate suppression | Key-based dedup | N/A |
| Actor resolution | Field fallback chain | N/A |

The `ai_text_enhancement_enabled` flag (default: false) is the hook point. When enabled, summary text could be post-processed by an AI endpoint. All current functionality works without any AI provider.

---

## Feature Flags

Defined in `src/config/trackerFlags.js`:

| Flag | Default | Description |
|------|---------|-------------|
| `smart_summary_enabled` | `true` | Show/hide the Smart Summary block |
| `ai_text_enhancement_enabled` | `false` | Placeholder for future AI text refinement |
| `grouping_enabled` | `true` | Enable/disable visual grouping of timeline entries |
| `debug_mode_enabled` | `false` | Show raw entry data at the bottom of the tracker |

Override via environment variables: `NEXT_PUBLIC_TRACKER_<FLAG_NAME>=true|false`
