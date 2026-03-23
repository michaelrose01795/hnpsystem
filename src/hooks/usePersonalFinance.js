import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/monthPlanning";
import {
  buildFinanceDashboardModel,
  createDefaultFinanceState,
  ensureFinanceState,
  ensureMonthFinanceState,
  makeCollectionItem,
  makeCreditCardItem,
  makeOvertimeEntry,
} from "@/lib/profile/personalFinance";

function readFinancePayload(widgetDataMap = {}) {
  const netWidgetData = widgetDataMap?.["net-position"]?.data || {};
  if (netWidgetData?.financeState && typeof netWidgetData.financeState === "object") {
    return { root: netWidgetData, financeState: netWidgetData.financeState };
  }
  return { root: netWidgetData, financeState: null };
}

export default function usePersonalFinance({ widgetDataMap = {}, workData = null, onSaveFinanceState }) {
  const source = readFinancePayload(widgetDataMap);
  const initialised = useMemo(
    () => ensureFinanceState(source.financeState || createDefaultFinanceState({ workData, monthKey: getCurrentMonthKey() }), {
      workData,
      monthKey: getCurrentMonthKey(),
    }),
    [source.financeState, workData]
  );

  const [financeState, setFinanceState] = useState(initialised);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    setFinanceState(initialised);
    skipPersistRef.current = true;
  }, [initialised]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      onSaveFinanceState?.({
        ...source.root,
        financeState,
      });
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [financeState, onSaveFinanceState, source.root]);

  const selectedMonthKey = normaliseMonthKey(financeState.selectedMonthKey, getCurrentMonthKey());

  const updateMonth = (updater) => {
    setFinanceState((current) => {
      const monthKey = normaliseMonthKey(current.selectedMonthKey, getCurrentMonthKey());
      const previousMonth = ensureMonthFinanceState(current.months?.[monthKey]);
      const nextMonth = updater(previousMonth);
      return {
        ...current,
        months: {
          ...current.months,
          [monthKey]: ensureMonthFinanceState(nextMonth),
        },
      };
    });
  };

  const model = useMemo(
    () => buildFinanceDashboardModel({ financeState, workData, monthKey: selectedMonthKey }),
    [financeState, selectedMonthKey, workData]
  );

  return {
    financeState,
    model,
    setSelectedMonth: (monthKey) =>
      setFinanceState((current) => ({
        ...current,
        selectedMonthKey: normaliseMonthKey(monthKey, current.selectedMonthKey),
      })),
    updatePaySetting: (key, value) =>
      setFinanceState((current) => ({
        ...current,
        paySettings: {
          ...current.paySettings,
          [key]: value,
        },
      })),
    updateMonthField: (key, value) =>
      updateMonth((month) => ({
        ...month,
        [key]: value,
      })),
    addFixedOutgoing: () => updateMonth((month) => ({ ...month, fixedOutgoings: [...month.fixedOutgoings, makeCollectionItem("", 0)] })),
    updateFixedOutgoing: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        fixedOutgoings: month.fixedOutgoings.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeFixedOutgoing: (id) =>
      updateMonth((month) => ({ ...month, fixedOutgoings: month.fixedOutgoings.filter((entry) => entry.id !== id) })),
    addPlannedPayment: () => updateMonth((month) => ({ ...month, plannedPayments: [...month.plannedPayments, makeCollectionItem("", 0)] })),
    updatePlannedPayment: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        plannedPayments: month.plannedPayments.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removePlannedPayment: (id) =>
      updateMonth((month) => ({ ...month, plannedPayments: month.plannedPayments.filter((entry) => entry.id !== id) })),
    addSavingsBucket: () => updateMonth((month) => ({ ...month, savingsBuckets: [...month.savingsBuckets, makeCollectionItem("", 0)] })),
    updateSavingsBucket: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        savingsBuckets: month.savingsBuckets.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeSavingsBucket: (id) =>
      updateMonth((month) => ({ ...month, savingsBuckets: month.savingsBuckets.filter((entry) => entry.id !== id) })),
    addCreditCard: () => updateMonth((month) => ({ ...month, creditCards: [...month.creditCards, makeCreditCardItem("Card")] })),
    updateCreditCard: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        creditCards: month.creditCards.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeCreditCard: (id) =>
      updateMonth((month) => ({ ...month, creditCards: month.creditCards.filter((entry) => entry.id !== id) })),
    addOvertimeEntry: () => updateMonth((month) => ({ ...month, overtimeEntries: [...month.overtimeEntries, makeOvertimeEntry(selectedMonthKey)] })),
    updateOvertimeEntry: (id, patch) =>
      updateMonth((month) => ({
        ...month,
        overtimeEntries: month.overtimeEntries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      })),
    removeOvertimeEntry: (id) =>
      updateMonth((month) => ({ ...month, overtimeEntries: month.overtimeEntries.filter((entry) => entry.id !== id) })),
    toggleCollapsed: (widgetType) =>
      setFinanceState((current) => ({
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
