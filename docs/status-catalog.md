# Status Catalog

## active

Status Name: Active
Application Context: Account status stored on accounts. | Employee status used in HR directory filters.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; HR/management users with access to HR pages; no explicit role gate in code.
Page Location: src/components/accounts/AccountTable.js, src/config/accounts.js, src/pages/hr/employees/index.js

## additional_work

Status Name: additional_work
Application Context: Write-up completion status in job_writeups.completion_status and status snapshot. | Write-up task and job request status in job_writeup_tasks.status and job_requests.status.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/lib/database/jobs.js, src/lib/status/jobStatusSnapshot.js, src/pages/job-cards/myjobs/[jobNumber].js

## additional_work_being_carried_out

Status Name: additional_work_being_carried_out
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## additional_work_required

Status Name: additional_work_required
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## advisory

Status Name: advisory
Application Context: Brake reading status used in VHC brake diagram. | Tyre reading status used in VHC tyre diagram.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakeDiagram.js, src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/TyreDiagram.js, src/components/VHC/WheelsTyresDetailsModal.js

## allocated

Status Name: allocated
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## amber

Status Name: amber
Application Context: VHC concern severity used in inspection modals. | VHC item display_status stored on vhc_checks.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/ExternalDetailsModal.js, src/components/VHC/ServiceIndicatorDetailsModal.js, src/components/VHC/VhcDetailsPanel.js, src/components/VHC/WheelsTyresDetailsModal.js, src/lib/database/schema/schemaReference.sql, src/pages/api/vhc/update-item-status.js

## appointment_booked

Status Name: appointment_booked
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## approved

Status Name: approved
Application Context: Booking request lifecycle status stored in job_booking_requests.status. | Leave approval status derived from hr_absences.approval_status.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.; Job card editors; access not explicitly enforced beyond page access.
Page Location: src/lib/database/hr.js, src/pages/api/job-cards/[jobNumber]/booking-request.js, src/pages/job-cards/[jobNumber].js

## assigned_to_tech

Status Name: assigned_to_tech
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## authorised

Status Name: authorised
Application Context: Derived VHC workflow status in status snapshot (workflows.vhc.status).
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/lib/status/jobStatusSnapshot.js

## authorized

Status Name: authorized
Application Context: VHC item approval_status stored on vhc_checks. | VHC item display_status stored on vhc_checks.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/VhcDetailsPanel.js, src/lib/database/schema/schemaReference.sql, src/pages/api/vhc/update-item-status.js

## awaiting-advisor

Status Name: Awaiting Advisor
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## awaiting-authorization

Status Name: Awaiting Authorization
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## awaiting-workshop

Status Name: Awaiting Workshop
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## awaiting_stock

Status Name: awaiting_stock
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## bad

Status Name: Bad
Application Context: Oil status stored in VHC service indicator modal data.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/ServiceIndicatorDetailsModal.js

## being_valeted

Status Name: being_valeted
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## being_washed

Status Name: being_washed
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## blocked

Status Name: blocked
Application Context: Derived parts workflow status in job status snapshot (workflows.parts.status).
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/jobStatusSnapshot.js

## booked

Status Name: booked
Application Context: Appointment status stored in appointments.status for job bookings. | Main job status stored in jobs.status and shown in status timeline and job card dropdowns. | Parts order status in parts order detail view.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/view/index.js, src/pages/parts/create-order/[orderNumber].js

## busy

Status Name: busy
Application Context: Delivery planner load status derived from job/quantity counts.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/delivery-planner.js

## cancelled

Status Name: cancelled
Application Context: Appointment status stored in appointments.status for job bookings. | Invoice payment_status values used in accounts UI. | Legacy jobs.status value normalized by statusFlow to main or sub-statuses. | Parts order invoice status in parts order detail view. | Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; Job card editors; access not explicitly enforced beyond page access.; Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/accounts/InvoiceTable.js, src/config/accounts.js, src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/lib/status/statusFlow.js, src/pages/company-accounts/[accountNumber].js, src/pages/job-cards/[jobNumber].js, src/pages/parts/create-order/[orderNumber].js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## checked_in

Status Name: checked_in
Application Context: Appointment status stored in appointments.status for job bookings. | Main job status stored in jobs.status and shown in status timeline and job card dropdowns.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/view/index.js

## closed

Status Name: Closed
Application Context: Account status stored on accounts.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.
Page Location: src/components/accounts/AccountTable.js, src/config/accounts.js

## collected

Status Name: collected
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## collection

Status Name: Collection
Application Context: Customer waiting status stored in jobs.waiting_status and job_customer_statuses.customer_status.
Role Access: Job card editors; access not explicitly enforced beyond page access.
Page Location: src/pages/job-cards/[jobNumber].js, src/pages/job-cards/create/index.js, src/pages/job-cards/view/index.js, src/pages/job-cards/waiting/nextjobs.js

## coming-up

Status Name: Coming Up
Application Context: Consumables schedule status in the consumables tracker.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/pages/api/workshop/consumables/requests.js, src/pages/workshop/consumables-tracker.js

## complete

Status Name: complete
Application Context: Main job status stored in jobs.status and shown in status timeline and job card dropdowns. | Parts order status in parts order detail view. | Vehicle tracking status shown in tracking dashboard. | Write-up completion status in job_writeups.completion_status and status snapshot. | Write-up task and job request status in job_writeup_tasks.status and job_requests.status.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Users with access to tracking page; no explicit role gate in code.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/database/jobs.js, src/lib/database/tracking.js, src/lib/status/jobStatusSnapshot.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/myjobs/[jobNumber].js, src/pages/job-cards/view/index.js, src/pages/parts/create-order/[orderNumber].js, src/pages/tracking/index.js

## completed

Status Name: completed
Application Context: Appointment status stored in appointments.status for job bookings. | Derived VHC workflow status in status snapshot (workflows.vhc.status). | Leave approval status derived from hr_absences.approval_status. | Legacy jobs.status value normalized by statusFlow to main or sub-statuses. | Parts delivery planner job status for delivery runs. | VHC item approval_status stored on vhc_checks. | VHC item display_status stored on vhc_checks.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.; Job card editors; access not explicitly enforced beyond page access.; Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/VHC/VhcDetailsPanel.js, src/lib/database/hr.js, src/lib/database/schema/schemaReference.sql, src/lib/status/jobStatusSnapshot.js, src/lib/status/statusFlow.js, src/pages/api/vhc/update-item-status.js, src/pages/job-cards/[jobNumber].js, src/pages/parts/delivery-planner.js

## confirmed

Status Name: confirmed
Application Context: Appointment status stored in appointments.status for job bookings.
Role Access: Job card editors; access not explicitly enforced beyond page access.
Page Location: src/pages/job-cards/[jobNumber].js

## critical

Status Name: critical
Application Context: Brake reading status used in VHC brake diagram.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakeDiagram.js, src/components/VHC/BrakesHubsDetailsModal.js

## customer_arrived

Status Name: customer_arrived
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## customer_authorised

Status Name: customer_authorised
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## customer_checkin_pending

Status Name: customer_checkin_pending
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## customer_declined

Status Name: customer_declined
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## danger

Status Name: danger
Application Context: Tyre reading status used in VHC tyre diagram.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/TyreDiagram.js, src/components/VHC/WheelsTyresDetailsModal.js

## declined

Status Name: declined
Application Context: Derived VHC workflow status in status snapshot (workflows.vhc.status). | VHC item approval_status stored on vhc_checks. | VHC item display_status stored on vhc_checks.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/VHC/VhcDetailsPanel.js, src/lib/database/schema/schemaReference.sql, src/lib/status/jobStatusSnapshot.js, src/pages/api/vhc/update-item-status.js

## delivered

Status Name: delivered
Application Context: Parts order delivery_status in parts order detail view.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/create-order/[orderNumber].js

## delivered_to_customer

Status Name: delivered_to_customer
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## dispatched

Status Name: dispatched
Application Context: Parts order delivery_status in parts order detail view.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/create-order/[orderNumber].js

## draft

Status Name: draft
Application Context: Invoice payment_status values used in accounts UI. | Parts order invoice status in parts order detail view. | Parts order status in parts order detail view.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/components/accounts/InvoiceTable.js, src/config/accounts.js, src/pages/company-accounts/[accountNumber].js, src/pages/parts/create-order/[orderNumber].js

## en_route

Status Name: en_route
Application Context: Parts delivery planner job status for delivery runs.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/delivery-planner.js

## ev

Status Name: EV
Application Context: Oil status stored in VHC service indicator modal data.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/ServiceIndicatorDetailsModal.js

## fail

Status Name: fail
Application Context: MOT completion_status values used for MOT dashboard filtering.
Role Access: MOT/workshop users with dashboard access.
Page Location: src/lib/database/dashboard/mot.js, src/pages/dashboard/mot/index.js

## fitted

Status Name: fitted
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## frozen

Status Name: Frozen
Application Context: Account status stored on accounts.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.
Page Location: src/components/accounts/AccountTable.js, src/config/accounts.js

## full

Status Name: full
Application Context: Delivery planner load status derived from job/quantity counts.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/delivery-planner.js

## good

Status Name: good
Application Context: Brake reading status used in VHC brake diagram. | Oil status stored in VHC service indicator modal data. | Tyre reading status used in VHC tyre diagram.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakeDiagram.js, src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/ServiceIndicatorDetailsModal.js, src/components/VHC/TyreDiagram.js, src/components/VHC/WheelsTyresDetailsModal.js

## green

Status Name: green
Application Context: VHC concern severity used in inspection modals. | VHC item display_status stored on vhc_checks.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/ExternalDetailsModal.js, src/components/VHC/ServiceIndicatorDetailsModal.js, src/components/VHC/VhcDetailsPanel.js, src/components/VHC/WheelsTyresDetailsModal.js, src/lib/database/schema/schemaReference.sql, src/pages/api/vhc/update-item-status.js

## in-progress

Status Name: In Progress
Application Context: Technician clocking status in user context and clocking views.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/Layout.js, src/context/UserContext.js, src/pages/clocking/[technicianSlug].js, src/pages/clocking/index.js

## in-transit

Status Name: In Transit
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## in-workshop

Status Name: In Workshop
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## in_mot

Status Name: in_mot
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## in_progress

Status Name: in_progress
Application Context: Derived VHC workflow status in status snapshot (workflows.vhc.status). | Derived parts workflow status in job status snapshot (workflows.parts.status). | Main job status stored in jobs.status and shown in status timeline and job card dropdowns.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/status/jobStatusSnapshot.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/view/index.js

## indicator_on

Status Name: indicator_on
Application Context: Service indicator status stored in VHC service indicator modal data.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/ServiceIndicatorDetailsModal.js

## inprogress

Status Name: inprogress
Application Context: Write-up task and job request status in job_writeup_tasks.status and job_requests.status.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/lib/database/jobs.js

## invoiced

Status Name: invoiced
Application Context: Main job status stored in jobs.status and shown in status timeline and job card dropdowns.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/view/index.js

## invoicing

Status Name: invoicing
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## issued

Status Name: issued
Application Context: Parts order invoice status in parts order detail view.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/create-order/[orderNumber].js

## job_accepted

Status Name: job_accepted
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## light

Status Name: light
Application Context: Delivery planner load status derived from job/quantity counts.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/pages/parts/delivery-planner.js

## loan-car

Status Name: Loan Car
Application Context: Customer waiting status stored in jobs.waiting_status and job_customer_statuses.customer_status.
Role Access: Job card editors; access not explicitly enforced beyond page access.
Page Location: src/pages/job-cards/[jobNumber].js, src/pages/job-cards/create/index.js, src/pages/job-cards/view/index.js, src/pages/job-cards/waiting/nextjobs.js

## missing

Status Name: missing
Application Context: Derived invoice workflow status in job status snapshot when no invoice exists. | Write-up completion status in job_writeups.completion_status and status snapshot.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/lib/database/jobs.js, src/lib/status/jobStatusSnapshot.js, src/pages/job-cards/myjobs/[jobNumber].js

## neither

Status Name: Neither
Application Context: Customer waiting status stored in jobs.waiting_status and job_customer_statuses.customer_status.
Role Access: Job card editors; access not explicitly enforced beyond page access.
Page Location: src/pages/job-cards/[jobNumber].js, src/pages/job-cards/create/index.js, src/pages/job-cards/view/index.js, src/pages/job-cards/waiting/nextjobs.js

## no_reminder

Status Name: no_reminder
Application Context: Service indicator status stored in VHC service indicator modal data.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/ServiceIndicatorDetailsModal.js

## none

Status Name: none
Application Context: Derived parts workflow status in job status snapshot (workflows.parts.status).
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/jobStatusSnapshot.js

## not-clocked-in

Status Name: Not Clocked In
Application Context: Technician clocking status in user context and clocking views.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/Layout.js, src/context/UserContext.js, src/pages/clocking/[technicianSlug].js, src/pages/clocking/index.js

## not-required

Status Name: Not Required
Application Context: Consumables schedule status in the consumables tracker.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/pages/api/workshop/consumables/requests.js, src/pages/workshop/consumables-tracker.js

## not_required

Status Name: not_required
Application Context: Derived VHC workflow status in status snapshot (workflows.vhc.status). | Service indicator status stored in VHC service indicator modal data.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/VHC/ServiceIndicatorDetailsModal.js, src/lib/status/jobStatusSnapshot.js

## on-leave

Status Name: On leave
Application Context: Employee status used in HR directory filters.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.
Page Location: src/pages/hr/employees/index.js

## on_order

Status Name: on_order
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## open

Status Name: open
Application Context: Main job status stored in jobs.status and shown in status timeline and job card dropdowns.
Role Access: Job card editors; access not explicitly enforced beyond page access.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/StatusTracking/StatusTimeline.js, src/lib/status/statusFlow.js, src/pages/job-cards/[jobNumber].js, src/pages/job-cards/view/index.js

## ordered

Status Name: ordered
Application Context: Consumables request status in consumables tracker and API.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/pages/api/workshop/consumables/requests.js, src/pages/workshop/consumables-tracker.js

## overdue

Status Name: Overdue
Application Context: Consumables schedule status in the consumables tracker. | Invoice payment_status values used in accounts UI.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/accounts/InvoiceTable.js, src/config/accounts.js, src/pages/api/workshop/consumables/requests.js, src/pages/company-accounts/[accountNumber].js, src/pages/workshop/consumables-tracker.js

## paid

Status Name: paid
Application Context: Invoice payment_status values used in accounts UI. | Parts order invoice status in parts order detail view.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/components/accounts/InvoiceTable.js, src/config/accounts.js, src/pages/company-accounts/[accountNumber].js, src/pages/parts/create-order/[orderNumber].js

## parts_arrived

Status Name: parts_arrived
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## parts_ready

Status Name: parts_ready
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## pass

Status Name: pass
Application Context: MOT completion_status values used for MOT dashboard filtering.
Role Access: MOT/workshop users with dashboard access.
Page Location: src/lib/database/dashboard/mot.js, src/pages/dashboard/mot/index.js

## pending

Status Name: pending
Application Context: Booking request lifecycle status stored in job_booking_requests.status. | Consumables request status in consumables tracker and API. | Derived VHC workflow status in status snapshot (workflows.vhc.status). | Leave approval status derived from hr_absences.approval_status. | Parts order delivery_status in parts order detail view. | Parts request/job item status stored in parts_requests.status and parts_job_items.status. | VHC item approval_status stored on vhc_checks.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.; Job card editors; access not explicitly enforced beyond page access.; Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Users with access to VHC panels (technicians/service); no explicit role gate in code.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/VHC/VhcDetailsPanel.js, src/lib/database/hr.js, src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/lib/status/jobStatusSnapshot.js, src/pages/api/job-cards/[jobNumber]/booking-request.js, src/pages/api/vhc/update-item-status.js, src/pages/api/workshop/consumables/requests.js, src/pages/job-cards/[jobNumber].js, src/pages/parts/create-order/[orderNumber].js, src/pages/parts/manager.js, src/pages/stock-catalogue.js, src/pages/workshop/consumables-tracker.js

## picked

Status Name: picked
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## pre_picked

Status Name: pre_picked
Application Context: Derived parts workflow status in job status snapshot (workflows.parts.status). | Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/lib/status/jobStatusSnapshot.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## pricing_completed

Status Name: pricing_completed
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## raise_tsr

Status Name: raise_tsr
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## ready

Status Name: ready
Application Context: Derived parts workflow status in job status snapshot (workflows.parts.status). | Parts order status in parts order detail view.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/jobStatusSnapshot.js, src/pages/parts/create-order/[orderNumber].js

## ready-for-collection

Status Name: Ready For Collection
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## ready-for-release

Status Name: Ready For Release
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## ready_for_invoice

Status Name: ready_for_invoice
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## ready_for_release

Status Name: ready_for_release
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## ready_for_valet

Status Name: ready_for_valet
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## red

Status Name: red
Application Context: VHC concern severity used in inspection modals. | VHC item display_status stored on vhc_checks.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/ExternalDetailsModal.js, src/components/VHC/ServiceIndicatorDetailsModal.js, src/components/VHC/VhcDetailsPanel.js, src/components/VHC/WheelsTyresDetailsModal.js, src/lib/database/schema/schemaReference.sql, src/pages/api/vhc/update-item-status.js

## rejected

Status Name: rejected
Application Context: Consumables request status in consumables tracker and API. | Leave approval status derived from hr_absences.approval_status.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/lib/database/hr.js, src/pages/api/workshop/consumables/requests.js, src/pages/workshop/consumables-tracker.js

## released

Status Name: released
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## reset

Status Name: reset
Application Context: Service indicator status stored in VHC service indicator modal data.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/ServiceIndicatorDetailsModal.js

## resigned

Status Name: Resigned
Application Context: Employee status used in HR directory filters.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.
Page Location: src/pages/hr/employees/index.js

## retail_parts_on_order

Status Name: retail_parts_on_order
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## retest

Status Name: retest
Application Context: MOT completion_status values used for MOT dashboard filtering.
Role Access: MOT/workshop users with dashboard access.
Page Location: src/lib/database/dashboard/mot.js, src/pages/dashboard/mot/index.js

## scheduled

Status Name: scheduled
Application Context: Leave approval status derived from hr_absences.approval_status. | Parts delivery planner job status for delivery runs. | Parts order delivery_status in parts order detail view.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.; Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/hr.js, src/pages/parts/create-order/[orderNumber].js, src/pages/parts/delivery-planner.js

## sent

Status Name: sent
Application Context: Derived VHC workflow status in status snapshot (workflows.vhc.status). | Invoice payment_status values used in accounts UI.
Role Access: Accounts/finance users with access to accounts pages; no explicit role gate in code.; Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/StatusSidebar.js, src/components/accounts/InvoiceTable.js, src/config/accounts.js, src/lib/status/jobStatusSnapshot.js, src/pages/company-accounts/[accountNumber].js

## sent_to_customer

Status Name: sent_to_customer
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## stock

Status Name: stock
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## tea-break

Status Name: Tea Break
Application Context: Technician clocking status in user context and clocking views.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/Layout.js, src/context/UserContext.js, src/pages/clocking/[technicianSlug].js, src/pages/clocking/index.js

## tea_break

Status Name: tea_break
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## tech_complete

Status Name: tech_complete
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses. | Technician completion marker stored in jobs.tech_completion_status.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.; Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/lib/status/statusFlow.js, src/pages/job-cards/myjobs/[jobNumber].js

## tech_done

Status Name: tech_done
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## technician_started

Status Name: technician_started
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## technician_work_completed

Status Name: technician_work_completed
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## terminated

Status Name: Terminated
Application Context: Employee status used in HR directory filters.
Role Access: HR/management users with access to HR pages; no explicit role gate in code.
Page Location: src/pages/hr/employees/index.js

## unknown

Status Name: unknown
Application Context: Brake reading status used in VHC brake diagram. | Tyre reading status used in VHC tyre diagram.
Role Access: Users with access to VHC panels (technicians/service); no explicit role gate in code.
Page Location: src/components/VHC/BrakeDiagram.js, src/components/VHC/BrakesHubsDetailsModal.js, src/components/VHC/TyreDiagram.js, src/components/VHC/WheelsTyresDetailsModal.js

## urgent

Status Name: urgent
Application Context: Consumables request status in consumables tracker and API.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/pages/api/workshop/consumables/requests.js, src/pages/workshop/consumables-tracker.js

## valet-hold

Status Name: Valet Hold
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## valet_complete

Status Name: valet_complete
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_approved

Status Name: vhc_approved
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_complete

Status Name: vhc_complete
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_completed

Status Name: vhc_completed
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## vhc_declined

Status Name: vhc_declined
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_in_progress

Status Name: vhc_in_progress
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_priced

Status Name: vhc_priced
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_reopened

Status Name: vhc_reopened
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## vhc_sent

Status Name: vhc_sent
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_sent_to_customer

Status Name: vhc_sent_to_customer
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_sent_to_service

Status Name: vhc_sent_to_service
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## vhc_started

Status Name: vhc_started
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## vhc_waiting

Status Name: vhc_waiting
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## waiting

Status Name: Waiting
Application Context: Customer waiting status stored in jobs.waiting_status and job_customer_statuses.customer_status.
Role Access: Job card editors; access not explicitly enforced beyond page access.
Page Location: src/pages/job-cards/[jobNumber].js, src/pages/job-cards/create/index.js, src/pages/job-cards/view/index.js, src/pages/job-cards/waiting/nextjobs.js

## waiting-for-collection

Status Name: Waiting For Collection
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## waiting-for-job

Status Name: Waiting for Job
Application Context: Technician clocking status in user context and clocking views.
Role Access: Workshop users with access to consumables/clocking pages; role checks only for UI hints.
Page Location: src/components/Layout.js, src/context/UserContext.js, src/pages/clocking/[technicianSlug].js, src/pages/clocking/index.js

## waiting_authorisation

Status Name: waiting_authorisation
Application Context: Parts request/job item status stored in parts_requests.status and parts_job_items.status.
Role Access: Parts/workshop users with access to parts pages; no explicit role gate in code.
Page Location: src/lib/database/schema/schemaReference.sql, src/lib/partsPipeline.js, src/pages/parts/manager.js, src/pages/stock-catalogue.js

## waiting_for_parts

Status Name: waiting_for_parts
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## waiting_for_pricing

Status Name: waiting_for_pricing
Application Context: Job sub-status timeline entry recorded in job_status_history.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/components/StatusTracking/JobProgressTracker.js, src/components/StatusTracking/StatusSidebar.js, src/lib/status/statusFlow.js, src/pages/api/status/getHistory.js

## waiting_for_tsr_response

Status Name: waiting_for_tsr_response
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## warranty_parts_on_order

Status Name: warranty_parts_on_order
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## warranty_quality_control

Status Name: warranty_quality_control
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## warranty_ready_to_claim

Status Name: warranty_ready_to_claim
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## wash

Status Name: Wash
Application Context: Vehicle tracking status shown in tracking dashboard.
Role Access: Users with access to tracking page; no explicit role gate in code.
Page Location: src/lib/database/tracking.js, src/pages/tracking/index.js

## work_complete

Status Name: work_complete
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js

## workshop_mot

Status Name: workshop_mot
Application Context: Legacy jobs.status value normalized by statusFlow to main or sub-statuses.
Role Access: Status sidebar roles: admin manager, service, service manager, workshop manager, after sales director, techs, parts, parts manager, mot tester, valet service.
Page Location: src/lib/status/statusFlow.js
