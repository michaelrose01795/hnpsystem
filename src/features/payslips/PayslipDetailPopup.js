// file location: src/features/payslips/PayslipDetailPopup.js
// Detailed payslip viewer styled like a printable HR payslip. Pure
// presentation — receives a payslip object and renders sections for
// employee/employer details, period, earnings, deductions and YTD totals.
// All colours come from theme tokens so it respects dark/light mode and
// the user's accent.

import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import {
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  formatStatusLabel,
  getStatusTone,
} from "./payslipUtils";

const sectionTitleStyle = {
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-1)",
};

const labelStyle = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text-1)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const valueStyle = {
  fontSize: "0.92rem",
  color: "var(--text-1)",
  fontWeight: 600,
};

function InfoCell({ label, value }) {
  return (
    <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value || "—"}</span>
    </div>
  );
}

function RowsTable({ rows = [], fallbackLabel, totalLabel, totalValue, accentColor = "var(--text-1)" }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <div
      style={{
        border: "1px solid rgba(var(--text-1-rgb), 0.12)",
        borderRadius: "var(--radius-md, 12px)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) 80px 80px minmax(80px,1fr)",
          gap: "8px",
          padding: "8px 12px",
          background: "rgba(var(--text-1-rgb), 0.04)",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--text-1)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span>Description</span>
        <span style={{ textAlign: "right" }}>Hours</span>
        <span style={{ textAlign: "right" }}>Rate</span>
        <span style={{ textAlign: "right" }}>Amount</span>
      </div>
      {safeRows.length === 0 ? (
        <div style={{ padding: "12px", color: "var(--text-1)", fontSize: "0.85rem" }}>
          {fallbackLabel}
        </div>
      ) : (
        safeRows.map((row, idx) => (
          <div
            key={`${row.label || "row"}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2fr) 80px 80px minmax(80px,1fr)",
              gap: "8px",
              padding: "10px 12px",
              borderTop: "1px solid rgba(var(--text-1-rgb), 0.06)",
              fontSize: "0.88rem",
              color: "var(--text-1)",
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.label || "—"}
            </span>
            <span style={{ textAlign: "right", color: "var(--text-1)" }}>
              {row.hours !== undefined && row.hours !== null && row.hours !== ""
                ? Number(row.hours).toFixed(2)
                : "—"}
            </span>
            <span style={{ textAlign: "right", color: "var(--text-1)" }}>
              {row.rate !== undefined && row.rate !== null && row.rate !== ""
                ? formatCurrency(row.rate)
                : "—"}
            </span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {formatCurrency(row.amount ?? 0)}
            </span>
          </div>
        ))
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderTop: "1px solid rgba(var(--text-1-rgb), 0.12)",
          background: "rgba(var(--text-1-rgb), 0.04)",
          fontWeight: 700,
          color: accentColor,
          fontSize: "0.92rem",
        }}
      >
        <span>{totalLabel}</span>
        <span>{formatCurrency(totalValue ?? 0)}</span>
      </div>
    </div>
  );
}

export default function PayslipDetailPopup({ isOpen, payslip, onClose }) {
  if (!isOpen || !payslip) return null;

  const tone = getStatusTone(payslip.status);

  const earningsTotal =
    payslip.earnings?.reduce((sum, row) => sum + Number(row?.amount || 0), 0) ?? 0;
  const deductionsTotal =
    payslip.deductions?.reduce((sum, row) => sum + Number(row?.amount || 0), 0) ?? 0;

  // Combined deductions number for the YTD/strip — earnings rows are the
  // "earnings" total, but the gross figure stored on the payslip wins if rows
  // are empty.
  const grossDisplay = earningsTotal > 0 ? earningsTotal : payslip.grossPay;
  const totalDeductionsDisplay =
    deductionsTotal > 0
      ? deductionsTotal
      : (Number(payslip.taxPaid || 0) +
          Number(payslip.niPaid || 0) +
          Number(payslip.pensionEmployee || 0) +
          Number(payslip.otherDeductions || 0));

  const employerSnapshot = payslip.employerSnapshot || {
    name: "Humphries & Parks",
    address: "Humphries & Parks Dealership",
  };
  const employeeSnapshot =
    payslip.employeeSnapshot ||
    (payslip.user
      ? {
          name: payslip.user.name,
          email: payslip.user.email,
          department: payslip.user.department,
          role: payslip.user.role,
        }
      : {});

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Payslip detail"
      cardStyle={{ width: "min(100%, 880px)", padding: 0 }}
    >
      <div style={{ display: "grid", gap: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            background: "var(--theme, var(--surface))",
            borderBottom: "1px solid rgba(var(--text-1-rgb), 0.08)",
            display: "flex",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <span style={sectionTitleStyle}>Payslip</span>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-1)" }}>
              {formatPeriodLabel(payslip)}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
              Paid {formatDate(payslip.paidDate)}
              {payslip.reference ? ` · Ref ${payslip.reference}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                background: tone.bg,
                color: tone.color,
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {formatStatusLabel(payslip.status)}
            </span>
            <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "grid", gap: "20px" }}>
          {/* Parties */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            <div className="app-section-card" style={{ padding: "14px", gap: "10px" }}>
              <span style={sectionTitleStyle}>Employer</span>
              <div style={{ display: "grid", gap: "6px", fontSize: "0.88rem", color: "var(--text-1)" }}>
                <strong style={{ fontSize: "0.95rem" }}>
                  {employerSnapshot?.name || "Humphries & Parks"}
                </strong>
                {employerSnapshot?.address ? <span>{employerSnapshot.address}</span> : null}
                {employerSnapshot?.email ? <span>{employerSnapshot.email}</span> : null}
                {employerSnapshot?.phone ? <span>{employerSnapshot.phone}</span> : null}
                {employerSnapshot?.registration ? (
                  <span style={{ color: "var(--text-1)" }}>
                    Reg {employerSnapshot.registration}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="app-section-card" style={{ padding: "14px", gap: "10px" }}>
              <span style={sectionTitleStyle}>Employee</span>
              <div style={{ display: "grid", gap: "6px", fontSize: "0.88rem", color: "var(--text-1)" }}>
                <strong style={{ fontSize: "0.95rem" }}>{employeeSnapshot?.name || "—"}</strong>
                {employeeSnapshot?.role ? <span>{employeeSnapshot.role}</span> : null}
                {employeeSnapshot?.department ? <span>{employeeSnapshot.department}</span> : null}
                {employeeSnapshot?.email ? <span>{employeeSnapshot.email}</span> : null}
                {payslip.niNumber ? (
                  <span style={{ color: "var(--text-1)" }}>NI {payslip.niNumber}</span>
                ) : null}
                {payslip.taxCode ? (
                  <span style={{ color: "var(--text-1)" }}>Tax code {payslip.taxCode}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Pay context */}
          <div
            className="app-section-card"
            style={{
              padding: "14px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            <InfoCell label="Period" value={formatPeriodLabel(payslip)} />
            <InfoCell label="Period start" value={formatDate(payslip.periodStart)} />
            <InfoCell label="Period end" value={formatDate(payslip.periodEnd)} />
            <InfoCell label="Payment date" value={formatDate(payslip.paidDate)} />
            <InfoCell
              label="Hourly rate"
              value={payslip.hourlyRate ? formatCurrency(payslip.hourlyRate) : "—"}
            />
            <InfoCell
              label="Contracted hours"
              value={
                payslip.contractedHours
                  ? `${Number(payslip.contractedHours).toFixed(2)} hrs`
                  : "—"
              }
            />
          </div>

          {/* Earnings */}
          <div style={{ display: "grid", gap: "8px" }}>
            <span style={sectionTitleStyle}>Earnings</span>
            <RowsTable
              rows={payslip.earnings}
              fallbackLabel="No itemised earnings recorded — gross pay shown below."
              totalLabel="Total earnings"
              totalValue={grossDisplay}
              accentColor="var(--success, #2e7d32)"
            />
          </div>

          {/* Deductions */}
          <div style={{ display: "grid", gap: "8px" }}>
            <span style={sectionTitleStyle}>Deductions</span>
            <RowsTable
              rows={
                Array.isArray(payslip.deductions) && payslip.deductions.length > 0
                  ? payslip.deductions
                  : [
                      payslip.taxPaid ? { label: "PAYE Tax", amount: payslip.taxPaid } : null,
                      payslip.niPaid ? { label: "National Insurance", amount: payslip.niPaid } : null,
                      payslip.pensionEmployee
                        ? { label: "Pension (Employee)", amount: payslip.pensionEmployee }
                        : null,
                      payslip.otherDeductions
                        ? { label: "Other deductions", amount: payslip.otherDeductions }
                        : null,
                    ].filter(Boolean)
              }
              fallbackLabel="No deductions recorded."
              totalLabel="Total deductions"
              totalValue={totalDeductionsDisplay}
              accentColor="var(--danger, #c62828)"
            />
          </div>

          {/* Totals strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            <div className="app-section-card" style={{ padding: "14px", gap: "4px" }}>
              <span style={labelStyle}>Gross pay</span>
              <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--success, #2e7d32)" }}>
                {formatCurrency(payslip.grossPay)}
              </span>
            </div>
            <div className="app-section-card" style={{ padding: "14px", gap: "4px" }}>
              <span style={labelStyle}>Taxable pay</span>
              <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-1)" }}>
                {formatCurrency(payslip.taxablePay ?? payslip.grossPay)}
              </span>
            </div>
            <div className="app-section-card" style={{ padding: "14px", gap: "4px" }}>
              <span style={labelStyle}>Net pay</span>
              <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--accentText, var(--accent))" }}>
                {formatCurrency(payslip.netPay)}
              </span>
            </div>
            <div className="app-section-card" style={{ padding: "14px", gap: "4px" }}>
              <span style={labelStyle}>Employer pension</span>
              <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-1)" }}>
                {formatCurrency(payslip.pensionEmployer)}
              </span>
            </div>
          </div>

          {/* YTD totals */}
          <div className="app-section-card" style={{ padding: "14px", gap: "10px" }}>
            <span style={sectionTitleStyle}>Year to date</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
              }}
            >
              <InfoCell label="YTD Gross" value={payslip.ytdGross !== null && payslip.ytdGross !== undefined ? formatCurrency(payslip.ytdGross) : "—"} />
              <InfoCell label="YTD Net" value={payslip.ytdNet !== null && payslip.ytdNet !== undefined ? formatCurrency(payslip.ytdNet) : "—"} />
              <InfoCell label="YTD Tax" value={payslip.ytdTax !== null && payslip.ytdTax !== undefined ? formatCurrency(payslip.ytdTax) : "—"} />
              <InfoCell label="YTD NI" value={payslip.ytdNi !== null && payslip.ytdNi !== undefined ? formatCurrency(payslip.ytdNi) : "—"} />
              <InfoCell label="YTD Pension" value={payslip.ytdPension !== null && payslip.ytdPension !== undefined ? formatCurrency(payslip.ytdPension) : "—"} />
            </div>
          </div>

          {/* Notes */}
          {payslip.notes ? (
            <div className="app-section-card" style={{ padding: "14px", gap: "8px" }}>
              <span style={sectionTitleStyle}>Notes</span>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-1)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {payslip.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </PopupModal>
  );
}
