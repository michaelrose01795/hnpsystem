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
import { rows as consumables } from "./consumables";
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
  parts_orders: partsOrders,
  parts_deliveries: partsDeliveries,
  parts_goods_in: partsGoodsIn,
  parts_inventory: partsInventory,
  vhc_reports: vhcReports,
  messages,
  notes,
  consumables,
  clocking,
  efficiency,
  hr_employees: hrEmployees,
  hr_attendance: hrAttendance,
  hr_leave: hrLeave,
  hr_training: hrTraining,
  tracking_events: trackingEvents,
  appointments,
  activity_logs: activityLogs,
};

export function getMockRows(table) {
  if (!table) return [];
  return TABLES[table] || [];
}

export function listMockTables() {
  return Object.keys(TABLES);
}
