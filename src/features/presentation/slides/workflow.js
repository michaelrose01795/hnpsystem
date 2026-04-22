// Canonical Presentation workflow order shared across all roles.
// The sequence follows the real job lifecycle: create, schedule, work,
// inspect, order parts, communicate, invoice, and archive.
export const WORKFLOW = {
  DASHBOARD: 10,
  JOB_CREATE: 20,
  APPOINTMENTS: 30,
  JOB_CARDS_LIST: 40,
  MY_JOBS: 45,
  JOB_DETAIL: 50,
  VHC: 60,
  PARTS_CREATE: 70,
  PARTS_GOODS_IN: 80,
  PARTS_DELIVERIES: 90,
  VALET: 100,
  CUSTOMER_PORTAL: 110,
  MESSAGES: 120,
  ACCOUNTS_INVOICES: 130,
  HR_DASHBOARD: 140,
  ARCHIVE: 150,
};
