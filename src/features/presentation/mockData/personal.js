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
      { id: "demo-fixed-save", name: "Monthly Saving", amount: 200, category: "savings" },
    ],
    savingsAccounts: [
      { id: "demo-sav-emergency", name: "Emergency Fund", balance: 3200 },
      { id: "demo-sav-holiday", name: "Holiday Fund", balance: 980 },
    ],
    creditCardAccounts: [],
    plannedPaymentPlans: [],
    months: {},
  };
}

function buildCollections() {
  const monthKey = currentMonthKey();
  return {
    transactions: [
      { id: "demo-txn-001", type: "expense", category: "Groceries", amount: 64.2, date: `${monthKey}-04`, isRecurring: false, notes: "Weekly shop" },
      { id: "demo-txn-002", type: "expense", category: "Fuel", amount: 58.0, date: `${monthKey}-07`, isRecurring: false, notes: "Diesel" },
      { id: "demo-txn-003", type: "expense", category: "Dining", amount: 32.5, date: `${monthKey}-11`, isRecurring: false, notes: "Meal out" },
      { id: "demo-txn-004", type: "income", category: "Refund", amount: 24.99, date: `${monthKey}-12`, isRecurring: false, notes: "Returned item" },
    ],
    bills: [
      { id: "demo-bill-001", name: "Gym Membership", amount: 32, dueDay: 1, isRecurring: true },
      { id: "demo-bill-002", name: "Streaming", amount: 15.99, dueDay: 8, isRecurring: true },
      { id: "demo-bill-003", name: "Car Finance", amount: 248, dueDay: 15, isRecurring: true },
    ],
    savings: { target: 5000, current: 4180 },
    goals: [
      { id: "demo-goal-001", type: "custom", name: "New Laptop", target: 1200, current: 540, deadline: null },
    ],
    notes: [
      { id: "demo-note-001", content: "Review car insurance renewal before the demo.", createdAt: new Date().toISOString() },
    ],
    attachments: [],
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
