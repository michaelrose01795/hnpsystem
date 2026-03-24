import React, { useMemo, useRef, useState } from "react";
import {
  DataRow,
  EmptyState,
  Headline,
  MetricPill,
  SectionLabel,
  SurfacePanel,
  StatusBadge,
  formatCurrency,
  formatDate,
  toNumber,
  widgetAccentSurfaceStyle,
  widgetInputStyle,
  widgetInsetSurfaceStyle,
} from "@/components/profile/personal/widgets/shared";
import Button from "@/components/ui/Button";
import {
  calculateGoalContributionForMonth,
  calculateIncomeForMonth,
  calculateProjectedSavingsDate,
  calculateProjectedTimeline,
  calculateSpendingForMonth,
  formatMonthLabel,
} from "@/lib/profile/calculations";

const widgetActionButtonStyle = {
  minWidth: "96px",
};

/* ── BaseWidget ───────────────────────────────────────────────── */

export function BaseWidget({
  title,
  subtitle,
  accent,
  monthLabel = "",
  statusLabel = "",
  headline = null,
  children,
  onOpenSettings,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        ...widgetAccentSurfaceStyle,
        borderColor: "rgba(var(--primary-rgb), 0.14)",
        borderRadius: "16px",
        padding: "10px",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          ...widgetInsetSurfaceStyle,
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          alignItems: "flex-start",
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "grid", gap: "2px", minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: "0.86rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {title}
            </div>
            {monthLabel ? <StatusBadge tone="neutral">{monthLabel}</StatusBadge> : null}
            {statusLabel ? (
              <StatusBadge tone="neutral">
                {statusLabel}
              </StatusBadge>
            ) : null}
          </div>
          {subtitle ? (
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{subtitle}</div>
          ) : null}
        </div>

        {onOpenSettings ? (
          <Button type="button" variant="secondary" size="sm" className="app-btn--control" style={widgetActionButtonStyle} onClick={onOpenSettings}>
            Settings
          </Button>
        ) : null}
      </div>

      {/* Headline slot */}
      {headline ? (
        <div style={{ ...widgetInsetSurfaceStyle, padding: "12px 14px" }}>
          {headline}
        </div>
      ) : null}

      {/* Detail content */}
      {children ? (
        <div
          style={{
            ...widgetInsetSurfaceStyle,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "12px 14px",
            flex: "none",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── IncomeWidget ─────────────────────────────────────────────── */

export function IncomeWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const pay = finance.financeState.paySettings || {};
  const year = finance.model.yearTotals || {};
  const monthLabel = formatMonthLabel(finance.model.selectedMonthKey);
  const incomeSectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Income"}
      subtitle="Selected month and year totals after tax"
      accent="var(--success, #2e7d32)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label={`Year total after tax (${finance.model.selectedFinanceYear})`}
            value={formatCurrency(year.totalAfterTax)}
            accent="var(--success, #2e7d32)"
            size="medium"
          />
          <Headline
            label={`${monthLabel} total after tax`}
            value={formatCurrency(month.pay.afterTaxIncome)}
            accent="var(--success, #2e7d32)"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={incomeSectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Year totals (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill label="Tax" value={formatCurrency(year.totalTax)} accent="var(--danger, #c62828)" />
              <MetricPill label="NI" value={formatCurrency(year.totalNationalInsurance)} accent="var(--danger, #c62828)" />
              <MetricPill label="Hours worked" value={`${Number(year.workedHours || 0).toFixed(1)}h`} accent="var(--info, #1565c0)" />
              <MetricPill
                label={year.bulkOvertimeHours > 0 ? `Overtime (incl. ${Number(year.bulkOvertimeHours).toFixed(1)}h bulk)` : "Overtime"}
                value={`${Number(year.overtimeHours || 0).toFixed(1)}h`}
                accent="var(--warning, #ef6c00)"
              />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={incomeSectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>{monthLabel} pay</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 10px", borderRadius: "10px", background: "var(--surface)", border: "1px solid rgba(var(--primary-rgb), 0.08)" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>Hours worked</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{month.pay.expectedHours.toFixed(1)}h</span>
                </div>
                <div style={{ display: "grid", gap: "2px", justifyItems: "end", borderLeft: "2px solid var(--primary)", paddingLeft: "10px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>Basic total</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{formatCurrency(month.pay.basePay)}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 10px", borderRadius: "10px", background: "var(--surface)", border: "1px solid rgba(var(--primary-rgb), 0.08)" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>Overtime worked</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{month.pay.overtimeHours.toFixed(1)}h</span>
                </div>
                <div style={{ display: "grid", gap: "2px", justifyItems: "end", borderLeft: "2px solid var(--primary)", paddingLeft: "10px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>Overtime total</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{formatCurrency(month.pay.overtimePay)}</span>
                </div>
              </div>
              <MetricPill label="Other income" value={formatCurrency(month.totals.classicIncome)} accent="var(--info, #1565c0)" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 10px", borderRadius: "10px", background: "var(--surface)", border: "1px solid rgba(var(--primary-rgb), 0.08)" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>Tax</span>
                  <input
                    type="number"
                    value={pay.useManualTax ? (pay.manualTax || 0) : month.pay.tax}
                    onChange={(e) => {
                      const v = toNumber(e.target.value);
                      if (!pay.useManualTax) finance.updatePaySetting("useManualTax", true);
                      finance.updatePaySetting("manualTax", v);
                    }}
                    style={{ ...widgetInputStyle, fontSize: "0.88rem", fontWeight: 700, padding: "2px 4px", minHeight: "unset" }}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px", borderLeft: "2px solid var(--primary)", paddingLeft: "10px" }}>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>NI</span>
                  <input
                    type="number"
                    value={pay.useManualTax ? (pay.manualNationalInsurance || 0) : month.pay.nationalInsurance}
                    onChange={(e) => {
                      const v = toNumber(e.target.value);
                      if (!pay.useManualTax) finance.updatePaySetting("useManualTax", true);
                      finance.updatePaySetting("manualNationalInsurance", v);
                    }}
                    style={{ ...widgetInputStyle, fontSize: "0.88rem", fontWeight: 700, padding: "2px 4px", minHeight: "unset" }}
                  />
                </div>
              </div>
            </div>
            {pay.useManualTax && (
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => finance.updatePaySetting("useManualTax", false)}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  Reset Tax &amp; NI to auto
                </button>
              </div>
            )}
            {(month.monthState.incomeAdjustments || 0) !== 0 ? (
              <DataRow label="Adjustment" value={formatCurrency(month.monthState.incomeAdjustments)} muted />
            ) : null}
            <MetricPill label="Total after tax" value={formatCurrency(month.pay.afterTaxIncome)} accent="var(--success, #2e7d32)" />
          </div>
        </SurfacePanel>

        <SurfacePanel style={incomeSectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Pay settings (Database)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill label="Weekly hours" value={`${pay.contractedWeeklyHours || 0}h`} accent="var(--text-secondary)" />
              <MetricPill label="Hourly rate" value={formatCurrency(pay.hourlyRate || 0)} accent="var(--text-secondary)" />
              <MetricPill label="OT rate" value={formatCurrency(pay.overtimeRate || 0)} accent="var(--text-secondary)" />
              <MetricPill label="Annual salary" value={formatCurrency(pay.annualSalary || 0)} accent="var(--text-secondary)" />
            </div>
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── WorkSummaryWidget ────────────────────────────────────────── */

export function WorkSummaryWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Work / Hours"}
      subtitle="Attendance and manual overtime this month"
      accent="var(--warning, #ef6c00)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Headline
            label="Total overtime"
            value={`${month.pay.overtimeHours.toFixed(1)}h`}
            accent="var(--warning, #ef6c00)"
          />
          <Headline
            label="Overtime pay"
            value={formatCurrency(month.pay.overtimePay)}
            accent="var(--success, #2e7d32)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Hours breakdown (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill label="Expected hours" value={`${month.pay.expectedHours.toFixed(1)}h`} accent="var(--text-secondary)" />
              <MetricPill label="Hours worked" value={month.pay.workedHours !== null ? `${month.pay.workedHours.toFixed(1)}h` : "—"} accent="var(--info, #1565c0)" />
              <MetricPill label="Attendance OT" value={`${month.pay.attendanceOvertimeHours.toFixed(1)}h`} accent="var(--info, #1565c0)" />
              <MetricPill label="Manual OT" value={`${month.pay.manualOvertimeHours.toFixed(1)}h`} accent="var(--warning, #ef6c00)" />
            </div>
            {month.pay.leaveDaysInMonth > 0 ? (
              <DataRow label="Leave days this month" value={`${month.pay.leaveDaysInMonth}d`} accent="var(--info, #1565c0)" />
            ) : null}
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Manual entries (Database)</SectionLabel>
            {month.monthState.overtimeEntries.length === 0 ? (
              <EmptyState>No manual overtime — add entries in Settings.</EmptyState>
            ) : (
              month.monthState.overtimeEntries.map((entry) => (
                <DataRow
                  key={entry.id}
                  label={`${entry.date ? formatDate(entry.date) : "No date"}${entry.note ? ` — ${entry.note}` : ""}`}
                  value={`${Number(entry.hours || 0).toFixed(1)}h`}
                />
              ))
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── SpendingWidget ───────────────────────────────────────────── */

export function SpendingWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Outgoings"}
      subtitle="Fixed costs, planned payments, and card impact"
      accent="var(--danger, #c62828)"
      onOpenSettings={onOpenSettings}
      headline={
        <Headline
          label="Total outgoings"
          value={formatCurrency(month.totals.totalOut)}
          accent="var(--danger, #c62828)"
        />
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Breakdown (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <MetricPill label="Fixed" value={formatCurrency(month.totals.fixedOut)} accent="var(--danger, #c62828)" />
              <MetricPill label="Planned" value={formatCurrency(month.totals.plannedOut)} accent="var(--warning, #ef6c00)" />
              <MetricPill label="Cards" value={formatCurrency(month.totals.creditCardOut)} accent="var(--accent-purple)" />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Fixed outgoings (Database)</SectionLabel>
            {month.monthState.fixedOutgoings.length === 0 ? (
              <EmptyState>None set — add in Settings.</EmptyState>
            ) : (
              month.monthState.fixedOutgoings.map((entry) => (
                <DataRow key={entry.id} label={entry.name || "Unnamed"} value={formatCurrency(entry.amount || 0)} />
              ))
            )}
          </div>
        </SurfacePanel>

        {month.monthState.plannedPayments.length > 0 ? (
          <SurfacePanel style={sectionStyle}>
            <div style={{ display: "grid", gap: "8px" }}>
              <SectionLabel>Planned payments (Linked)</SectionLabel>
              {month.monthState.plannedPayments.map((entry) => (
                <DataRow key={entry.id} label={entry.name || "Unnamed"} value={formatCurrency(entry.amount || 0)} />
              ))}
            </div>
          </SurfacePanel>
        ) : null}

        {(month.monthState.outgoingAdjustments || 0) !== 0 ? (
          <DataRow label="Adjustment" value={formatCurrency(month.monthState.outgoingAdjustments)} muted />
        ) : null}
      </div>
    </BaseWidget>
  );
}

/* ── SavingsWidget ────────────────────────────────────────────── */

export function SavingsWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const accountBalances = finance.model.savingsAccountBalances || [];
  const transactions = month.monthState.savingsBuckets || [];
  const accounts = finance.financeState.savingsAccounts || [];
  const totalBalance = accountBalances.reduce((sum, a) => sum + a.currentBalance, 0);
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  const accountNameMap = {};
  for (const a of accounts) accountNameMap[a.id] = a.name;

  return (
    <BaseWidget
      title={widget.config?.title || "Savings"}
      subtitle="Accounts, balances, and monthly activity"
      accent="var(--info, #1565c0)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label="Total balance"
            value={formatCurrency(totalBalance)}
            accent="var(--info, #1565c0)"
          />
          <Headline
            label="Saved this month"
            value={formatCurrency(month.totals.savingsTotal)}
            accent="var(--success, #2e7d32)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Accounts</SectionLabel>
            {accountBalances.length === 0 ? (
              <EmptyState>No savings accounts — add them in Settings.</EmptyState>
            ) : (
              accountBalances.map((account) => (
                <div
                  key={account.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "4px",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    background: "var(--surface)",
                    border: "1px solid rgba(var(--primary-rgb), 0.08)",
                  }}
                >
                  <div style={{ display: "grid", gap: "2px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{account.name || "Unnamed"}</span>
                    <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      {account.interestRate > 0 ? `${account.interestRate}% AER` : "No interest rate set"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "2px", justifyItems: "end" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(account.currentBalance)}</span>
                    {account.monthActivity !== 0 ? (
                      <span style={{ fontSize: "0.66rem", fontWeight: 600, color: account.monthActivity > 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)" }}>
                        {account.monthActivity > 0 ? "+" : ""}{formatCurrency(account.monthActivity)} this month
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>No activity this month</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfacePanel>

        {transactions.length > 0 && (
          <SurfacePanel style={sectionStyle}>
            <div style={{ display: "grid", gap: "8px" }}>
              <SectionLabel>This month&apos;s transactions</SectionLabel>
              {transactions.map((txn) => (
                <DataRow
                  key={txn.id}
                  label={`${accountNameMap[txn.accountId] || "Unknown"} — ${txn.type || "deposit"}`}
                  value={`${txn.type === "withdrawal" ? "-" : "+"}${formatCurrency(txn.amount || 0)}`}
                />
              ))}
            </div>
          </SurfacePanel>
        )}
      </div>
    </BaseWidget>
  );
}

/* ── BillsWidget ──────────────────────────────────────────────── */

export function BillsWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const planDetails = finance.model.plannedPaymentPlanDetails || [];
  const activePlans = planDetails.filter((p) => p.isActiveThisMonth && p.thisMonthAmount > 0);
  const legacyPayments = month.monthState.plannedPayments || [];
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Payments"}
      subtitle="Planned payment schedules and commitments"
      accent="var(--warning, #ef6c00)"
      onOpenSettings={onOpenSettings}
      headline={
        <Headline
          label="Planned payments this month"
          value={formatCurrency(month.totals.plannedOut)}
          accent="var(--warning, #ef6c00)"
        />
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        {planDetails.length > 0 && (
          <SurfacePanel style={sectionStyle}>
            <div style={{ display: "grid", gap: "8px" }}>
              <SectionLabel>Payment schedules</SectionLabel>
              {planDetails.map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "4px",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    background: "var(--surface)",
                    border: "1px solid rgba(var(--primary-rgb), 0.08)",
                    opacity: plan.isActiveThisMonth ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: "grid", gap: "2px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{plan.name || "Unnamed"}</span>
                    <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      {plan.startMonth} → {plan.endMonth} · Total: {formatCurrency(plan.totalAcrossMonths)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "2px", justifyItems: "end" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: plan.isActiveThisMonth ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {plan.isActiveThisMonth ? formatCurrency(plan.thisMonthAmount) : "—"}
                    </span>
                    <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      {plan.isActiveThisMonth ? "this month" : "not active"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SurfacePanel>
        )}

        {legacyPayments.length > 0 && (
          <SurfacePanel style={sectionStyle}>
            <div style={{ display: "grid", gap: "8px" }}>
              <SectionLabel>One-off payments</SectionLabel>
              {legacyPayments.map((entry) => (
                <DataRow key={entry.id} label={entry.name || "Unnamed"} value={formatCurrency(entry.amount || 0)} />
              ))}
            </div>
          </SurfacePanel>
        )}

        {planDetails.length === 0 && legacyPayments.length === 0 && (
          <SurfacePanel style={sectionStyle}>
            <EmptyState>No planned payments — add them in Settings.</EmptyState>
          </SurfacePanel>
        )}
      </div>
    </BaseWidget>
  );
}

/* ── FuelWidget (Credit Cards) ────────────────────────────────── */

export function FuelWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Credit Cards"}
      subtitle="Balances and monthly card payments"
      accent="var(--accent-purple)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label="Total balances"
            value={formatCurrency(month.totals.totalCardBalances)}
            accent="var(--danger, #c62828)"
          />
          <Headline
            label="Monthly payments"
            value={formatCurrency(month.totals.creditCardOut)}
            accent="var(--accent-purple)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Cards (Database)</SectionLabel>
            {month.monthState.creditCards.length === 0 ? (
              <EmptyState>No credit cards — add them in Settings.</EmptyState>
            ) : (
              month.monthState.creditCards.map((entry) => (
                <div key={entry.id}>
                  <DataRow label={entry.name || "Unnamed card"} value={formatCurrency(entry.balance || 0)} />
                  <DataRow label="Monthly payment" value={formatCurrency(entry.monthlyPayment || 0)} muted />
                </div>
              ))
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── MortgageWidget ───────────────────────────────────────────── */

export function MortgageWidget({
  widget,
  widgetData,
  widgetMonthKey,
  onOpenSettings,
  finance,
}) {
  const settings = widgetData?.settings || {};
  const depositTarget = Number(settings.depositTarget || 0);
  const linkedAccountId = settings.linkedSavingsAccountId || "";
  const linkedBalance = linkedAccountId
    ? (finance?.model?.savingsAccountBalances || []).find((b) => b.id === linkedAccountId)?.currentBalance || 0
    : null;
  const currentSaved = linkedBalance !== null ? linkedBalance : Number(settings.currentSaved || 0);
  const deadline = settings.mortgageDeadline || "";
  const monthlyPayment = Number(settings.monthlyPayment || widgetData?.monthlyPayment || 0);
  const monthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData: {
          ...widgetData,
          target: depositTarget,
          current: currentSaved,
          deadline,
          monthlyPayment,
        },
        defaultCategory: "House",
      }),
    [currentSaved, deadline, depositTarget, monthlyPayment, widgetData, widgetMonthKey]
  );

  const projectedDate = calculateProjectedSavingsDate({
    targetAmount: depositTarget,
    currentAmount: currentSaved,
    monthlyContribution: monthlyPayment,
  });

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Mortgage"}
      subtitle="House deposit and payment planning"
      accent="var(--text-primary)"
      monthLabel={monthView.label}
      statusLabel={monthView.status}
      onOpenSettings={onOpenSettings}
      headline={
        <Headline
          label="Deposit target"
          value={formatCurrency(depositTarget)}
        />
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>House goal (Database)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill
                label={linkedAccountId
                  ? `Saved (${(finance?.financeState?.savingsAccounts || []).find((a) => a.id === linkedAccountId)?.name || "Linked"})`
                  : "Current saved"}
                value={formatCurrency(currentSaved)}
              />
              <MetricPill label="Monthly payment" value={formatCurrency(monthlyPayment)} />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Timeline (Linked)</SectionLabel>
            <DataRow label="Deadline" value={deadline ? formatDate(deadline) : "Not set"} muted />
            <DataRow label="Projected date" value={projectedDate ? formatDate(projectedDate) : "No projection"} />
            <DataRow label={monthView.status} value={formatCurrency(monthView.total || monthlyPayment)} />
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── HolidayWidget ────────────────────────────────────────────── */

export function HolidayWidget({ widget, finance, onOpenSettings }) {
  const leaveStats = finance.derived.leaveStats;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Holiday"}
      subtitle="Leave balances from the Work tab"
      accent="var(--info, #00838f)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label="Days taken"
            value={`${leaveStats.workDaysTaken.toFixed(1)}d`}
            accent="var(--warning, #ef6c00)"
          />
          <Headline
            label="Remaining"
            value={leaveStats.remaining ?? "—"}
            accent="var(--success, #2e7d32)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Summary (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill label="Work days" value={`${leaveStats.workDaysTaken.toFixed(1)}d`} accent="var(--warning, #ef6c00)" />
              <MetricPill label="Calendar days" value={`${leaveStats.calendarDaysTaken.toFixed(0)}d`} accent="var(--info, #00838f)" />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Approved leave (Database)</SectionLabel>
            {leaveStats.approvedRequests.length === 0 ? (
              <EmptyState>No approved leave records in the Work tab.</EmptyState>
            ) : (
              leaveStats.approvedRequests.map((request) => (
                <DataRow
                  key={request.id}
                  label={`${request.type || "Leave"} · ${formatDate(request.startDate)} → ${formatDate(request.endDate)}`}
                  value={`${Number(request.totalDays || 0).toFixed(1)}d`}
                />
              ))
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── CustomWidget ─────────────────────────────────────────────── */

export function CustomWidget({ widget, widgetData, onOpenSettings }) {
  const settings = widgetData?.settings || {};
  const title = settings.customTitle || widget?.config?.title || "Custom widget";
  const amount = Number(settings.customAmount ?? widget?.config?.amount ?? 0);
  const target = Number(settings.customTarget ?? widget?.config?.target ?? 0);
  const note = settings.customNote ?? widget?.config?.note ?? "";
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={title}
      subtitle="Flexible personal summary card"
      accent="var(--accent-purple)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Amount" value={formatCurrency(amount)} accent="var(--accent-purple)" />
          <MetricPill label="Target" value={formatCurrency(target)} accent="var(--info, #1565c0)" />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Summary</SectionLabel>
            {note ? (
              <div style={{ fontSize: "0.84rem", lineHeight: 1.5, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                {note}
              </div>
            ) : (
              <EmptyState>Add custom values and notes in Settings.</EmptyState>
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── NetPositionWidget ────────────────────────────────────────── */

export function NetPositionWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const previous = finance.model.previousMonth;
  const delta = finance.model.deltaFromPrevious;
  const year = finance.model.yearTotals;
  const positive = month.totals.difference >= 0;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Net Position"}
      subtitle="What you keep after all income and outgoings"
      accent={positive ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
      monthLabel={finance.model.selectedMonthKey}
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label="Money left"
            value={formatCurrency(month.totals.difference)}
            accent={positive ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
          />
          <Headline
            label="After tax"
            value={formatCurrency(month.totals.moneyLeftAfterTax)}
            accent="var(--accent-purple)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Breakdown (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <MetricPill label="Total in" value={formatCurrency(month.totals.totalIn)} accent="var(--success, #2e7d32)" />
              <MetricPill label="Total out" value={formatCurrency(month.totals.totalOut)} accent="var(--danger, #c62828)" />
              <MetricPill label="Savings" value={formatCurrency(month.totals.savingsTotal)} accent="var(--info, #1565c0)" />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>vs previous month (Database)</SectionLabel>
            <DataRow label="Previous month left" value={formatCurrency(previous.totals.difference)} muted />
            <DataRow
              label="Change"
              value={formatCurrency(delta)}
              accent={delta >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
            />
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Year to date ({finance.model.selectedFinanceYear})</SectionLabel>
            <DataRow label="Year income" value={formatCurrency(year.totalIn)} accent="var(--success, #2e7d32)" />
            <DataRow label="Year outgoings" value={formatCurrency(year.totalOut)} accent="var(--danger, #c62828)" />
            <DataRow
              label="Year difference"
              value={formatCurrency(year.difference)}
              accent={year.difference >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
            />
            <DataRow label="Year overtime pay" value={formatCurrency(year.overtimePay)} accent="var(--warning, #ef6c00)" />
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── ChartWidget ──────────────────────────────────────────────── */

function BarChart({ items = [] }) {
  const maxValue = items.reduce((largest, item) => Math.max(largest, item.value), 0) || 1;

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "0.82rem" }}>
            <span>{item.label}</span>
            <span style={{ fontWeight: 700 }}>{item.value.toFixed(2)}</span>
          </div>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "rgba(var(--accent-purple-rgb), 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                height: "100%",
                borderRadius: "999px",
                background: "rgba(var(--primary-rgb), 0.72)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartWidget({
  widget,
  widgetData,
  widgetMonthKey,
  widgetDataMap,
  datasets,
  onOpenSettings,
}) {
  const source = widgetData?.settings?.chartSource || widgetData?.source || "spendingByCategory";

  const chartItems = useMemo(() => {
    if (source === "incomeVsSpending") {
      const income = calculateIncomeForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        widgetData: widgetData,
        workData: datasets.workData,
      }).total;
      const spending = calculateSpendingForMonth({
        monthKey: widgetMonthKey,
        transactions: datasets.transactions,
        bills: datasets.bills,
        widgetData: widgetDataMap?.spending?.data || {},
      }).total;
      return [
        { label: "Income", value: income },
        { label: "Spending", value: spending },
      ];
    }

    if (source === "goalsProgress") {
      return (datasets.goals || []).map((goal) => ({
        label: goal.type,
        value: Number(goal.current || 0),
      }));
    }

    if (source === "timeline") {
      return calculateProjectedTimeline({
        startMonth: widgetMonthKey,
        endMonth: (() => {
          const date = new Date(`${widgetMonthKey}-01T00:00:00`);
          if (Number.isNaN(date.getTime())) return widgetMonthKey;
          date.setMonth(date.getMonth() + 5);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        })(),
        datasets,
        widgetDataMap,
      }).map((entry) => ({
        label: formatMonthLabel(entry.monthKey),
        value: entry.net,
      }));
    }

    return calculateSpendingForMonth({
      monthKey: widgetMonthKey,
      transactions: datasets.transactions,
      bills: datasets.bills,
      widgetData: widgetDataMap?.spending?.data || {},
    }).rows.map((row) => ({
      label: row.category,
      value: Number(row.amount || 0),
    }));
  }, [datasets, source, widgetData, widgetDataMap, widgetMonthKey]);

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Chart"}
      subtitle="Visual dashboard snapshot"
      accent="var(--info, #1e88e5)"
      monthLabel={formatMonthLabel(widgetMonthKey)}
      statusLabel="Planned"
      onOpenSettings={onOpenSettings}
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Chart source (Database)</SectionLabel>
            <DataRow
              label="Source"
              value={
                source === "incomeVsSpending"
                  ? "Income vs spending"
                  : source === "goalsProgress"
                    ? "Goals"
                    : source === "timeline"
                      ? "Timeline"
                      : "Spending"
              }
            />
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Data</SectionLabel>
            {chartItems.length === 0 ? <EmptyState>No chart data available yet.</EmptyState> : <BarChart items={chartItems} />}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── NotesWidget ──────────────────────────────────────────────── */

export function NotesWidget({ widget, datasets, actions }) {
  const [draft, setDraft] = useState("");

  const addNote = async () => {
    if (!draft.trim()) return;
    await actions.createNote({ content: draft.trim() });
    setDraft("");
  };

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Notes"}
      subtitle="Private reminders and references"
      accent="var(--text-primary)"
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>New note</SectionLabel>
            <textarea
              className="app-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              style={{ minHeight: "80px", resize: "vertical" }}
              placeholder="Capture a thought, reminder, or personal reference..."
            />
            <div>
              <Button type="button" variant="primary" size="sm" pill onClick={addNote}>
                Save note
              </Button>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Saved notes</SectionLabel>
            {(datasets.notes || []).length === 0 ? (
              <EmptyState>No notes yet.</EmptyState>
            ) : (
              <div style={{ display: "grid", gap: "6px" }}>
                {(datasets.notes || []).map((note) => (
                  <div
                    key={note.id}
                    style={{
                      display: "grid",
                      gap: "6px",
                      padding: "10px 12px",
                      ...widgetInsetSurfaceStyle,
                    }}
                  >
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                      {formatDate(note.updatedAt || note.createdAt)}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: "0.84rem", lineHeight: 1.5 }}>
                      {note.content}
                    </div>
                    <div>
                      <Button type="button" variant="secondary" size="sm" pill onClick={() => actions.deleteNote(note.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── AttachmentsWidget ────────────────────────────────────────── */

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
}

export function AttachmentsWidget({ widget, datasets, actions }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await actions.uploadAttachment(file);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Attachments"}
      subtitle="Private files behind your personal unlock"
      accent="var(--accent-purple)"
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Upload</SectionLabel>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Button type="button" variant="primary" size="sm" pill onClick={() => fileInputRef.current?.click()}>
                {isUploading ? "Uploading..." : "Upload file"}
              </Button>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Files</SectionLabel>
            {(datasets.attachments || []).length === 0 ? (
              <EmptyState>No attachments uploaded yet.</EmptyState>
            ) : (
              <div style={{ display: "grid", gap: "6px" }}>
                {(datasets.attachments || []).map((attachment) => (
                  <div
                    key={attachment.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      padding: "10px 12px",
                      ...widgetInsetSurfaceStyle,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <a
                        href={attachment.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "block",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {attachment.fileName}
                      </a>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                        {formatFileSize(attachment.fileSize)} · {formatDate(attachment.createdAt)}
                      </div>
                    </div>
                    <Button type="button" variant="secondary" size="sm" pill onClick={() => actions.deleteAttachment(attachment.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}
