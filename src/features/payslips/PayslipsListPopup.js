// file location: src/features/payslips/PayslipsListPopup.js
// Searchable list of all payslips for the signed-in user. Header shows the
// at-a-glance pay rates / contracted hours summary that used to live in the
// "Pay Rates" KPI card on the work tab, plus payslip-derived totals (latest
// gross/net/tax/NI/pension and YTD figures). Clicking a row opens the
// detailed payslip popup.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/searchBarAPI";
import {
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  formatStatusLabel,
  getStatusTone,
  filterPayslips,
} from "./payslipUtils";

function SummaryStat({ label, value, tone = "var(--text-primary)" }) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "var(--radius-md, 12px)",
        background: "var(--surface)",
        border: "1px solid rgba(var(--text-primary-rgb), 0.08)",
        display: "grid",
        gap: "4px",
      }}
    >
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "1.05rem", fontWeight: 700, color: tone }}>{value}</span>
    </div>
  );
}

export default function PayslipsListPopup({
  isOpen,
  onClose,
  payslips = [],
  loading = false,
  error = null,
  summary = null,
  onSelectPayslip,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => filterPayslips(payslips, search), [payslips, search]);

  if (!isOpen) return null;

  const latest = summary?.latest;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="All payslips"
      cardStyle={{ width: "min(100%, 960px)", padding: 0 }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", maxHeight: "calc(100dvh - 60px)" }}>
        {/* Header + summary */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(var(--text-primary-rgb), 0.08)",
            display: "grid",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "4px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                Payslips
              </span>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {payslips.length} payslip{payslips.length === 1 ? "" : "s"} on record
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
              Close
            </Button>
          </div>

          {/* Pay-rate strip — replaces the legacy Pay Rates KPI card */}
          <div
            style={{
              display: "grid",
              gap: "10px",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <SummaryStat
              label="Hourly rate"
              value={summary?.hourlyRate ? formatCurrency(summary.hourlyRate) : "—"}
              tone="var(--success, #2e7d32)"
            />
            <SummaryStat
              label="Overtime rate"
              value={summary?.overtimeRate ? formatCurrency(summary.overtimeRate) : "—"}
              tone="var(--danger, #c62828)"
            />
            <SummaryStat
              label="Contracted hours"
              value={
                summary?.contractedHours
                  ? `${Number(summary.contractedHours).toFixed(2)} hrs`
                  : "—"
              }
            />
            <SummaryStat
              label="Latest gross"
              value={latest ? formatCurrency(latest.grossPay) : "—"}
            />
            <SummaryStat
              label="Latest net"
              value={latest ? formatCurrency(latest.netPay) : "—"}
              tone="var(--accentText, var(--accent))"
            />
            <SummaryStat
              label="Latest tax"
              value={latest ? formatCurrency(latest.taxPaid) : "—"}
            />
            <SummaryStat
              label="Latest NI"
              value={latest ? formatCurrency(latest.niPaid) : "—"}
            />
            <SummaryStat
              label="Latest pension"
              value={latest ? formatCurrency(latest.pensionEmployee) : "—"}
            />
          </div>

          {/* YTD strip */}
          {summary?.ytd ? (
            <div
              style={{
                display: "grid",
                gap: "10px",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              <SummaryStat label="YTD Gross" value={formatCurrency(summary.ytd.gross)} />
              <SummaryStat label="YTD Net" value={formatCurrency(summary.ytd.net)} />
              <SummaryStat label="YTD Tax" value={formatCurrency(summary.ytd.tax)} />
              <SummaryStat label="YTD NI" value={formatCurrency(summary.ytd.ni)} />
              <SummaryStat label="YTD Pension" value={formatCurrency(summary.ytd.pension)} />
            </div>
          ) : null}

          <SearchBar
            name="payslip-search"
            placeholder="Search by paid date, period, month, year, reference"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            style={{ background: "var(--surface)" }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", padding: "12px 16px 20px" }}>
          {loading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Loading payslips…
            </div>
          ) : error ? (
            <div
              style={{
                margin: "12px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md, 12px)",
                background: "rgba(198, 40, 40, 0.08)",
                color: "var(--danger, #c62828)",
                fontSize: "0.88rem",
              }}
            >
              {error?.message || "Unable to load payslips."}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
              }}
            >
              {payslips.length === 0
                ? "No payslips have been added to your record yet."
                : "No payslips match that search."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {filtered.map((slip) => {
                const tone = getStatusTone(slip.status);
                return (
                  <button
                    key={slip.id}
                    type="button"
                    onClick={() => onSelectPayslip?.(slip)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(110px, 0.8fr) minmax(0, 1.4fr) minmax(100px, 0.8fr) minmax(80px, 0.6fr) auto",
                      gap: "10px",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md, 12px)",
                      border: "1px solid rgba(var(--text-primary-rgb), 0.08)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{formatDate(slip.paidDate)}</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {formatPeriodLabel(slip)}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--accentText, var(--accent))", textAlign: "right" }}>
                      {formatCurrency(slip.netPay)}
                    </span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem", textAlign: "right" }}>
                      {slip.reference || "—"}
                    </span>
                    <span
                      style={{
                        padding: "3px 9px",
                        borderRadius: "999px",
                        background: tone.bg,
                        color: tone.color,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        justifySelf: "end",
                      }}
                    >
                      {formatStatusLabel(slip.status)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PopupModal>
  );
}
