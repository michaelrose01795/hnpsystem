// file location: src/lib/accounts/permissions.js // path header for clarity
import { normalizeRoles } from "@/lib/auth/roles"; // reuse the shared role normalizer so RBAC stays consistent
const ADMIN_ROLES = new Set(["admin", "owner", "admin manager"]);
const ACCOUNT_ROLES = new Set(["accounts", "accounts manager"]);
const MANAGER_KEYWORDS = ["manager", "director"];
const SALES_KEYWORDS = ["sales"];
const WORKSHOP_KEYWORDS = ["workshop", "technician", "tech", "service"];
const PARTS_KEYWORDS = ["parts"];
export const ACCOUNTS_NAV_ROLES = Array.from(ACCOUNT_ROLES);
const matchesKeyword = (role = "", keywordList = []) => keywordList.some((keyword) => role.includes(keyword));
const hasKeywordMatch = (roles = [], keywords = []) => roles.some((role) => matchesKeyword(role, keywords));
export function deriveAccountPermissions(inputRoles = []) {
  const normalizedRoles = normalizeRoles(inputRoles || []);
  const hasAdmin = normalizedRoles.some((role) => ADMIN_ROLES.has(role));
  const hasAccounts = normalizedRoles.some((role) => ACCOUNT_ROLES.has(role));
  const hasManager = normalizedRoles.some((role) => MANAGER_KEYWORDS.some((keyword) => role.includes(keyword))) && !normalizedRoles.some((role) => role === "parts manager");
  const hasSales = hasKeywordMatch(normalizedRoles, SALES_KEYWORDS);
  const hasWorkshop = hasKeywordMatch(normalizedRoles, WORKSHOP_KEYWORDS);
  const hasParts = hasKeywordMatch(normalizedRoles, PARTS_KEYWORDS);
  const canViewAccounts = hasAdmin || hasAccounts || hasManager || hasSales;
  const canCreateAccount = hasAdmin || hasAccounts;
  const canEditAccount = hasAdmin || hasAccounts || hasManager;
  const canFreezeAccount = hasAdmin || hasAccounts || hasManager;
  const canAdjustBalance = hasAdmin || hasAccounts || hasManager;
  const canViewInvoices = hasAdmin || hasAccounts || hasManager || hasSales || hasWorkshop || hasParts;
  const canEditInvoices = hasAdmin || hasAccounts;
  const canCreateTransactions = hasAdmin || hasAccounts;
  const canExport = hasAdmin || hasAccounts || hasManager;
  const restrictedAccountTypes = !hasAdmin && !hasAccounts && hasSales ? ["Sales"] : null;
  const restrictInvoicesToJobs = hasWorkshop || hasParts;
  const navEligible = hasAdmin || hasAccounts;
  return {
    normalizedRoles,
    hasAdmin,
    hasAccounts,
    hasManager,
    hasSales,
    hasWorkshop,
    hasParts,
    canViewAccounts,
    canCreateAccount,
    canEditAccount,
    canFreezeAccount,
    canAdjustBalance,
    canViewInvoices,
    canEditInvoices,
    canCreateTransactions,
    canExport,
    restrictedAccountTypes,
    restrictInvoicesToJobs,
    navEligible,
  };
}
export function shouldShowAccountsNav(roles = []) {
  return deriveAccountPermissions(roles).navEligible;
}
