# VHC Status Surfaces

## VHC summary + health check UI
- `src/components/VHC/VhcDetailsPanel.js` - summary tables and health check cards; uses `vhc_checks.approval_status`, `display_status`, `labour_complete`, `parts_complete`, plus VHC builder payload severity.
- `src/components/VHC/VhcSharedComponents.js` - severity badge styling for red/amber/green/authorized/declined.

## Section modals (status capture)
- `src/components/VHC/WheelsTyresDetailsModal.js` - concern statuses (Red/Amber/Green) and tread-derived severity for tyres; provides diagram severity.
- `src/components/VHC/BrakesHubsDetailsModal.js` - pad/disc/drum statuses and concerns; maps to diagram severity and builder payload values.
- `src/components/VHC/ServiceIndicatorDetailsModal.js` - service choice, oil status, and concern statuses (Red/Amber/Green).
- `src/components/VHC/ExternalDetailsModal.js` - concern statuses (Red/Amber/Green).
- `src/components/VHC/InternalElectricsDetailsModal.js` - concern statuses (Red/Amber/Green).
- `src/components/VHC/UndersideDetailsModal.js` - concern statuses (Red/Amber/Green).

## Diagram status rendering
- `src/components/VHC/TyreDiagram.js` - converts tread depth into `danger/advisory/good/unknown` statuses for diagram fill.
- `src/components/VHC/BrakeDiagram.js` - converts pad thickness into `critical/advisory/good/unknown` statuses for diagram fill.

## Job card + parts surfaces
- `src/pages/job-cards/[jobNumber].js` - resolves VHC severity from checks; shows highlighted red/amber items.
- `src/components/PartsTab_New.js` - pulls VHC check titles/descriptions when building job parts descriptions.
- `src/components/popups/InvoiceBuilderPopup.js` - labels parts/VHC items by origin (VHC link).
- `src/pages/stock-catalogue.js` - displays VHC item ID badge when parts are linked to VHC.

## Status snapshot + workflow views
- `src/lib/status/jobStatusSnapshot.js` - derives `workflows.vhc.status` from job timestamps and authorization/declination history.
- `src/components/StatusTracking/StatusSidebar.js` - renders workflow snapshot status data from `/api/status/snapshot`.
- `src/lib/status/catalog/timeline.js` - maps VHC sub-status labels to timeline events.
- `src/lib/status/catalog/job.js` - includes `vhc_*` sub-status ids in job status catalog.

## VHC totals + summary logic
- `src/lib/vhc/summary.js` - builds section-level status/metrics from VHC builder payload.
- `src/lib/vhc/calculateVhcTotals.js` - reads `approval_status` and `display_status` for totals.

## Customer portal
- `src/customers/hooks/useCustomerPortalData.js` - reads `vhc_workflow_status.status`, counts, and timestamps for customer-facing VHC summary.

## Dashboards
- `src/lib/database/dashboard/service.js` - uses `vhc_checks` to build weekly severity trends.
- `src/components/dashboards/AfterSalesManagerDashboard.js` - counts VHC sent events by `vhc_sent_at` / send history.
