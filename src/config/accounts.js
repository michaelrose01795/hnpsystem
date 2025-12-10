// file location: src/config/accounts.js // identify module path for reviewers
export const ACCOUNT_TYPES = [ // enumerate the valid account types supported by the module
  "Retail",
  "Warranty",
  "Service",
  "Parts",
  "Sales",
  "General",
];
export const ACCOUNT_STATUSES = [
  "Active",
  "Frozen",
  "Closed",
];
export const TRANSACTION_TYPES = [
  "Debit",
  "Credit",
  "Adjustment",
];
export const PAYMENT_METHODS = [
  "Card",
  "Cash",
  "Bank Transfer",
  "Account Transfer",
  "Warranty Claim",
];
export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Paid",
  "Overdue",
  "Cancelled",
];
export const DEFAULT_ACCOUNT_FORM_VALUES = {
  account_id: "",
  customer_id: "",
  account_type: "Retail",
  balance: 0,
  credit_limit: 0,
  status: "Active",
  billing_name: "",
  billing_email: "",
  billing_phone: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_postcode: "",
  billing_country: "United Kingdom",
  created_at: "",
  updated_at: "",
  credit_terms: 30,
  notes: "",
};
export const ACCOUNT_PAGE_SIZES = [10, 20, 50, 100];
export const REPORT_PERIODS = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];
export const TRANSACTION_FILTERS = {
  types: TRANSACTION_TYPES,
  methods: PAYMENT_METHODS,
};
export const INVOICE_FILTERS = {
  statuses: INVOICE_STATUSES,
};
