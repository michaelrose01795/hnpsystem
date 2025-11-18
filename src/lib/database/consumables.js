// file location: src/lib/database/consumables.js
import { getDatabaseClient } from "@/lib/database/client";

const supabase = getDatabaseClient();

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const buildConsumableRecord = (row = {}) => {
  const unitCost = toNumber(row.unit_cost ?? row.unitCost);
  const estimatedQuantity = toNumber(row.estimated_quantity ?? row.estimatedQuantity);
  const lastOrderQuantity = toNumber(row.last_order_quantity ?? row.lastOrderQuantity);
  const totalValueFromRow = row.last_order_total_value ?? row.lastOrderTotalValue;
  const hasLastOrderQuantity = lastOrderQuantity > 0;
  const lastOrderTotalValue =
    totalValueFromRow !== null && totalValueFromRow !== undefined
      ? toNumber(totalValueFromRow)
      : hasLastOrderQuantity
      ? unitCost * lastOrderQuantity
      : null;

  return {
    id: row.id,
    name: row.item_name || row.name || "Consumable",
    partNumber: row.part_number ?? row.partNumber ?? null,
    supplier: row.supplier ?? null,
    unitCost,
    estimatedQuantity,
    lastOrderDate: row.last_order_date ?? row.lastOrderDate ?? null,
    nextEstimatedOrderDate: row.next_estimated_order_date ?? row.nextEstimatedOrderDate ?? null,
    lastOrderQuantity,
    lastOrderTotalValue,
    reorderFrequencyDays: row.reorder_frequency_days ?? row.reorderFrequencyDays ?? null,
    isRequired: row.is_required !== false,
    notes: row.notes ?? null,
  };
};

export async function listConsumablesForTracker() {
  const { data, error } = await supabase
    .from("workshop_consumables")
    .select(
      `
      id,
      item_name,
      part_number,
      supplier,
      unit_cost,
      estimated_quantity,
      last_order_date,
      next_estimated_order_date,
      last_order_quantity,
      last_order_total_value,
      reorder_frequency_days,
      is_required,
      notes
    `
    )
    .order("next_estimated_order_date", { ascending: true, nulls: "last" })
    .order("item_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(buildConsumableRecord);
}
