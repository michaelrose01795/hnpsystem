import { useCallback, useMemo } from "react";
import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/calculations";
import {
  buildDerivedModel,
  buildFinanceDashboardModel,
  createDefaultFinanceState,
  ensureFinanceState,
  ensureMonthFinanceState,
  makeCollectionItem,
  makeCreditCardItem,
  makeFuelEntry,
  makeOvertimeEntry,
  makePlannedPaymentPlan,
  makeSavingsAccount,
  makeSavingsTransaction,
} from "@/lib/profile/personalFinance";

/**
 * Unified hook for the Personal tab finance model.
 *
 * Reads financeState directly from the dashboard's canonical state blob
 * and writes all changes back through `onUpdateFinanceState`. There is
 * no internal copy or debounce — the dashboard hook's single debounced
 * save handles persistence for all Personal tab data in one place.
 */
export default function usePersonalTabModel({ financeState: rawFinanceState = null, workData = null, onUpdateFinanceState }) {
  const financeState = useMemo(
    () =>
      ensureFinanceState(
        rawFinanceState || createDefaultFinanceState({ workData, monthKey: getCurrentMonthKey() }),
        { workData, monthKey: getCurrentMonthKey() }
      ),
    [rawFinanceState, workData]
  );

  const selectedMonthKey = normaliseMonthKey(financeState.selectedMonthKey, getCurrentMonthKey());

  const model = useMemo(
    () => buildFinanceDashboardModel({ financeState, workData, monthKey: selectedMonthKey }),
    [financeState, selectedMonthKey, workData]
  );

  const derived = useMemo(
    () => buildDerivedModel({ financeModel: model, workData }),
    [model, workData]
  );

  // Helper: apply an updater to the ensured state and push to parent.
  // We ensure the state inside the updater so the mutation always works
  // on a fully-normalised object, regardless of what's in the blob.
  const update = useCallback(
    (fn) => {
      onUpdateFinanceState?.((current) => {
        const ensured = ensureFinanceState(
          current || createDefaultFinanceState({ workData, monthKey: getCurrentMonthKey() }),
          { workData, monthKey: getCurrentMonthKey() }
        );
        return fn(ensured);
      });
    },
    [onUpdateFinanceState, workData]
  );

  // Helper: mutate the current month's data within the finance state.
  const updateMonth = useCallback(
    (fn) => {
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        const previousMonth = ensureMonthFinanceState(current.months?.[monthKey]);
        const nextMonth = fn(previousMonth);
        return {
          ...current,
          months: {
            ...current.months,
            [monthKey]: ensureMonthFinanceState(nextMonth),
          },
        };
      });
    },
    [update]
  );

  return {
    financeState,
    model,
    derived,

    setSelectedMonth: (monthKey) =>
      update((current) => ({
        ...current,
        selectedMonthKey: normaliseMonthKey(monthKey, current.selectedMonthKey),
      })),

    updatePaySetting: (key, value) =>
      update((current) => ({
        ...current,
        paySettings: { ...current.paySettings, [key]: value },
      })),

    updateMonthField: (key, value) =>
      updateMonth((month) => ({ ...month, [key]: value })),

    addFixedOutgoing: () =>
      updateMonth((month) => ({
        ...month,
        fixedOutgoings: [...month.fixedOutgoings, makeCollectionItem("", 0)],
      })),
    updateFixedOutgoing: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        fixedOutgoings: month.fixedOutgoings.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeFixedOutgoing: (id) =>
      updateMonth((month) => ({
        ...month,
        fixedOutgoings: month.fixedOutgoings.filter((entry) => entry.id !== id),
      })),

    addPlannedPayment: () =>
      updateMonth((month) => ({
        ...month,
        plannedPayments: [...month.plannedPayments, makeCollectionItem("", 0)],
      })),
    updatePlannedPayment: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        plannedPayments: month.plannedPayments.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removePlannedPayment: (id) =>
      updateMonth((month) => ({
        ...month,
        plannedPayments: month.plannedPayments.filter((entry) => entry.id !== id),
      })),

    // Savings accounts (global, not per-month)
    addSavingsAccount: (name = "", interestRate = 0, openingBalance = 0, parentGroup = "") =>
      update((current) => ({
        ...current,
        savingsAccounts: [...(current.savingsAccounts || []), makeSavingsAccount(name, interestRate, openingBalance, parentGroup)],
      })),
    updateSavingsAccount: (id, patch) =>
      update((current) => ({
        ...current,
        savingsAccounts: (current.savingsAccounts || []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeSavingsAccount: (id) =>
      update((current) => ({
        ...current,
        savingsAccounts: (current.savingsAccounts || []).filter((entry) => entry.id !== id),
      })),

    // Planned payment plans (global, not per-month)
    addPlannedPaymentPlan: (name = "", startMonth = selectedMonthKey, endMonth = selectedMonthKey) =>
      update((current) => ({
        ...current,
        plannedPaymentPlans: [...(current.plannedPaymentPlans || []), makePlannedPaymentPlan(name, startMonth, endMonth)],
      })),
    updatePlannedPaymentPlan: (id, patch) =>
      update((current) => ({
        ...current,
        plannedPaymentPlans: (current.plannedPaymentPlans || []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removePlannedPaymentPlan: (id) =>
      update((current) => ({
        ...current,
        plannedPaymentPlans: (current.plannedPaymentPlans || []).filter((entry) => entry.id !== id),
      })),
    updatePlannedPaymentPlanMonth: (id, monthKey, amount) =>
      update((current) => ({
        ...current,
        plannedPaymentPlans: (current.plannedPaymentPlans || []).map((entry) =>
          entry.id === id
            ? { ...entry, monthlyAmounts: { ...entry.monthlyAmounts, [monthKey]: amount } }
            : entry
        ),
      })),

    // Savings transactions (per-month, linked to accounts)
    addSavingsBucket: (accountId = "", amount = 0, type = "deposit") =>
      updateMonth((month) => ({
        ...month,
        savingsBuckets: [...month.savingsBuckets, makeSavingsTransaction(accountId, amount, type)],
      })),
    updateSavingsBucket: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        savingsBuckets: month.savingsBuckets.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeSavingsBucket: (id) =>
      updateMonth((month) => ({
        ...month,
        savingsBuckets: month.savingsBuckets.filter((entry) => entry.id !== id),
      })),

    addCreditCard: () =>
      updateMonth((month) => ({
        ...month,
        creditCards: [...month.creditCards, makeCreditCardItem("Card")],
      })),
    updateCreditCard: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        creditCards: month.creditCards.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeCreditCard: (id) =>
      updateMonth((month) => ({
        ...month,
        creditCards: month.creditCards.filter((entry) => entry.id !== id),
      })),

    addFuelEntry: ({ cost = 0, litres = 0, costPerLitre = 0, date = "" } = {}) =>
      updateMonth((month) => ({
        ...month,
        fuelEntries: [...(month.fuelEntries || []), makeFuelEntry({ cost, litres, costPerLitre, date })],
      })),
    updateFuelEntry: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        fuelEntries: (month.fuelEntries || []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeFuelEntry: (id) =>
      updateMonth((month) => ({
        ...month,
        fuelEntries: (month.fuelEntries || []).filter((entry) => entry.id !== id),
      })),

    addOvertimeEntry: () =>
      updateMonth((month) => ({
        ...month,
        overtimeEntries: [...month.overtimeEntries, makeOvertimeEntry(selectedMonthKey)],
      })),
    updateOvertimeEntry: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        overtimeEntries: month.overtimeEntries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeOvertimeEntry: (id) =>
      updateMonth((month) => ({
        ...month,
        overtimeEntries: month.overtimeEntries.filter((entry) => entry.id !== id),
      })),

    toggleCollapsed: (widgetType) =>
      update((current) => ({
        ...current,
        ui: {
          ...current.ui,
          collapsed: {
            ...(current.ui?.collapsed || {}),
            [widgetType]: !(current.ui?.collapsed || {})[widgetType],
          },
        },
      })),
  };
}
