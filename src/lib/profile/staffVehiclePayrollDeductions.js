import { supabaseService } from "@/lib/supabaseClient";

export const WORK_DEDUCTION_LABEL = "Work Deduction";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

export function getStaffVehicleDeductionMonthKey(value) {
  if (!value) return null;
  const text = String(value);
  const directMatch = text.match(/^(\d{4}-\d{2})/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function mapStaffVehiclePayrollDeduction(row = {}) {
  return {
    id: row.deduction_id,
    historyId: row.history_id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    monthKey: row.month_key || null,
    label: row.label || WORK_DEDUCTION_LABEL,
    amount: roundMoney(row.amount ?? 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function getStaffVehiclePayrollDeductionsForUser(userId, db = supabaseService) {
  if (!db || !userId) return [];

  const { data, error } = await db
    .from("staff_vehicle_payroll_deductions")
    .select("deduction_id, history_id, vehicle_id, user_id, month_key, label, amount, created_at, updated_at")
    .eq("user_id", userId)
    .order("month_key", { ascending: false })
    .order("deduction_id", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapStaffVehiclePayrollDeduction);
}

export async function syncStaffVehiclePayrollDeduction(
  {
    historyId,
    vehicleId,
    userId,
    recordedAt,
    cost,
    deductFromPayroll,
    label = WORK_DEDUCTION_LABEL,
  },
  db = supabaseService
) {
  if (!db || !historyId) return null;

  const shouldPersist = Boolean(deductFromPayroll) && roundMoney(cost) > 0 && userId && vehicleId;
  if (!shouldPersist) {
    const { error } = await db
      .from("staff_vehicle_payroll_deductions")
      .delete()
      .eq("history_id", historyId);

    if (error) throw error;
    return null;
  }

  const monthKey = getStaffVehicleDeductionMonthKey(recordedAt);
  if (!monthKey) {
    throw new Error("Unable to determine deduction month for vehicle history entry.");
  }

  const { data, error } = await db
    .from("staff_vehicle_payroll_deductions")
    .upsert(
      {
        history_id: historyId,
        vehicle_id: vehicleId,
        user_id: Number(userId),
        month_key: monthKey,
        label: String(label || WORK_DEDUCTION_LABEL).trim() || WORK_DEDUCTION_LABEL,
        amount: roundMoney(cost),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "history_id" }
    )
    .select("deduction_id, history_id, vehicle_id, user_id, month_key, label, amount, created_at, updated_at")
    .maybeSingle();

  if (error) throw error;
  return data ? mapStaffVehiclePayrollDeduction(data) : null;
}
