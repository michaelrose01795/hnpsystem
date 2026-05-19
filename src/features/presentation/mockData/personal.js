// Mock "personal dashboard" state for Presentation Mode.
//
// The real /profile → Personal tab is passcode-locked and backed by
// /api/personal/* endpoints. In a demo deck those endpoints are intercepted
// (see dataLayer/fetchInterceptor.js + apiRouteTable.js); this module supplies
// the unlocked state blob so the personal dashboard renders with realistic
// figures tied to the demo user once the presenter enters the passcode.

import { buildDefaultWidgets, normaliseWidgetRecord } from "@/lib/profile/personalWidgets";

// The 4-digit passcode shown (pre-filled) in the demo unlock popup.
export const PRESENTATION_PERSONAL_PASSCODE = "1111";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Default widget set, normalised into the camelCase record shape the personal
// dashboard hook expects to receive from the server.
function buildWidgets() {
  return buildDefaultWidgets(1).map((widget, index) => normaliseWidgetRecord(widget, index));
}

// A self-contained personal-finance state blob. The finance model is tolerant
// of partial data, so a pay profile plus a few fixed outgoings is enough to
// drive non-zero figures across the income / spending / net-position widgets.
function buildFinanceState() {
  const monthKey = currentMonthKey();
  return {
    selectedMonthKey: monthKey,
    paySettings: {
      hourlyRate: 18.5,
      overtimeRate: 27.75,
      contractedWeeklyHours: 40,
      annualSalary: 0,
    },
    fixedOutgoings: [
      { id: "demo-fixed-rent", name: "Rent", amount: 850, category: "housing" },
      { id: "demo-fixed-council", name: "Council Tax", amount: 145, category: "bills" },
      { id: "demo-fixed-car", name: "Car Insurance", amount: 62, category: "transport" },
      { id: "demo-fixed-phone", name: "Phone & Broadband", amount: 48, category: "bills" },
      { id: "demo-fixed-energy", name: "Gas & Electric", amount: 124, category: "bills" },
      { id: "demo-fixed-water", name: "Water", amount: 36, category: "bills" },
      { id: "demo-fixed-life", name: "Life Insurance", amount: 21, category: "insurance" },
      { id: "demo-fixed-childcare", name: "Childcare", amount: 310, category: "family" },
      { id: "demo-fixed-pension", name: "Private Pension", amount: 120, category: "savings" },
      { id: "demo-fixed-save", name: "Monthly Saving", amount: 200, category: "savings" },
    ],
    savingsAccounts: [
      { id: "demo-sav-emergency", name: "Emergency Fund", balance: 3200 },
      { id: "demo-sav-holiday", name: "Holiday Fund", balance: 980 },
      { id: "demo-sav-isa", name: "Cash ISA", balance: 6450 },
      { id: "demo-sav-car", name: "Next Car Fund", balance: 2110 },
      { id: "demo-sav-xmas", name: "Christmas Pot", balance: 415 },
    ],
    creditCardAccounts: [
      { id: "demo-cc-visa", name: "Visa Rewards", balance: 742.18, limit: 4000 },
      { id: "demo-cc-store", name: "Store Card", balance: 188.5, limit: 1200 },
    ],
    plannedPaymentPlans: [],
    months: {},
  };
}

function buildCollections() {
  const monthKey = currentMonthKey();
  return {
    transactions: [
      { id: "demo-txn-001", type: "expense", category: "Groceries", amount: 64.2, date: `${monthKey}-02`, isRecurring: false, notes: "Weekly shop" },
      { id: "demo-txn-002", type: "expense", category: "Fuel", amount: 58.0, date: `${monthKey}-03`, isRecurring: false, notes: "Diesel" },
      { id: "demo-txn-003", type: "expense", category: "Dining", amount: 32.5, date: `${monthKey}-05`, isRecurring: false, notes: "Meal out" },
      { id: "demo-txn-004", type: "income", category: "Refund", amount: 24.99, date: `${monthKey}-06`, isRecurring: false, notes: "Returned item" },
      { id: "demo-txn-005", type: "expense", category: "Groceries", amount: 71.85, date: `${monthKey}-09`, isRecurring: false, notes: "Big shop" },
      { id: "demo-txn-006", type: "expense", category: "Fuel", amount: 61.4, date: `${monthKey}-12`, isRecurring: false, notes: "Diesel top-up" },
      { id: "demo-txn-007", type: "expense", category: "Shopping", amount: 89.99, date: `${monthKey}-13`, isRecurring: false, notes: "New work boots" },
      { id: "demo-txn-008", type: "expense", category: "Entertainment", amount: 27.0, date: `${monthKey}-15`, isRecurring: false, notes: "Cinema" },
      { id: "demo-txn-009", type: "income", category: "Side Work", amount: 140.0, date: `${monthKey}-16`, isRecurring: false, notes: "Weekend job" },
      { id: "demo-txn-010", type: "expense", category: "Groceries", amount: 58.3, date: `${monthKey}-17`, isRecurring: false, notes: "Mid-week shop" },
      { id: "demo-txn-011", type: "expense", category: "Dining", amount: 44.75, date: `${monthKey}-19`, isRecurring: false, notes: "Family takeaway" },
      { id: "demo-txn-012", type: "expense", category: "Fuel", amount: 60.0, date: `${monthKey}-21`, isRecurring: false, notes: "Diesel" },
      { id: "demo-txn-013", type: "expense", category: "Health", amount: 18.5, date: `${monthKey}-23`, isRecurring: false, notes: "Prescription" },
      { id: "demo-txn-014", type: "expense", category: "Gifts", amount: 35.0, date: `${monthKey}-25`, isRecurring: false, notes: "Birthday present" },
      { id: "demo-txn-015", type: "income", category: "Cashback", amount: 12.4, date: `${monthKey}-26`, isRecurring: false, notes: "Card cashback" },
    ],
    bills: [
      { id: "demo-bill-001", name: "Gym Membership", amount: 32, dueDay: 1, isRecurring: true },
      { id: "demo-bill-002", name: "Streaming - Netflix", amount: 15.99, dueDay: 8, isRecurring: true },
      { id: "demo-bill-003", name: "Car Finance", amount: 248, dueDay: 15, isRecurring: true },
      { id: "demo-bill-004", name: "Mobile Contract", amount: 24.5, dueDay: 4, isRecurring: true },
      { id: "demo-bill-005", name: "Spotify Premium", amount: 11.99, dueDay: 10, isRecurring: true },
      { id: "demo-bill-006", name: "Pet Insurance", amount: 18.4, dueDay: 18, isRecurring: true },
      { id: "demo-bill-007", name: "Cloud Storage", amount: 2.99, dueDay: 22, isRecurring: true },
      { id: "demo-bill-008", name: "TV Licence", amount: 13.25, dueDay: 28, isRecurring: true },
    ],
    savings: { target: 8000, current: 5120 },
    goals: [
      { id: "demo-goal-001", type: "custom", name: "New Laptop", target: 1200, current: 540, deadline: `${monthKey}-28` },
      { id: "demo-goal-002", type: "custom", name: "Holiday to Spain", target: 2500, current: 980, deadline: null },
      { id: "demo-goal-003", type: "custom", name: "Emergency Buffer", target: 5000, current: 3200, deadline: null },
      { id: "demo-goal-004", type: "custom", name: "Car Service & MOT", target: 450, current: 310, deadline: null },
    ],
    notes: [
      { id: "demo-note-001", content: "Review car insurance renewal before the demo.", createdAt: new Date().toISOString() },
      { id: "demo-note-002", content: "Move £150 into the Cash ISA after payday.", createdAt: new Date().toISOString() },
      { id: "demo-note-003", content: "Cancel the unused cloud storage subscription.", createdAt: new Date().toISOString() },
      { id: "demo-note-004", content: "Book MOT for the end of the month - budget set in goals.", createdAt: new Date().toISOString() },
      { id: "demo-note-005", content: "Check overtime hours logged against this month's payslip.", createdAt: new Date().toISOString() },
    ],
    attachments: [
      { id: "demo-att-001", fileName: "Payslip - latest.pdf", fileSize: 184320, createdAt: new Date().toISOString(), downloadUrl: "#" },
      { id: "demo-att-002", fileName: "Car insurance certificate.pdf", fileSize: 96256, createdAt: new Date().toISOString(), downloadUrl: "#" },
      { id: "demo-att-003", fileName: "Tenancy agreement.pdf", fileSize: 311296, createdAt: new Date().toISOString(), downloadUrl: "#" },
      { id: "demo-att-004", fileName: "Mortgage in principle.pdf", fileSize: 142336, createdAt: new Date().toISOString(), downloadUrl: "#" },
    ],
  };
}

// Returns a fresh unlocked personal-dashboard state blob for the demo user.
export function buildPresentationPersonalState() {
  return {
    widgets: buildWidgets(),
    widgetData: {},
    collections: buildCollections(),
    financeState: buildFinanceState(),
    updatedAt: new Date().toISOString(),
  };
}
