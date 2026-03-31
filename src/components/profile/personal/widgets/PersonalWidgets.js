import React, { useCallback, useMemo, useRef, useState } from "react";
import useIsMobile from "@/hooks/useIsMobile";
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
  widgetAccentSurfaceStyle,
  widgetInsetSurfaceStyle,
} from "@/components/profile/personal/widgets/shared";
import Button from "@/components/ui/Button";
import {
  calculateMortgagePaymentBreakdown,
  calculateMortgagePayoffTimeline,
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

function SummaryBlock({ label, value, accent = "var(--text-primary)" }) {
  return (
    <div
      style={{
        ...widgetAccentSurfaceStyle,
        padding: "12px 14px",
        display: "grid",
        gap: "4px",
      }}
    >
      <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: "1.15rem", fontWeight: 800, color: accent, lineHeight: 1.2 }}>
        {value}
      </span>
    </div>
  );
}

function buildDisplayRowsNewestFirst(rows = [], limit = null) {
  const ordered = [...(rows || [])].reverse();
  return Number.isInteger(limit) ? ordered.slice(0, limit) : ordered;
}

function InlineValuePair({ leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        padding: "8px 10px",
        borderRadius: "10px",
        background: "var(--surface)",
        border: "1px solid rgba(var(--primary-rgb), 0.08)",
      }}
    >
      <div style={{ display: "grid", gap: "2px" }}>
        <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>{leftLabel}</span>
        <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700 }}>{leftValue}</span>
      </div>
      <div style={{ display: "grid", gap: "2px", justifyItems: "end", borderLeft: "2px solid var(--primary)", paddingLeft: "10px" }}>
        <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>{rightLabel}</span>
        <span style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontWeight: 700, textAlign: "right" }}>{rightValue}</span>
      </div>
    </div>
  );
}

function resolveMortgageMode(settings = {}) {
  return settings.mode === "bills" ? "bills" : "saving";
}

function resolveLinkedMortgagePayment(finance, sourceId = "") {
  if (!sourceId) return null;
  if (sourceId.startsWith("savings:")) {
    const savings = finance?.model?.savingsAccountBalances?.find(
      (entry) => entry.id === sourceId.slice(8)
    );
    return savings ? Number(savings.monthInflow || 0) : null;
  }
  if (sourceId.startsWith("fixed:")) {
    const fixed = finance?.model?.currentMonth?.monthState?.fixedOutgoings?.find(
      (entry) => entry.id === sourceId.slice(6)
    );
    return fixed ? Number(fixed.amount || 0) : null;
  }
  if (sourceId.startsWith("plan:")) {
    const plan = finance?.model?.plannedPaymentPlanDetails?.find(
      (entry) => entry.id === sourceId.slice(5)
    );
    return plan ? Number(plan.thisMonthAmount || 0) : null;
  }
  return null;
}

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
        height: "100%",
        flex: 1,
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
                fontSize: "1rem",
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
            flex: 1,
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
  const isMobile = useIsMobile();
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
          <SummaryBlock
            label={`TOTAL AFTER TAX (${String(finance.model.selectedFinanceYear || "").toUpperCase()})`}
            value={formatCurrency(year.totalAfterTax)}
            accent="var(--success, #2e7d32)"
          />
          <SummaryBlock
            label={`${String(monthLabel || "").toUpperCase()} TOTAL AFTER TAX`}
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
              <MetricPill label="Hours worked" value={`${Number(year.hoursWorked || 0).toFixed(1)}h`} accent="var(--info, #1565c0)" />
              <MetricPill label="Overtime" value={`${Number(year.overtimeHours || 0).toFixed(1)}h`} accent="var(--warning, #ef6c00)" />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={incomeSectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>{monthLabel} pay</SectionLabel>
            {isMobile ? (
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "minmax(0, 1fr)" }}>
                <InlineValuePair
                  leftLabel="Hours worked"
                  leftValue={`${month.pay.hoursWorked.toFixed(1)}h`}
                  rightLabel="Basic total"
                  rightValue={formatCurrency(month.pay.basePay)}
                />
                <InlineValuePair
                  leftLabel="Overtime worked"
                  leftValue={`${month.pay.overtimeHours.toFixed(1)}h`}
                  rightLabel="Overtime total"
                  rightValue={formatCurrency(month.pay.overtimePay)}
                />
                <InlineValuePair
                  leftLabel="Other income"
                  leftValue={formatCurrency(month.totals.classicIncome)}
                  rightLabel="Tax NI"
                  rightValue={`${formatCurrency(month.pay.tax)} / ${formatCurrency(month.pay.nationalInsurance)}`}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <InlineValuePair
                  leftLabel="Hours worked"
                  leftValue={`${month.pay.hoursWorked.toFixed(1)}h`}
                  rightLabel="Basic total"
                  rightValue={formatCurrency(month.pay.basePay)}
                />
                <InlineValuePair
                  leftLabel="Overtime worked"
                  leftValue={`${month.pay.overtimeHours.toFixed(1)}h`}
                  rightLabel="Overtime total"
                  rightValue={formatCurrency(month.pay.overtimePay)}
                />
                <MetricPill label="Other income" value={formatCurrency(month.totals.classicIncome)} accent="var(--info, #1565c0)" />
                <InlineValuePair
                  leftLabel="Tax"
                  leftValue={formatCurrency(month.pay.tax)}
                  rightLabel="NI"
                  rightValue={formatCurrency(month.pay.nationalInsurance)}
                />
              </div>
            )}
            {month.pay.workDeductions > 0
              ? (month.pay.workDeductionEntries || []).map((entry) => {
                  const description = String(entry.description || "").trim();
                  const label = entry.registration
                    ? description
                      ? `${entry.registration} - ${description}`
                      : entry.registration
                    : (description || entry.label || "Work Deduction");
                  return (
                  <DataRow
                    key={entry.id}
                    label={label}
                    value={`-${formatCurrency(entry.amount)}`}
                    muted
                  />
                  );
                })
              : null}
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
  const totalWorkedHours = Number(month.pay.totalWorkedHours ?? month.pay.hoursWorked ?? 0);
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Work / Hours"}
      subtitle="Worked hours and overtime this month"
      accent="var(--warning, #ef6c00)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <SummaryBlock
            label="Total worked"
            value={`${totalWorkedHours.toFixed(1)}h`}
            accent="var(--info, #1565c0)"
          />
          <SummaryBlock
            label="Total pay after tax"
            value={formatCurrency(month.pay.afterTaxIncome)}
            accent="var(--success, #2e7d32)"
          />
          <SummaryBlock
            label="Total overtime"
            value={`${month.pay.overtimeHours.toFixed(1)}h`}
            accent="var(--warning, #ef6c00)"
          />
          <SummaryBlock
            label="Total overtime pay (before tax)"
            value={formatCurrency(month.pay.overtimePay)}
            accent="var(--warning, #ef6c00)"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Linked summary</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <MetricPill label="Attendance logged" value={month.pay.attendanceWorkedHours !== null ? `${month.pay.attendanceWorkedHours.toFixed(1)}h` : "—"} accent="var(--info, #1565c0)" />
              <MetricPill label="Total OT hour" value={`${month.pay.overtimeHours.toFixed(1)}h`} accent="var(--warning, #ef6c00)" />
              <MetricPill label="Base pay (before tax)" value={formatCurrency(month.pay.basePay)} accent="var(--success, #2e7d32)" />
              <MetricPill label="OT rate" value={formatCurrency(month.pay.overtimeRate)} accent="var(--text-secondary)" />
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
  const creditCards = buildDisplayRowsNewestFirst(month.monthState.creditCards || []);
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
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <MetricPill label="Fixed" value={formatCurrency(month.totals.fixedOut)} accent="var(--danger, #c62828)" />
              <MetricPill label="Planned" value={formatCurrency(month.totals.plannedOut)} accent="var(--warning, #ef6c00)" />
              <MetricPill label="Card payments" value={formatCurrency(month.totals.creditCardOut)} accent="var(--accent-purple)" />
              <MetricPill label="Card balances" value={formatCurrency(month.totals.totalCardBalances)} accent="var(--accent-purple)" />
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

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Credit cards (Database)</SectionLabel>
            {creditCards.length === 0 ? (
              <EmptyState>No credit cards set for this month.</EmptyState>
            ) : (
              creditCards.map((entry) => (
                <DataRow
                  key={entry.id}
                  label={`${entry.name || "Card"}${entry.isPaidOff ? " · fully paid off" : ""}`}
                  value={`${formatCurrency(entry.balance || 0)} balance · ${formatCurrency(entry.isPaidOff ? entry.balance || 0 : entry.monthlyPayment || 0)}`}
                />
              ))
            )}
          </div>
        </SurfacePanel>

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
  const accountGroups = finance.model.savingsAccountGroups || [];
  const transactions = buildDisplayRowsNewestFirst(month.monthState.savingsBuckets || [], 4);
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
          <SummaryBlock
            label="TOTAL BALANCE"
            value={formatCurrency(totalBalance)}
            accent="var(--info, #1565c0)"
          />
          <SummaryBlock
            label="SAVED THIS MONTH"
            value={formatCurrency(month.totals.savingsTotal)}
            accent="var(--success, #2e7d32)"
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
              <div style={{ display: "grid", gap: "8px" }}>
                {accountGroups.map((group) => (
                  <div
                    key={group.id}
                    style={{
                      display: "grid",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: "var(--surface)",
                      border: "1px solid rgba(var(--primary-rgb), 0.08)",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", alignItems: "start" }}>
                      <div style={{ display: "grid", gap: "2px" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{group.name} total</span>
                        <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                          {group.accounts.length} linked account{group.accounts.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gap: "2px", justifyItems: "end" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(group.currentBalance)}</span>
                        {group.monthActivity !== 0 ? (
                          <span style={{ fontSize: "0.66rem", fontWeight: 600, color: group.monthActivity > 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)" }}>
                            {group.monthActivity > 0 ? "+" : ""}{formatCurrency(group.monthActivity)} this month
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>No activity this month</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: "6px" }}>
                      {group.accounts.map((account) => (
                        <div key={account.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", alignItems: "start" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>{account.name || "Unnamed"}</span>
                            <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                              {account.interestRate > 0 ? `${account.interestRate}% AER` : "No interest rate set"}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(account.currentBalance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {accountBalances.filter((account) => !String(account.parentGroup || "").trim()).map((account) => (
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
                ))}
              </div>
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

export function BillsWidget({ widget, onOpenSettings, finance, widgetDataMap, widgetMonthKey }) {
  const month = finance.model.currentMonth;
  const spendingTotal = Number(month?.totals?.fixedOut || 0);
  const fuelTotal = Number(month?.totals?.fuelTotal || 0);
  const mortgageWidgetData = widgetDataMap?.mortgage?.data || {};
  const holidayWidgetData = widgetDataMap?.holiday?.data || {};
  const resolvedMortgageSettings = mortgageWidgetData?.settings || {};
  const mortgageMode = resolveMortgageMode(resolvedMortgageSettings);
  const resolvedMortgagePayment = resolveLinkedMortgagePayment(
    finance,
    resolvedMortgageSettings.linkedMortgagePaymentSourceId || ""
  );
  const mortgageBillsPayment = resolvedMortgagePayment !== null
    ? resolvedMortgagePayment
    : Number(
      resolvedMortgageSettings.mortgageMonthlyPayment
      || resolvedMortgageSettings.monthlyPayment
      || mortgageWidgetData?.monthlyPayment
      || 0
    );
  const mortgageMonthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData: {
          ...mortgageWidgetData,
          settings: {
            ...(mortgageWidgetData?.settings || {}),
            mortgageMonthlyPayment: mortgageBillsPayment,
          },
        },
        defaultCategory: "House",
      }),
    [mortgageBillsPayment, mortgageWidgetData, widgetMonthKey]
  );
  const holidayMonthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData: holidayWidgetData,
        defaultCategory: "Holiday",
      }),
    [holidayWidgetData, widgetMonthKey]
  );
  const mortgageTotal = mortgageMode === "bills"
    ? Number(mortgageMonthView?.total || mortgageBillsPayment || 0)
    : 0;
  const holidayTotal = Number(holidayMonthView?.total || 0);
  const totalPayments = spendingTotal + fuelTotal + mortgageTotal + holidayTotal;
  const afterTaxIncome = Number(month?.pay?.afterTaxIncome || 0);
  const moneyLeftAfterPayments = afterTaxIncome - totalPayments;
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Payments"}
      subtitle="Monthly payment summary against after-tax income"
      accent="var(--warning, #ef6c00)"
      onOpenSettings={onOpenSettings}
      headline={
        <Headline
          label="Total payments this month"
          value={formatCurrency(totalPayments)}
          accent="var(--warning, #ef6c00)"
        />
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Breakdown (Linked)</SectionLabel>
            <DataRow label="Spending" value={formatCurrency(spendingTotal)} />
            <DataRow label="Fuel" value={formatCurrency(fuelTotal)} />
            <DataRow label="Mortgage" value={formatCurrency(mortgageTotal)} />
            <DataRow label="Holiday" value={formatCurrency(holidayTotal)} />
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Compared with income (Linked)</SectionLabel>
            <DataRow label="Income after tax" value={formatCurrency(afterTaxIncome)} />
            <DataRow label="Total payments" value={formatCurrency(totalPayments)} />
            <DataRow
              label={moneyLeftAfterPayments >= 0 ? "Remaining after payments" : "Over after payments"}
              value={formatCurrency(Math.abs(moneyLeftAfterPayments))}
              accent={moneyLeftAfterPayments >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #c62828)"}
            />
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}

/* ── FuelWidget ───────────────────────────────────────────────── */

export function FuelWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;
  const fuelEntries = buildDisplayRowsNewestFirst(month.monthState.fuelEntries || [], 5);
  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Fuel"}
      subtitle="Monthly fuel costs, litres, and average pump price"
      accent="var(--warning, #ff8f00)"
      onOpenSettings={onOpenSettings}
      headline={
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Headline
            label="Total fuel"
            value={formatCurrency(month.totals.fuelTotal || 0)}
            accent="var(--warning, #ff8f00)"
          />
          <Headline
            label="Total litres"
            value={`${Number(month.totals.fuelLitres || 0).toFixed(2)}L`}
            accent="var(--info, #1565c0)"
            size="medium"
          />
        </div>
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Summary (Linked)</SectionLabel>
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <MetricPill label="Spend" value={formatCurrency(month.totals.fuelTotal || 0)} accent="var(--warning, #ff8f00)" />
              <MetricPill label="Litres" value={`${Number(month.totals.fuelLitres || 0).toFixed(2)}L`} accent="var(--info, #1565c0)" />
              <MetricPill
                label="Avg / litre"
                value={month.totals.fuelAverageCostPerLitre > 0 ? `${Number(month.totals.fuelAverageCostPerLitre).toFixed(3)}` : "—"}
                accent="var(--success, #2e7d32)"
              />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
            <SectionLabel>Fuel entries (Database)</SectionLabel>
            {fuelEntries.length === 0 ? (
              <EmptyState>No fuel entries yet — add them in Settings.</EmptyState>
            ) : (
              fuelEntries.map((entry) => (
                <DataRow
                  key={entry.id}
                  label="Entry"
                  value={`${formatCurrency(entry.cost || 0)} · ${Number(entry.litres || 0).toFixed(2)}L · ${entry.costPerLitre ? Number(entry.costPerLitre).toFixed(3) : "—"}`}
                />
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
  const mode = resolveMortgageMode(settings);
  const savingsGoal = Number(settings.savingsGoal || settings.depositTarget || 0);
  const linkedAccountId = settings.linkedSavingsAccountId || "";
  const linkedBalance = linkedAccountId
    ? (finance?.model?.savingsAccountBalances || []).find((b) => b.id === linkedAccountId)?.currentBalance || 0
    : null;
  const totalSaved = linkedBalance !== null
    ? linkedBalance
    : Number(settings.totalSaved || settings.currentSaved || 0);
  const savingsDeadline = settings.savingsDeadline || settings.mortgageDeadline || "";
  const linkedMortgagePaymentSourceId = settings.linkedMortgagePaymentSourceId || "";
  const resolvedLinkedMortgagePayment = useMemo(
    () => resolveLinkedMortgagePayment(finance, linkedMortgagePaymentSourceId),
    [finance, linkedMortgagePaymentSourceId]
  );
  const monthlyContribution = resolvedLinkedMortgagePayment !== null
    ? resolvedLinkedMortgagePayment
    : Number(settings.monthlyContribution || settings.monthlyPayment || widgetData?.monthlyPayment || 0);
  const monthlyPayment = resolvedLinkedMortgagePayment !== null
    ? resolvedLinkedMortgagePayment
    : Number(settings.mortgageMonthlyPayment || settings.monthlyPayment || widgetData?.monthlyPayment || 0);
  const interestRate = Number(settings.interestRate || 0);
  const termLengthYears = Number(settings.termLengthYears || 0);
  const remainingBalance = Number(settings.remainingBalance || 0);
  const monthView = useMemo(
    () =>
      calculateGoalContributionForMonth({
        monthKey: widgetMonthKey,
        widgetData: {
          ...widgetData,
          target: savingsGoal,
          current: totalSaved,
          deadline: savingsDeadline,
          monthlyPayment: monthlyContribution,
        },
        defaultCategory: "House",
      }),
    [monthlyContribution, savingsDeadline, savingsGoal, totalSaved, widgetData, widgetMonthKey]
  );

  const projectedDate = calculateProjectedSavingsDate({
    targetAmount: savingsGoal,
    currentAmount: totalSaved,
    monthlyContribution,
  });
  const remainingToTarget = Math.max(0, savingsGoal - totalSaved);
  const monthsToDepositTarget = savingsGoal <= totalSaved
    ? 0
    : monthlyContribution > 0
      ? Math.ceil(remainingToTarget / monthlyContribution)
      : null;
  const mortgageBreakdown = useMemo(
    () => calculateMortgagePaymentBreakdown({
      remainingBalance,
      monthlyPayment,
      interestRate,
    }),
    [interestRate, monthlyPayment, remainingBalance]
  );
  const mortgageTimeline = useMemo(
    () => calculateMortgagePayoffTimeline({
      remainingBalance,
      monthlyPayment,
      interestRate,
    }),
    [interestRate, monthlyPayment, remainingBalance]
  );

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Mortgage"}
      subtitle={mode === "bills" ? "Mortgage repayment overview" : "Saving for your mortgage goal"}
      accent="var(--text-primary)"
      monthLabel={mode === "saving" ? monthView.label : ""}
      statusLabel={mode === "saving" ? monthView.status : "Mortgage Bills"}
      onOpenSettings={onOpenSettings}
      headline={
        mode === "bills" ? (
          <Headline
            label="Monthly payment"
            value={formatCurrency(monthlyPayment)}
          />
        ) : (
          <Headline
            label="Savings goal"
            value={formatCurrency(savingsGoal)}
          />
        )
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        {mode === "bills" ? (
          <>
            <SurfacePanel style={sectionStyle}>
              <div style={{ display: "grid", gap: "8px" }}>
                <SectionLabel>Mortgage bills</SectionLabel>
                <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <MetricPill label="Monthly payment" value={formatCurrency(monthlyPayment)} />
                  <MetricPill label="Interest rate" value={`${interestRate.toFixed(2)}%`} />
                  <MetricPill label="Term length" value={termLengthYears > 0 ? `${termLengthYears} years` : "Not set"} />
                  <MetricPill label="Remaining balance" value={formatCurrency(remainingBalance)} />
                </div>
              </div>
            </SurfacePanel>

            <SurfacePanel style={sectionStyle}>
              <div style={{ display: "grid", gap: "8px" }}>
                <SectionLabel>Payment breakdown</SectionLabel>
                <DataRow label="Interest" value={formatCurrency(mortgageBreakdown.interestPayment)} />
                <DataRow label="Capital" value={formatCurrency(mortgageBreakdown.capitalPayment)} />
                <DataRow label="Balance after payment" value={formatCurrency(mortgageBreakdown.remainingAfterPayment)} />
                <DataRow
                  label="Estimated payoff"
                  value={
                    mortgageTimeline.isPaymentInsufficient
                      ? "Payment too low"
                      : mortgageTimeline.projectedPayoffDate
                        ? formatDate(mortgageTimeline.projectedPayoffDate)
                        : "No projection"
                  }
                />
              </div>
            </SurfacePanel>
          </>
        ) : (
          <>
            <SurfacePanel style={sectionStyle}>
              <div style={{ display: "grid", gap: "8px" }}>
                <SectionLabel>Saving for mortgage</SectionLabel>
                <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <MetricPill label="Savings goal" value={formatCurrency(savingsGoal)} />
                  <MetricPill
                    label={linkedAccountId
                      ? `Total saved (${(finance?.financeState?.savingsAccounts || []).find((a) => a.id === linkedAccountId)?.name || "Linked"})`
                      : "Total saved"}
                    value={formatCurrency(totalSaved)}
                  />
                  <MetricPill
                    label={linkedMortgagePaymentSourceId ? "Linked monthly contribution" : "Monthly contribution"}
                    value={formatCurrency(monthlyContribution)}
                  />
                  <MetricPill label="Remaining amount" value={formatCurrency(remainingToTarget)} />
                </div>
              </div>
            </SurfacePanel>

            <SurfacePanel style={sectionStyle}>
              <div style={{ display: "grid", gap: "8px" }}>
                <SectionLabel>Timeline</SectionLabel>
                <DataRow label="Target date" value={savingsDeadline ? formatDate(savingsDeadline) : "Not set"} muted />
                <DataRow label="Projected date" value={projectedDate ? formatDate(projectedDate) : "No projection"} />
                <DataRow
                  label="Time remaining"
                  value={
                    monthsToDepositTarget === null
                      ? "No estimate"
                      : `${monthsToDepositTarget} month${monthsToDepositTarget === 1 ? "" : "s"}`
                  }
                />
                <DataRow label={monthView.status} value={formatCurrency(monthView.total || monthlyContribution)} />
              </div>
            </SurfacePanel>
          </>
        )}
      </div>
    </BaseWidget>
  );
}

/* ── HolidayWidget ────────────────────────────────────────────── */

export function HolidayWidget({ widget, finance, onOpenSettings, widgetData }) {
  const leaveStats = finance.derived.leaveStats;
  const settings = widgetData?.settings || {};
  const holidayPaymentLinks = settings.holidayPaymentLinks && typeof settings.holidayPaymentLinks === "object"
    ? settings.holidayPaymentLinks
    : {};
  const linkedPaymentPlanIds = Array.isArray(settings.linkedPaymentPlanIds)
    ? settings.linkedPaymentPlanIds
    : Object.keys(holidayPaymentLinks);
  const linkedPlans = (finance.model.plannedPaymentPlanDetails || []).filter((plan) => linkedPaymentPlanIds.includes(plan.id));
  const holidayCostThisMonth = linkedPlans.reduce((sum, plan) => sum + Number(plan.thisMonthAmount || 0), 0);
  const holidayCostTotal = linkedPlans.reduce((sum, plan) => sum + Number(plan.totalAcrossMonths || 0), 0);
  const leaveMap = new Map((leaveStats.approvedRequests || []).map((request) => [request.id, request]));
  const linkedHolidayGroups = linkedPlans.reduce((accumulator, plan) => {
    const linkedLeaveId = holidayPaymentLinks[plan.id] || "";
    const request = leaveMap.get(linkedLeaveId);
    const groupKey = linkedLeaveId || `unassigned-${plan.id}`;
    const label = request
      ? `${request.type || "Leave"} · ${formatDate(request.startDate)} → ${formatDate(request.endDate)}`
      : "Unassigned holiday";

    if (!accumulator[groupKey]) {
      accumulator[groupKey] = {
        label,
        thisMonthAmount: 0,
        totalAcrossMonths: 0,
      };
    }

    accumulator[groupKey].thisMonthAmount += Number(plan.thisMonthAmount || 0);
    accumulator[groupKey].totalAcrossMonths += Number(plan.totalAcrossMonths || 0);
    return accumulator;
  }, {});
  const linkedHolidayRows = Object.values(linkedHolidayGroups);
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
            label="Holiday costs"
            value={formatCurrency(holidayCostTotal)}
            accent="var(--info, #00838f)"
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
              <MetricPill label="Remaining" value={leaveStats.remaining ?? "—"} accent="var(--success, #2e7d32)" />
              <MetricPill label="Cost this month" value={formatCurrency(holidayCostThisMonth)} accent="var(--info, #1565c0)" />
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "8px" }}>
            <SectionLabel>Linked holiday costs</SectionLabel>
            {linkedHolidayRows.length === 0 ? (
              <EmptyState>No payment schedules linked yet. Link them in Settings to track holiday costs.</EmptyState>
            ) : (
              linkedHolidayRows.map((row) => (
                <DataRow
                  key={row.label}
                  label={row.label}
                  value={`${formatCurrency(row.thisMonthAmount || 0)} / ${formatCurrency(row.totalAcrossMonths || 0)}`}
                />
              ))
            )}
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

/* ── FinanceOverviewWidget ─────────────────────────────────────── */

const OVERVIEW_MAX_VISIBLE_ACCOUNTS = 5;

function OverviewAccountRow({ name, balance, negative = false }) {
  const color = negative || balance < 0 ? "var(--danger, #c62828)" : "var(--text-primary)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "0.82rem", padding: "2px 0" }}>
      <span style={{ color: "var(--text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ fontWeight: 700, color, whiteSpace: "nowrap" }}>{formatCurrency(balance)}</span>
    </div>
  );
}

export function FinanceOverviewWidget({ widget, onOpenSettings, finance }) {
  const [expanded, setExpanded] = useState(false);
  const month = finance.model.currentMonth;
  const userAccounts = finance.financeState.userAccounts || [];

  const visibleNonCardAccounts = useMemo(
    () => userAccounts.filter((a) => a.showInOverview && a.type !== "credit-card"),
    [userAccounts]
  );
  const creditCardAccounts = useMemo(
    () => userAccounts.filter((a) => a.type === "credit-card"),
    [userAccounts]
  );

  const accountsTotal = useMemo(
    () => visibleNonCardAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    [visibleNonCardAccounts]
  );
  const creditCardTotal = useMemo(
    () => creditCardAccounts.reduce((sum, a) => sum + Math.abs(Number(a.balance || 0)), 0),
    [creditCardAccounts]
  );

  const incomeAfterTax = month.pay.afterTaxIncome;
  const totalIn = month.totals.totalIn;
  const totalOut = month.totals.totalOut;
  const difference = month.totals.totalIn - month.totals.classicOut;
  const differencePositive = difference >= 0;

  const displayedAccounts = expanded
    ? visibleNonCardAccounts
    : visibleNonCardAccounts.slice(0, OVERVIEW_MAX_VISIBLE_ACCOUNTS);
  const hiddenCount = visibleNonCardAccounts.length - OVERVIEW_MAX_VISIBLE_ACCOUNTS;

  const sectionStyle = {
    background: "rgba(var(--primary-rgb), 0.08)",
    border: "1px solid rgba(var(--primary-rgb), 0.14)",
  };

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  return (
    <BaseWidget
      title={widget.config?.title || "Finance Overview"}
      accent="var(--success, #2e7d32)"
      onOpenSettings={onOpenSettings}
      headline={
        <SummaryBlock
          label="INCOME AFTER TAX"
          value={formatCurrency(incomeAfterTax)}
          accent="var(--success, #2e7d32)"
        />
      }
    >
      <div style={{ display: "grid", gap: "10px" }}>
        {/* Accounts section */}
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "6px" }}>
            <SectionLabel>Accounts (current balances)</SectionLabel>
            {visibleNonCardAccounts.length === 0 ? (
              <EmptyState>No accounts added yet. Open Settings to add accounts.</EmptyState>
            ) : (
              <>
                {displayedAccounts.map((account) => (
                  <OverviewAccountRow
                    key={account.id}
                    name={account.name || "Unnamed"}
                    balance={account.balance}
                  />
                ))}
                {hiddenCount > 0 && !expanded ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 0",
                      textAlign: "left",
                    }}
                  >
                    + {hiddenCount} more
                  </button>
                ) : hiddenCount > 0 && expanded ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 0",
                      textAlign: "left",
                    }}
                  >
                    Show less
                  </button>
                ) : null}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", borderTop: "1px solid rgba(var(--primary-rgb), 0.12)", paddingTop: "6px", marginTop: "2px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>Total in accounts</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 800, color: accountsTotal < 0 ? "var(--danger, #c62828)" : "var(--success, #2e7d32)" }}>
                    {formatCurrency(accountsTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SurfacePanel>

        {/* Credit cards section */}
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "6px" }}>
            <SectionLabel>Credit cards (total owed)</SectionLabel>
            {creditCardAccounts.length === 0 ? (
              <EmptyState>No credit cards added yet.</EmptyState>
            ) : (
              <>
                {creditCardAccounts.map((account) => (
                  <OverviewAccountRow
                    key={account.id}
                    name={account.name || "Unnamed"}
                    balance={Math.abs(account.balance)}
                    negative
                  />
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", borderTop: "1px solid rgba(var(--primary-rgb), 0.12)", paddingTop: "6px", marginTop: "2px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>Total owed</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--danger, #c62828)" }}>
                    {formatCurrency(creditCardTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SurfacePanel>

        {/* Totals section */}
        <SurfacePanel style={sectionStyle}>
          <div style={{ display: "grid", gap: "6px" }}>
            <SectionLabel>Monthly totals</SectionLabel>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total In</span>
              <span style={{ fontWeight: 700, color: "var(--success, #2e7d32)" }}>{formatCurrency(totalIn)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total Out</span>
              <span style={{ fontWeight: 700, color: "var(--danger, #c62828)" }}>{formatCurrency(totalOut)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", borderTop: "1px solid rgba(var(--primary-rgb), 0.12)", paddingTop: "6px", marginTop: "2px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>Difference</span>
              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: differencePositive ? "var(--success, #2e7d32)" : "var(--danger, #c62828)" }}>
                {formatCurrency(difference)}
              </span>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </BaseWidget>
  );
}
