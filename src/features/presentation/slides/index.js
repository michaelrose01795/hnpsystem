import { hasAnyRole, normalizeRoles } from "@/lib/auth/roles";
import { validateSlide } from "./schema";

// Existing slides
import { dashboardSlide } from "./definitions/dashboard";
import { jobCardsListSlide } from "./definitions/jobCardsList";
import { jobCreateSlide } from "./definitions/jobCreate";
import { appointmentsSlide } from "./definitions/appointments";
import { myJobsSlide } from "./definitions/myJobs";
import { jobDetailSlide } from "./definitions/jobDetail";
import { vhcSlide } from "./definitions/vhc";
import { partsCreateSlide } from "./definitions/partsCreate";
import { partsGoodsInSlide } from "./definitions/partsGoodsIn";
import { partsDeliveriesSlide } from "./definitions/partsDeliveries";
import { valetSlide } from "./definitions/valet";
import { messagesSlide } from "./definitions/messages";
import { accountsInvoicesSlide } from "./definitions/accountsInvoices";
import { hrDashboardSlide } from "./definitions/hrDashboard";
import { customerPortalSlide } from "./definitions/customerPortal";
import { archiveSlide } from "./definitions/archive";

// Dashboard variants
import { dashboardWorkshopSlide } from "./definitions/dashboardWorkshop";
import { dashboardManagersSlide } from "./definitions/dashboardManagers";
import { dashboardAccountsSlide } from "./definitions/dashboardAccounts";
import { dashboardAdminSlide } from "./definitions/dashboardAdmin";
import { dashboardAfterSalesSlide } from "./definitions/dashboardAfterSales";
import { dashboardMotSlide } from "./definitions/dashboardMot";
import { dashboardPaintingSlide } from "./definitions/dashboardPainting";
import { dashboardPartsSlide } from "./definitions/dashboardParts";
import { dashboardServiceSlide } from "./definitions/dashboardService";
import { dashboardValetingSlide } from "./definitions/dashboardValeting";

// Accounts
import { accountsSlide } from "./definitions/accounts";
import { accountsCreateSlide } from "./definitions/accountsCreate";
import { accountsEditSlide } from "./definitions/accountsEdit";
import { accountsViewSlide } from "./definitions/accountsView";
import { accountsTransactionsSlide } from "./definitions/accountsTransactions";
import { accountsInvoiceDetailSlide } from "./definitions/accountsInvoiceDetail";
import { accountsPayslipsSlide } from "./definitions/accountsPayslips";
import { accountsReportsSlide } from "./definitions/accountsReports";
import { accountsSettingsSlide } from "./definitions/accountsSettings";
import { companyAccountsSlide } from "./definitions/companyAccounts";
import { companyAccountsDetailSlide } from "./definitions/companyAccountsDetail";

// Admin
import { adminUsersSlide } from "./definitions/adminUsers";
import { adminProfileSlide } from "./definitions/adminProfile";

// HR
import { hrAttendanceSlide } from "./definitions/hrAttendance";
import { hrDisciplinarySlide } from "./definitions/hrDisciplinary";
import { hrEmployeesSlide } from "./definitions/hrEmployees";
import { hrLeaveSlide } from "./definitions/hrLeave";
import { hrManagerSlide } from "./definitions/hrManager";
import { hrPayrollSlide } from "./definitions/hrPayroll";
import { hrPerformanceSlide } from "./definitions/hrPerformance";
import { hrRecruitmentSlide } from "./definitions/hrRecruitment";
import { hrReportsSlide } from "./definitions/hrReports";
import { hrSettingsSlide } from "./definitions/hrSettings";
import { hrTrainingSlide } from "./definitions/hrTraining";

// Customer & VHC
import { customerMessagesSlide } from "./definitions/customerMessages";
import { customerPartsSlide } from "./definitions/customerParts";
import { customerPaymentsSlide } from "./definitions/customerPayments";
import { customerVehiclesSlide } from "./definitions/customerVehicles";
import { customerVhcSlide } from "./definitions/customerVhc";
import { customersSlide } from "./definitions/customers";
import { customerDetailSlide } from "./definitions/customerDetail";
import { vhcCustomerPreviewSlide } from "./definitions/vhcCustomerPreview";
import { vhcCustomerViewSlide } from "./definitions/vhcCustomerView";
import { vhcShareSlide } from "./definitions/vhcShare";

// Job-cards extras
import { jobCardsMyJobsDetailSlide } from "./definitions/jobCardsMyJobsDetail";
import { jobCardsValetSlide } from "./definitions/jobCardsValet";
import { jobCardsWaitingNextJobsSlide } from "./definitions/jobCardsWaitingNextJobs";

// Parts extras
import { partsSlide } from "./definitions/parts";
import { partsManagerSlide } from "./definitions/partsManager";
import { partsCreateOrderDetailSlide } from "./definitions/partsCreateOrderDetail";
import { partsDeliveriesDetailSlide } from "./definitions/partsDeliveriesDetail";
import { partsDeliveryPlannerSlide } from "./definitions/partsDeliveryPlanner";
import { partsGoodsInDetailSlide } from "./definitions/partsGoodsInDetail";
import { stockCatalogueSlide } from "./definitions/stockCatalogue";

// Mobile
import { mobileDashboardSlide } from "./definitions/mobileDashboard";
import { mobileJobsSlide } from "./definitions/mobileJobs";
import { mobileJobDetailSlide } from "./definitions/mobileJobDetail";
import { mobileAppointmentsSlide } from "./definitions/mobileAppointments";
import { mobileCreateSlide } from "./definitions/mobileCreate";
import { mobileDeliverySlide } from "./definitions/mobileDelivery";

// Tech
import { techConsumablesRequestSlide } from "./definitions/techConsumablesRequest";
import { techDashboardSlide } from "./definitions/techDashboard";
import { techEfficiencySlide } from "./definitions/techEfficiency";

// Misc
import { clockingSlide } from "./definitions/clocking";
import { clockingTechnicianSlide } from "./definitions/clockingTechnician";
import { trackingSlide } from "./definitions/tracking";
import { newsfeedSlide } from "./definitions/newsfeed";
import { profileSlide } from "./definitions/profile";
import { workshopConsumablesTrackerSlide } from "./definitions/workshopConsumablesTracker";
import { loginSlide } from "./definitions/login";
import { unauthorizedSlide } from "./definitions/unauthorized";
import { passwordResetRevertedSlide } from "./definitions/passwordResetReverted";

export const ALL_SLIDES = [
  dashboardSlide,
  jobCardsListSlide,
  jobCreateSlide,
  appointmentsSlide,
  myJobsSlide,
  jobDetailSlide,
  vhcSlide,
  partsCreateSlide,
  partsGoodsInSlide,
  partsDeliveriesSlide,
  valetSlide,
  messagesSlide,
  accountsInvoicesSlide,
  hrDashboardSlide,
  customerPortalSlide,
  archiveSlide,

  dashboardWorkshopSlide,
  dashboardManagersSlide,
  dashboardAccountsSlide,
  dashboardAdminSlide,
  dashboardAfterSalesSlide,
  dashboardMotSlide,
  dashboardPaintingSlide,
  dashboardPartsSlide,
  dashboardServiceSlide,
  dashboardValetingSlide,

  accountsSlide,
  accountsCreateSlide,
  accountsEditSlide,
  accountsViewSlide,
  accountsTransactionsSlide,
  accountsInvoiceDetailSlide,
  accountsPayslipsSlide,
  accountsReportsSlide,
  accountsSettingsSlide,
  companyAccountsSlide,
  companyAccountsDetailSlide,

  adminUsersSlide,
  adminProfileSlide,

  hrAttendanceSlide,
  hrDisciplinarySlide,
  hrEmployeesSlide,
  hrLeaveSlide,
  hrManagerSlide,
  hrPayrollSlide,
  hrPerformanceSlide,
  hrRecruitmentSlide,
  hrReportsSlide,
  hrSettingsSlide,
  hrTrainingSlide,

  customerMessagesSlide,
  customerPartsSlide,
  customerPaymentsSlide,
  customerVehiclesSlide,
  customerVhcSlide,
  customersSlide,
  customerDetailSlide,
  vhcCustomerPreviewSlide,
  vhcCustomerViewSlide,
  vhcShareSlide,

  jobCardsMyJobsDetailSlide,
  jobCardsValetSlide,
  jobCardsWaitingNextJobsSlide,

  partsSlide,
  partsManagerSlide,
  partsCreateOrderDetailSlide,
  partsDeliveriesDetailSlide,
  partsDeliveryPlannerSlide,
  partsGoodsInDetailSlide,
  stockCatalogueSlide,

  mobileDashboardSlide,
  mobileJobsSlide,
  mobileJobDetailSlide,
  mobileAppointmentsSlide,
  mobileCreateSlide,
  mobileDeliverySlide,

  techConsumablesRequestSlide,
  techDashboardSlide,
  techEfficiencySlide,

  clockingSlide,
  clockingTechnicianSlide,
  trackingSlide,
  newsfeedSlide,
  profileSlide,
  workshopConsumablesTrackerSlide,
  loginSlide,
  unauthorizedSlide,
  passwordResetRevertedSlide,
];

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  for (const s of ALL_SLIDES) {
    const err = validateSlide(s);
    if (err) console.warn(`[presentation] invalid slide ${s?.id}: ${err}`);
  }
}

export function buildSlidesForRole(userRoles) {
  const normalized = normalizeRoles(Array.isArray(userRoles) ? userRoles : []);
  return ALL_SLIDES
    .filter((slide) => {
      if (!slide.roles || slide.roles.length === 0) return true;
      return hasAnyRole(normalized, slide.roles);
    })
    .slice()
    .sort((a, b) => a.workflowIndex - b.workflowIndex);
}
