# Improved Job Assistant — Design Document

## 1. Analysis: Where Users Get Stuck

### Pain Points by Role

**Technician (myjobs/[jobNumber])**
| # | Pain Point | Current State | Impact |
|---|-----------|---------------|--------|
| T1 | "What do I do next?" — No unified step tracker | VHC assistant exists but only covers VHC sections. Write-up, clocking, and completion are separate mental models | Techs skip steps, forget to clock in/out, or miss VHC sections |
| T2 | VHC section order unclear | 6 section cards in a grid — no sequencing guidance | Techs jump between sections randomly, leave mandatory ones incomplete |
| T3 | Write-up ↔ VHC disconnect | Write-up and VHC are separate tabs; findings don't clearly carry forward | Duplicate work or missed findings in write-up |
| T4 | Measurement → severity mapping invisible | Auto-calculated from tread/pad depth, but tech doesn't see the threshold rules | Tech doesn't know *why* something turned red |
| T5 | No "I'm done" confidence | Tech must mentally check: VHC done? Write-up done? Clocked out? No single completion gate | Jobs sit in limbo, service advisors chase techs |
| T6 | Camera/photo prompts missing | Camera is available but nothing prompts "take a photo of this red item" | Low photo evidence on critical findings |

**Service Advisor (job-cards/[jobNumber])**
| # | Pain Point | Current State | Impact |
|---|-----------|---------------|--------|
| S1 | Pricing gaps block send-to-customer | Must manually check every red/amber item has labour + parts costs | VHC sent without pricing → customer confusion |
| S2 | No "send readiness" checklist | VhcAssistantPanel shows a readiness %, but no actionable checklist of exactly what's missing | Advisor guesses, clicks send, hits validation error |
| S3 | Cross-tab context switching | Must flip between VHC, Parts, Write-up tabs to understand full picture | Slow decision-making, missed connections |
| S4 | Approval follow-up invisible | After sending VHC, no clear "customer hasn't responded to 3 items" nudge | Advisors don't follow up, jobs stall |
| S5 | Invoice readiness scattered | Blockers shown in assistant card, but not actionable (no "go to tab" links) | Advisors read blocker text but can't act on it quickly |

**Parts Desk**
| # | Pain Point | Current State | Impact |
|---|-----------|---------------|--------|
| P1 | Authorized items without linked parts | Counter exists but no direct "fix this" action | Parts ordering delayed |
| P2 | Pre-pick location not prompted | Field exists but nothing suggests "this part is on order, update location when received" | Parts sit in warehouse untracked |

### Missed Steps (from workflow analysis)

```
Common missed-step patterns:
1. Clock in → do VHC → forget to mark write-up complete → job stuck
2. VHC complete → sent to customer → customer authorizes → nobody orders parts
3. All work done → mileage not recorded → invoice blocked
4. Technician marks VHC complete → 2 of 3 mandatory sections actually filled
5. Red items found → no photo taken → customer disputes finding
6. Parts authorized → parts arrived → pre-pick location never set → tech can't find parts
```

### Unclear States

- **"VHC Complete" vs "VHC Sent"** — techs confuse these; completing sections ≠ sent to customer
- **"Write-up complete" ambiguity** — completion_status vs all checklist tasks checked are separate concepts
- **Parts pipeline visibility** — tech doesn't know if parts are ordered, arrived, or pre-picked
- **"What's blocking invoice?"** — the answer exists in selectors.js but isn't surfaced in a clear, clickable format

---

## 2. Feature Concept: **Job Flow Assistant**

A **unified, context-aware assistant strip** that replaces the current fragmented guidance with a single, persistent component visible on every relevant page. It understands the *entire* job lifecycle — not just VHC — and gives role-specific, actionable next steps.

### Core Principles

1. **One assistant, full lifecycle** — covers clocking → VHC → write-up → parts → approvals → invoice
2. **Role-aware** — shows different guidance to technicians vs service advisors vs parts desk
3. **Actionable, not informational** — every message includes a verb and a target ("Add labour to 2 red items in VHC tab")
4. **Progressive disclosure** — compact strip by default, expandable for details
5. **Non-blocking but persistent** — always visible, never a modal

### What It Replaces / Unifies

| Current | Proposed |
|---------|----------|
| `VhcAssistantPanel` (VHC tab only) | Unified assistant covers VHC + everything else |
| `JobWorkflowAssistantCard` (job card header) | Merged into the same component with richer logic |
| `getNextBestAction()` (single next action) | Multi-step checklist with priorities |
| Separate blocker lists per area | Combined, ranked, actionable blocker list |

---

## 3. Logic Rules

### 3.1 Lifecycle Stages (superset of current)

```
STAGES = {
  // Pre-work
  NOT_CLOCKED_IN:           "Clock in to start work",
  CLOCKED_IN_NO_WORK:      "Begin inspection or write-up",

  // VHC phase
  VHC_NOT_STARTED:          "Start VHC health check",
  VHC_IN_PROGRESS:          "Complete remaining VHC sections",
  VHC_NEEDS_PRICING:        "Add labour/parts to VHC findings",
  VHC_READY_TO_SEND:        "Send VHC to customer",
  VHC_SENT_AWAITING:        "Waiting for customer response",
  VHC_DECISIONS_RECEIVED:   "Process customer decisions",
  VHC_AUTHORISED_WORK:      "Complete authorised VHC work",

  // Write-up phase
  WRITEUP_PENDING:          "Complete write-up tasks",
  WRITEUP_IN_PROGRESS:      "Finish remaining write-up items",

  // Parts phase
  PARTS_NEED_ORDERING:      "Order authorized parts",
  PARTS_ON_ORDER:           "Awaiting parts delivery",
  PARTS_READY_TO_FIT:       "Parts ready — fit and mark complete",

  // Completion phase
  MILEAGE_MISSING:          "Record vehicle mileage",
  READY_FOR_INVOICE:        "All gates clear — ready to invoice",
  INVOICED:                 "Invoice sent — awaiting payment",
  RELEASED:                 "Job complete",
}
```

### 3.2 Rule Engine (Priority-ordered)

Rules are evaluated top-to-bottom. First match wins for "primary action"; all matches populate the checklist.

```javascript
// Rule structure:
{
  id: string,
  priority: number,          // lower = higher priority
  condition: (ctx) => bool,  // evaluated against job + VHC + parts + clocking state
  message: {
    title: string,
    action: string,          // imperative verb phrase
    target: string,          // tab or section to navigate to
    ownerRole: string,       // who should act
    severity: "blocker" | "warning" | "info",
  }
}
```

**Technician rules (myjobs/[jobNumber]):**

| Priority | ID | Condition | Action | Severity |
|----------|----|-----------|--------|----------|
| 10 | `clock-in` | Not clocked in to this job | "Clock in before starting work" | blocker |
| 20 | `vhc-mandatory-sections` | VHC required AND < 3 mandatory sections complete | "Complete {section} — {n} of 3 mandatory sections done" | blocker |
| 25 | `vhc-photo-prompt` | Red item exists without linked photo | "Take a photo of {item} to support the finding" | warning |
| 30 | `vhc-measurement-hint` | Section open AND measurement field empty | "Enter tread depth / pad thickness to auto-calculate severity" | info |
| 40 | `writeup-tasks-pending` | Checklist has unchecked items | "Mark {n} write-up tasks as complete" | blocker |
| 45 | `writeup-not-marked` | All tasks checked but completion_status ≠ complete | "Mark write-up as complete to unblock invoicing" | blocker |
| 50 | `clock-out-reminder` | VHC done + write-up done + still clocked in | "All work complete — clock out" | warning |
| 60 | `parts-location-update` | Authorized part with pre_pick_location = null AND status = "pre_picked" | "Set pre-pick location for {part}" | info |

**Service Advisor rules (job-cards/[jobNumber]):**

| Priority | ID | Condition | Action | Severity |
|----------|----|-----------|--------|----------|
| 10 | `vhc-pricing-gaps` | Red/amber items missing labour_hours or parts_cost | "Add pricing to {n} VHC items before sending" → navigate to VHC tab | blocker |
| 20 | `vhc-send-ready` | All sections complete + all priced + not yet sent | "VHC is ready — send to customer" | info |
| 25 | `vhc-customer-pending` | Sent > 4 hours ago + items still awaiting_customer_decision | "Customer hasn't responded to {n} items — consider follow-up" | warning |
| 30 | `parts-not-linked` | Authorized VHC items with no linked parts_job_items | "Link parts to {n} authorized items" → navigate to Parts tab | blocker |
| 35 | `parts-need-ordering` | Parts in waiting_to_order status | "{n} parts waiting to be ordered" | warning |
| 40 | `mileage-missing` | Mileage not recorded | "Record mileage before invoicing" → navigate to Vehicle section | blocker |
| 50 | `invoice-ready` | All prerequisites met | "All gates clear — create invoice" | info |
| 60 | `invoice-blockers` | Prerequisites not met | Show specific blockers from getInvoiceWorkflowState() | blocker |

### 3.3 Checklist Model

Instead of a single "next best action", the assistant builds a **full checklist** showing all pending items grouped by phase:

```
┌─────────────────────────────────────────────┐
│  Job Flow Assistant                         │
│                                             │
│  ✅ Clocked in                              │
│  ✅ VHC: Wheels & Tyres                     │
│  ✅ VHC: Brakes & Hubs                      │
│  🔲 VHC: Service Indicator  ← YOU ARE HERE  │
│  ○  Write-up tasks (3 remaining)            │
│  ○  Record mileage                          │
│  ○  Invoice readiness                       │
│                                             │
│  ┌─ Next Action ─────────────────────────┐  │
│  │ Complete Service Indicator section     │  │
│  │ Open section →                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ⚠ 1 red item needs a photo                │
│  ⚠ 2 items missing labour pricing           │
└─────────────────────────────────────────────┘
```

### 3.4 Readiness Score (Enhanced)

Keep the existing 0-100% score but extend it to cover the full lifecycle:

```javascript
// Weight distribution (sums to 100):
const WEIGHTS = {
  clocking:    5,   // clocked in
  vhcSections: 20,  // mandatory sections complete
  vhcPricing:  15,  // all red/amber items priced
  vhcSent:     10,  // sent to customer (if required)
  writeUp:     20,  // write-up complete
  parts:       15,  // parts allocated and priced
  mileage:      5,  // mileage recorded
  vhcDecisions: 10, // customer decisions received + acted on
};
```

---

## 4. UI Placement

### 4.1 Technician View — myjobs/[jobNumber]

```
┌──────────────────────────────────────────────────────────┐
│  Header: Job #12345 — AB12 CDE — Ford Focus              │
│  [Clock In/Out]  [Progress: ████████░░ 72%]              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ ASSISTANT STRIP (always visible, top of content) ──┐ │
│  │ ▶ Next: Complete Service Indicator section     [Go →]│ │
│  │   ⚠ 1 red item needs photo  · 72% ready             │ │
│  │   [▾ Show full checklist]                            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ VHC Sections Grid ─────────────────────────────────┐ │
│  │  [✅ Wheels]  [✅ Brakes]  [🔲 Service]              │ │
│  │  [○ External] [○ Internal] [○ Underside]             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Write-Up Section ──────────────────────────────────┐ │
│  │  (write-up form below VHC)                          │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key UI decisions:**
- **Persistent strip** at top of content area (not in a sidebar, not in a tab)
- **Collapsed by default**: one-line showing next action + readiness %
- **Expandable**: click to show full checklist + warnings
- **"Go →" button**: navigates directly to the relevant section/modal
- **Section cards get numbered badges**: "1", "2", "3" for mandatory order

### 4.2 Service Advisor View — job-cards/[jobNumber]

```
┌──────────────────────────────────────────────────────────┐
│  Header: Job #12345                                      │
│  [Status: In Progress]  [Tab bar: Requests | Parts | ...] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ ASSISTANT STRIP (between header and tab content) ──┐ │
│  │ ▶ Next: Add pricing to 2 VHC items     [Go to VHC →]│ │
│  │   Invoice blocked: 3 reasons  · 58% ready            │ │
│  │   [▾ Show details]                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Active Tab Content ────────────────────────────────┐ │
│  │  (whatever tab is selected)                         │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key UI decisions:**
- Same persistent strip pattern as tech view
- **Tab-aware**: "Go →" button switches to the relevant tab
- **Blocker list** is expandable and each blocker has a clickable link to the tab that resolves it
- Replaces current `JobWorkflowAssistantCard` position
- **Customer follow-up nudge**: appears 4+ hours after VHC sent with no response

### 4.3 Shared Assistant Strip Component

```
Props:
  - stage: current lifecycle stage
  - checklist: array of { id, label, status: "done"|"current"|"pending"|"blocked" }
  - nextAction: { title, action, targetTab?, targetSection?, severity }
  - warnings: array of { message, severity }
  - readinessScore: number 0-100
  - compact: boolean (default true = collapsed strip)
  - onNavigate: (targetTab, targetSection) => void
```

### 4.4 VHC Section Ordering (New)

Add numbered indicators to the section grid to guide techs through in order:

```
Recommended order (by dependency):
1. Wheels & Tyres       ← mandatory, quick measurements
2. Brakes & Hubs        ← mandatory, measurements feed severity
3. Service Indicator    ← mandatory, oil/service status
4. External             ← optional, visual inspection
5. Internal / Electrics ← optional, cabin inspection
6. Underside            ← optional, lift required
```

Show as numbered badges on the section cards. Grey out optional sections until all 3 mandatory are done (soft guidance, not hard lock).

---

## 5. Implementation Plan

### Phase 1: Core Assistant Engine (foundation)

**Files to create:**
- `src/features/job-assistant/buildJobAssistantState.js` — unified state builder (replaces separate VHC + job selectors)
- `src/features/job-assistant/assistantRules.js` — rule definitions with priorities
- `src/features/job-assistant/evaluateRules.js` — rule engine evaluator
- `src/features/job-assistant/assistantChecklist.js` — builds ordered checklist from job state

**Files to modify:**
- `src/features/jobCards/workflow/selectors.js` — extract shared logic, keep as dependency

**Key decisions:**
- Keep `buildVhcAssistantState` as-is for now; the new engine *wraps* it and adds job-level context
- Pure functions, no React — fully testable
- Input: full job data object (same shape as `useJob()` returns)
- Output: `{ stage, checklist, nextAction, warnings, readinessScore, blockers }`

### Phase 2: Assistant Strip UI Component

**Files to create:**
- `src/features/job-assistant/components/JobAssistantStrip.js` — the shared UI component
- `src/features/job-assistant/components/AssistantChecklist.js` — expandable checklist
- `src/features/job-assistant/components/AssistantWarning.js` — warning badge

**Design tokens:** Use existing CSS variables (no new design tokens needed)

### Phase 3: Integrate into Technician View

**Files to modify:**
- `src/pages/job-cards/myjobs/[jobNumber].js`:
  - Import `JobAssistantStrip`
  - Replace `VhcAssistantPanel` with unified strip
  - Add section ordering badges to VHC grid
  - Wire `onNavigate` to open relevant section modals
  - Add clock-in/out awareness to assistant state

### Phase 4: Integrate into Service Advisor View

**Files to modify:**
- `src/pages/job-cards/[jobNumber].js`:
  - Import `JobAssistantStrip`
  - Replace `JobWorkflowAssistantCard` with unified strip
  - Wire `onNavigate` to switch tabs
  - Add customer follow-up timer logic

### Phase 5: Photo Prompts & Smart Hints

**Files to create:**
- `src/features/job-assistant/photoPromptRules.js` — rules for when to prompt camera

**Files to modify:**
- VHC section modals — add "take photo" prompt when red item detected
- `VhcCameraButton` — highlight when assistant recommends a photo

### Phase 6: Testing & Refinement

- Unit tests for rule engine against edge cases
- Test with real job data snapshots (completed jobs, stuck jobs, edge cases)
- Verify backward compatibility: old `VhcAssistantPanel` and `JobWorkflowAssistantCard` still work if feature flag is off

### Migration Strategy

- **Feature flag**: `NEXT_PUBLIC_UNIFIED_ASSISTANT=true`
- When flag is off: existing components render as-is
- When flag is on: unified strip replaces both existing assistants
- After validation: remove old components and flag

### Dependency Order

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──┐
                        Phase 4 ──┤──→ Phase 6
                        Phase 5 ──┘
```

Phases 3, 4, 5 can be done in parallel after Phase 2 is complete.

---

## 6. Summary

| Dimension | Current | Proposed |
|-----------|---------|----------|
| Scope | VHC-only + separate job-level card | Full lifecycle: clock → VHC → write-up → parts → invoice |
| Guidance | Single "next best action" string | Ordered checklist + ranked warnings + "Go to" navigation |
| Placement | Inside VHC tab (VhcAssistantPanel) + job header (WorkflowAssistantCard) | Persistent strip between header and content on both views |
| Role awareness | Minimal (ownerRole label) | Different rule sets per role, different checklist items |
| Actionability | Text-only messages | Each item has a navigation target (tab, section, modal) |
| Photo prompts | None | Contextual "take photo" prompts for red findings |
| Section ordering | Unordered grid | Numbered sequence with soft gating |
| Follow-up | None | Timer-based customer follow-up nudges |
