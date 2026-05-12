const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const rawRows = [
  { id: "demo-po-001", order_number: "PO-3001", supplier: "VAG Parts", job_number: "DEMO-1042", customer_name: "Alex Morgan", vehicle_reg: "DE24 XYZ", status: "pending", total: 82.4 },
  { id: "demo-po-002", order_number: "PO-3002", supplier: "Ford Direct", job_number: "DEMO-1043", customer_name: "Priya Shah", vehicle_reg: "TA23 ABC", status: "delivered", total: 48.75 },
  { id: "demo-po-003", order_number: "PO-3003", supplier: "Euro Car Parts", job_number: "DEMO-1042", customer_name: "Alex Morgan", vehicle_reg: "DE24 XYZ", status: "received", total: 28.4 },
  { id: "demo-po-004", order_number: "PO-3004", supplier: "Mercedes Parts", job_number: "DEMO-1046", customer_name: "James Holt", vehicle_reg: "LB23 RTV", status: "pending", total: 612 },
  { id: "demo-po-005", order_number: "PO-3005", supplier: "Toyota Direct", job_number: "DEMO-1047", customer_name: "Helen Carter", vehicle_reg: "GA24 XPL", status: "pending", total: 384 },
  { id: "demo-po-006", order_number: "PO-3006", supplier: "Land Rover", job_number: "DEMO-1051", customer_name: "Owen Brooks", vehicle_reg: "BX24 LNP", status: "confirmed", total: 482 },
  { id: "demo-po-007", order_number: "PO-3007", supplier: "Tyre Wholesale", job_number: "DEMO-1052", customer_name: "Rachel Hughes", vehicle_reg: "HP24 MOT", status: "pending", total: 58 },
  { id: "demo-po-008", order_number: "PO-3008", supplier: "BMW Parts", job_number: "DEMO-1044", customer_name: "Tom Reynolds", vehicle_reg: "TV22 HNP", status: "received", total: 11.9 },
];

export const rows = rawRows.map((row, index) => {
  const createdAt = `${today}T0${(index % 4) + 8}:00:00.000Z`;
  const unitCost = Number((row.total / 2).toFixed(2));
  const unitRetail = Number((unitCost * 1.35).toFixed(2));
  return {
    archived: false,
    is_active: true,
    deleted_at: null,
    org_id: null,
    tenant_id: null,
    job_id: 1042 + index,
    supplier_name: row.supplier,
    supplier_account_id: `SUP-${index + 1}`,
    status: row.status,
    delivery_status: row.status === "delivered" || row.status === "received" ? "delivered" : "pending",
    invoice_status: row.status === "received" ? "paid" : "issued",
    delivery_type: "supplier_drop",
    delivery_eta: `${tomorrow}T09:00:00.000Z`,
    delivery_window: "09:00-12:00",
    delivery_contact: "Demo Parts",
    delivery_phone: "01392 555 010",
    delivery_address: "Humphries & Parks Parts Desk",
    delivery_notes: "Presentation delivery route",
    invoice_total: row.total,
    notes: "Presentation parts order with mock line items.",
    created_at: createdAt,
    updated_at: createdAt,
    line_count: 2,
    items: [
      {
        id: `${row.id}-item-1`,
        order_id: row.id,
        part_number: "HNP-BPAD-01",
        description: "Front brake pad set",
        quantity: 1,
        unit_cost: unitCost,
        retail_price: unitRetail,
        line_total: unitCost,
        status: "ordered",
      },
      {
        id: `${row.id}-item-2`,
        order_id: row.id,
        part_number: "HNP-FILT-02",
        description: "Service filter kit",
        quantity: 1,
        unit_cost: Number((row.total - unitCost).toFixed(2)),
        retail_price: Number(((row.total - unitCost) * 1.35).toFixed(2)),
        line_total: Number((row.total - unitCost).toFixed(2)),
        status: "ordered",
      },
    ],
    ...row,
  };
});
