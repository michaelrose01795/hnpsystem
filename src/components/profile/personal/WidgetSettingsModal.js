import React, { useEffect, useMemo, useState } from "react";
import { CalendarField } from "@/components/calendarAPI";
import DropdownField from "@/components/dropdownAPI/DropdownField";
import useIsMobile from "@/hooks/useIsMobile";
import PopupModal from "@/components/popups/popupStyleApi";
import {
  EmptyState,
  formatCurrency,
  formatDate,
  toNumber,
  widgetAccentSurfaceStyle,
  widgetInsetSurfaceStyle,
} from "@/components/profile/personal/widgets/shared";
import Button from "@/components/ui/Button";
import {
  calculateMortgagePaymentBreakdown,
  calculateMortgagePayoffTimeline,
  calculateProjectedSavingsDate,
  formatMonthLabel,
  getCurrentMonthKey,
  normaliseMonthKey,
  shiftMonthKey,
} from "@/lib/profile/calculations";
import { FIXED_OUTGOING_CATEGORY_OPTIONS } from "@/lib/profile/personalFinance";

const RECURRING_DAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const RECURRING_PATTERN_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "alternate", label: "Alternate weeks" },
];

const RECURRING_PARITY_OPTIONS = [
  { value: "odd", label: "Odd weeks" },
  { value: "even", label: "Even weeks" },
];

function makeRecurringRule() {
  return {
    rule_id: `local-${Math.random().toString(36).slice(2, 10)}`,
    day_of_week: 1,
    hours: "",
    active: true,
    pattern_type: "weekly",
    week_parity: null,
    label: "",
    isLocal: true,
  };
}

const WIDGET_SETTINGS_PRESETS = {
  income: {
    baseMonthlyIncome: 0,
    useWorkEstimate: true,
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  spending: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  savings: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    includeInNetPosition: true,
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  bills: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  fuel: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    expectedMileage: "",
    trendPct: "",
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  holiday: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    targetAmount: 0,
    goalDate: "",
    linkedPaymentPlanIds: [],
    holidayPaymentLinks: {},
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  mortgage: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    mode: "saving",
    savingsGoal: 0,
    monthlyContribution: 0,
    totalSaved: 0,
    savingsDeadline: "",
    linkedSavingsAccountId: "",
    linkedMortgagePaymentSourceId: "",
    mortgageMonthlyPayment: 0,
    interestRate: 0,
    termLengthYears: 25,
    remainingBalance: 0,
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  "net-position": {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    includeSavings: true,
    includeBills: true,
    includeFuel: true,
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  chart: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    chartSource: "spendingByCategory",
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  "work-summary": {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    plannedHours: 0,
    plannedOvertimeHours: 0,
    useWorkEstimate: true,
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  notes: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  attachments: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
  custom: {
    useGlobalMonth: true,
    monthKey: getCurrentMonthKey(),
    customTitle: "Custom widget",
    customAmount: 0,
    customTarget: 0,
    customNote: "",
    dateDisplayMode: "month",
    dateValue: getCurrentMonthKey(),
  },
};

function buildInitialSettings(widgetType, data = {}, activeMonthKey = getCurrentMonthKey()) {
  const preset = WIDGET_SETTINGS_PRESETS[widgetType] || WIDGET_SETTINGS_PRESETS.spending;
  const saved = data?.settings || {};
  const savedMode = saved.dateDisplayMode || "month";
  const savedDateValue = saved.dateValue || saved.monthKey || activeMonthKey;
  const normalisedMonth = normaliseMonthKey(saved.monthKey || activeMonthKey, activeMonthKey);

  const initial = {
    ...preset,
    ...saved,
    monthKey: normalisedMonth,
    dateDisplayMode: savedMode,
    dateValue: savedMode === "day" ? String(savedDateValue).slice(0, 10) : String(savedDateValue).slice(0, 7),
  };

  if (widgetType === "mortgage") {
    return {
      ...initial,
      mode: saved.mode === "bills" ? "bills" : "saving",
      savingsGoal: toNumber(saved.savingsGoal ?? saved.depositTarget, 0),
      monthlyContribution: toNumber(saved.monthlyContribution ?? saved.monthlyPayment, 0),
      totalSaved: toNumber(saved.totalSaved ?? saved.currentSaved, 0),
      savingsDeadline: saved.savingsDeadline || saved.mortgageDeadline || "",
      mortgageMonthlyPayment: toNumber(saved.mortgageMonthlyPayment ?? saved.monthlyPayment, 0),
      interestRate: toNumber(saved.interestRate, 0),
      termLengthYears: toNumber(saved.termLengthYears, preset.termLengthYears),
      remainingBalance: toNumber(saved.remainingBalance, 0),
    };
  }

  return initial;
}

function buildMonthOptions(centerMonthKey, radius = 12) {
  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const offset = index - radius;
    const monthKey = shiftMonthKey(centerMonthKey, offset);
    return {
      value: monthKey,
      label: formatMonthLabel(monthKey),
    };
  });
}

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "4px" }}>{children}</div>;
}

function Section({ title, description = "", children }) {
  return (
    <section
      style={{
        display: "grid",
        gap: "10px",
        ...widgetAccentSurfaceStyle,
        padding: "14px",
      }}
    >
      <div style={{ display: "grid", gap: "4px" }}>
        <div
          style={{
            fontSize: "0.74rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}

function SegmentedTabs({ value, options = [], onChange }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "8px",
        gridTemplateColumns: `repeat(${options.length || 1}, minmax(0, 1fr))`,
        ...widgetInsetSurfaceStyle,
        padding: "6px",
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "10px 12px",
              background: isActive ? "rgba(var(--primary-rgb), 0.12)" : "transparent",
              color: "var(--text-primary)",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "var(--control-transition)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function resolveLinkedMortgagePaymentValue(finance, sourceId = "") {
  const savingsBalances = finance?.model?.savingsAccountBalances || [];
  const fixedOutgoings = finance?.model?.currentMonth?.monthState?.fixedOutgoings || [];
  const paymentPlans = finance?.model?.plannedPaymentPlanDetails || [];

  if (!sourceId) return null;
  if (sourceId.startsWith("savings:")) {
    const savingsAccount = savingsBalances.find((entry) => entry.id === sourceId.slice(8));
    return savingsAccount ? Number(savingsAccount.monthInflow || 0) : null;
  }
  if (sourceId.startsWith("fixed:")) {
    const fixed = fixedOutgoings.find((entry) => entry.id === sourceId.slice(6));
    return fixed ? Number(fixed.amount || 0) : null;
  }
  if (sourceId.startsWith("plan:")) {
    const plan = paymentPlans.find((entry) => entry.id === sourceId.slice(5));
    return plan ? Number(plan.thisMonthAmount || 0) : null;
  }
  return null;
}

function MortgageModeEditor({ finance, isMobile, settings, updateSetting }) {
  const accounts = finance?.financeState?.savingsAccounts || [];
  const balances = finance?.model?.savingsAccountBalances || [];
  const fixedOutgoings = finance?.model?.currentMonth?.monthState?.fixedOutgoings || [];
  const paymentPlans = finance?.model?.plannedPaymentPlanDetails || [];
  const mode = settings.mode === "bills" ? "bills" : "saving";
  const linkedSavingsId = settings.linkedSavingsAccountId || "";
  const linkedPaymentSourceId = settings.linkedMortgagePaymentSourceId || "";
  const linkedSavingsBalance = linkedSavingsId
    ? balances.find((entry) => entry.id === linkedSavingsId)?.currentBalance || 0
    : null;
  const linkedPaymentValue = resolveLinkedMortgagePaymentValue(finance, linkedPaymentSourceId);
  const totalSaved = linkedSavingsBalance !== null ? Number(linkedSavingsBalance) : Number(settings.totalSaved || 0);
  const monthlyContribution = linkedPaymentValue !== null
    ? Number(linkedPaymentValue)
    : Number(settings.monthlyContribution || 0);
  const mortgageMonthlyPayment = linkedPaymentValue !== null
    ? Number(linkedPaymentValue)
    : Number(settings.mortgageMonthlyPayment || 0);
  const remainingAmount = Math.max(0, Number(settings.savingsGoal || 0) - totalSaved);
  const projectedDate = calculateProjectedSavingsDate({
    targetAmount: settings.savingsGoal || 0,
    currentAmount: totalSaved,
    monthlyContribution,
  });
  const monthsToGoal = Number(settings.savingsGoal || 0) <= totalSaved
    ? 0
    : monthlyContribution > 0
      ? Math.ceil(remainingAmount / monthlyContribution)
      : null;
  const paymentBreakdown = useMemo(
    () => calculateMortgagePaymentBreakdown({
      remainingBalance: settings.remainingBalance,
      monthlyPayment: mortgageMonthlyPayment,
      interestRate: settings.interestRate,
    }),
    [mortgageMonthlyPayment, settings.interestRate, settings.remainingBalance]
  );
  const payoffTimeline = useMemo(
    () => calculateMortgagePayoffTimeline({
      remainingBalance: settings.remainingBalance,
      monthlyPayment: mortgageMonthlyPayment,
      interestRate: settings.interestRate,
    }),
    [mortgageMonthlyPayment, settings.interestRate, settings.remainingBalance]
  );

  const savingsAccountOptions = [
    { label: "Manual entry", value: "" },
    ...accounts.map((account) => {
      const balance = balances.find((entry) => entry.id === account.id);
      return {
        label: `${account.name || "Unnamed"} (${formatCurrency(balance?.currentBalance || 0)})`,
        value: account.id,
      };
    }),
  ];

  const paymentSourceOptions = [
    { label: "Manual entry", value: "" },
    ...accounts.map((account) => {
      const balance = balances.find((entry) => entry.id === account.id);
      return {
        label: `Savings: ${account.name || "Unnamed"} (${formatCurrency(balance?.monthInflow || 0)}/month)`,
        value: `savings:${account.id}`,
      };
    }),
    ...fixedOutgoings.map((entry) => ({
      label: `Spending: ${entry.name || "Unnamed"} (${formatCurrency(entry.amount || 0)})`,
      value: `fixed:${entry.id}`,
    })),
    ...paymentPlans.map((plan) => ({
      label: `Payment schedule: ${plan.name || "Unnamed"} (${formatCurrency(plan.thisMonthAmount || 0)})`,
      value: `plan:${plan.id}`,
    })),
  ];

  return (
    <Section title="Mortgage mode" description="Only one mortgage mode is active at a time.">
      <SegmentedTabs
        value={mode}
        onChange={(nextMode) => updateSetting("mode", nextMode)}
        options={[
          { value: "saving", label: "Saving for Mortgage" },
          { value: "bills", label: "Mortgage Bills" },
        ]}
      />

      {mode === "saving" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            <label>
              <FieldLabel>Savings goal</FieldLabel>
              <input className="app-input" type="number" value={settings.savingsGoal} onChange={(e) => updateSetting("savingsGoal", e.target.value)} />
            </label>
            <div style={{ display: "grid", gap: "6px" }}>
              <FieldLabel>Total saved</FieldLabel>
              <DropdownField
                value={linkedSavingsId}
                options={savingsAccountOptions}
                onChange={(event) => {
                  const value = event.target.value;
                  updateSetting("linkedSavingsAccountId", value);
                  if (value) {
                    const balance = balances.find((entry) => entry.id === value);
                    updateSetting("totalSaved", balance?.currentBalance || 0);
                  }
                }}
                placeholder="Link savings account..."
              />
              {!linkedSavingsId ? (
                <input className="app-input" type="number" value={settings.totalSaved} onChange={(e) => updateSetting("totalSaved", e.target.value)} />
              ) : null}
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <FieldLabel>Monthly contribution</FieldLabel>
              <DropdownField
                value={linkedPaymentSourceId}
                options={paymentSourceOptions}
                menuStyle={{ maxHeight: "192px", overflowY: "auto" }}
                onChange={(event) => {
                  const value = event.target.value;
                  updateSetting("linkedMortgagePaymentSourceId", value);
                  if (value) {
                    const linkedValue = resolveLinkedMortgagePaymentValue(finance, value);
                    if (linkedValue !== null) updateSetting("monthlyContribution", linkedValue);
                  }
                }}
                placeholder="Link monthly contribution..."
              />
              {!linkedPaymentSourceId ? (
                <input className="app-input" type="number" value={settings.monthlyContribution} onChange={(e) => updateSetting("monthlyContribution", e.target.value)} />
              ) : (
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Auto-updated from linked contribution source
                </div>
              )}
            </div>
            <label>
              <FieldLabel>Timeline target date</FieldLabel>
              <CalendarField value={settings.savingsDeadline || ""} onChange={(e) => updateSetting("savingsDeadline", e.target.value)} placeholder="Target date" />
            </label>
          </div>

          <div style={{ display: "grid", gap: "8px", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Remaining amount</FieldLabel>
              <div style={{ fontSize: "0.92rem", fontWeight: 700 }}>{formatCurrency(remainingAmount)}</div>
            </div>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Timeline</FieldLabel>
              <div style={{ fontSize: "0.92rem", fontWeight: 700 }}>
                {monthsToGoal === null ? "No estimate" : `${monthsToGoal} month${monthsToGoal === 1 ? "" : "s"}`}
              </div>
            </div>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Projected date</FieldLabel>
              <div style={{ fontSize: "0.92rem", fontWeight: 700 }}>{projectedDate ? formatDate(projectedDate) : "No projection"}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <FieldLabel>Monthly payment</FieldLabel>
              <DropdownField
                value={linkedPaymentSourceId}
                options={paymentSourceOptions}
                menuStyle={{ maxHeight: "192px", overflowY: "auto" }}
                onChange={(event) => {
                  const value = event.target.value;
                  updateSetting("linkedMortgagePaymentSourceId", value);
                  if (value) {
                    const linkedValue = resolveLinkedMortgagePaymentValue(finance, value);
                    if (linkedValue !== null) updateSetting("mortgageMonthlyPayment", linkedValue);
                  }
                }}
                placeholder="Link monthly payment..."
              />
              {!linkedPaymentSourceId ? (
                <input className="app-input" type="number" value={settings.mortgageMonthlyPayment} onChange={(e) => updateSetting("mortgageMonthlyPayment", e.target.value)} />
              ) : (
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Auto-updated from linked payment source
                </div>
              )}
            </div>
            <label>
              <FieldLabel>Interest rate (%)</FieldLabel>
              <input className="app-input" type="number" step="0.01" value={settings.interestRate} onChange={(e) => updateSetting("interestRate", e.target.value)} />
            </label>
            <label>
              <FieldLabel>Term length (years)</FieldLabel>
              <input className="app-input" type="number" value={settings.termLengthYears} onChange={(e) => updateSetting("termLengthYears", e.target.value)} />
            </label>
            <label>
              <FieldLabel>Remaining balance</FieldLabel>
              <input className="app-input" type="number" value={settings.remainingBalance} onChange={(e) => updateSetting("remainingBalance", e.target.value)} />
            </label>
          </div>

          <div style={{ display: "grid", gap: "8px", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Breakdown</FieldLabel>
              <div style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
                {formatCurrency(paymentBreakdown.interestPayment)} interest / {formatCurrency(paymentBreakdown.capitalPayment)} capital
              </div>
            </div>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Balance after payment</FieldLabel>
              <div style={{ fontSize: "0.92rem", fontWeight: 700 }}>{formatCurrency(paymentBreakdown.remainingAfterPayment)}</div>
            </div>
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
              <FieldLabel>Payoff timeline</FieldLabel>
              <div style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
                {payoffTimeline.isPaymentInsufficient
                  ? "Payment too low"
                  : payoffTimeline.monthsToPayoff === null
                    ? "No estimate"
                    : `${payoffTimeline.monthsToPayoff} months`}
              </div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function FinanceCollectionEditor({
  title,
  source,
  rows = [],
  isMobile,
  emptyLabel,
  namePlaceholder,
  amountPlaceholder,
  onAdd,
  onUpdate,
  onRemove,
  extraColumns = null,
  categoryOptions = null,
}) {
  const gridTemplateColumns = extraColumns || (
    isMobile ? "minmax(0, 1fr)" : categoryOptions ? "1.5fr 0.9fr 1fr auto" : "1.6fr 1fr auto"
  );

  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {rows.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns,
                padding: "8px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <input className="app-input" value={entry.name || ""} placeholder={namePlaceholder} onChange={(e) => onUpdate(entry.id, { name: e.target.value })} />
              <input className="app-input" type="number" value={entry.amount || 0} placeholder={amountPlaceholder} onChange={(e) => onUpdate(entry.id, { amount: toNumber(e.target.value) })} />
              {categoryOptions ? (
                <DropdownField
                  value={entry.category || "other"}
                  onChange={(e) => onUpdate(entry.id, { category: e.target.value })}
                  options={categoryOptions}
                />
              ) : null}
              <Button type="button" variant="secondary" size="sm" pill onClick={() => onRemove(entry.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" pill onClick={onAdd} style={{ justifySelf: "start" }}>
        Add row
      </Button>
    </Section>
  );
}

function CreditCardEditor({ finance, isMobile }) {
  const rows = finance?.model?.currentMonth?.monthState?.creditCards || [];
  const accounts = finance?.financeState?.creditCardAccounts || [];
  const accountOptions = accounts.map((entry) => ({ value: entry.id, label: entry.name || "Card" }));

  return (
    <Section
      title="Credit cards"
    >
      {!isMobile && rows.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "4px",
            gridTemplateColumns: "1.4fr 1fr 1fr auto auto",
            fontSize: "0.74rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            padding: "0 2px",
          }}
        >
          <span>Name</span>
          <span>Balance</span>
          <span>Monthly payment</span>
          <span>Paid off</span>
          <span />
        </div>
      ) : null}
      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Credit card names
      </div>
      {accounts.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          No credit card names added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {accounts.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
                padding: "8px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <input
                className="app-input"
                value={entry.name || ""}
                placeholder="Card name"
                onChange={(e) => finance.updateCreditCardAccount(entry.id, { name: e.target.value })}
              />
              <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeCreditCardAccount(entry.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" pill onClick={() => finance?.addCreditCardAccount("")} style={{ justifySelf: "start" }}>
        Add credit card name
      </Button>
      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {formatMonthLabel(finance?.model?.selectedMonthKey || getCurrentMonthKey())} balances
      </div>
      {rows.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          No credit cards added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {rows.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.4fr 1fr 1fr auto auto",
                padding: "8px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <DropdownField
                value={entry.cardId || ""}
                onChange={(event) => {
                  const selectedId = event.target.value;
                  const selectedAccount = accounts.find((account) => account.id === selectedId) || null;
                  finance.updateCreditCard(entry.id, {
                    cardId: selectedId,
                    name: selectedAccount?.name || entry.name || "",
                  });
                }}
                options={accountOptions}
                ariaLabel="Credit card"
                placeholder="Choose card"
              />
              <input className="app-input" type="number" value={entry.balance || 0} placeholder="Balance" onChange={(e) => finance.updateCreditCard(entry.id, { balance: toNumber(e.target.value) })} />
              <input
                className="app-input"
                type="number"
                value={entry.monthlyPayment || 0}
                placeholder={entry.isPaidOff ? "Paid off" : "Monthly payment"}
                disabled={entry.isPaidOff === true}
                onChange={(e) => finance.updateCreditCard(entry.id, { monthlyPayment: toNumber(e.target.value) })}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={entry.isPaidOff === true}
                  onChange={(e) => finance.updateCreditCard(entry.id, { isPaidOff: e.target.checked })}
                />
                <span>Paid off</span>
              </label>
              <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeCreditCard(entry.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" pill onClick={finance?.addCreditCard} style={{ justifySelf: "start" }}>
        Add credit card
      </Button>
    </Section>
  );
}

function StatGrid({ children, isMobile }) {
  return (
    <div style={{ display: "grid", gap: "6px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(160px, 1fr))" }}>
      {children}
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div style={{ fontSize: "0.82rem" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}: </span>
      <strong>{children}</strong>
    </div>
  );
}

function PayAndWorkEditor({ finance, isMobile }) {
  const pay = finance.financeState.paySettings || {};
  const month = finance.model.currentMonth;
  const monthLabel = formatMonthLabel(finance.model.selectedMonthKey);

  return (
    <Section
      title="Pay and Work"
      description="Your contracted hours, pay rates, and salary. These values are used across all income and work calculations."
    >
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label>
          <FieldLabel>Contracted weekly hours</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={pay.contractedWeeklyHours || 0}
            onChange={(e) => finance.updatePaySetting("contractedWeeklyHours", toNumber(e.target.value))}
          />
        </label>
        <label>
          <FieldLabel>Hourly rate</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={pay.hourlyRate || 0}
            onChange={(e) => finance.updatePaySetting("hourlyRate", toNumber(e.target.value))}
          />
        </label>
        <label>
          <FieldLabel>Overtime rate</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={pay.overtimeRate || 0}
            onChange={(e) => finance.updatePaySetting("overtimeRate", toNumber(e.target.value))}
          />
        </label>
        <label>
          <FieldLabel>Annual salary</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={pay.annualSalary || 0}
            onChange={(e) => finance.updatePaySetting("annualSalary", toNumber(e.target.value))}
          />
        </label>
        <label>
          <FieldLabel>Other income (£)</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={month.monthState.otherIncome || 0}
            onChange={(e) => finance.updateMonthField("otherIncome", toNumber(e.target.value))}
          />
        </label>
      </div>

      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: "2px" }}>
        Tax and NI overrides
      </div>
      <CheckboxRow
        label={`Override tax and NI for ${monthLabel} only with fixed £ amounts`}
        checked={Boolean(month.monthState.useManualTax)}
        onChange={(checked) => finance.updateMonthTaxOverride("useManualTax", checked)}
      />
      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        These overrides are saved against the selected month only and never update other months.
      </div>
      {month.monthState.useManualTax ? (
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 1fr" }}>
          <label>
            <FieldLabel>Tax (£)</FieldLabel>
            <input
              className="app-input"
              type="number"
              step="0.01"
              min="0"
              value={month.monthState.manualTax || 0}
              onChange={(e) => finance.updateMonthTaxOverride("manualTax", toNumber(e.target.value))}
            />
          </label>
          <label>
            <FieldLabel>National Insurance (£)</FieldLabel>
            <input
              className="app-input"
              type="number"
              step="0.01"
              min="0"
              value={month.monthState.manualNationalInsurance || 0}
              onChange={(e) => finance.updateMonthTaxOverride("manualNationalInsurance", toNumber(e.target.value))}
            />
          </label>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          pill
          onClick={finance.resetMonthTaxOverride}
          disabled={!month.monthState.useManualTax}
        >
          Reset Tax and NI to Auto
        </Button>
      </div>

      <StatGrid isMobile={isMobile}>
        <Stat label="Hours worked">{month.pay.hoursWorked.toFixed(1)}h</Stat>
        <Stat label="Base pay">{formatCurrency(month.pay.basePay)}</Stat>
        <Stat label="Tax">{formatCurrency(month.pay.tax)}</Stat>
        <Stat label="NI">{formatCurrency(month.pay.nationalInsurance)}</Stat>
      </StatGrid>
    </Section>
  );
}

function IncomeAdjustmentsEditor({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Income Adjustments"
      description="One-off income adjustments for this month."
    >
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 1fr" }}>
        <label>
          <FieldLabel>Income adjustment</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={month.monthState.incomeAdjustments || 0}
            onChange={(e) => finance.updateMonthField("incomeAdjustments", toNumber(e.target.value))}
          />
        </label>
        <label>
          <FieldLabel>Work deduction</FieldLabel>
          <input
            className="app-input"
            type="text"
            value={formatCurrency(month.pay.workDeductions || 0)}
            readOnly
          />
        </label>
      </div>
      <StatGrid isMobile={isMobile}>
        <Stat label="Total in">{formatCurrency(month.totals.totalIn)}</Stat>
        <Stat label="After tax">{formatCurrency(month.pay.afterTaxIncome)}</Stat>
      </StatGrid>
    </Section>
  );
}

function OvertimeEditor({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Overtime"
      description="Log extra hours worked on specific days. Attendance overtime from the Work tab is included automatically."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Attendance history overtime">{month.pay.attendanceOvertimeHours.toFixed(2)}h</Stat>
        <Stat label="Manual overtime">{month.pay.manualOvertimeHours.toFixed(2)}h</Stat>
        <Stat label="Overtime pay">{formatCurrency(month.pay.overtimePay)}</Stat>
      </StatGrid>

      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.overtimeEntries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "grid",
              gap: "8px",
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 0.7fr 1.4fr auto",
              padding: "8px 10px",
              ...widgetInsetSurfaceStyle,
            }}
          >
            <CalendarField value={entry.date || ""} onChange={(e) => finance.updateOvertimeEntry(entry.id, { date: e.target.value })} placeholder="Date" />
            <input className="app-input" type="number" value={entry.hours || 0} placeholder="Hours" onChange={(e) => finance.updateOvertimeEntry(entry.id, { hours: toNumber(e.target.value) })} />
            <input className="app-input" value={entry.note || ""} placeholder="Note" onChange={(e) => finance.updateOvertimeEntry(entry.id, { note: e.target.value })} />
            <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeOvertimeEntry(entry.id)}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" pill style={{ justifySelf: "start" }} onClick={finance.addOvertimeEntry}>
        Add overtime entry
      </Button>
    </Section>
  );
}

function RecurringRulesEditor({ isMobile }) {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setMessage("");

    fetch("/api/profile/overtime-recurring-rules", { credentials: "include" })
      .then((response) => response.json())
      .then((result) => {
        if (!isMounted) return;
        if (result.success && Array.isArray(result.data)) {
          setRules(
            result.data
              .filter((rule) => Number(rule.day_of_week) >= 1 && Number(rule.day_of_week) <= 6)
              .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week))
          );
        } else {
          setRules([]);
        }
      })
      .catch(() => {
        if (isMounted) setMessage("Unable to load recurring rules.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateRule = (ruleId, patch) => {
    setRules((current) =>
      current.map((rule) =>
        String(rule.rule_id) === String(ruleId)
          ? {
              ...rule,
              ...patch,
              week_parity:
                (patch.pattern_type || rule.pattern_type) === "alternate"
                  ? patch.week_parity !== undefined
                    ? patch.week_parity
                    : rule.week_parity || "odd"
                  : null,
            }
          : rule
      )
    );
    setMessage("");
  };

  const addRule = () => {
    setRules((current) => [...current, makeRecurringRule()]);
    setMessage("");
  };

  const removeRule = async (ruleId) => {
    const existingRule = rules.find((rule) => String(rule.rule_id) === String(ruleId));
    if (!existingRule) return;

    if (String(existingRule.rule_id).startsWith("local-")) {
      setRules((current) => current.filter((rule) => String(rule.rule_id) !== String(ruleId)));
      return;
    }

    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/overtime-recurring-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ruleIds: [existingRule.rule_id] }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to remove recurring rule.");
      }
      setRules((current) => current.filter((rule) => String(rule.rule_id) !== String(ruleId)));
    } catch (error) {
      setMessage(error.message || "Unable to remove recurring rule.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveRules = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      const payload = rules.map((rule) => ({
        dayOfWeek: Number(rule.day_of_week),
        hours: Number(rule.hours || 0),
        active: rule.active !== false,
        patternType: rule.pattern_type || "weekly",
        weekParity: (rule.pattern_type || "weekly") === "alternate" ? rule.week_parity || "odd" : null,
        label: rule.label || null,
      }));

      const response = await fetch("/api/profile/overtime-recurring-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rules: payload }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to save recurring rules.");
      }

      const refreshed = await fetch("/api/profile/overtime-recurring-rules", { credentials: "include" });
      const refreshedResult = await refreshed.json().catch(() => null);
      if (refreshed.ok && refreshedResult?.success && Array.isArray(refreshedResult.data)) {
        setRules(
          refreshedResult.data
            .filter((rule) => Number(rule.day_of_week) >= 1 && Number(rule.day_of_week) <= 6)
            .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week))
        );
      }
      setMessage("Recurring rules saved.");
    } catch (error) {
      setMessage(error.message || "Unable to save recurring rules.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Section
      title="Recurring Overtime Rules"
      description="Add the days and hours that should auto-log overtime."
    >
      {isLoading ? (
        <EmptyState>Loading recurring rules…</EmptyState>
      ) : (
        <>
          {rules.length === 0 ? (
            <EmptyState>No recurring overtime rules set yet.</EmptyState>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {rules.map((rule) => (
                <div
                  key={rule.rule_id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    gridTemplateColumns: isMobile
                      ? "minmax(0, 1fr)"
                      : "minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                    padding: "10px",
                    ...widgetInsetSurfaceStyle,
                  }}
                >
                  <DropdownField
                    value={String(rule.day_of_week)}
                    onChange={(event) => updateRule(rule.rule_id, { day_of_week: Number(event.target.value) })}
                    options={RECURRING_DAY_OPTIONS.map((option) => ({ ...option, value: String(option.value) }))}
                  />
                  <input
                    className="app-input"
                    type="number"
                    min="0"
                    step="0.25"
                    value={rule.hours}
                    placeholder="Hours"
                    onChange={(event) => updateRule(rule.rule_id, { hours: event.target.value })}
                  />
                  <DropdownField
                    value={rule.pattern_type || "weekly"}
                    onChange={(event) => updateRule(rule.rule_id, { pattern_type: event.target.value })}
                    options={RECURRING_PATTERN_OPTIONS}
                  />
                  {(rule.pattern_type || "weekly") === "alternate" ? (
                    <DropdownField
                      value={rule.week_parity || "odd"}
                      onChange={(event) => updateRule(rule.rule_id, { week_parity: event.target.value })}
                      options={RECURRING_PARITY_OPTIONS}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px",
                        color: "var(--text-secondary)",
                        fontSize: "0.82rem",
                      }}
                    >
                      Every week
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    pill
                    onClick={() => removeRule(rule.rule_id)}
                    disabled={isSaving}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button type="button" variant="secondary" size="sm" pill onClick={addRule} disabled={isSaving}>
              Add rule
            </Button>
            <Button type="button" variant="primary" size="sm" pill onClick={saveRules} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save recurring rules"}
            </Button>
          </div>

          {message ? (
            <div style={{ fontSize: "0.8rem", color: message.includes("saved") ? "var(--text-secondary)" : "var(--danger, #c62828)" }}>
              {message}
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

function LeaveEditor({ finance, isMobile }) {
  const leaveStats = finance.derived.leaveStats;

  return (
    <Section
      title="Leave and Calendar"
      description="Holiday and leave balances pulled from the Work tab. Approved leave requests are shown below."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Work days taken">{leaveStats.workDaysTaken.toFixed(1)}d</Stat>
        <Stat label="Calendar days">{leaveStats.calendarDaysTaken.toFixed(0)}d</Stat>
        <Stat label="Days remaining">{leaveStats.remaining ?? "\u2014"}</Stat>
      </StatGrid>

      {leaveStats.approvedRequests.length === 0 ? (
        <EmptyState>No approved leave records yet in the Work tab.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
          {leaveStats.approvedRequests.map((request) => (
            <div
              key={request.id}
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                gap: isMobile ? "4px" : "12px",
                alignItems: isMobile ? "flex-start" : "center",
                padding: "8px 12px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{request.type || "Leave"}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  {formatDate(request.startDate)} → {formatDate(request.endDate)}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{Number(request.totalDays || 0).toFixed(1)}d</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function HolidayPaymentLinkEditor({ finance, isMobile, settings = {}, updateSetting }) {
  const planDetails = finance.model.plannedPaymentPlanDetails || [];
  const leaveRequests = finance.derived.leaveStats?.approvedRequests || [];
  const holidayLinks = settings.holidayPaymentLinks && typeof settings.holidayPaymentLinks === "object"
    ? settings.holidayPaymentLinks
    : {};
  const linkedIds = Array.isArray(settings.linkedPaymentPlanIds)
    ? settings.linkedPaymentPlanIds
    : Object.keys(holidayLinks);
  const linkedPlans = planDetails.filter((plan) => linkedIds.includes(plan.id));
  const currentMonthTotal = linkedPlans.reduce((sum, plan) => sum + Number(plan.thisMonthAmount || 0), 0);
  const totalAcrossPlans = linkedPlans.reduce((sum, plan) => sum + Number(plan.totalAcrossMonths || 0), 0);
  const leaveOptions = leaveRequests.map((request) => ({
    value: request.id,
    label: `${request.type || "Leave"} · ${formatDate(request.startDate)} → ${formatDate(request.endDate)}`,
  }));

  return (
    <Section
      title="Linked Holiday Costs"
      description="Tick a payment schedule, then choose which holiday from Leave and Calendar it belongs to."
    >
      {planDetails.length === 0 ? (
        <EmptyState>No payment schedules available yet. Add them in the Outgoings settings first.</EmptyState>
      ) : leaveRequests.length === 0 ? (
        <EmptyState>No approved leave records available to link yet. Approved holidays from Leave and Calendar will appear here.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {planDetails.map((plan) => {
            const isLinked = linkedIds.includes(plan.id);
            const selectedLeaveId = holidayLinks[plan.id] || "";
            return (
              <div
                key={plan.id}
                style={{
                  display: "grid",
                  gap: "10px",
                  padding: "10px 12px",
                  ...widgetInsetSurfaceStyle,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>{plan.name || "Unnamed plan"}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                      {plan.startMonth} → {plan.endMonth} · This month {formatCurrency(plan.thisMonthAmount || 0)} · Total {formatCurrency(plan.totalAcrossMonths || 0)}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={(event) => {
                      const nextIds = event.target.checked
                        ? [...linkedIds, plan.id]
                        : linkedIds.filter((id) => id !== plan.id);
                      const nextLinks = { ...holidayLinks };
                      if (event.target.checked) {
                        nextLinks[plan.id] = nextLinks[plan.id] || leaveRequests[0]?.id || "";
                      } else {
                        delete nextLinks[plan.id];
                      }
                      updateSetting("linkedPaymentPlanIds", nextIds);
                      updateSetting("holidayPaymentLinks", nextLinks);
                    }}
                  />
                </label>

                {isLinked ? (
                  <div style={{ display: "grid", gap: "6px" }}>
                    <FieldLabel>Linked holiday</FieldLabel>
                    <DropdownField
                      value={selectedLeaveId}
                      onChange={(event) => updateSetting("holidayPaymentLinks", { ...holidayLinks, [plan.id]: event.target.value })}
                      options={leaveOptions}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <StatGrid isMobile={isMobile}>
        <Stat label="Linked schedules">{linkedPlans.length}</Stat>
        <Stat label="This month">{formatCurrency(currentMonthTotal)}</Stat>
        <Stat label="Linked total">{formatCurrency(totalAcrossPlans)}</Stat>
      </StatGrid>
    </Section>
  );
}

function PlannedPaymentPlansEditor({ finance, isMobile }) {
  const plans = finance.financeState.plannedPaymentPlans || [];
  const planDetails = finance.model.plannedPaymentPlanDetails || [];
  const [expandedId, setExpandedId] = useState(null);
  const monthOptions = buildMonthOptions(finance.model.selectedMonthKey, 18);

  return (
    <Section
      title="Payment Schedules"
      description="Recurring payments with start and end months. Set a different amount for each month within the range."
    >
      {plans.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          No payment schedules added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {plans.map((plan) => {
            const detail = planDetails.find((d) => d.id === plan.id);
            const months = detail?.months || [];
            const isExpanded = expandedId === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  display: "grid",
                  gap: "8px",
                  padding: "10px",
                  ...widgetInsetSurfaceStyle,
                }}
              >
                <div style={{ display: "grid", gap: "8px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.4fr 1fr 1fr auto" }}>
                  <input
                    className="app-input"
                    value={plan.name || ""}
                    placeholder="Payment name"
                    onChange={(e) => finance.updatePlannedPaymentPlan(plan.id, { name: e.target.value })}
                  />
                  <DropdownField
                    value={plan.startMonth || ""}
                    onChange={(e) => finance.updatePlannedPaymentPlan(plan.id, { startMonth: e.target.value })}
                    options={monthOptions}
                  />
                  <DropdownField
                    value={plan.endMonth || ""}
                    onChange={(e) => finance.updatePlannedPaymentPlan(plan.id, { endMonth: e.target.value })}
                    options={monthOptions}
                  />
                  <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removePlannedPaymentPlan(plan.id)}>
                    Remove
                  </Button>
                </div>

                {!isMobile && plans.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: "8px", fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 600, padding: "0 2px" }}>
                    <span>Name</span><span>Start month</span><span>End month</span><span />
                  </div>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  pill
                  onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  style={{ justifySelf: "start" }}
                >
                  {isExpanded ? "Hide months" : `Show months (${months.length})`}
                </Button>

                {isExpanded && months.length > 0 && (
                  <div style={{ display: "grid", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
                    {months.map((mk) => (
                      <div
                        key={mk}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          background: mk === finance.model.selectedMonthKey ? "rgba(var(--primary-rgb), 0.08)" : "transparent",
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: mk === finance.model.selectedMonthKey ? 700 : 500, color: "var(--text-primary)" }}>
                          {formatMonthLabel(mk)}
                        </span>
                        <input
                          className="app-input"
                          type="number"
                          value={plan.monthlyAmounts?.[mk] || 0}
                          placeholder="£0.00"
                          onChange={(e) => finance.updatePlannedPaymentPlanMonth(plan.id, mk, toNumber(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {detail && (
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    Total across all months: <strong>{formatCurrency(detail.totalAcrossMonths)}</strong>
                    {detail.isActiveThisMonth ? ` · This month: ${formatCurrency(detail.thisMonthAmount)}` : " · Not active this month"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.addPlannedPaymentPlan("", finance.model.selectedMonthKey, finance.model.selectedMonthKey)} style={{ justifySelf: "start" }}>
        Add payment schedule
      </Button>
    </Section>
  );
}

function FuelEntriesEditor({ finance, isMobile }) {
  const month = finance.model.currentMonth;
  const entries = month.monthState.fuelEntries || [];
  const [draft, setDraft] = useState({
    cost: "",
    litres: "",
    costPerLitre: "",
  });

  const parseValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseCostPerLitreValue = (value) => {
    const parsed = parseValue(value);
    if (parsed <= 0) return 0;
    return parsed > 10 ? parsed / 100 : parsed;
  };

  const roundToString = (value, decimals) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return value.toFixed(decimals);
  };

  const deriveFuelValues = (nextDraft) => {
    const costRaw = String(nextDraft.cost ?? "").trim();
    const litresRaw = String(nextDraft.litres ?? "").trim();
    const costPerLitreRaw = String(nextDraft.costPerLitre ?? "").trim();
    const cost = parseValue(costRaw);
    const litres = parseValue(litresRaw);
    const costPerLitre = parseCostPerLitreValue(costPerLitreRaw);
    const hasCost = costRaw !== "" && cost > 0;
    const hasLitres = litresRaw !== "" && litres > 0;
    const hasCostPerLitre = costPerLitreRaw !== "" && costPerLitre > 0;
    const populatedFields = [hasCost, hasLitres, hasCostPerLitre].filter(Boolean).length;

    if (populatedFields < 2) return nextDraft;
    if (populatedFields === 3) return nextDraft;

    if (!hasCost && hasLitres && hasCostPerLitre) {
      return {
        ...nextDraft,
        cost: roundToString(litres * costPerLitre, 2),
      };
    }
    if (!hasLitres && hasCost && hasCostPerLitre) {
      return {
        ...nextDraft,
        litres: roundToString(cost / costPerLitre, 2),
      };
    }
    if (!hasCostPerLitre && hasCost && hasLitres) {
      return {
        ...nextDraft,
        costPerLitre: roundToString(cost / litres, 3),
      };
    }

    return nextDraft;
  };

  const handleDraftChange = (key, value) => {
    setDraft((current) => deriveFuelValues({ ...current, [key]: value }));
  };

  const handleAddFuel = () => {
    const normalised = deriveFuelValues(draft);
    const cost = parseValue(normalised.cost);
    const litres = parseValue(normalised.litres);
    const costPerLitre = parseValue(normalised.costPerLitre);
    if (!(cost > 0) || !(litres > 0) || !(costPerLitre > 0)) {
      return;
    }
    finance.addFuelEntry({
      cost,
      litres,
      costPerLitre,
      date: `${finance.model.selectedMonthKey}-01`,
    });
    setDraft({ cost: "", litres: "", costPerLitre: "" });
  };

  return (
    <Section
      title="Add Fuel"
      description="Enter any two values and the third will be calculated automatically."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Total £">{formatCurrency(month.totals.fuelTotal || 0)}</Stat>
        <Stat label="Total L">{`${Number(month.totals.fuelLitres || 0).toFixed(2)}L`}</Stat>
        <Stat label="Avg cost / litre">{month.totals.fuelAverageCostPerLitre > 0 ? Number(month.totals.fuelAverageCostPerLitre).toFixed(3) : "—"}</Stat>
      </StatGrid>

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
        <label>
          <FieldLabel>Cost (£)</FieldLabel>
          <input className="app-input" type="number" step="0.01" value={draft.cost} onChange={(e) => handleDraftChange("cost", e.target.value)} />
        </label>
        <label>
          <FieldLabel>Litres (L)</FieldLabel>
          <input className="app-input" type="number" step="0.01" value={draft.litres} onChange={(e) => handleDraftChange("litres", e.target.value)} />
        </label>
        <label>
          <FieldLabel>Cost per litre</FieldLabel>
          <input className="app-input" type="number" step="0.001" value={draft.costPerLitre} onChange={(e) => handleDraftChange("costPerLitre", e.target.value)} placeholder="138.9" />
        </label>
        <div style={{ display: "flex", alignItems: "end" }}>
          <Button type="button" variant="primary" size="sm" pill onClick={handleAddFuel}>
            Add row
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState>No fuel entries added for this month yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
                alignItems: "center",
                padding: "8px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", minWidth: 0 }}>
                {`${formatCurrency(entry.cost || 0)} · ${Number(entry.litres || 0).toFixed(2)}L · ${entry.costPerLitre ? Number(entry.costPerLitre).toFixed(3) : "—"}`}
              </div>
              <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeFuelEntry(entry.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function OutgoingAdjustmentEditor({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Outgoing Adjustments"
      description="One-off outgoing adjustments for this month."
    >
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 1fr" }}>
        <label>
          <FieldLabel>Outgoing adjustment</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={month.monthState.outgoingAdjustments || 0}
            onChange={(e) => finance.updateMonthField("outgoingAdjustments", toNumber(e.target.value))}
          />
        </label>
      </div>
      <StatGrid isMobile={isMobile}>
        <Stat label="Fixed outgoings">{formatCurrency(month.totals.fixedOut)}</Stat>
        <Stat label="Planned payments">{formatCurrency(month.totals.plannedOut)}</Stat>
        <Stat label="Total out">{formatCurrency(month.totals.totalOut)}</Stat>
      </StatGrid>
    </Section>
  );
}

function SavingsAccountsEditor({ finance, isMobile }) {
  const accounts = finance.financeState.savingsAccounts || [];
  const accountBalances = finance.model.savingsAccountBalances || [];
  const accountGroups = finance.model.savingsAccountGroups || [];

  return (
    <Section
      title="Savings Accounts"
      description="Your savings accounts with interest rates, opening balances, and optional main savings groups. These persist across all months."
    >
      {!isMobile && accounts.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "4px",
            gridTemplateColumns: "1.2fr 1fr 0.8fr 1fr auto",
            fontSize: "0.74rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            padding: "0 2px",
          }}
        >
          <span>Name</span>
          <span>AER %</span>
          <span>Opening balance</span>
          <span>Main group</span>
          <span />
        </div>
      ) : null}
      {accounts.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          No savings accounts added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {accounts.map((account) => {
            const bal = accountBalances.find((b) => b.id === account.id);
            return (
              <div
                key={account.id}
                style={{
                  display: "grid",
                  gap: "8px",
                  gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.2fr 1fr 0.8fr 1fr auto",
                  padding: "8px 10px",
                  ...widgetInsetSurfaceStyle,
                }}
              >
                <input
                  className="app-input"
                  value={account.name || ""}
                  placeholder="Account name"
                  onChange={(e) => finance.updateSavingsAccount(account.id, { name: e.target.value })}
                />
                <input
                  className="app-input"
                  type="number"
                  step="0.01"
                  value={account.interestRate || 0}
                  placeholder="AER %"
                  onChange={(e) => finance.updateSavingsAccount(account.id, { interestRate: toNumber(e.target.value) })}
                />
                <input
                  className="app-input"
                  type="number"
                  value={account.openingBalance || 0}
                  placeholder="Opening balance"
                  onChange={(e) => finance.updateSavingsAccount(account.id, { openingBalance: toNumber(e.target.value) })}
                />
                <input
                  className="app-input"
                  value={account.parentGroup || ""}
                  placeholder="Main savings group / bank"
                  onChange={(e) => finance.updateSavingsAccount(account.id, { parentGroup: e.target.value })}
                />
                <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeSavingsAccount(account.id)}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.addSavingsAccount("", 0, 0)} style={{ justifySelf: "start" }}>
        Add account
      </Button>

      {accountBalances.length > 0 && (
        <>
          <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: "2px" }}>
            Current balances
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {accountGroups.map((group) => (
              <div key={group.id} style={{ display: "grid", gap: "8px", ...widgetInsetSurfaceStyle, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {group.name} total
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {formatCurrency(group.currentBalance)}
                  </div>
                </div>
                <div style={{ display: "grid", gap: "6px" }}>
                  {group.accounts.map((account) => (
                    <div key={account.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "0.78rem", color: "var(--text-secondary)", flexWrap: "wrap" }}>
                      <span>{account.name || "Unnamed"}</span>
                      <span>{formatCurrency(account.currentBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <StatGrid isMobile={isMobile}>
              {accountBalances.filter((bal) => !String(bal.parentGroup || "").trim()).map((bal) => (
                <Stat key={bal.id} label={bal.name || "Unnamed"}>{formatCurrency(bal.currentBalance)}</Stat>
              ))}
            </StatGrid>
          </div>
        </>
      )}
    </Section>
  );
}

function SavingsTransactionsEditor({ finance, isMobile }) {
  const month = finance.model.currentMonth;
  const accounts = finance.financeState.savingsAccounts || [];
  const transactions = month.monthState.savingsBuckets || [];

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name || "Unnamed" }));

  return (
    <Section
      title="Monthly Savings Activity"
      description="Add deposits, interest, or withdrawals for this month. Select the account and enter the amount."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Saved this month">{formatCurrency(month.totals.savingsTotal)}</Stat>
        <Stat label="Year total">{formatCurrency(finance.model.yearTotals.savingsTotal)}</Stat>
      </StatGrid>

      {accounts.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          Add a savings account first before logging transactions.
        </div>
      ) : (
        <>
          {transactions.length === 0 ? (
            <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              No savings transactions this month.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.2fr 0.8fr 1fr auto",
                    padding: "8px 10px",
                    ...widgetInsetSurfaceStyle,
                  }}
                >
                  <DropdownField
                    value={txn.accountId || ""}
                    onChange={(e) => finance.updateSavingsBucket(txn.id, { accountId: e.target.value })}
                    options={[{ value: "", label: "Select account" }, ...accountOptions]}
                  />
                  <DropdownField
                    value={txn.type || "deposit"}
                    onChange={(e) => finance.updateSavingsBucket(txn.id, { type: e.target.value })}
                    options={[
                      { value: "deposit", label: "Deposit" },
                      { value: "interest", label: "Interest" },
                      { value: "withdrawal", label: "Withdrawal" },
                    ]}
                  />
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-secondary)",
                        fontSize: "0.82rem",
                        pointerEvents: "none",
                      }}
                    >
                      £
                    </span>
                    <input
                      className="app-input"
                      type="number"
                      value={txn.amount === 0 || txn.amount === "0" || txn.amount == null ? "" : txn.amount}
                      placeholder="0.00"
                      onChange={(e) => finance.updateSavingsBucket(txn.id, { amount: e.target.value === "" ? "" : toNumber(e.target.value) })}
                      style={{ paddingLeft: "26px" }}
                    />
                  </div>
                  <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeSavingsBucket(txn.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            pill
            onClick={() => finance.addSavingsBucket(accounts[0]?.id || "", 0, "deposit")}
            style={{ justifySelf: "start" }}
          >
            Add transaction
          </Button>
        </>
      )}
    </Section>
  );
}

const USER_ACCOUNT_TYPE_OPTIONS = [
  { value: "current", label: "Current Account" },
  { value: "savings", label: "Savings Account" },
  { value: "credit-card", label: "Credit Card" },
  { value: "other", label: "Other" },
];

function UserAccountsEditor({ finance, isMobile }) {
  const accounts = finance.financeState.userAccounts || [];
  const [validationError, setValidationError] = useState("");

  const handleAdd = () => {
    setValidationError("");
    finance.addAccount({ name: "", type: "current", balance: 0, showInOverview: true });
  };

  const handleUpdateName = (id, name) => {
    setValidationError("");
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    const trimmed = String(name || "").trim();
    if (trimmed) {
      const duplicate = accounts.some(
        (a) => a.id !== id && a.type === account.type && String(a.name || "").trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        setValidationError(`An account named "${trimmed}" already exists for this type.`);
        return;
      }
    }
    finance.updateAccount(id, { name });
  };

  return (
    <Section title="Accounts" description="Add bank accounts and credit cards. These are snapshot balances for the Finance Overview widget only — they do not affect income or outgoing totals.">
      {!isMobile && accounts.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "4px",
            gridTemplateColumns: "1.4fr 1fr 1fr 0.6fr auto",
            fontSize: "0.74rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            padding: "0 2px",
          }}
        >
          <span>Name</span>
          <span>Type</span>
          <span>Balance</span>
          <span>Visible</span>
          <span />
        </div>
      ) : null}
      {accounts.length === 0 ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "10px 12px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
          No accounts added yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {accounts.map((account) => (
            <div
              key={account.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.4fr 1fr 1fr 0.6fr auto",
                padding: "8px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <input
                className="app-input"
                value={account.name || ""}
                placeholder="Account name"
                onChange={(e) => handleUpdateName(account.id, e.target.value)}
              />
              <DropdownField
                value={account.type || "current"}
                onChange={(e) => finance.updateAccount(account.id, { type: e.target.value })}
                options={USER_ACCOUNT_TYPE_OPTIONS}
              />
              <input
                className="app-input"
                type="number"
                step="0.01"
                value={account.balance || 0}
                placeholder="Balance"
                onChange={(e) => finance.updateAccount(account.id, { balance: toNumber(e.target.value) })}
              />
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <input
                  type="checkbox"
                  checked={account.showInOverview !== false}
                  onChange={() => finance.toggleAccountVisibility(account.id)}
                />
              </label>
              <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeAccount(account.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {accounts.some((a) => a.type === "credit-card") ? (
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: "2px" }}>
            Credit limits (optional)
          </div>
          {accounts.filter((a) => a.type === "credit-card").map((account) => (
            <div
              key={account.id}
              style={{
                display: "grid",
                gap: "8px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 1fr",
                padding: "6px 10px",
                ...widgetInsetSurfaceStyle,
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center" }}>
                {account.name || "Unnamed"}
              </div>
              <input
                className="app-input"
                type="number"
                step="0.01"
                value={account.creditLimit || 0}
                placeholder="Credit limit"
                onChange={(e) => finance.updateAccount(account.id, { creditLimit: toNumber(e.target.value) })}
              />
            </div>
          ))}
        </div>
      ) : null}

      {validationError ? (
        <div style={{ fontSize: "0.78rem", color: "var(--danger, #c62828)", lineHeight: 1.4 }}>{validationError}</div>
      ) : null}

      <Button type="button" variant="secondary" size="sm" pill onClick={handleAdd} style={{ justifySelf: "start" }}>
        Add account
      </Button>
    </Section>
  );
}

export default function WidgetSettingsModal({
  isOpen,
  widgetType,
  widgetLabel,
  activeMonthKey = getCurrentMonthKey(),
  widgetIsVisible = true,
  finance = null,
  data = {},
  onClose,
  onSave,
  onToggleVisibility,
}) {
  const isMobile = useIsMobile();
  const [settings, setSettings] = useState(() => buildInitialSettings(widgetType, data, activeMonthKey));

  useEffect(() => {
    if (isOpen) {
      setSettings(buildInitialSettings(widgetType, data, activeMonthKey));
    }
  }, [activeMonthKey, data, isOpen, widgetType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateSetting = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };

      if (key === "dateDisplayMode") {
        next.dateValue = value === "day"
          ? `${String(next.monthKey || activeMonthKey).slice(0, 7)}-01`
          : String(next.monthKey || activeMonthKey).slice(0, 7);
      }
      if (key === "dateValue") {
        next.monthKey = value ? String(value).slice(0, 7) : activeMonthKey;
      }
      if (key === "monthKey") {
        next.dateValue = next.dateDisplayMode === "day"
          ? `${String(value).slice(0, 7)}-01`
          : String(value).slice(0, 7);
      }

      return next;
    });
  };

  const handleSave = async () => {
    const dateValue = settings.dateValue || activeMonthKey;
    const resolvedMonthKey = String(dateValue).slice(0, 7);
    const nextSettings = {
      ...data?.settings,
      ...settings,
      monthKey: normaliseMonthKey(resolvedMonthKey, activeMonthKey),
    };

    if (widgetType === "mortgage") {
      delete nextSettings.depositTarget;
      delete nextSettings.currentSaved;
      delete nextSettings.monthlyPayment;
      delete nextSettings.mortgageDeadline;
    }

    await onSave?.({
      ...data,
      settings: nextSettings,
    });
    onClose?.();
  };

  const hasWidgetOptions =
    "baseMonthlyIncome" in settings ||
    "expectedMileage" in settings ||
    "trendPct" in settings ||
    "targetAmount" in settings ||
    "goalDate" in settings ||
    "linkedPaymentPlanIds" in settings ||
    "holidayPaymentLinks" in settings ||
    widgetType === "mortgage" ||
    "plannedHours" in settings ||
    "plannedOvertimeHours" in settings ||
    "chartSource" in settings ||
    "customTitle" in settings ||
    "customAmount" in settings ||
    "customTarget" in settings ||
    "customNote" in settings ||
    "useWorkEstimate" in settings ||
    "includeSavings" in settings ||
    "includeBills" in settings ||
    "includeFuel" in settings ||
    widgetType === "work-summary" ||
    widgetType === "income" ||
    widgetType === "savings" ||
    widgetType === "fuel";
  const monthOptions = buildMonthOptions(settings.monthKey || activeMonthKey, 12);

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`${widgetLabel || "Widget"} settings`}
      cardStyle={{
        width: "min(100%, 720px)",
        padding: isMobile ? "16px" : "20px",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "12px" : "14px",
        overflow: "hidden",
      }}
    >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ fontSize: isMobile ? "1rem" : "1.05rem", fontWeight: 700 }}>{widgetLabel || "Widget"} settings</div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gap: isMobile ? "12px" : "14px",
            paddingRight: isMobile ? "2px" : "4px",
          }}
        >
          <div style={{ display: "grid", gap: "14px", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
            {/* Visibility */}
            <Section title="Visibility">
              <CheckboxRow
                label="Show this card on the dashboard"
                checked={widgetIsVisible !== false}
                onChange={(checked) => onToggleVisibility?.(checked)}
              />
            </Section>

            {/* Date view */}
            <Section title="Date view" description="Control which month or day this card uses.">
              <CheckboxRow
                label="Follow the dashboard month"
                checked={settings.useGlobalMonth !== false}
                onChange={(checked) => updateSetting("useGlobalMonth", checked)}
              />
              {settings.useGlobalMonth === false ? (
                <div style={{ display: "grid", gap: "8px", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                  <div>
                    <FieldLabel>Display mode</FieldLabel>
                    <DropdownField
                      value={settings.dateDisplayMode || "month"}
                      onChange={(event) => updateSetting("dateDisplayMode", event.target.value)}
                      options={[
                        { value: "month", label: "By month" },
                        { value: "day", label: "By day" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel>{settings.dateDisplayMode === "day" ? "Selected day" : "Selected month"}</FieldLabel>
                    {settings.dateDisplayMode === "day" ? (
                      <CalendarField
                        value={settings.dateValue || ""}
                        onChange={(event) => updateSetting("dateValue", event.target.value)}
                        placeholder="Selected day"
                      />
                    ) : (
                      <DropdownField
                        value={settings.dateValue || ""}
                        onChange={(event) => updateSetting("dateValue", event.target.value)}
                        options={monthOptions}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </Section>
          </div>

          {/* Widget-specific options */}
          {hasWidgetOptions ? (
            widgetType === "mortgage" ? (
              <MortgageModeEditor
                finance={finance}
                isMobile={isMobile}
                settings={settings}
                updateSetting={updateSetting}
              />
            ) : (
            <Section title="Widget options">
              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {"baseMonthlyIncome" in settings ? (
                <label>
                  <FieldLabel>Base monthly income</FieldLabel>
                  <input className="app-input" type="number" value={settings.baseMonthlyIncome} onChange={(e) => updateSetting("baseMonthlyIncome", e.target.value)} />
                </label>
              ) : null}
              {"expectedMileage" in settings ? (
                <label>
                  <FieldLabel>Expected mileage</FieldLabel>
                  <input className="app-input" type="number" value={settings.expectedMileage} onChange={(e) => updateSetting("expectedMileage", e.target.value)} />
                </label>
              ) : null}
              {"trendPct" in settings ? (
                <label>
                  <FieldLabel>Cost trend %</FieldLabel>
                  <input className="app-input" type="number" value={settings.trendPct} onChange={(e) => updateSetting("trendPct", e.target.value)} />
                </label>
              ) : null}
              {"targetAmount" in settings ? (
                <label>
                  <FieldLabel>Target amount</FieldLabel>
                  <input className="app-input" type="number" value={settings.targetAmount} onChange={(e) => updateSetting("targetAmount", e.target.value)} />
                </label>
              ) : null}
              {"goalDate" in settings ? (
                <label>
                  <FieldLabel>Goal date</FieldLabel>
                  <CalendarField value={settings.goalDate} onChange={(e) => updateSetting("goalDate", e.target.value)} placeholder="Goal date" />
                </label>
              ) : null}
              </div>

              <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {"plannedHours" in settings ? (
                <label>
                  <FieldLabel>Planned hours</FieldLabel>
                  <input className="app-input" type="number" value={settings.plannedHours} onChange={(e) => updateSetting("plannedHours", e.target.value)} />
                </label>
              ) : null}
              {"plannedOvertimeHours" in settings ? (
                <label>
                  <FieldLabel>Planned overtime</FieldLabel>
                  <input className="app-input" type="number" value={settings.plannedOvertimeHours} onChange={(e) => updateSetting("plannedOvertimeHours", e.target.value)} />
                </label>
              ) : null}
              {"chartSource" in settings ? (
                <label>
                  <FieldLabel>Chart source</FieldLabel>
                  <DropdownField
                    value={settings.chartSource || "spendingByCategory"}
                    onChange={(event) => updateSetting("chartSource", event.target.value)}
                    options={[
                      { value: "spendingByCategory", label: "Spending" },
                      { value: "incomeVsSpending", label: "Income vs spending" },
                      { value: "goalsProgress", label: "Goals" },
                      { value: "timeline", label: "Timeline" },
                    ]}
                  />
                </label>
              ) : null}
              {"customTitle" in settings ? (
                <label>
                  <FieldLabel>Card title</FieldLabel>
                  <input className="app-input" value={settings.customTitle || ""} onChange={(e) => updateSetting("customTitle", e.target.value)} />
                </label>
              ) : null}
              {"customAmount" in settings ? (
                <label>
                  <FieldLabel>Amount</FieldLabel>
                  <input className="app-input" type="number" value={settings.customAmount} onChange={(e) => updateSetting("customAmount", e.target.value)} />
                </label>
              ) : null}
              {"customTarget" in settings ? (
                <label>
                  <FieldLabel>Target</FieldLabel>
                  <input className="app-input" type="number" value={settings.customTarget} onChange={(e) => updateSetting("customTarget", e.target.value)} />
                </label>
              ) : null}
              </div>

              {"customNote" in settings ? (
                <label>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea
                    className="app-input"
                    value={settings.customNote || ""}
                    onChange={(e) => updateSetting("customNote", e.target.value)}
                    style={{ minHeight: "96px", resize: "vertical" }}
                    placeholder="Add a note or summary for this card"
                  />
                </label>
              ) : null}

              {"useWorkEstimate" in settings ? (
                <CheckboxRow label="Use work-linked estimate when available" checked={settings.useWorkEstimate !== false} onChange={(checked) => updateSetting("useWorkEstimate", checked)} />
              ) : null}

              {widgetType === "work-summary" || widgetType === "income" ? (
                <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <label>
                  <FieldLabel>Weekly hours (fallback)</FieldLabel>
                  <input className="app-input" type="number" value={settings.contractedWeeklyHours || ""} onChange={(e) => updateSetting("contractedWeeklyHours", e.target.value)} />
                </label>
                <label>
                  <FieldLabel>Hourly rate override</FieldLabel>
                  <input className="app-input" type="number" value={settings.hourlyRate || ""} onChange={(e) => updateSetting("hourlyRate", e.target.value)} />
                </label>
                <label>
                  <FieldLabel>Overtime rate override</FieldLabel>
                  <input className="app-input" type="number" value={settings.overtimeRate || ""} onChange={(e) => updateSetting("overtimeRate", e.target.value)} />
                </label>
                <label>
                  <FieldLabel>Tax % estimate</FieldLabel>
                  <input className="app-input" type="number" value={settings.taxRate || ""} onChange={(e) => updateSetting("taxRate", e.target.value)} />
                </label>
                <label>
                  <FieldLabel>NI % estimate</FieldLabel>
                  <input className="app-input" type="number" value={settings.niRate || ""} onChange={(e) => updateSetting("niRate", e.target.value)} />
                </label>
                </div>
              ) : null}

              {"includeSavings" in settings ? (
                <CheckboxRow label="Include savings in net position" checked={settings.includeSavings !== false} onChange={(checked) => updateSetting("includeSavings", checked)} />
              ) : null}
              {"includeBills" in settings ? (
                <CheckboxRow label="Include bills in net position" checked={settings.includeBills !== false} onChange={(checked) => updateSetting("includeBills", checked)} />
              ) : null}
              {"includeFuel" in settings ? (
                <CheckboxRow label="Include fuel in net position" checked={settings.includeFuel !== false} onChange={(checked) => updateSetting("includeFuel", checked)} />
              ) : null}
            </Section>
            )
          ) : null}

          {widgetType === "finance-overview" && finance ? (
            <UserAccountsEditor finance={finance} isMobile={isMobile} />
          ) : null}

          {widgetType === "spending" && finance ? (
            <>
              <FinanceCollectionEditor
                title="Fixed outgoings"
                source="Database"
                rows={finance.model.currentMonth.monthState.fixedOutgoings || []}
                isMobile={isMobile}
                emptyLabel="No fixed outgoings added yet."
                namePlaceholder="Name"
                amountPlaceholder="Amount"
                onAdd={finance.addFixedOutgoing}
                onUpdate={finance.updateFixedOutgoing}
                onRemove={finance.removeFixedOutgoing}
                categoryOptions={FIXED_OUTGOING_CATEGORY_OPTIONS}
              />
              <PlannedPaymentPlansEditor finance={finance} isMobile={isMobile} />
              <FinanceCollectionEditor
                title="One-off payments"
                source="This month only"
                rows={finance.model.currentMonth.monthState.plannedPayments || []}
                isMobile={isMobile}
                emptyLabel="No one-off payments this month."
                namePlaceholder="Payment name"
                amountPlaceholder="Amount"
                onAdd={finance.addPlannedPayment}
                onUpdate={finance.updatePlannedPayment}
                onRemove={finance.removePlannedPayment}
              />
              <CreditCardEditor finance={finance} isMobile={isMobile} />
            </>
          ) : null}

          {widgetType === "fuel" && finance ? <FuelEntriesEditor finance={finance} isMobile={isMobile} /> : null}

          {widgetType === "savings" && finance ? (
            <>
              <SavingsAccountsEditor finance={finance} isMobile={isMobile} />
              <SavingsTransactionsEditor finance={finance} isMobile={isMobile} />
            </>
          ) : null}

          {widgetType === "income" && finance ? (
            <>
              <PayAndWorkEditor finance={finance} isMobile={isMobile} />
              <IncomeAdjustmentsEditor finance={finance} isMobile={isMobile} />
            </>
          ) : null}

          {widgetType === "work-summary" && finance ? (
            <>
              <OvertimeEditor finance={finance} isMobile={isMobile} />
              <RecurringRulesEditor isMobile={isMobile} />
            </>
          ) : null}

          {widgetType === "holiday" && finance ? (
            <>
              <LeaveEditor finance={finance} isMobile={isMobile} />
              <HolidayPaymentLinkEditor finance={finance} isMobile={isMobile} settings={settings} updateSetting={updateSetting} />
            </>
          ) : null}

          {widgetType === "spending" && finance ? (
            <OutgoingAdjustmentEditor finance={finance} isMobile={isMobile} />
          ) : null}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap", paddingTop: "2px" }}>
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" pill onClick={handleSave}>
            Save
          </Button>
        </div>
    </PopupModal>
  );
}
