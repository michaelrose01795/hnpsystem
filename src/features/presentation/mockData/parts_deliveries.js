const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const rawRows = [
  { id: "demo-pd-001", delivery_id: "DLV-4001", supplier: "VAG Parts", driver: "Demo Driver A", status: "Out for delivery", scheduled_date: today, scheduled_time: "09:00", arrived_at: null, line_count: 4 },
  { id: "demo-pd-002", delivery_id: "DLV-4002", supplier: "Ford Direct", driver: "Demo Driver B", status: "Arrived", scheduled_date: today, scheduled_time: "10:30", arrived_at: `${today}T10:18:00.000Z`, line_count: 2 },
  { id: "demo-pd-003", delivery_id: "DLV-4003", supplier: "Euro Car Parts", driver: "Demo Driver A", status: "Booked", scheduled_date: today, scheduled_time: "14:00", arrived_at: null, line_count: 6 },
  { id: "demo-pd-004", delivery_id: "DLV-4004", supplier: "Mercedes Parts", driver: "Demo Driver C", status: "Confirmed", scheduled_date: tomorrow, scheduled_time: "09:00", arrived_at: null, line_count: 1 },
  { id: "demo-pd-005", delivery_id: "DLV-4005", supplier: "BMW Parts", driver: "Demo Driver B", status: "Arrived", scheduled_date: today, scheduled_time: "07:30", arrived_at: `${today}T07:25:00.000Z`, line_count: 3 },
  { id: "demo-pd-006", delivery_id: "DLV-4006", supplier: "Toyota Direct", driver: "Demo Driver D", status: "Booked", scheduled_date: tomorrow, scheduled_time: "11:00", arrived_at: null, line_count: 2 },
  { id: "demo-pd-007", delivery_id: "DLV-4007", supplier: "Tyre Wholesale", driver: "Demo Driver A", status: "Arrived", scheduled_date: today, scheduled_time: "14:30", arrived_at: `${today}T14:32:00.000Z`, line_count: 4 },
];

export const rows = rawRows.map((row, index) => {
  const scheduledAt = `${row.scheduled_date}T${row.scheduled_time}:00.000Z`;
  return {
    archived: false,
    is_active: true,
    deleted_at: null,
    org_id: null,
    tenant_id: null,
    delivery_date: row.scheduled_date,
    scheduled_at: scheduledAt,
    order_reference: `PO-300${(index % 8) + 1}`,
    vehicle_reg: ["DE24 XYZ", "TA23 ABC", "TV22 HNP", "LB23 RTV"][index % 4],
    customer_name: ["Alex Morgan", "Priya Shah", "Tom Reynolds", "James Holt"][index % 4],
    address: "Humphries & Parks Parts Desk",
    postcode: "EX1 1AA",
    phone: "01392 555 010",
    notes: "Presentation delivery stop",
    stops: [
      {
        id: `${row.id}-stop-1`,
        job_id: 1042 + index,
        job_number: `DEMO-${1042 + index}`,
        vehicle_reg: ["DE24 XYZ", "TA23 ABC", "TV22 HNP", "LB23 RTV"][index % 4],
        customer_name: ["Alex Morgan", "Priya Shah", "Tom Reynolds", "James Holt"][index % 4],
        status: row.status,
        stop_number: index + 1,
      },
    ],
    items: [
      { id: `${row.id}-item-1`, part_number: "HNP-BPAD-01", description: "Front brake pad set", quantity: 1, job_number: `DEMO-${1042 + index}` },
      { id: `${row.id}-item-2`, part_number: "HNP-FILT-02", description: "Service filter kit", quantity: 1, job_number: `DEMO-${1042 + index}` },
    ],
    ...row,
  };
});
