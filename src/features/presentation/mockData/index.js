// Barrel for per-table mock data. Each module exports `rows` matching the
// real Supabase column shape so the actual page-ui + handlers run unchanged.
// `getMockRows(table)` is the only entry point used by queryRouter and
// apiRouteTable; tables without a registered file resolve to an empty array.

import { rows as jobs } from "./jobs";
import { rows as customers } from "./customers";
import { rows as vehicles } from "./vehicles";
import { rows as users } from "./users";
import { rows as invoices } from "./invoices";
import { rows as accounts } from "./accounts";
import { rows as companyAccounts } from "./company_accounts";
import { rows as payslips } from "./payslips";
import { rows as partsOrders } from "./parts_orders";
import { rows as partsDeliveries } from "./parts_deliveries";
import { rows as partsGoodsIn } from "./parts_goods_in";
import { rows as partsInventory } from "./parts_inventory";
import { rows as vhcReports } from "./vhc_reports";
import { rows as messages } from "./messages";
import { rows as notes } from "./notes";
import {
  rows as consumables,
  orderRows as workshopConsumableOrders,
  requestRows as workshopConsumableRequests,
  budgetRows as workshopConsumableBudgets,
} from "./consumables";
import { rows as clocking } from "./clocking";
import { rows as efficiency } from "./efficiency";
import { rows as hrEmployees } from "./hr_employees";
import { rows as hrAttendance } from "./hr_attendance";
import { rows as hrLeave } from "./hr_leave";
import { rows as hrTraining } from "./hr_training";
import { rows as trackingEvents } from "./tracking_events";
import { rows as appointments } from "./appointments";
import { rows as activityLogs } from "./activity_logs";
import { rows as parts } from "./parts";
import { rows as newsUpdates } from "./news_updates";
import {
  breachRecords,
  dpiaRecords,
  retentionPolicies,
  retentionRuns,
  processingActivities,
  subjectRequests,
} from "./compliance";

const TABLES = {
  jobs,
  customers,
  vehicles,
  users,
  invoices,
  accounts,
  company_accounts: companyAccounts,
  payslips,
  parts,
  parts_catalog: partsInventory,
  parts_job_items: parts,
  parts_requests: parts,
  parts_order_cards: partsOrders,
  parts_orders: partsOrders,
  parts_delivery_jobs: partsDeliveries,
  parts_delivery_items: partsDeliveries,
  parts_deliveries: partsDeliveries,
  parts_goods_in: partsGoodsIn,
  parts_inventory: partsInventory,
  vhc_checks: vhcReports,
  vhc_reports: vhcReports,
  messages,
  message_threads: messages,
  message_thread_members: users,
  notifications: messages,
  notes,
  job_notes: notes,
  consumables,
  workshop_consumables: consumables,
  workshop_consumable_orders: workshopConsumableOrders,
  workshop_consumable_requests: workshopConsumableRequests,
  workshop_consumable_budgets: workshopConsumableBudgets,
  clocking,
  job_clocking: clocking,
  time_records: clocking,
  overtime_periods: clocking,
  overtime_sessions: clocking,
  efficiency,
  tech_efficiency_entries: efficiency,
  tech_efficiency_targets: efficiency,
  hr_employees: hrEmployees,
  hr_absences: hrLeave,
  hr_disciplinary_cases: hrEmployees,
  hr_payroll_adjustments: payslips,
  hr_payroll_runs: payslips,
  hr_performance_reviews: hrEmployees,
  hr_training_assignments: hrTraining,
  hr_attendance: hrAttendance,
  hr_leave: hrLeave,
  hr_training: hrTraining,
  job_activity_events: activityLogs,
  customer_activity_events: activityLogs,
  key_tracking_events: trackingEvents,
  vehicle_tracking_events: trackingEvents,
  tracking_events: trackingEvents,
  customer_payment_methods: accounts,
  staff_vehicles: vehicles,
  job_customer_statuses: jobs,
  job_files: jobs,
  job_request_presets: jobs,
  job_requests: jobs,
  job_status_history: jobs,
  job_writeups: jobs,
  appointments,
  activity_logs: activityLogs,
  news_updates: newsUpdates,
  breach_records: breachRecords,
  dpia_records: dpiaRecords,
  retention_policies: retentionPolicies,
  retention_runs: retentionRuns,
  processing_activities: processingActivities,
  subject_requests: subjectRequests,
};

export function getMockRows(table) {
  if (!table) return [];
  return TABLES[table] || [];
}

export function listMockTables() {
  return Object.keys(TABLES);
}
