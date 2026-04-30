// Presentation slide mocks registry.
// Each entry maps a slide id to a mock component that wraps the real
// `src/components/page-ui/*` file with demo props. Updates to a live page UI
// flow into the matching presentation slide automatically — the mock never
// duplicates layout JSX. Per-slide overlay text/highlights live in
// `src/features/presentation/slides/definitions/*`.

// Existing mocks
import DashboardMock from "./dashboard";
import JobCardsListMock from "./job-cards-list";
import JobCreateMock from "./job-create";
import AppointmentsMock from "./appointments";
import MyJobsMock from "./my-jobs";
import JobDetailMock from "./job-detail";
import VhcMock from "./vhc";
import PartsCreateMock from "./parts-create-order";
import PartsGoodsInMock from "./parts-goods-in";
import PartsDeliveriesMock from "./parts-deliveries";
import ValetMock from "./valet";
import MessagesMock from "./messages";
import AccountsInvoicesMock from "./accounts-invoices";
import HrDashboardMock from "./hr-dashboard";
import CustomerPortalMock from "./customer-portal";
import ArchiveMock from "./archive";

// Dashboard variants
import DashboardWorkshopMock from "./dashboard-workshop";
import DashboardManagersMock from "./dashboard-managers";
import DashboardAccountsMock from "./dashboard-accounts";
import DashboardAdminMock from "./dashboard-admin";
import DashboardAfterSalesMock from "./dashboard-after-sales";
import DashboardMotMock from "./dashboard-mot";
import DashboardPaintingMock from "./dashboard-painting";
import DashboardPartsMock from "./dashboard-parts";
import DashboardServiceMock from "./dashboard-service";
import DashboardValetingMock from "./dashboard-valeting";

// Accounts
import AccountsMock from "./accounts";
import AccountsCreateMock from "./accounts-create";
import AccountsEditMock from "./accounts-edit";
import AccountsViewMock from "./accounts-view";
import AccountsTransactionsMock from "./accounts-transactions";
import AccountsInvoiceDetailMock from "./accounts-invoice-detail";
import AccountsPayslipsMock from "./accounts-payslips";
import AccountsReportsMock from "./accounts-reports";
import AccountsSettingsMock from "./accounts-settings";
import CompanyAccountsMock from "./company-accounts";
import CompanyAccountsDetailMock from "./company-accounts-detail";

// Admin
import AdminUsersMock from "./admin-users";
import AdminProfileMock from "./admin-profile";

// HR
import HrManagerMock from "./hr-manager";
import HrAttendanceMock from "./hr-attendance";
import HrDisciplinaryMock from "./hr-disciplinary";
import HrEmployeesMock from "./hr-employees";
import HrLeaveMock from "./hr-leave";
import HrPayrollMock from "./hr-payroll";
import HrPerformanceMock from "./hr-performance";
import HrRecruitmentMock from "./hr-recruitment";
import HrReportsMock from "./hr-reports";
import HrSettingsMock from "./hr-settings";
import HrTrainingMock from "./hr-training";

// Customer & VHC
import CustomerMessagesMock from "./customer-messages";
import CustomerPartsMock from "./customer-parts";
import CustomerPaymentsMock from "./customer-payments";
import CustomerVehiclesMock from "./customer-vehicles";
import CustomerVhcMock from "./customer-vhc";
import CustomersMock from "./customers";
import CustomerDetailMock from "./customer-detail";
import VhcCustomerPreviewMock from "./vhc-customer-preview";
import VhcCustomerViewMock from "./vhc-customer-view";
import VhcShareMock from "./vhc-share";

// Job-cards extras
import MyJobsDetailMock from "./my-jobs-detail";
import JobCardsValetMock from "./job-cards-valet";
import JobCardsWaitingNextJobsMock from "./job-cards-waiting-nextjobs";

// Parts extras
import PartsMock from "./parts";
import PartsManagerMock from "./parts-manager";
import PartsCreateOrderDetailMock from "./parts-create-order-detail";
import PartsDeliveriesDetailMock from "./parts-deliveries-detail";
import PartsDeliveryPlannerMock from "./parts-delivery-planner";
import PartsGoodsInDetailMock from "./parts-goods-in-detail";
import StockCatalogueMock from "./stock-catalogue";

// Mobile
import MobileDashboardMock from "./mobile-dashboard";
import MobileJobsMock from "./mobile-jobs";
import MobileJobDetailMock from "./mobile-job-detail";
import MobileAppointmentsMock from "./mobile-appointments";
import MobileCreateMock from "./mobile-create";
import MobileDeliveryMock from "./mobile-delivery";

// Tech
import TechConsumablesRequestMock from "./tech-consumables-request";
import TechDashboardMock from "./tech-dashboard";
import TechEfficiencyMock from "./tech-efficiency";

// Misc
import ClockingMock from "./clocking";
import ClockingTechnicianMock from "./clocking-technician";
import TrackingMock from "./tracking";
import NewsfeedMock from "./newsfeed";
import ProfileMock from "./profile";
import WorkshopConsumablesTrackerMock from "./workshop-consumables-tracker";
import LoginMock from "./login";
import UnauthorizedMock from "./unauthorized";
import PasswordResetRevertedMock from "./password-reset-reverted";

export const MOCKS_BY_SLIDE_ID = {
  // Existing
  "dashboard": DashboardMock,
  "job-cards-list": JobCardsListMock,
  "job-create": JobCreateMock,
  "appointments": AppointmentsMock,
  "my-jobs": MyJobsMock,
  "job-detail": JobDetailMock,
  "vhc": VhcMock,
  "parts-create-order": PartsCreateMock,
  "parts-goods-in": PartsGoodsInMock,
  "parts-deliveries": PartsDeliveriesMock,
  "valet": ValetMock,
  "messages": MessagesMock,
  "accounts-invoices": AccountsInvoicesMock,
  "hr-dashboard": HrDashboardMock,
  "customer-portal": CustomerPortalMock,
  "archive": ArchiveMock,

  // Dashboard variants
  "dashboard-workshop": DashboardWorkshopMock,
  "dashboard-managers": DashboardManagersMock,
  "dashboard-accounts": DashboardAccountsMock,
  "dashboard-admin": DashboardAdminMock,
  "dashboard-after-sales": DashboardAfterSalesMock,
  "dashboard-mot": DashboardMotMock,
  "dashboard-painting": DashboardPaintingMock,
  "dashboard-parts": DashboardPartsMock,
  "dashboard-service": DashboardServiceMock,
  "dashboard-valeting": DashboardValetingMock,

  // Accounts
  "accounts": AccountsMock,
  "accounts-create": AccountsCreateMock,
  "accounts-edit": AccountsEditMock,
  "accounts-view": AccountsViewMock,
  "accounts-transactions": AccountsTransactionsMock,
  "accounts-invoice-detail": AccountsInvoiceDetailMock,
  "accounts-payslips": AccountsPayslipsMock,
  "accounts-reports": AccountsReportsMock,
  "accounts-settings": AccountsSettingsMock,
  "company-accounts": CompanyAccountsMock,
  "company-accounts-detail": CompanyAccountsDetailMock,

  // Admin
  "admin-users": AdminUsersMock,
  "admin-profile": AdminProfileMock,

  // HR
  "hr-manager": HrManagerMock,
  "hr-attendance": HrAttendanceMock,
  "hr-disciplinary": HrDisciplinaryMock,
  "hr-employees": HrEmployeesMock,
  "hr-leave": HrLeaveMock,
  "hr-payroll": HrPayrollMock,
  "hr-performance": HrPerformanceMock,
  "hr-recruitment": HrRecruitmentMock,
  "hr-reports": HrReportsMock,
  "hr-settings": HrSettingsMock,
  "hr-training": HrTrainingMock,

  // Customer & VHC
  "customer-messages": CustomerMessagesMock,
  "customer-parts": CustomerPartsMock,
  "customer-payments": CustomerPaymentsMock,
  "customer-vehicles": CustomerVehiclesMock,
  "customer-vhc": CustomerVhcMock,
  "customers": CustomersMock,
  "customer-detail": CustomerDetailMock,
  "vhc-customer-preview": VhcCustomerPreviewMock,
  "vhc-customer-view": VhcCustomerViewMock,
  "vhc-share": VhcShareMock,

  // Job-cards extras
  "my-jobs-detail": MyJobsDetailMock,
  "job-cards-valet": JobCardsValetMock,
  "job-cards-waiting-nextjobs": JobCardsWaitingNextJobsMock,

  // Parts extras
  "parts": PartsMock,
  "parts-manager": PartsManagerMock,
  "parts-create-order-detail": PartsCreateOrderDetailMock,
  "parts-deliveries-detail": PartsDeliveriesDetailMock,
  "parts-delivery-planner": PartsDeliveryPlannerMock,
  "parts-goods-in-detail": PartsGoodsInDetailMock,
  "stock-catalogue": StockCatalogueMock,

  // Mobile
  "mobile-dashboard": MobileDashboardMock,
  "mobile-jobs": MobileJobsMock,
  "mobile-job-detail": MobileJobDetailMock,
  "mobile-appointments": MobileAppointmentsMock,
  "mobile-create": MobileCreateMock,
  "mobile-delivery": MobileDeliveryMock,

  // Tech
  "tech-consumables-request": TechConsumablesRequestMock,
  "tech-dashboard": TechDashboardMock,
  "tech-efficiency": TechEfficiencyMock,

  // Misc
  "clocking": ClockingMock,
  "clocking-technician": ClockingTechnicianMock,
  "tracking": TrackingMock,
  "newsfeed": NewsfeedMock,
  "profile": ProfileMock,
  "workshop-consumables-tracker": WorkshopConsumablesTrackerMock,
  "login": LoginMock,
  "unauthorized": UnauthorizedMock,
  "password-reset-reverted": PasswordResetRevertedMock,
};
