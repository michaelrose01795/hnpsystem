// file location: src/pages/api/workshop/consumables/logs.js
import { supabase } from "@/lib/supabaseClient";

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

const formatRow = (row) => ({
  id: row.order_id,
  date: row.order_date,
  quantity: row.quantity,
  unitCost: row.unit_cost,
  totalValue: row.total_value,
  supplier: row.supplier,
  itemName: row.consumable?.item_name || null,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const { year, month } = getMonthBounds(req.query.year, req.query.month);
    const { data, error } = await supabase
      .from("workshop_consumable_orders")
      .select(
        `
        order_id,
        order_date,
        quantity,
        unit_cost,
        total_value,
        supplier,
        consumable:workshop_consumables(item_name)
      `
      )
      .gte("order_date", `${year}-${String(month).padStart(2, "0")}-01`)
      .lt(
        "order_date",
        new Date(year, month, 1).toISOString().split("T")[0]
      )
      .order("order_date", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []).map(formatRow);
    const summary = rows.reduce(
      (acc, row) => {
        acc.spend += Number(row.totalValue) || Number(row.quantity) * Number(row.unitCost);
        acc.quantity += Number(row.quantity) || 0;
        acc.orders += 1;
        if (row.supplier) {
          acc.suppliers.add(row.supplier);
        }
        return acc;
      },
      { spend: 0, quantity: 0, orders: 0, suppliers: new Set() }
    );

    return res.status(200).json({
      success: true,
      data: {
        orders: rows,
        summary: {
          spend: summary.spend,
          quantity: summary.quantity,
          orders: summary.orders,
          suppliers: summary.suppliers.size,
        },
      },
    });
  } catch (error) {
    console.error("❌ /api/workshop/consumables/logs error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
