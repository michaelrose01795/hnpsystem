// file location: src/lib/database/payslips.js
// Supabase access for the payslips table. All payslip queries live here so the
// API routes never touch supabase directly. Read access from /profile is only
// allowed once the personal-passcode unlock cookie has been validated by the
// caller; admin endpoints rely on role guards instead.

import { supabase, supabaseService } from "@/lib/database/supabaseClient";

const TABLE = "payslips";

const COLUMNS = `
  payslip_id,
  user_id,
  paid_date,
  period_start,
  period_end,
  pay_period_label,
  status,
  gross_pay,
  net_pay,
  taxable_pay,
  tax_paid,
  ni_paid,
  pension_employee,
  pension_employer,
  other_deductions,
  hourly_rate,
  contracted_hours,
  tax_code,
  ni_number,
  ytd_gross,
  ytd_net,
  ytd_tax,
  ytd_ni,
  ytd_pension,
  earnings,
  deductions,
  employee_snapshot,
  employer_snapshot,
  notes,
  reference,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

function getDb() {
  return supabaseService || supabase;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value, fallback = 0) {
  const parsed = toNumberOrNull(value);
  return parsed === null ? fallback : parsed;
}

function toJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapPayslipRow(row) {
  if (!row) return null;
  return {
    id: row.payslip_id,
    userId: row.user_id,
    paidDate: row.paid_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    payPeriodLabel: row.pay_period_label || "",
    status: row.status || "paid",
    grossPay: toNumber(row.gross_pay),
    netPay: toNumber(row.net_pay),
    taxablePay: toNumberOrNull(row.taxable_pay),
    taxPaid: toNumber(row.tax_paid),
    niPaid: toNumber(row.ni_paid),
    pensionEmployee: toNumber(row.pension_employee),
    pensionEmployer: toNumber(row.pension_employer),
    otherDeductions: toNumber(row.other_deductions),
    hourlyRate: toNumberOrNull(row.hourly_rate),
    contractedHours: toNumberOrNull(row.contracted_hours),
    taxCode: row.tax_code || "",
    niNumber: row.ni_number || "",
    ytdGross: toNumberOrNull(row.ytd_gross),
    ytdNet: toNumberOrNull(row.ytd_net),
    ytdTax: toNumberOrNull(row.ytd_tax),
    ytdNi: toNumberOrNull(row.ytd_ni),
    ytdPension: toNumberOrNull(row.ytd_pension),
    earnings: toJsonArray(row.earnings),
    deductions: toJsonArray(row.deductions),
    employeeSnapshot: row.employee_snapshot || null,
    employerSnapshot: row.employer_snapshot || null,
    notes: row.notes || "",
    reference: row.reference || "",
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildInsertPayload(input, actorUserId) {
  const now = new Date().toISOString();
  return {
    user_id: Number(input.userId),
    paid_date: input.paidDate,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    pay_period_label: input.payPeriodLabel || null,
    status: input.status || "paid",
    gross_pay: toNumber(input.grossPay),
    net_pay: toNumber(input.netPay),
    taxable_pay: toNumberOrNull(input.taxablePay),
    tax_paid: toNumber(input.taxPaid),
    ni_paid: toNumber(input.niPaid),
    pension_employee: toNumber(input.pensionEmployee),
    pension_employer: toNumber(input.pensionEmployer),
    other_deductions: toNumber(input.otherDeductions),
    hourly_rate: toNumberOrNull(input.hourlyRate),
    contracted_hours: toNumberOrNull(input.contractedHours),
    tax_code: input.taxCode || null,
    ni_number: input.niNumber || null,
    ytd_gross: toNumberOrNull(input.ytdGross),
    ytd_net: toNumberOrNull(input.ytdNet),
    ytd_tax: toNumberOrNull(input.ytdTax),
    ytd_ni: toNumberOrNull(input.ytdNi),
    ytd_pension: toNumberOrNull(input.ytdPension),
    earnings: toJsonArray(input.earnings),
    deductions: toJsonArray(input.deductions),
    employee_snapshot: input.employeeSnapshot || null,
    employer_snapshot: input.employerSnapshot || null,
    notes: input.notes || null,
    reference: input.reference || null,
    created_by: actorUserId ?? null,
    updated_by: actorUserId ?? null,
    created_at: now,
    updated_at: now,
  };
}

function buildUpdatePayload(input, actorUserId) {
  const payload = { updated_by: actorUserId ?? null, updated_at: new Date().toISOString() };
  const map = {
    paidDate: "paid_date",
    periodStart: "period_start",
    periodEnd: "period_end",
    payPeriodLabel: "pay_period_label",
    status: "status",
    grossPay: "gross_pay",
    netPay: "net_pay",
    taxablePay: "taxable_pay",
    taxPaid: "tax_paid",
    niPaid: "ni_paid",
    pensionEmployee: "pension_employee",
    pensionEmployer: "pension_employer",
    otherDeductions: "other_deductions",
    hourlyRate: "hourly_rate",
    contractedHours: "contracted_hours",
    taxCode: "tax_code",
    niNumber: "ni_number",
    ytdGross: "ytd_gross",
    ytdNet: "ytd_net",
    ytdTax: "ytd_tax",
    ytdNi: "ytd_ni",
    ytdPension: "ytd_pension",
    earnings: "earnings",
    deductions: "deductions",
    employeeSnapshot: "employee_snapshot",
    employerSnapshot: "employer_snapshot",
    notes: "notes",
    reference: "reference",
    userId: "user_id",
  };
  Object.entries(map).forEach(([camel, snake]) => {
    if (!(camel in input)) return;
    let value = input[camel];
    if (["grossPay", "netPay", "taxPaid", "niPaid", "pensionEmployee", "pensionEmployer", "otherDeductions"].includes(camel)) {
      value = toNumber(value);
    } else if (["taxablePay", "hourlyRate", "contractedHours", "ytdGross", "ytdNet", "ytdTax", "ytdNi", "ytdPension"].includes(camel)) {
      value = toNumberOrNull(value);
    } else if (camel === "earnings" || camel === "deductions") {
      value = toJsonArray(value);
    } else if (typeof value === "string") {
      value = value || null;
    }
    payload[snake] = value;
  });
  return payload;
}

export async function listPayslipsForUser(userId, { limit = 200 } = {}) {
  const { data, error } = await getDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", Number(userId))
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapPayslipRow);
}

export async function listPayslipsAdmin({
  search = "",
  userId = null,
  department = "",
  status = "",
  paidFrom = null,
  paidTo = null,
  periodFrom = null,
  periodTo = null,
  limit = 500,
} = {}) {
  const db = getDb();
  let query = db
    .from(TABLE)
    .select(`${COLUMNS}, user:users!payslips_user_id_fkey(user_id, first_name, last_name, email, department, role, name)`)
    .order("paid_date", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", Number(userId));
  if (status) query = query.eq("status", status);
  if (paidFrom) query = query.gte("paid_date", paidFrom);
  if (paidTo) query = query.lte("paid_date", paidTo);
  if (periodFrom) query = query.gte("period_start", periodFrom);
  if (periodTo) query = query.lte("period_end", periodTo);
  if (search) query = query.or(`reference.ilike.%${search}%,pay_period_label.ilike.%${search}%,notes.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || [])
    .filter((row) => {
      if (!department) return true;
      const dept = row.user?.department || "";
      return dept.toLowerCase() === department.toLowerCase();
    })
    .map((row) => {
      const mapped = mapPayslipRow(row);
      const u = row.user || {};
      const fullName = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || `User ${u.user_id || mapped.userId}`;
      mapped.user = {
        id: u.user_id ?? mapped.userId,
        name: fullName,
        email: u.email || "",
        department: u.department || "",
        role: u.role || "",
      };
      return mapped;
    });
  return rows;
}

export async function getPayslipById(payslipId) {
  const { data, error } = await getDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq("payslip_id", payslipId)
    .maybeSingle();
  if (error) throw error;
  return mapPayslipRow(data);
}

export async function createPayslip(input, actorUserId) {
  if (!input?.userId) {
    const error = new Error("userId is required to create a payslip.");
    error.statusCode = 400;
    throw error;
  }
  if (!input?.paidDate) {
    const error = new Error("paidDate is required to create a payslip.");
    error.statusCode = 400;
    throw error;
  }
  const payload = buildInsertPayload(input, actorUserId);
  const { data, error } = await getDb()
    .from(TABLE)
    .insert(payload)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapPayslipRow(data);
}

export async function updatePayslip(payslipId, input, actorUserId) {
  const payload = buildUpdatePayload(input, actorUserId);
  const { data, error } = await getDb()
    .from(TABLE)
    .update(payload)
    .eq("payslip_id", payslipId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapPayslipRow(data);
}

export async function deletePayslip(payslipId) {
  const { error } = await getDb().from(TABLE).delete().eq("payslip_id", payslipId);
  if (error) throw error;
  return { id: payslipId };
}

