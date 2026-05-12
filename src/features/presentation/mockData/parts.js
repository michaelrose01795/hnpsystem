const rawRows = [
  { id: "demo-part-001", job_number: "DEMO-1042", part_number: "1K0-407-366-C", description: "Front lower suspension arm (LH)", quantity: 1, status: "Ordered", supplier: "VAG Parts", cost: 82.40 },
  { id: "demo-part-002", job_number: "DEMO-1042", part_number: "1K0-411-315-R", description: "Anti-roll bar drop link", quantity: 2, status: "In Stock", supplier: "Euro Car Parts", cost: 14.20 },
  { id: "demo-part-003", job_number: "DEMO-1043", part_number: "DS7T-9F472-AA", description: "Crankshaft position sensor", quantity: 1, status: "Goods In", supplier: "Ford Direct", cost: 48.75 },
  { id: "demo-part-004", job_number: "DEMO-1044", part_number: "11-42-7-953-129", description: "BMW oil filter", quantity: 1, status: "Fitted", supplier: "BMW Parts", cost: 11.90 },
  { id: "demo-part-005", job_number: "DEMO-1046", part_number: "A0008307202", description: "AC compressor (C-Class)", quantity: 1, status: "Quoted", supplier: "Mercedes Parts", cost: 612.00 },
  { id: "demo-part-006", job_number: "DEMO-1047", part_number: "G9510-42040", description: "Hybrid battery cell module", quantity: 1, status: "Ordered", supplier: "Toyota Direct", cost: 384.00 },
  { id: "demo-part-007", job_number: "DEMO-1048", part_number: "13568-31230", description: "Cambelt kit", quantity: 1, status: "Fitted", supplier: "Nissan Direct", cost: 142.00 },
  { id: "demo-part-008", job_number: "DEMO-1049", part_number: "76830-SVA-A01", description: "Rear washer pump", quantity: 1, status: "Fitted", supplier: "Honda Direct", cost: 19.50 },
  { id: "demo-part-009", job_number: "DEMO-1051", part_number: "LR020626", description: "Air suspension compressor", quantity: 1, status: "Ordered", supplier: "Land Rover Direct", cost: 482.00 },
  { id: "demo-part-010", job_number: "DEMO-1052", part_number: "TY155-65R14", description: "Tyre 155/65 R14 (front NS)", quantity: 1, status: "Quoted", supplier: "Tyre Wholesale", cost: 58.00 },
];

const today = new Date().toISOString();

export const rows = rawRows.map((row, index) => ({
  request_id: `REQ-PART-${String(index + 1).padStart(3, "0")}`,
  job_id: 1042 + index,
  part_id: row.id,
  pre_pick_location: index % 2 === 0 ? "Workshop rack A" : "",
  fulfilled_by: index % 3 === 0 ? 1 : null,
  source_request_id: `REQ-PART-${String(index + 1).padStart(3, "0")}`,
  created_at: today,
  updated_at: today,
  quantity_ordered: row.quantity,
  quantity_received: index % 4 === 0 ? 0 : row.quantity,
  ...row,
}));
