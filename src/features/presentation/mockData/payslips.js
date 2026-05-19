// Mock payslip history for the presentation deck.
//
// Shape matches `mapPayslipRow` in src/lib/database/payslips.js — the value
// /api/payslips and /api/payslips/admin return — so the profile Payslips card,
// the payslip list/detail popups and the /accounts/payslips page all render
// against this data unchanged.
//
// Every payslip belongs to the demo user (Supabase user_id 1), since the
// presentation deck mocks a single signed-in identity.

const DEMO_USER = {
  user_id: 1,
  first_name: "Demo",
  last_name: "Manager",
  email: "demo.manager@hnp.example",
  department: "Service",
  role: "Service Manager",
  name: "Demo Manager",
};

const EMPLOYER_SNAPSHOT = {
  name: "Humphries & Parks",
  address: "Matford Park Road, Marsh Barton, Exeter, EX2 8FD",
  email: "payroll@hnp.example",
  phone: "01392 555 010",
  registration: "GB 000 0000 00",
};

const EMPLOYEE_SNAPSHOT = {
  name: "Demo Manager",
  role: "Service Manager",
  department: "Service",
  email: "demo.manager@hnp.example",
};

// One entry per month: [paidDate, periodStart, periodEnd, label, overtimeHours].
const SCHEDULE = [
  ["2025-11-28", "2025-11-01", "2025-11-30", "November 2025", 0],
  ["2025-12-23", "2025-12-01", "2025-12-31", "December 2025", 6],
  ["2026-01-30", "2026-01-01", "2026-01-31", "January 2026", 2],
  ["2026-02-27", "2026-02-01", "2026-02-28", "February 2026", 0],
  ["2026-03-31", "2026-03-01", "2026-03-31", "March 2026", 4],
  ["2026-04-30", "2026-04-01", "2026-04-30", "April 2026", 3],
];

const BASIC_PAY = 3650;
const OVERTIME_RATE = 28.5;
const HOURLY_RATE = 22.5;
const CONTRACTED_HOURS = 40;

const round2 = (value) => Math.round(value * 100) / 100;

const ytd = { gross: 0, net: 0, tax: 0, ni: 0, pension: 0 };

// Built oldest-first so the year-to-date totals accumulate correctly.
const chronologicalRows = SCHEDULE.map(
  ([paidDate, periodStart, periodEnd, payPeriodLabel, overtimeHours], index) => {
    const overtimePay = round2(overtimeHours * OVERTIME_RATE);
    const grossPay = round2(BASIC_PAY + overtimePay);
    const taxPaid = round2(grossPay * 0.16);
    const niPaid = round2(grossPay * 0.09);
    const pensionEmployee = round2(grossPay * 0.04);
    const pensionEmployer = round2(grossPay * 0.06);
    const otherDeductions = 0;
    const netPay = round2(grossPay - taxPaid - niPaid - pensionEmployee - otherDeductions);

    // Running year-to-date totals across the months shown above.
    ytd.gross = round2(ytd.gross + grossPay);
    ytd.net = round2(ytd.net + netPay);
    ytd.tax = round2(ytd.tax + taxPaid);
    ytd.ni = round2(ytd.ni + niPaid);
    ytd.pension = round2(ytd.pension + pensionEmployee);

    const earnings = [
      { label: "Basic salary", hours: CONTRACTED_HOURS, rate: HOURLY_RATE, amount: BASIC_PAY },
    ];
    if (overtimePay > 0) {
      earnings.push({
        label: "Overtime",
        hours: overtimeHours,
        rate: OVERTIME_RATE,
        amount: overtimePay,
      });
    }

    const deductions = [
      { label: "PAYE tax", amount: taxPaid },
      { label: "National Insurance", amount: niPaid },
      { label: "Pension (employee)", amount: pensionEmployee },
    ];

    return {
      id: `demo-ps-${String(index + 1).padStart(3, "0")}`,
      userId: DEMO_USER.user_id,
      paidDate,
      periodStart,
      periodEnd,
      payPeriodLabel,
      status: "paid",
      grossPay,
      netPay,
      taxablePay: grossPay,
      taxPaid,
      niPaid,
      pensionEmployee,
      pensionEmployer,
      otherDeductions,
      hourlyRate: HOURLY_RATE,
      contractedHours: CONTRACTED_HOURS,
      taxCode: "1257L",
      niNumber: "QQ 12 34 56 C",
      ytdGross: ytd.gross,
      ytdNet: ytd.net,
      ytdTax: ytd.tax,
      ytdNi: ytd.ni,
      ytdPension: ytd.pension,
      earnings,
      deductions,
      employeeSnapshot: EMPLOYEE_SNAPSHOT,
      employerSnapshot: EMPLOYER_SNAPSHOT,
      notes: "",
      reference: `PS-2026-${String(index + 1).padStart(3, "0")}`,
      createdBy: null,
      updatedBy: null,
      createdAt: `${paidDate}T09:00:00.000Z`,
      updatedAt: `${paidDate}T09:00:00.000Z`,
      user: DEMO_USER,
    };
  }
);

// Exposed newest-first to match the real /api/payslips ordering (paid_date
// descending), so the profile card's "last 2" rows show the latest payslips.
export const rows = [...chronologicalRows].reverse();
