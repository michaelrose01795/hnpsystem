// file location: src/features/payslips/payslipUtils.js
// Formatting + filtering helpers shared between the profile card, list popup,
// detail popup, and account-manager page. Keeping these pure makes both the
// /profile and /accounts/payslips screens consistent.

export function formatCurrency(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "£0.00";
  return `£${number.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", options);
}

export function formatPeriodLabel(payslip) {
  if (!payslip) return "—";
  if (payslip.payPeriodLabel) return payslip.payPeriodLabel;
  if (payslip.periodStart && payslip.periodEnd) {
    return `${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`;
  }
  if (payslip.paidDate) {
    const date = new Date(payslip.paidDate);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
  }
  return "—";
}

export function formatStatusLabel(status) {
  if (!status) return "—";
  const lower = String(status).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const STATUS_TONE = {
  paid: { bg: "rgba(67, 160, 71, 0.14)", color: "var(--success, #2e7d32)" },
  issued: { bg: "rgba(30, 136, 229, 0.14)", color: "var(--info, #1565c0)" },
  draft: { bg: "rgba(120, 120, 120, 0.16)", color: "var(--text-secondary)" },
  void: { bg: "rgba(229, 57, 53, 0.14)", color: "var(--danger, #c62828)" },
};

export function getStatusTone(status) {
  const key = String(status || "").toLowerCase();
  return STATUS_TONE[key] || STATUS_TONE.draft;
}

export function filterPayslips(payslips, query) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return payslips;

  return payslips.filter((slip) => {
    const haystacks = [
      slip.payPeriodLabel,
      slip.reference,
      slip.notes,
      slip.status,
      slip.paidDate,
      slip.periodStart,
      slip.periodEnd,
      slip.user?.name,
      slip.user?.email,
      slip.user?.department,
      formatPeriodLabel(slip),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    if (haystacks.some((value) => value.includes(term))) return true;

    // Match against year and month names from paid_date (e.g. "april", "2026").
    if (slip.paidDate) {
      const d = new Date(slip.paidDate);
      if (!Number.isNaN(d.getTime())) {
        const monthLong = d.toLocaleDateString("en-GB", { month: "long" }).toLowerCase();
        const monthShort = d.toLocaleDateString("en-GB", { month: "short" }).toLowerCase();
        const year = String(d.getFullYear());
        if (monthLong.includes(term) || monthShort.includes(term) || year.includes(term)) {
          return true;
        }
      }
    }
    return false;
  });
}

export function buildPayslipsSummary(payslips = [], profile = null) {
  const sorted = [...payslips].sort((a, b) =>
    String(b.paidDate || "").localeCompare(String(a.paidDate || ""))
  );
  const latest = sorted[0] || null;

  const ytdFromLatest = latest
    ? {
        gross: latest.ytdGross,
        net: latest.ytdNet,
        tax: latest.ytdTax,
        ni: latest.ytdNi,
        pension: latest.ytdPension,
      }
    : null;

  const fallbackYtd = sorted.reduce(
    (acc, slip) => {
      acc.gross += Number(slip.grossPay || 0);
      acc.net += Number(slip.netPay || 0);
      acc.tax += Number(slip.taxPaid || 0);
      acc.ni += Number(slip.niPaid || 0);
      acc.pension += Number(slip.pensionEmployee || 0);
      return acc;
    },
    { gross: 0, net: 0, tax: 0, ni: 0, pension: 0 }
  );

  const ytd =
    ytdFromLatest && Object.values(ytdFromLatest).some((v) => v !== null && v !== undefined)
      ? {
          gross: ytdFromLatest.gross ?? fallbackYtd.gross,
          net: ytdFromLatest.net ?? fallbackYtd.net,
          tax: ytdFromLatest.tax ?? fallbackYtd.tax,
          ni: ytdFromLatest.ni ?? fallbackYtd.ni,
          pension: ytdFromLatest.pension ?? fallbackYtd.pension,
        }
      : fallbackYtd;

  return {
    count: sorted.length,
    latest,
    ytd,
    hourlyRate: latest?.hourlyRate ?? profile?.hourlyRate ?? null,
    contractedHours: latest?.contractedHours ?? profile?.contractedWeeklyHours ?? null,
    overtimeRate: profile?.overtimeRate ?? null,
  };
}

export function emptyPayslipDraft(userId = null) {
  return {
    userId: userId || "",
    paidDate: "",
    periodStart: "",
    periodEnd: "",
    payPeriodLabel: "",
    status: "paid",
    grossPay: 0,
    netPay: 0,
    taxablePay: "",
    taxPaid: 0,
    niPaid: 0,
    pensionEmployee: 0,
    pensionEmployer: 0,
    otherDeductions: 0,
    hourlyRate: "",
    contractedHours: "",
    taxCode: "",
    niNumber: "",
    ytdGross: "",
    ytdNet: "",
    ytdTax: "",
    ytdNi: "",
    ytdPension: "",
    earnings: [],
    deductions: [],
    notes: "",
    reference: "",
  };
}
