# Job Card VHC Tab — Master Analysis Prompt

You are auditing the **VHC tab behavior inside `src/pages/job-cards/[jobNumber].js`** in a Next.js Dealer Management System.

Your task is to produce a **complete, implementation-accurate functional specification** of everything the VHC tab does.

## Scope (must cover all of this)
1. **VHC tab shell integration inside job card page**
   - How the VHC tab appears in tab navigation.
   - Badge behavior (e.g., warning indicators).
   - Visual tab state/highlighting (default, warning, complete).
   - Tab lock/read-only messaging and when VHC becomes non-editable.
   - Conditions that gate whether VHC actions are interactive.

2. **`VHCTab` component behavior on the job card page**
   - Every prop passed from job card page into `VHCTab` and why.
   - Logic for:
     - `canShowCustomerActions`
     - `hasAwaitingCustomerDecision`
     - `actionsEnabled` (checkbox completion dependency)
     - `previewOpened` persistence via localStorage
   - Customer-facing actions:
     - “View VHC” behavior
     - “Copy Link” behavior, endpoint called, and 24-hour share link behavior
     - “Send to Customer” behavior and payload sent
     - Success/error status messaging UX

3. **`VhcDetailsPanel` capabilities used by this tab**
   - Internal VHC sub-tabs enabled by `enableTabs` and what each is for:
     - Summary
     - Parts Identified
     - Parts Authorised
     - Photos
   - Data loading flow (job, checks, parts, files) and realtime refresh behavior.
   - How approval statuses are interpreted (authorized/declined/awaiting/completed etc.).
   - How VHC items are linked to parts rows.
   - Financial totals logic and how totals are pushed back up to parent page.
   - Checkbox-completion callback contract and lock reason callback.
   - Any domain-specific sections (e.g., wheels/tyres, brakes/hubs, service indicator) that materially affect VHC outcomes.

4. **Cross-tab / workflow implications within job card**
   - How VHC completion affects:
     - Job-level completion markers
     - Summary cards (declined/authorised financial cards)
     - Tab tone/badges
     - Invoice readiness or other workflow checks
   - Whether VHC actions can create or update records that Parts or Invoice views depend on.

5. **API and persistence map**
   - Enumerate all VHC-related API calls triggered from this context, including route paths and purpose.
   - Enumerate all key persisted fields/states touched (examples: approval state, labour/parts completion flags, vhc required/completed timestamps, share link state).

## Output format (mandatory)
Use these sections exactly:

1. **Executive Summary** (5–10 bullets)
2. **User Journey Through the VHC Tab** (step-by-step)
3. **Detailed Behavior Matrix** (table with columns: Trigger, Condition, Action, Data Written, UI Feedback)
4. **State & Permissions Model**
5. **API Endpoints and Payloads**
6. **Data Model Fields Referenced/Updated**
7. **Edge Cases & Failure Handling**
8. **Dependencies on Other Job Card Tabs / Workflow**
9. **Test Checklist** (practical manual QA scenarios)
10. **Unknowns / Assumptions** (explicitly call out anything inferred)

## Quality bar
- Be concrete and implementation-faithful.
- Distinguish clearly between **observed in code** vs **inferred behavior**.
- Do not hand-wave; include practical detail (conditions, flags, callbacks, endpoints, statuses).
- If there are multiple statuses/aliases for approval or severity, list all observed forms.
