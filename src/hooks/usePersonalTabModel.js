import { useCallback, useMemo } from "react";
import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/calculations";
import {
  buildDerivedModel,
  buildFinanceDashboardModel,
  createDefaultFinanceState,
  ensureFinanceState,
  ensureMonthFinanceState,
  makeCollectionItem,
  makeCreditCardAccount,
  makeCreditCardItem,
  makeFixedOutgoingItem,
  makeFuelEntry,
  makeOvertimeEntry,
  makePlannedPaymentPlan,
  makeSavingsAccount,
  makeSavingsTransaction,
  makeUserAccount,
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

  const updateCurrentMonthTaxOverride = useCallback(
    (patch) => {
      const safePatch = Object.fromEntries(
        Object.entries(patch || {}).filter(([key]) => TAX_OVERRIDE_KEYS.has(key))
      );
      if (Object.keys(safePatch).length === 0) return;

      updateMonth((month) => ({
        ...month,
        ...safePatch,
      }));
    },
    [updateMonth]
  );

  const resetCurrentMonthTaxOverride = useCallback(
    () => {
      updateMonth((month) => ({
        ...month,
        useManualTax: false,
        manualTax: 0,
        manualNationalInsurance: 0,
      }));
    },
    [updateMonth]
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

    updatePaySetting: (key, value) => {
      if (TAX_OVERRIDE_KEYS.has(key)) {
        updateCurrentMonthTaxOverride({ [key]: value });
        return;
      }
      update((current) => ({
        ...current,
        paySettings: { ...current.paySettings, [key]: value },
      }));
    },

    updateMonthField: (key, value) =>
      updateMonth((month) => ({ ...month, [key]: value })),

    updateMonthTaxOverride: (key, value) =>
      updateCurrentMonthTaxOverride({ [key]: value }),

    resetMonthTaxOverride: resetCurrentMonthTaxOverride,

    addFixedOutgoing: () =>
      update((current) => ({
        ...current,
        fixedOutgoings: [...(current.fixedOutgoings || []), makeFixedOutgoingItem("", 0, "other")],
      })),
    updateFixedOutgoing: (id, patch) =>
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        return {
          ...current,
          fixedOutgoings: (current.fixedOutgoings || []).map((entry) => {
            if (entry.id !== id) return entry;
            const override = entry.monthOverrides?.[monthKey];
            if (
              patch &&
              Object.prototype.hasOwnProperty.call(patch, "amount") &&
              override?.enabled === true
            ) {
              return {
                ...entry,
                monthOverrides: {
                  ...(entry.monthOverrides || {}),
                  [monthKey]: {
                    enabled: true,
                    amount: patch.amount,
                  },
                },
              };
            }
            return { ...entry, ...patch };
          }),
        };
      }),
    removeFixedOutgoing: (id) =>
      update((current) => ({
        ...current,
        fixedOutgoings: (current.fixedOutgoings || []).filter((entry) => entry.id !== id),
      })),
    setFixedOutgoingMonthOverride: (id, enabled) =>
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        return {
          ...current,
          fixedOutgoings: (current.fixedOutgoings || []).map((entry) => {
            if (entry.id !== id) return entry;
            const nextOverrides = { ...(entry.monthOverrides || {}) };
            if (enabled) {
              nextOverrides[monthKey] = {
                enabled: true,
                amount: nextOverrides[monthKey]?.amount ?? entry.amount ?? 0,
              };
            } else {
              delete nextOverrides[monthKey];
            }
            return {
              ...entry,
              monthOverrides: nextOverrides,
            };
          }),
        };
      }),
    updateFixedOutgoingMonthOverrideAmount: (id, amount) =>
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        return {
          ...current,
          fixedOutgoings: (current.fixedOutgoings || []).map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  monthOverrides: {
                    ...(entry.monthOverrides || {}),
                    [monthKey]: {
                      enabled: true,
                      amount,
                    },
                  },
                }
              : entry
          ),
        };
      }),

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

    addCreditCardAccount: (name = "") =>
      update((current) => ({
        ...current,
        creditCardAccounts: [...(current.creditCardAccounts || []), makeCreditCardAccount(name)],
      })),
    updateCreditCardAccount: (id, patch) =>
      update((current) => ({
        ...current,
        creditCardAccounts: (current.creditCardAccounts || []).map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeCreditCardAccount: (id) =>
      update((current) => {
        const nextMonths = Object.fromEntries(
          Object.entries(current.months || {}).map(([monthKey, rawMonth]) => {
            const month = ensureMonthFinanceState(rawMonth, { creditCardAccounts: current.creditCardAccounts || [] });
            return [
              monthKey,
              {
                ...month,
                creditCards: month.creditCards.map((entry) =>
                  entry.cardId === id
                    ? { ...entry, cardId: "" }
                    : entry
                ),
              },
            ];
          })
        );

        return {
          ...current,
          creditCardAccounts: (current.creditCardAccounts || []).filter((entry) => entry.id !== id),
          months: nextMonths,
        };
      }),
    addCreditCard: () =>
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        const month = ensureMonthFinanceState(current.months?.[monthKey], {
          creditCardAccounts: current.creditCardAccounts || [],
        });
        const defaultAccount = (current.creditCardAccounts || [])[0] || null;
        return {
          ...current,
          months: {
            ...current.months,
            [monthKey]: {
              ...month,
              creditCards: [
                ...month.creditCards,
                makeCreditCardItem({
                  cardId: defaultAccount?.id || "",
                  name: defaultAccount?.name || "Card",
                }),
              ],
            },
          },
        };
      }),
    updateCreditCard: (id, patch) =>
      update((current) => {
        const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
        const month = ensureMonthFinanceState(current.months?.[monthKey], {
          creditCardAccounts: current.creditCardAccounts || [],
        });
        const nextCards = month.creditCards.map((entry) => {
          if (entry.id !== id) return entry;
          if (patch.cardId !== undefined) {
            const matchedAccount = (current.creditCardAccounts || []).find((account) => account.id === patch.cardId) || null;
            return {
              ...entry,
              ...patch,
              cardId: matchedAccount?.id || "",
              name: matchedAccount?.name || patch.name || entry.name || "",
            };
          }
          return { ...entry, ...patch };
        });

        return {
          ...current,
          months: {
            ...current.months,
            [monthKey]: {
              ...month,
              creditCards: nextCards,
            },
          },
        };
      }),
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
        fuelEntries: (month.fuelEntries || []).map((entry) => {
          if (entry.id !== id) return entry;
          const next = makeFuelEntry({
            cost: patch.cost ?? entry.cost,
            litres: patch.litres ?? entry.litres,
            costPerLitre: patch.costPerLitre ?? entry.costPerLitre,
            date: patch.date ?? entry.date,
          });
          return { ...entry, ...patch, ...next, id: entry.id };
        }),
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

    // User accounts (global, display-only snapshot accounts for Finance Overview)
    addAccount: ({ name = "", type = "current", balance = 0, showInOverview = true, creditLimit = 0 } = {}) =>
      update((current) => {
        const existing = current.userAccounts || [];
        const trimmedName = String(name || "").trim();
        const isDuplicate = existing.some(
          (entry) => entry.type === type && String(entry.name || "").trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate && trimmedName) return current;
        return {
          ...current,
          userAccounts: [...existing, makeUserAccount({ name, type, balance, showInOverview, creditLimit })],
        };
      }),
    updateAccount: (id, patch) =>
      update((current) => ({
        ...current,
        userAccounts: (current.userAccounts || []).map((entry) => {
          if (entry.id !== id) return entry;
          const next = { ...entry, ...patch };
          if (patch.name !== undefined) next.name = String(patch.name || "").trim();
          return next;
        }),
      })),
    removeAccount: (id) =>
      update((current) => ({
        ...current,
        userAccounts: (current.userAccounts || []).filter((entry) => entry.id !== id),
      })),
    toggleAccountVisibility: (id) =>
      update((current) => ({
        ...current,
        userAccounts: (current.userAccounts || []).map((entry) =>
          entry.id === id ? { ...entry, showInOverview: !entry.showInOverview } : entry
        ),
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
  const TAX_OVERRIDE_KEYS = new Set(["useManualTax", "manualTax", "manualNationalInsurance"]);
