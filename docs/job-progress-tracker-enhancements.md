# Job Progress Tracker — Intelligent Activity Layer

## Overview

The Job Progress Tracker has been enhanced with a 7-layer intelligence system that makes the timeline section feel like a smart workshop activity feed — interpreting the job, highlighting what matters, reducing noise, and spotting workflow issues.

All enhancements are **code-driven** (no external AI dependency). Optional AI text refinement is available behind a feature flag but the system works fully without it.

---

## Architecture: 7 Layers

### Layer 1: Importance Scoring
Every timeline entry gets a numeric importance score (1-5):
- **Milestone (5)**: Booked, Checked In, In Progress, Invoiced, Released, Tech Work Completed, Wash Complete
- **Major (4)**: Technician Started, VHC Completed, Customer Authorised/Declined, Parts Ready, MOT Completed
- **Normal (3)**: VHC Started, pricing steps, clocking events, first tracking event
- **Minor (2)**: Subsequent tracking/key updates
- **Noise (1)**: Unrecognised system events

Drives: card opacity, milestone accent borders, summary prominence.

### Layer 2: Explanation Text
Each entry gets an optional plain-English explanation:
- "Initial workshop work was started by Jake Smith"
- "Vehicle was moved to the Service area"
- "Jake Smith clocked off after 2h 15m"

Generated from event type + metadata. Displayed below the card title in italic.

### Layer 3: Phase Grouping
Entries are grouped into named workflow phases instead of basic time-window clusters:
- Booking & Check-in
- Workshop Activity
- VHC & Authorisation
- Parts & Ordering
- Wash & Final Prep
- Invoice & Collection
- Tracking Updates
- System Updates

Phase assignment is deterministic from status/eventType. Consecutive same-phase entries form collapsible groups with phase-specific accent colours.

### Layer 4: Anomaly Detection
10 rules detect suspicious or missing workflow patterns:
1. Checked in > 2 hours with no technician start
2. Technician started > 4 hours with no progress
3. Active clocking session > 8 hours
4. Parts blocking with no parts_ready event
5. VHC required but pending while in progress
6. Wash complete before tech work completed
7. Invoiced but no invoice record
8. Important event with no recorded actor
9. Timeline events don't match overall status
10. Multiple simultaneous clock-ins

Displayed as an "Attention Needed" banner in the Smart Summary.

### Layer 5: Confidence Model
Inferred fields get confidence levels (high/medium/low):
- **Actor confidence**: high (from DB), medium (propagated from neighbours), low (unresolved)
- **Next step confidence**: high (deterministic), medium (ambiguous), low (conflicting)
- **Summary confidence**: based on count of available key fields

Visible only in debug mode as coloured pills.

### Layer 6: Enhanced Smart Summary
The summary panel now includes:
- Current stage with colour badge
- Latest meaningful update
- Technician, tracking, wash, invoice status
- Current responsible department
- Job story (2-3 sentence natural narrative)
- Next likely step with confidence
- Attention items from anomaly detection
- Blocking reasons

### Layer 7: Optional AI Enhancement
Behind `ai_text_enhancement_enabled` flag:
- API route `/api/ai/enhance-summary` sends code-generated text to external AI
- Client hook `useAiEnhancement` manages the request
- 10-second timeout, schema validation, silent fallback
- Code-generated text remains source of truth

---

## Files

### New Files (9)

| File | Purpose |
|------|---------|
| `src/lib/status/timeUtils.js` | Shared time utilities: relativeTime, formatDuration, hoursSince, withinWindow, shortDate |
| `src/lib/status/importanceScoring.js` | Importance scoring (1-5) for timeline entries |
| `src/lib/status/explanationBuilder.js` | Plain-English explanation text generator |
| `src/lib/status/phaseGrouping.js` | Phase-based semantic grouping of timeline entries |
| `src/lib/status/anomalyDetector.js` | 10-rule anomaly detection engine |
| `src/lib/status/confidenceModel.js` | Confidence assessment for actors, next step, summary |
| `src/lib/status/jobStoryBuilder.js` | Natural-language job narrative builder |
| `src/pages/api/ai/enhance-summary.js` | Optional AI text enhancement API route |
| `src/hooks/useAiEnhancement.js` | Client hook for AI enhancement |

### Modified Files (8)

| File | Changes |
|------|---------|
| `src/config/trackerFlags.js` | Added 4 new flags: importance_scoring, phase_grouping, anomaly_detection, confidence_display |
| `src/lib/status/timelineDisplayMap.js` | Added resolveExplanation export, imports explanationBuilder |
| `src/lib/status/timelineGrouping.js` | Extracted utils to timeUtils.js, exported groupClockingPairs |
| `src/lib/status/timelineEnhancer.js` | 8-step pipeline: titles → explanations → actors → importance → dedup → phase grouping → highlights → confidence |
| `src/lib/status/smartSummaryBuilder.js` | Extracted relativeTime, added invoiceStatus, currentResponsible, jobStory, attentionItems, confidence scores |
| `src/components/StatusTracking/SmartSummaryBlock.js` | Renders job story, attention items, invoice/responsible in grid, confidence badges in debug mode |
| `src/components/StatusTracking/JobProgressTracker.js` | Importance-driven opacity + milestone borders, explanation text, phase-coloured group headers, extended debug output |
| `src/components/StatusTracking/StatusSidebar.js` | Reordered useMemo (enhanced timeline before summary), passes flags to SmartSummaryBlock |

---

## Enhancement Pipeline

```
enhanceTimeline(entries, flags):
  1. applyDisplayTitles      — clean user-facing titles + badge labels
  2. applyExplanations       — plain-English context for each entry
  3. propagateActors         — fill orphan entries from neighbours (tags _actorPropagated)
  4. applyImportanceScores   — 1-5 scoring (gated by flag)
  5. deduplicateEntries      — key-based dedup + initial clocking suppression
  6. groupByPhase / groupTimelineEntries — semantic or basic grouping (gated by flags)
  7. tagHighlights           — isHighlighted boolean for emphasis
  8. applyActorConfidence    — high/medium/low per entry
```

---

## Smart Summary Data Shape

```javascript
{
  stage, stageColor, latestUpdate,
  technician, trackingStatus, washStatus,
  summary, nextStep, blockingReasons,
  invoiceStatus,          // "missing" | "Draft" | payment status
  currentResponsible,     // "Workshop" | "Parts" | "VHC" | "Accounts" | "Service Reception"
  jobStory,               // "Vehicle was booked and checked in on 18 Mar. Jake Smith started work..."
  attentionItems,         // [{ code, severity, message, detail, workflowKey }]
  nextStepConfidence,     // "high" | "medium" | "low"
  summaryConfidence,      // "high" | "medium" | "low"
}
```

## Enhanced Timeline Entry Shape

```javascript
{
  displayTitle, badgeLabel, isHighlighted,
  explanation,            // "Initial workshop work was started by Jake Smith"
  importance,             // 1-5
  importanceLabel,        // "milestone" | "major" | "normal" | "minor" | "noise"
  phase,                  // "workshop" | "booking_checkin" | "vhc_auth" | ...
  actorConfidence,        // "high" | "medium" | "low"
  _actorPropagated,       // boolean (internal flag)
  group: {                // present on grouped entries
    groupId, groupLabel, items, isCollapsible,
    phaseId, phaseColor,  // for phase groups
  }
}
```

---

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `smart_summary_enabled` | `true` | Show/hide Smart Summary block |
| `ai_text_enhancement_enabled` | `false` | Enable optional AI text refinement |
| `grouping_enabled` | `true` | Enable basic time-window grouping (fallback) |
| `debug_mode_enabled` | `false` | Show raw entry data + confidence badges |
| `importance_scoring_enabled` | `true` | Enable importance-driven opacity/ordering |
| `phase_grouping_enabled` | `true` | Enable phase-based semantic grouping |
| `anomaly_detection_enabled` | `true` | Enable anomaly detection in Smart Summary |
| `confidence_display_enabled` | `false` | Show confidence badges in standard UI |

Override via env: `NEXT_PUBLIC_TRACKER_<FLAG_NAME>=true|false`

---

## Anomaly Detection Rules

| Code | Severity | Trigger |
|------|----------|---------|
| STALE_CHECKIN | warning | Checked in > 2 hrs, no tech start |
| STALE_TECHNICIAN | warning | Tech started > 4 hrs, no progress |
| LONG_CLOCKING | warning | Active clocking > 8 hrs |
| PARTS_BLOCKING | info | Parts blocking, no parts_ready |
| VHC_REQUIRED_PENDING | info | VHC required but pending while in_progress |
| WASH_BEFORE_WORK | warning | Wash complete before tech complete |
| INVOICE_NO_RECORD | warning | Invoiced but no invoice ID |
| MISSING_ACTOR | info | Important event with no actor |
| STATUS_MISMATCH | warning | Timeline doesn't match overall status |
| MULTIPLE_CLOCKINS | info | Multiple simultaneous clock-ins |

---

## What Is Rule-Based vs Optional AI

| Feature | Rule-based | Optional AI |
|---------|-----------|-------------|
| Display titles | Code mapping | N/A |
| Explanation text | Template sentences | Could refine wording |
| Smart Summary | Template sentences | Could refine natural language |
| Job story | Milestone-based narrative | Could improve flow |
| Next step | Decision tree | Could consider more context |
| Anomaly detection | 10 hardcoded rules | N/A |
| Importance scoring | Status-based scoring | N/A |
| Phase grouping | Deterministic dispatch | N/A |
| Confidence model | Field-counting heuristic | N/A |
