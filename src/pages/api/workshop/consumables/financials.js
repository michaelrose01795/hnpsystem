// file location: src/pages/api/workshop/consumables/financials.js
import { supabase } from "@/lib/supabaseClient";

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const getMonthBounds = (year, month) => {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const baseYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const baseMonth =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : new Date().getMonth() + 1;

  const startDate = new Date(baseYear, baseMonth - 1, 1);
  const endDate = new Date(baseYear, baseMonth, 1);
  return {
    year: startDate.getFullYear(),
    month: startDate.getMonth() + 1,
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  };
};

const calculateFinancialSummary = async (year, month) => {
  const { start, end } = getMonthBounds(year, month);

  const { data: orders, error: orderError } = await supabase
    .from("workshop_consumable_orders")
    .select("quantity, unit_cost, total_cost")
    .gte("order_date", start)
    .lt("order_date", end);

  if (orderError) {
    throw orderError;
  }

  const monthSpend = (orders || []).reduce((acc, order) => {
    const totalValue =
      toNumber(order.total_cost) ||
      toNumber(order.quantity) * toNumber(order.unit_cost);
    return acc + totalValue;
  }, 0);

  const { data: consumables, error: consumableError } = await supabase
    .from("workshop_consumables")
    .select("estimated_quantity, unit_cost");

  if (consumableError) {
    throw consumableError;
  }

  const projectedSpend = (consumables || []).reduce((acc, consumable) => {
    const estimatedQty = toNumber(consumable.estimated_quantity);
    const unitCost = toNumber(consumable.unit_cost);
    return acc + estimatedQty * unitCost;
  }, 0);

  const { data: budgetRow, error: budgetError } = await supabase
    .from("workshop_consumable_budgets")
    .select("monthly_budget, updated_at")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (budgetError) {
    throw budgetError;
  }

  return {
    monthSpend,
    projectedSpend,
    monthlyBudget: toNumber(budgetRow?.monthly_budget),
    budgetUpdatedAt: budgetRow?.updated_at ?? null,
  };
};

export default async function handler(req, res) {
  try {
    const { year: rawYear, month: rawMonth } =
      req.method === "GET" ? req.query : req.body;

    const bounds = getMonthBounds(rawYear, rawMonth);

    if (req.method === "GET") {
      const summary = await calculateFinancialSummary(bounds.year, bounds.month);
      return res.status(200).json({ success: true, data: summary });
    }

    if (req.method === "POST") {
      const { budget, updatedBy } = req.body || {};
      const numericBudget = Math.max(0, Number(budget) || 0);

      const { error: budgetError } = await supabase
        .from("workshop_consumable_budgets")
        .upsert(
          {
            year: bounds.year,
            month: bounds.month,
            monthly_budget: numericBudget,
            updated_by: updatedBy || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ["year", "month"] }
        );

      if (budgetError) {
        throw budgetError;
      }

      const summary = await calculateFinancialSummary(bounds.year, bounds.month);
      return res.status(200).json({ success: true, data: summary });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed." });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/financials error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}
