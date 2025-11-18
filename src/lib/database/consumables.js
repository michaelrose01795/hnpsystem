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

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const normalizeName = (value) => (value || "").trim().toLowerCase();

export async function listConsumablesForTracker() {
  const { data, error } = await supabase
    .from("workshop_consumables")
    .select(
      `
      id,
      item_name,
      supplier,
      unit_cost,
      estimated_quantity,
      last_order_date,
      next_estimated_order_date,
      last_order_quantity,
      last_order_total_value,
      reorder_frequency_days,
      is_required,
      notes,
      workshop_consumable_orders (
        order_date,
        quantity,
        unit_cost,
        total_value
      )
    `
    );

  if (error) {
    throw error;
  }

  const grouped = new Map();
  const duplicateTracker = new Map();

  (data || []).forEach((row) => {
    const rawName = (row.item_name || "").trim();
    const normalized = normalizeName(rawName || row.name);
    const groupKey = normalized || row.id;

    const candidateSet = duplicateTracker.get(normalized) ?? new Set();
    candidateSet.add(rawName || `Consumable ${row.id}`);
    duplicateTracker.set(normalized, candidateSet);

    const existing = grouped.get(groupKey) || {
      id: groupKey,
      name: rawName || `Consumable ${row.id}`,
      supplier: row.supplier || null,
      unitCost: toNumber(row.unit_cost ?? row.unitCost),
      estimatedQuantity: 0,
      nextEstimatedOrderDate: null,
      reorderFrequencyDays: row.reorder_frequency_days ?? row.reorderFrequencyDays ?? null,
      isRequired: row.is_required !== false,
      notes: row.notes ?? null,
      latestOrder: null,
    };

    existing.supplier = existing.supplier || row.supplier || null;
    existing.unitCost = existing.unitCost || toNumber(row.unit_cost ?? row.unitCost);
    existing.estimatedQuantity += toNumber(row.estimated_quantity ?? row.estimatedQuantity);
    existing.reorderFrequencyDays =
      existing.reorderFrequencyDays || row.reorder_frequency_days ?? row.reorderFrequencyDays ?? null;
    existing.isRequired = existing.isRequired && row.is_required !== false;
    existing.notes = existing.notes || row.notes || null;

    const candidateNext = parseDate(row.next_estimated_order_date ?? row.nextEstimatedOrderDate);
    if (candidateNext && (!existing.nextEstimatedOrderDate || candidateNext < existing.nextEstimatedOrderDate)) {
      existing.nextEstimatedOrderDate = candidateNext;
    }

    const addOrderCandidate = (order) => {
      const orderDate = parseDate(order.order_date);
      if (!orderDate) {
        return;
      }
      const totalValue =
        order.total_value ?? order.totalValue ?? toNumber(order.quantity) * toNumber(order.unit_cost);
      if (!existing.latestOrder || orderDate > existing.latestOrder.date) {
        existing.latestOrder = {
          date: orderDate,
          quantity: toNumber(order.quantity),
          totalValue,
        };
      }
    };

    if (row.workshop_consumable_orders && Array.isArray(row.workshop_consumable_orders)) {
      row.workshop_consumable_orders.forEach(addOrderCandidate);
    }

    const lastOrderDate = parseDate(row.last_order_date);
    if (lastOrderDate) {
      const totalValue =
        row.last_order_total_value ??
        row.lastOrderTotalValue ??
        toNumber(row.last_order_quantity) * toNumber(row.unit_cost ?? row.unitCost);
      if (!existing.latestOrder || lastOrderDate > existing.latestOrder.date) {
        existing.latestOrder = {
          date: lastOrderDate,
          quantity: toNumber(row.last_order_quantity ?? row.lastOrderQuantity),
          totalValue,
        };
      }
    }

    grouped.set(groupKey, existing);
  });

  const consumableItems = Array.from(grouped.values()).map((entry) => {
    const lastOrderDate = entry.latestOrder ? entry.latestOrder.date.toISOString().split("T")[0] : null;
    const lastOrderQuantity = entry.latestOrder ? entry.latestOrder.quantity : null;
    const lastOrderTotalValue = entry.latestOrder ? entry.latestOrder.totalValue : null;

    return {
      id: entry.id,
      name: entry.name,
      supplier: entry.supplier,
      unitCost: entry.unitCost,
      estimatedQuantity: entry.estimatedQuantity,
      lastOrderDate,
      nextEstimatedOrderDate: entry.nextEstimatedOrderDate
        ? entry.nextEstimatedOrderDate.toISOString().split("T")[0]
        : null,
      lastOrderQuantity,
      lastOrderTotalValue,
      reorderFrequencyDays: entry.reorderFrequencyDays,
      isRequired: entry.isRequired,
      notes: entry.notes,
    };
  });

  const potentialDuplicates = Array.from(duplicateTracker.entries())
    .filter(([, names]) => names.size > 1)
    .map(([normalized, names]) => ({
      normalized,
      names: Array.from(names),
    }));

  consumableItems.sort((a, b) => {
    if (!a.nextEstimatedOrderDate) return 1;
    if (!b.nextEstimatedOrderDate) return -1;
    return new Date(a.nextEstimatedOrderDate) - new Date(b.nextEstimatedOrderDate);
  });

  return {
    items: consumableItems,
    potentialDuplicates,
  };
}
