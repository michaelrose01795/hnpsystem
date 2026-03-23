# Job Card `[jobNumber]` Workflow Architecture

## Scope
This document describes the centralized workflow + permission model used by `src/pages/job-cards/[jobNumber].js`.

## Core Files
- `src/pages/job-cards/[jobNumber].js`
  - Route-level orchestrator.
  - Owns page state, primary refresh contract, tab rendering, and callback wiring.
- `src/features/jobCards/workflow/permissions.js`
  - Centralized role/status-based permission and lock model.
- `src/features/jobCards/workflow/selectors.js`
  - Shared workflow derivations (write-up completion, invoice blockers, next best action output).
- `src/features/jobCards/components/JobWorkflowAssistantCard.js`
  - Deterministic workflow guidance UI.
- `src/features/jobCards/components/JobWorkflowDiagnostics.js`
  - Dev-only computed state diagnostics.

## Cross-tab Workflow Dependencies
1. Customer Requests -> Write-Up
   - Request rows seed write-up task checklist and task status updates.
2. Write-Up -> VHC
   - VHC-linked write-up toggles sync VHC item completion/authorization state.
3. VHC -> Parts/Invoice
   - VHC completion and summary decisions influence invoice readiness.
4. Parts -> Invoice
   - Parts allocation and pricing validation are invoice blockers.
5. Mileage -> Invoice
   - Mileage must be recorded before invoice readiness.
6. Main Status -> Edit Locks
   - Status transitions (booked/checked-in/in-progress/invoiced/released) control editability.

## Shared Permission Model
`resolveJobCardPermissions()` returns:
- `canEdit`, `canEditPartsWriteUpVhc`, `canManageDocuments`
- `canViewPartsTab`, `canViewVhcTab`
- `isInvoiceOrBeyondReadOnly`, `isPartsWriteUpVhcLockedByStatus`, `isClockingLockedByStatus`
- `lockedTabIds`
- lock reason strings for consistent messaging
- base tab definitions for valet vs standard mode

This reduces scattered role/status checks and keeps lock behaviour consistent.

## Shared Workflow Selector Layer
`selectors.js` centralizes pure derivations:
- `getWriteUpCompletionState()`
- `getInvoiceWorkflowState()`
- `getNextBestAction()`

These outputs are consumed by the route shell to avoid duplicating blocker/readiness logic in multiple places.

## Refresh/Revalidation Contract
Authoritative refresh remains at page level:
- `fetchJobData()` is the parent source of truth refresh path.
- Child tabs receive parent callbacks (e.g., `onRefreshJob`, `onJobDataRefresh`) to request refresh.
- Parent realtime subscriptions continue to trigger throttled background refresh.

## Assistant Feature (Deterministic)
The assistant card is **rule-based** and uses existing page data:
- write-up completion
- VHC readiness
- parts readiness/allocation
- mileage presence
- invoice blocker list
- current lock/edit state

Outputs:
- one top next action
- suggested owner role
- reason text
- current blockers
- compact workflow state badges

## Diagnostics
`JobWorkflowDiagnostics` is rendered in development only (`NODE_ENV !== production`).
It prints computed workflow state to simplify future debugging and reduce regression risk.
