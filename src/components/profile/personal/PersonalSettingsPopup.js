import React from "react";
import { createPortal } from "react-dom";
import { CalendarField } from "@/components/calendarAPI";
import DropdownField from "@/components/dropdownAPI/DropdownField";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import useIsMobile from "@/hooks/useIsMobile";
import {
  EmptyState,
  formatCurrency,
  formatDate,
  getWidgetModalCardStyle,
  toNumber,
  widgetAccentSurfaceStyle,
  widgetInsetSurfaceStyle,
  widgetModalBackdropStyle,
} from "@/components/profile/personal/widgets/shared";
import Button from "@/components/ui/Button";

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

function Section({ title, description, children }) {
  return (
    <section
      style={{
        display: "grid",
        gap: "12px",
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
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: "0.74rem", marginBottom: "2px", color: "var(--text-secondary)", fontWeight: 600 }}>{children}</div>;
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

function RecurringRulesSection() {
  const [rules, setRules] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isMobile = useIsMobile();

  React.useEffect(() => {
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

function PayAndWorkSection({ finance, isMobile }) {
  const pay = finance.financeState.paySettings || {};
  const month = finance.model.currentMonth;

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
      <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={Boolean(pay.useManualTax)}
          onChange={(e) => finance.updatePaySetting("useManualTax", e.target.checked)}
        />
        <span>Override tax and NI with fixed £ amounts</span>
      </label>
      {pay.useManualTax ? (
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1fr 1fr" }}>
          <label>
            <FieldLabel>Tax (£)</FieldLabel>
            <input
              className="app-input"
              type="number"
              value={pay.manualTax || 0}
              onChange={(e) => finance.updatePaySetting("manualTax", toNumber(e.target.value))}
            />
          </label>
          <label>
            <FieldLabel>National Insurance (£)</FieldLabel>
            <input
              className="app-input"
              type="number"
              value={pay.manualNationalInsurance || 0}
              onChange={(e) => finance.updatePaySetting("manualNationalInsurance", toNumber(e.target.value))}
            />
          </label>
        </div>
      ) : null}

      <StatGrid isMobile={isMobile}>
        <Stat label="Hours worked">{month.pay.expectedHours.toFixed(1)}h</Stat>
        <Stat label="Base pay">{formatCurrency(month.pay.basePay)}</Stat>
        <Stat label="Tax">{formatCurrency(month.pay.tax)}</Stat>
        <Stat label="NI">{formatCurrency(month.pay.nationalInsurance)}</Stat>
      </StatGrid>
    </Section>
  );
}

function OvertimeSection({ finance, isMobile }) {
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

function LeaveSection({ finance, isMobile }) {
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

function SavingsSection({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Savings and Pots"
      description="Monthly savings allocations. Each pot represents a named target you put money toward this month."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Saved this month">{formatCurrency(month.totals.savingsTotal)}</Stat>
        <Stat label="Year planned savings">{formatCurrency(finance.model.yearTotals.savingsTotal)}</Stat>
      </StatGrid>

      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.savingsBuckets.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "grid",
              gap: "8px",
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.6fr 1fr auto",
              padding: "8px 10px",
              ...widgetInsetSurfaceStyle,
            }}
          >
            <input className="app-input" value={entry.name || ""} placeholder="Pot name" onChange={(e) => finance.updateSavingsBucket(entry.id, { name: e.target.value })} />
            <input className="app-input" type="number" value={entry.amount || 0} placeholder="Amount" onChange={(e) => finance.updateSavingsBucket(entry.id, { amount: toNumber(e.target.value) })} />
            <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeSavingsBucket(entry.id)}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" pill style={{ justifySelf: "start" }} onClick={finance.addSavingsBucket}>
        Add savings pot
      </Button>
    </Section>
  );
}

function PaymentsSection({ finance, isMobile }) {
  const month = finance.model.currentMonth;
  const rowStyle = isMobile ? "minmax(0, 1fr)" : "1.6fr 1fr auto";

  return (
    <Section
      title="Payments and Outgoings"
      description="Fixed monthly costs and planned one-off payments. These are used to calculate your total outgoings."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Fixed outgoings">{formatCurrency(month.totals.fixedOut)}</Stat>
        <Stat label="Planned payments">{formatCurrency(month.totals.plannedOut)}</Stat>
        <Stat label="Total out">{formatCurrency(month.totals.totalOut)}</Stat>
      </StatGrid>

      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: "2px" }}>
        Fixed outgoings
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.fixedOutgoings.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: rowStyle, padding: "8px 10px", ...widgetInsetSurfaceStyle }}>
            <input className="app-input" value={entry.name || ""} placeholder="Category" onChange={(e) => finance.updateFixedOutgoing(entry.id, { name: e.target.value })} />
            <input className="app-input" type="number" value={entry.amount || 0} placeholder="Amount" onChange={(e) => finance.updateFixedOutgoing(entry.id, { amount: toNumber(e.target.value) })} />
            <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeFixedOutgoing(entry.id)}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" pill style={{ justifySelf: "start" }} onClick={finance.addFixedOutgoing}>
        Add fixed outgoing
      </Button>

      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: "2px" }}>
        Planned payments
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.plannedPayments.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: rowStyle, padding: "8px 10px", ...widgetInsetSurfaceStyle }}>
            <input className="app-input" value={entry.name || ""} placeholder="Payment name" onChange={(e) => finance.updatePlannedPayment(entry.id, { name: e.target.value })} />
            <input className="app-input" type="number" value={entry.amount || 0} placeholder="Amount" onChange={(e) => finance.updatePlannedPayment(entry.id, { amount: toNumber(e.target.value) })} />
            <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removePlannedPayment(entry.id)}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" pill style={{ justifySelf: "start" }} onClick={finance.addPlannedPayment}>
        Add planned payment
      </Button>
    </Section>
  );
}

function CreditCardsSection({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Credit Cards"
      description="Track card balances and monthly payments. Card payments are included in your total outgoings calculation."
    >
      <StatGrid isMobile={isMobile}>
        <Stat label="Card payments">{formatCurrency(month.totals.creditCardOut)}</Stat>
        <Stat label="Total balances">{formatCurrency(month.totals.totalCardBalances)}</Stat>
      </StatGrid>

      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.creditCards.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "grid",
              gap: "8px",
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "1.2fr 1fr 1fr auto",
              padding: "8px 10px",
              ...widgetInsetSurfaceStyle,
            }}
          >
            <input className="app-input" value={entry.name || ""} placeholder="Card name" onChange={(e) => finance.updateCreditCard(entry.id, { name: e.target.value })} />
            <input className="app-input" type="number" value={entry.balance || 0} placeholder="Balance" onChange={(e) => finance.updateCreditCard(entry.id, { balance: toNumber(e.target.value) })} />
            <input className="app-input" type="number" value={entry.monthlyPayment || 0} placeholder="Monthly pay" onChange={(e) => finance.updateCreditCard(entry.id, { monthlyPayment: toNumber(e.target.value) })} />
            <Button type="button" variant="secondary" size="sm" pill onClick={() => finance.removeCreditCard(entry.id)}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" pill style={{ justifySelf: "start" }} onClick={finance.addCreditCard}>
        Add credit card
      </Button>
    </Section>
  );
}

function AdjustmentsSection({ finance, isMobile }) {
  const month = finance.model.currentMonth;

  return (
    <Section
      title="Manual Adjustments"
      description="One-off income or outgoing adjustments for this month that don't fit into the categories above."
    >
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label>
          <FieldLabel>Other income this month</FieldLabel>
          <input
            className="app-input"
            type="number"
            value={month.monthState.otherIncome || 0}
            onChange={(e) => finance.updateMonthField("otherIncome", toNumber(e.target.value))}
          />
        </label>
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
        <Stat label="Total in"><span style={{ color: "var(--text-primary)" }}>{formatCurrency(month.totals.totalIn)}</span></Stat>
        <Stat label="Total out"><span style={{ color: "var(--text-primary)" }}>{formatCurrency(month.totals.totalOut)}</span></Stat>
        <Stat label="Money left">
          <span style={{ color: "var(--text-primary)" }}>
            {formatCurrency(month.totals.difference)}
          </span>
        </Stat>
      </StatGrid>
    </Section>
  );
}

export default function PersonalSettingsPopup({ isOpen, onClose, finance }) {
  useBodyModalLock(isOpen);
  const isMobile = useIsMobile();

  if (!isOpen || !finance) return null;

  const popup = (
    <div
      className="popup-backdrop"
      style={{
        ...widgetModalBackdropStyle,
        padding: isMobile ? "8px" : "24px",
        zIndex: 2200,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          ...getWidgetModalCardStyle(isMobile, {
            maxWidth: "820px",
          }),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "3px" }}>
            <div style={{ fontSize: isMobile ? "1rem" : "1.05rem", fontWeight: 700 }}>Personal settings</div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, fontSize: "0.8rem" }}>
              Changes for <strong>{finance.model.selectedMonthKey}</strong> save automatically.
            </div>
          </div>
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
          <PayAndWorkSection finance={finance} isMobile={isMobile} />
          <OvertimeSection finance={finance} isMobile={isMobile} />
          <RecurringRulesSection />
          <LeaveSection finance={finance} isMobile={isMobile} />
          <SavingsSection finance={finance} isMobile={isMobile} />
          <PaymentsSection finance={finance} isMobile={isMobile} />
          <CreditCardsSection finance={finance} isMobile={isMobile} />
          <AdjustmentsSection finance={finance} isMobile={isMobile} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "2px" }}>
          <Button type="button" variant="primary" size="sm" pill onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? popup : createPortal(popup, document.body);
}
