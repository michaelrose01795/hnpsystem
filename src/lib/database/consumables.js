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
        total_cost,
        supplier
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
      orderHistory: [],
    };

    if (rawName) {
      existing.name = rawName;
    }

    existing.supplier = existing.supplier || row.supplier || null;
    existing.unitCost = existing.unitCost || toNumber(row.unit_cost ?? row.unitCost);
    existing.estimatedQuantity += toNumber(row.estimated_quantity ?? row.estimatedQuantity);
    existing.reorderFrequencyDays =
      existing.reorderFrequencyDays ||
      (row.reorder_frequency_days ?? row.reorderFrequencyDays ?? null);
    existing.isRequired = existing.isRequired && row.is_required !== false;
    existing.notes = existing.notes || row.notes || null;

    const candidateNext = parseDate(row.next_estimated_order_date ?? row.nextEstimatedOrderDate);
    if (candidateNext && (!existing.nextEstimatedOrderDate || candidateNext < existing.nextEstimatedOrderDate)) {
      existing.nextEstimatedOrderDate = candidateNext;
    }

    const trackOrder = ({ date, quantity, unitCost, totalCost, supplier }) => {
      if (!date) {
        return;
      }
      const formattedDate = date.toISOString().split("T")[0];
      existing.orderHistory.push({
        itemName: existing.name,
        date: formattedDate,
        quantity,
        unitCost,
        totalCost,
        supplier,
      });

      if (!existing.latestOrder || date > existing.latestOrder.date) {
        existing.latestOrder = {
          date,
          quantity,
          totalValue: totalCost,
        };
      }
    };

    const addOrderCandidate = (order) => {
      const orderDate = parseDate(order.order_date);
      if (!orderDate) {
        return;
      }
      const quantity = toNumber(order.quantity);
      const unitCost = toNumber(order.unit_cost ?? order.unitCost);
      const totalValue =
        order.total_cost ??
        order.totalValue ??
        order.total_value ??
        toNumber(order.quantity) * unitCost;
      trackOrder({
        date: orderDate,
        quantity,
        unitCost,
        totalCost: totalValue,
        supplier: order.supplier ?? row.supplier ?? null,
      });
    };

    if (row.workshop_consumable_orders && Array.isArray(row.workshop_consumable_orders)) {
      row.workshop_consumable_orders.forEach(addOrderCandidate);
    }

    const lastOrderDate = parseDate(row.last_order_date);
    if (lastOrderDate) {
      const quantity = toNumber(row.last_order_quantity ?? row.lastOrderQuantity);
      const unitCost = toNumber(row.unit_cost ?? row.unitCost);
      const totalValue =
        row.last_order_total_value ??
        row.lastOrderTotalValue ??
        quantity * unitCost;
      trackOrder({
        date: lastOrderDate,
        quantity,
        unitCost,
        totalCost: totalValue,
        supplier: row.supplier ?? null,
      });
    }

    grouped.set(groupKey, existing);
  });

  const consumableItems = Array.from(grouped.values()).map((entry) => {
    const lastOrderDate = entry.latestOrder ? entry.latestOrder.date.toISOString().split("T")[0] : null;
    const lastOrderQuantity = entry.latestOrder ? entry.latestOrder.quantity : null;
    const lastOrderTotalValue = entry.latestOrder ? entry.latestOrder.totalValue : null;
    const orderHistory = entry.orderHistory
      .slice()
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

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
      orderHistory,
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

const addDays = (dateString, days) => {
  if (!dateString) {
    return null;
  }
  const candidate = new Date(dateString);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  candidate.setDate(candidate.getDate() + (days || 0));
  return candidate.toISOString().split("T")[0];
};

export async function addConsumableOrder(consumableId, { quantity, unitCost, supplier, orderDate }) {
  const payloadDate = orderDate || new Date().toISOString().split("T")[0];
  const numericQuantity = Number(quantity) || 0;
  const numericUnitCost = Number(unitCost) || 0;

  const { error: insertError } = await supabase.from("workshop_consumable_orders").insert({
    consumable_id: consumableId,
    order_date: payloadDate,
    quantity: numericQuantity,
    unit_cost: numericUnitCost,
    supplier: supplier || null,
  });

  if (insertError) {
    throw insertError;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("workshop_consumables")
    .select("reorder_frequency_days")
    .eq("id", consumableId)
    .single();

  if (lookupError) {
    throw lookupError;
  }

  const nextEstimatedOrderDate = addDays(
    payloadDate,
    existing?.reorder_frequency_days ?? 30
  );

  const { error: updateError } = await supabase
    .from("workshop_consumables")
    .update({
      last_order_date: payloadDate,
      last_order_quantity: numericQuantity,
      last_order_total_value: numericQuantity * numericUnitCost,
      next_estimated_order_date: nextEstimatedOrderDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consumableId);

  if (updateError) {
    throw updateError;
  }

  return { orderDate: payloadDate };
}
