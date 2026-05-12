const rawRows = [
  { id: "demo-cons-001", item_name: "Engine oil (5W-30)", unit: "litre", on_hand: 48, par_level: 30, supplier: "Opie Oils", unit_cost: 4.85, estimated_quantity: 60, last_order_date: "2026-04-19", next_estimated_order_date: "2026-05-17", last_order_quantity: 60, reorder_frequency_days: 28 },
  { id: "demo-cons-002", item_name: "Brake cleaner", unit: "can", on_hand: 12, par_level: 10, supplier: "Euro Car Parts", unit_cost: 2.75, estimated_quantity: 24, last_order_date: "2026-04-15", next_estimated_order_date: "2026-05-06", last_order_quantity: 24, reorder_frequency_days: 21 },
  { id: "demo-cons-003", item_name: "Disposable gloves (L)", unit: "box", on_hand: 6, par_level: 8, supplier: "Workshop Supplies Direct", unit_cost: 8.4, estimated_quantity: 12, last_order_date: "2026-04-08", next_estimated_order_date: "2026-05-01", last_order_quantity: 12, reorder_frequency_days: 23 },
  { id: "demo-cons-004", item_name: "Coolant (long-life)", unit: "litre", on_hand: 36, par_level: 24, supplier: "TPS", unit_cost: 3.95, estimated_quantity: 48, last_order_date: "2026-04-12", next_estimated_order_date: "2026-05-24", last_order_quantity: 48, reorder_frequency_days: 42 },
  { id: "demo-cons-005", item_name: "AdBlue", unit: "litre", on_hand: 80, par_level: 60, supplier: "Fueltek", unit_cost: 0.72, estimated_quantity: 100, last_order_date: "2026-04-22", next_estimated_order_date: "2026-05-20", last_order_quantity: 100, reorder_frequency_days: 28 },
  { id: "demo-cons-006", item_name: "Bay roll", unit: "roll", on_hand: 4, par_level: 6, supplier: "Bunzl", unit_cost: 12.5, estimated_quantity: 8, last_order_date: "2026-04-04", next_estimated_order_date: "2026-05-02", last_order_quantity: 8, reorder_frequency_days: 28 },
  { id: "demo-cons-007", item_name: "Cable ties (assorted)", unit: "pack", on_hand: 18, par_level: 12, supplier: "RS Components", unit_cost: 5.2, estimated_quantity: 20, last_order_date: "2026-04-09", next_estimated_order_date: "2026-06-08", last_order_quantity: 20, reorder_frequency_days: 60 },
  { id: "demo-cons-008", item_name: "Windscreen washer concentrate", unit: "bottle", on_hand: 10, par_level: 12, supplier: "Accessory World", unit_cost: 3.25, estimated_quantity: 18, last_order_date: "2026-04-11", next_estimated_order_date: "2026-05-09", last_order_quantity: 18, reorder_frequency_days: 28 },
];

export const rows = rawRows.map((row) => {
  const total = Number(row.last_order_quantity || 0) * Number(row.unit_cost || 0);
  return {
    archived: false,
    is_active: true,
    deleted_at: null,
    org_id: null,
    tenant_id: null,
    name: row.item_name,
    last_restocked_at: `${row.last_order_date}T09:00:00.000Z`,
    last_order_total_value: total,
    is_required: true,
    notes: "",
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-22T09:00:00.000Z",
    workshop_consumable_orders: [
      {
        order_id: `${row.id}-order-001`,
        consumable_id: row.id,
        order_date: row.last_order_date,
        quantity: row.last_order_quantity,
        unit_cost: row.unit_cost,
        total_value: total,
        supplier: row.supplier,
        consumable: { item_name: row.item_name },
      },
      {
        order_id: `${row.id}-order-002`,
        consumable_id: row.id,
        order_date: "2026-03-18",
        quantity: Math.max(1, Math.round(Number(row.last_order_quantity || 1) * 0.85)),
        unit_cost: row.unit_cost,
        total_value: Math.max(1, Math.round(Number(row.last_order_quantity || 1) * 0.85)) * Number(row.unit_cost || 0),
        supplier: row.supplier,
        consumable: { item_name: row.item_name },
      },
    ],
    ...row,
  };
});

export const orderRows = rows.flatMap((row) => row.workshop_consumable_orders || []);

export const requestRows = [
  { id: "demo-req-001", item_name: "Disposable gloves (L)", quantity: 4, requested_by: 1, requested_by_name: "Demo Technician", requested_at: "2026-04-22T10:30:00.000Z", status: "pending", updated_at: "2026-04-22T10:30:00.000Z" },
  { id: "demo-req-002", item_name: "Brake cleaner", quantity: 12, requested_by: 2, requested_by_name: "Demo Workshop", requested_at: "2026-04-21T15:45:00.000Z", status: "urgent", updated_at: "2026-04-21T15:45:00.000Z" },
  { id: "demo-req-003", item_name: "Bay roll", quantity: 6, requested_by: 3, requested_by_name: "Demo Valet", requested_at: "2026-04-20T09:20:00.000Z", status: "ordered", updated_at: "2026-04-21T11:00:00.000Z" },
];

export const budgetRows = [
  { budget_id: 1, year: 2026, month: 5, monthly_budget: 1200, updated_by: 1, updated_at: "2026-05-01T09:00:00.000Z" },
  { budget_id: 2, year: 2026, month: 4, monthly_budget: 1100, updated_by: 1, updated_at: "2026-04-01T09:00:00.000Z" },
];
