// file location: src/features/payslips/PayslipUpsertModal.js
// Admin-side editor for creating or editing a payslip. Used from the
// /accounts/payslips page. Only renders inputs from the global token system —
// no hardcoded colours or one-off classes.

import React, { useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import FieldError from "@/components/ui/FieldError";
import { runValidation } from "@/lib/validation/validate";
import { required, min } from "@/lib/validation/rules";
import { emptyPayslipDraft } from "./payslipUtils";

// Phase 8: money-critical guards — a payslip can no longer be saved with a
// missing user/date or a zero/negative gross or net figure.
const PAYSLIP_SCHEMA = {
  userId: required("Select a user."),
  paidDate: required("Paid date is required."),
  grossPay: [required("Gross pay is required."), min(0.01, "Gross pay must be more than zero.")],
  netPay: [required("Net pay is required."), min(0, "Net pay cannot be negative.")],
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const labelStyle = {
  display: "grid",
  gap: "4px",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--text-1)",
};

const inputStyle = {
  width: "100%",
};

// Standard --theme section card for a group of form fields. Sits inside the
// modal surface, so per the layer-alternation rule it is a LayerTheme.
function FieldGroup({ children, columns }) {
  return (
    <LayerTheme
      style={{
        padding: "14px",
        display: "grid",
        gap: "12px",
        ...(columns ? { gridTemplateColumns: columns } : {}),
      }}
    >
      {children}
    </LayerTheme>
  );
}

function NumberField({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      step="0.01"
      className="app-input"
      style={inputStyle}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
      {...rest}
    />
  );
}

function TextField({ value, onChange, ...rest }) {
  return (
    <input
      type="text"
      className="app-input"
      style={inputStyle}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  );
}

function RowsEditor({ title, rows = [], onChange, defaultLabel }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const update = (idx, patch) => {
    const next = safeRows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange(next);
  };
  const addRow = () => onChange([...safeRows, { label: defaultLabel, hours: "", rate: "", amount: 0 }]);
  const removeRow = (idx) => onChange(safeRows.filter((_, i) => i !== idx));

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>{title}</span>
        <Button type="button" variant="secondary" size="xs" onClick={addRow}>
          Add row
        </Button>
      </div>
      {safeRows.length === 0 ? (
        <div style={{ color: "var(--text-1)", fontSize: "0.82rem" }}>
          No rows — total values from the headline figures will be used.
        </div>
      ) : (
        safeRows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) 90px 90px minmax(0, 1fr) auto",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <input
              className="app-input"
              placeholder="Description"
              value={row.label || ""}
              onChange={(event) => update(idx, { label: event.target.value })}
            />
            <input
              className="app-input"
              placeholder="Hours"
              type="number"
              step="0.01"
              value={row.hours ?? ""}
              onChange={(event) => update(idx, { hours: event.target.value === "" ? "" : Number(event.target.value) })}
            />
            <input
              className="app-input"
              placeholder="Rate"
              type="number"
              step="0.01"
              value={row.rate ?? ""}
              onChange={(event) => update(idx, { rate: event.target.value === "" ? "" : Number(event.target.value) })}
            />
            <input
              className="app-input"
              placeholder="Amount"
              type="number"
              step="0.01"
              value={row.amount ?? 0}
              onChange={(event) => update(idx, { amount: event.target.value === "" ? 0 : Number(event.target.value) })}
            />
            <Button type="button" variant="ghost" size="xs" onClick={() => removeRow(idx)}>
              Remove
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

export default function PayslipUpsertModal({
  isOpen,
  mode = "create",
  initialPayslip = null,
  users = [],
  onClose,
  onSaved,
}) {
  const [draft, setDraft] = useState(() => emptyPayslipDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && initialPayslip) {
      setDraft({
        ...emptyPayslipDraft(initialPayslip.userId),
        ...initialPayslip,
      });
    } else {
      setDraft(emptyPayslipDraft());
    }
    setError("");
    setFieldErrors({});
  }, [isOpen, mode, initialPayslip]);

  const userOptions = useMemo(
    () => [
      { value: "", label: "Select a user", placeholder: true },
      ...users.map((user) => ({
        value: String(user.id),
        label: `${user.name}${user.department ? ` — ${user.department}` : ""}`,
      })),
    ],
    [users]
  );

  if (!isOpen) return null;

  const update = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    // Live-clear a field's error as soon as it is edited (after first submit).
    setFieldErrors((prev) => {
      const keys = Object.keys(patch).filter((key) => prev[key]);
      if (!keys.length) return prev;
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Inline, accessible validation before we touch the network — no zero-value
    // or userless payslips can be saved.
    const validationErrors = await runValidation(draft, PAYSLIP_SCHEMA);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const isEdit = mode === "edit" && initialPayslip?.id;
      const url = isEdit ? `/api/payslips/${initialPayslip.id}` : "/api/payslips/admin";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || `Request failed with status ${response.status}`);
      }
      onSaved?.(json?.data || null);
      onClose?.();
    } catch (err) {
      setError(err.message || "Unable to save payslip.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={mode === "edit" ? "Edit payslip" : "Create payslip"}
      cardStyle={{ width: "min(100%, 920px)", padding: 0 }}
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateRows: "auto 1fr auto", maxHeight: "calc(100dvh - 60px)" }}>
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-1)" }}>
            {mode === "edit" ? "Edit payslip" : "New payslip"}
          </div>
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Cancel
          </Button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", display: "grid", gap: "16px" }}>
          {/* Person + status */}
          <FieldGroup columns="repeat(auto-fit, minmax(220px, 1fr))">
            <label style={labelStyle}>
              User
              <DropdownField
                name="userId"
                value={String(draft.userId || "")}
                onChange={(event) => update({ userId: event.target.value ? Number(event.target.value) : "" })}
                options={userOptions}
                disabled={mode === "edit"}
                aria-invalid={fieldErrors.userId ? "true" : undefined}
                aria-describedby={fieldErrors.userId ? "field-userId-error" : undefined}
              />
              <FieldError id="field-userId-error">{fieldErrors.userId}</FieldError>
            </label>
            <label style={labelStyle}>
              Status
              <DropdownField
                name="status"
                value={draft.status || "paid"}
                onChange={(event) => update({ status: event.target.value })}
                options={STATUS_OPTIONS}
              />
            </label>
            <label style={labelStyle}>
              Reference
              <TextField value={draft.reference} onChange={(value) => update({ reference: value })} />
            </label>
          </FieldGroup>

          {/* Dates */}
          <FieldGroup columns="repeat(auto-fit, minmax(220px, 1fr))">
            <label style={labelStyle}>
              Paid date
              <CalendarField
                name="paidDate"
                value={draft.paidDate || ""}
                onChange={(event) => update({ paidDate: event.target.value })}
                aria-invalid={fieldErrors.paidDate ? "true" : undefined}
                aria-describedby={fieldErrors.paidDate ? "field-paidDate-error" : undefined}
              />
              <FieldError id="field-paidDate-error">{fieldErrors.paidDate}</FieldError>
            </label>
            <label style={labelStyle}>
              Period start
              <CalendarField
                name="periodStart"
                value={draft.periodStart || ""}
                onChange={(event) => update({ periodStart: event.target.value })}
              />
            </label>
            <label style={labelStyle}>
              Period end
              <CalendarField
                name="periodEnd"
                value={draft.periodEnd || ""}
                onChange={(event) => update({ periodEnd: event.target.value })}
              />
            </label>
            <label style={labelStyle}>
              Period label
              <TextField
                value={draft.payPeriodLabel}
                onChange={(value) => update({ payPeriodLabel: value })}
                placeholder="e.g. April 2026"
              />
            </label>
          </FieldGroup>

          {/* Headline figures */}
          <FieldGroup columns="repeat(auto-fit, minmax(160px, 1fr))">
            <label style={labelStyle}>Gross pay
              <NumberField
                value={draft.grossPay}
                onChange={(value) => update({ grossPay: value })}
                aria-invalid={fieldErrors.grossPay ? "true" : undefined}
                aria-describedby={fieldErrors.grossPay ? "field-grossPay-error" : undefined}
              />
              <FieldError id="field-grossPay-error">{fieldErrors.grossPay}</FieldError>
            </label>
            <label style={labelStyle}>Net pay
              <NumberField
                value={draft.netPay}
                onChange={(value) => update({ netPay: value })}
                aria-invalid={fieldErrors.netPay ? "true" : undefined}
                aria-describedby={fieldErrors.netPay ? "field-netPay-error" : undefined}
              />
              <FieldError id="field-netPay-error">{fieldErrors.netPay}</FieldError>
            </label>
            <label style={labelStyle}>Taxable pay
              <NumberField value={draft.taxablePay} onChange={(value) => update({ taxablePay: value })} />
            </label>
            <label style={labelStyle}>Tax paid
              <NumberField value={draft.taxPaid} onChange={(value) => update({ taxPaid: value })} />
            </label>
            <label style={labelStyle}>NI paid
              <NumberField value={draft.niPaid} onChange={(value) => update({ niPaid: value })} />
            </label>
            <label style={labelStyle}>Pension (employee)
              <NumberField value={draft.pensionEmployee} onChange={(value) => update({ pensionEmployee: value })} />
            </label>
            <label style={labelStyle}>Pension (employer)
              <NumberField value={draft.pensionEmployer} onChange={(value) => update({ pensionEmployer: value })} />
            </label>
            <label style={labelStyle}>Other deductions
              <NumberField value={draft.otherDeductions} onChange={(value) => update({ otherDeductions: value })} />
            </label>
          </FieldGroup>

          {/* Pay context */}
          <FieldGroup columns="repeat(auto-fit, minmax(160px, 1fr))">
            <label style={labelStyle}>Hourly rate
              <NumberField value={draft.hourlyRate} onChange={(value) => update({ hourlyRate: value })} />
            </label>
            <label style={labelStyle}>Contracted hours
              <NumberField value={draft.contractedHours} onChange={(value) => update({ contractedHours: value })} />
            </label>
            <label style={labelStyle}>Tax code
              <TextField value={draft.taxCode} onChange={(value) => update({ taxCode: value })} />
            </label>
            <label style={labelStyle}>NI number
              <TextField value={draft.niNumber} onChange={(value) => update({ niNumber: value })} />
            </label>
          </FieldGroup>

          {/* YTD */}
          <FieldGroup columns="repeat(auto-fit, minmax(140px, 1fr))">
            <label style={labelStyle}>YTD gross
              <NumberField value={draft.ytdGross} onChange={(value) => update({ ytdGross: value })} />
            </label>
            <label style={labelStyle}>YTD net
              <NumberField value={draft.ytdNet} onChange={(value) => update({ ytdNet: value })} />
            </label>
            <label style={labelStyle}>YTD tax
              <NumberField value={draft.ytdTax} onChange={(value) => update({ ytdTax: value })} />
            </label>
            <label style={labelStyle}>YTD NI
              <NumberField value={draft.ytdNi} onChange={(value) => update({ ytdNi: value })} />
            </label>
            <label style={labelStyle}>YTD pension
              <NumberField value={draft.ytdPension} onChange={(value) => update({ ytdPension: value })} />
            </label>
          </FieldGroup>

          {/* Earnings rows */}
          <FieldGroup>
            <RowsEditor
              title="Earnings rows"
              rows={draft.earnings}
              onChange={(rows) => update({ earnings: rows })}
              defaultLabel="Basic pay"
            />
          </FieldGroup>

          {/* Deduction rows */}
          <FieldGroup>
            <RowsEditor
              title="Deduction rows"
              rows={draft.deductions}
              onChange={(rows) => update({ deductions: rows })}
              defaultLabel="PAYE Tax"
            />
          </FieldGroup>

          {/* Notes */}
          <FieldGroup>
            <label style={labelStyle}>
              Notes
              <textarea
                className="app-input"
                rows={3}
                value={draft.notes || ""}
                onChange={(event) => update({ notes: event.target.value })}
                style={{ resize: "vertical" }}
              />
            </label>
          </FieldGroup>

          {error ? (
            <p className="app-status-message app-status-message--danger" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" pill disabled={submitting}>
            {submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Create payslip"}
          </Button>
        </div>
      </form>
    </PopupModal>
  );
}
