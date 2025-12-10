// file location: src/lib/accounts/permissions.js // path header for clarity
import { normalizeRoles } from "@/lib/auth/roles"; // reuse the shared role normalizer so RBAC stays consistent
const ADMIN_ROLES = new Set(["admin", "owner", "admin manager"]); // roles treated as full administrators
const ACCOUNT_ROLES = new Set(["accounts", "accounts manager"]); // dedicated accounts team roles
const MANAGER_KEYWORDS = ["manager", "director"]; // strings that imply management level even if not exact match
const SALES_KEYWORDS = ["sales"]; // strings that imply sales department responsibilities
const WORKSHOP_KEYWORDS = ["workshop", "technician", "tech", "service"]; // strings tied to workshop and service teams
const PARTS_KEYWORDS = ["parts"]; // strings tied to parts department
export const ACCOUNTS_NAV_ROLES = Array.from(ACCOUNT_ROLES); // expose the raw role names for sidebar gating
const matchesKeyword = (role = "", keywordList = []) => keywordList.some((keyword) => role.includes(keyword)); // helper to match keyword fragments
const hasKeywordMatch = (roles = [], keywords = []) => roles.some((role) => matchesKeyword(role, keywords)); // helper to scan across roles array
export function deriveAccountPermissions(inputRoles = []) { // compute boolean permission flags for UI and API consumers
  const normalizedRoles = normalizeRoles(inputRoles || []); // normalize casing before evaluating
  const hasAdmin = normalizedRoles.some((role) => ADMIN_ROLES.has(role)); // check for admin power
  const hasAccounts = normalizedRoles.some((role) => ACCOUNT_ROLES.has(role)); // check for accounts department power
  const hasManager = normalizedRoles.some((role) => MANAGER_KEYWORDS.some((keyword) => role.includes(keyword))) && !normalizedRoles.some((role) => role === "parts manager"); // treat job titles with "manager" or "director" as management while ignoring parts-only
  const hasSales = hasKeywordMatch(normalizedRoles, SALES_KEYWORDS); // detect sales department staff
  const hasWorkshop = hasKeywordMatch(normalizedRoles, WORKSHOP_KEYWORDS); // detect workshop/service staff
  const hasParts = hasKeywordMatch(normalizedRoles, PARTS_KEYWORDS); // detect parts staff
  const canViewAccounts = hasAdmin || hasAccounts || hasManager || hasSales; // determine read access to account records
  const canCreateAccount = hasAdmin || hasAccounts; // determine create access
  const canEditAccount = hasAdmin || hasAccounts || hasManager; // determine edit access
  const canFreezeAccount = hasAdmin || hasAccounts || hasManager; // determine freeze/unfreeze ability per requirements
  const canAdjustBalance = hasAdmin || hasAccounts || hasManager; // determine if balance edits allowed
  const canViewInvoices = hasAdmin || hasAccounts || hasManager || hasSales || hasWorkshop || hasParts; // determine invoice read access across departments
  const canEditInvoices = hasAdmin || hasAccounts; // determine invoice edit ability
  const canCreateTransactions = hasAdmin || hasAccounts; // determine ability to create manual transactions
  const canExport = hasAdmin || hasAccounts || hasManager; // determine CSV export ability
  const restrictedAccountTypes = !hasAdmin && !hasAccounts && hasSales ? ["Sales"] : null; // restrict sales staff to sales account types only
  const restrictInvoicesToJobs = hasWorkshop || hasParts; // workshop/parts should only see invoices tied to their jobs/requests
  const navEligible = hasAdmin || hasAccounts; // only show sidebar buttons for accounts-focused staff as requested
  return { // expose the computed flags for consumers
    normalizedRoles, // include normalized roles for debugging or analytics
    hasAdmin, // expose admin flag
    hasAccounts, // expose accounts flag
    hasManager, // expose manager flag
    hasSales, // expose sales flag
    hasWorkshop, // expose workshop flag
    hasParts, // expose parts flag
    canViewAccounts, // expose read permission
    canCreateAccount, // expose create permission
    canEditAccount, // expose edit permission
    canFreezeAccount, // expose freeze permission
    canAdjustBalance, // expose balance edit permission
    canViewInvoices, // expose invoice read permission
    canEditInvoices, // expose invoice edit permission
    canCreateTransactions, // expose transaction create permission
    canExport, // expose export permission
    restrictedAccountTypes, // expose optional account type restrictions
    restrictInvoicesToJobs, // expose invoice scoping flag
    navEligible, // expose sidebar visibility flag
  }; // end of return object
} // close deriveAccountPermissions definition
export function shouldShowAccountsNav(roles = []) { // helper consumed by layout/sidebar to gate nav items
  return deriveAccountPermissions(roles).navEligible; // check navEligible flag to decide if nav buttons appear
} // close shouldShowAccountsNav definition
