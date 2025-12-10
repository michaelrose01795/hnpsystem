// file location: src/config/accounts.js // identify module path for reviewers
export const ACCOUNT_TYPES = [ // enumerate the valid account types supported by the module
  "Retail", // retail accounts created from customer walk-ins
  "Warranty", // manufacturer warranty accounts with claim handling
  "Service", // internal service accounts tied to workshop activity
  "Parts", // parts department accounts for supply-only work
  "Sales", // vehicle sales accounts for deposits and settlements
  "General", // general ledger style accounts for edge cases
]; // close ACCOUNT_TYPES definition
export const ACCOUNT_STATUSES = [ // enumerate the statuses used across UI and API
  "Active", // account can transact freely
  "Frozen", // account is temporarily blocked for invoicing
  "Closed", // account is permanently closed
]; // close ACCOUNT_STATUSES definition
export const TRANSACTION_TYPES = [ // enumerate supported transaction classifications
  "Debit", // money moving out of the account
  "Credit", // money moving into the account
  "Adjustment", // manual adjustment usually created by finance
]; // close TRANSACTION_TYPES definition
export const PAYMENT_METHODS = [ // enumerate allowed transaction payment methods
  "Card", // card payment processed through PDQ or POS
  "Cash", // cash received on site
  "Bank Transfer", // manual transfer made by finance team
  "Account Transfer", // internal ledger transfer between accounts
  "Warranty Claim", // manufacturer claim credit memo
]; // close PAYMENT_METHODS definition
export const INVOICE_STATUSES = [ // enumerate the statuses shown on invoice tables
  "Draft", // invoice is still being prepared
  "Sent", // invoice issued to the customer
  "Paid", // invoice fully settled
  "Overdue", // invoice past due date without payment
  "Cancelled", // invoice voided or written off
]; // close INVOICE_STATUSES definition
export const DEFAULT_ACCOUNT_FORM_VALUES = { // provide baseline values for the account form
  account_id: "", // auto generated identifier from Supabase or manual entry
  customer_id: "", // identifier linking back to the customers module
  account_type: "Retail", // default account type aligned with most use cases
  balance: 0, // running balance stored as number
  credit_limit: 0, // default credit limit in company currency
  status: "Active", // new accounts default to Active status
  billing_name: "", // display name for invoices and statements
  billing_email: "", // billing contact email
  billing_phone: "", // billing contact phone number
  billing_address_line1: "", // billing address primary line
  billing_address_line2: "", // billing address secondary line
  billing_city: "", // city field for billing address
  billing_postcode: "", // postal or zip code for billing address
  billing_country: "United Kingdom", // default country for the dealership
  created_at: "", // timestamp provided by Supabase
  updated_at: "", // timestamp updated on writes
  credit_terms: 30, // default payment terms in days
  notes: "", // optional free text for internal memos
}; // close DEFAULT_ACCOUNT_FORM_VALUES
export const ACCOUNT_PAGE_SIZES = [10, 20, 50, 100]; // supported pagination sizes for accounts lists
export const REPORT_PERIODS = [ // describe the report filters rendered on the reports page
  { label: "Monthly", value: "monthly" }, // month level rollup period
  { label: "Quarterly", value: "quarterly" }, // quarter level rollup period
  { label: "Yearly", value: "yearly" }, // year level rollup period
]; // close REPORT_PERIODS definition
export const TRANSACTION_FILTERS = { // shareable configuration for transaction filter dropdowns
  types: TRANSACTION_TYPES, // transaction type list for select elements
  methods: PAYMENT_METHODS, // payment method list
}; // close TRANSACTION_FILTERS definition
export const INVOICE_FILTERS = { // shareable configuration for invoice filter dropdowns
  statuses: INVOICE_STATUSES, // invoice statuses for filtering
}; // close INVOICE_FILTERS definition
