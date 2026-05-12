const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const rawRows = [
  { id: "demo-appt-001", job_id: 1042, job_number: "DEMO-1042", customer_id: "demo-cust-001", customer_name: "Alex Morgan", reg: "DE24 XYZ", start: `${today}T08:30:00.000Z`, end: `${today}T16:30:00.000Z`, bay: "Bay 2", type: "Service + Diagnosis" },
  { id: "demo-appt-002", job_id: 1043, job_number: "DEMO-1043", customer_id: "demo-cust-002", customer_name: "Priya Shah", reg: "TA23 ABC", start: `${today}T10:00:00.000Z`, end: `${today}T15:00:00.000Z`, bay: "Bay 3", type: "Diagnostic" },
  { id: "demo-appt-003", job_id: 1044, job_number: "DEMO-1044", customer_id: "demo-cust-003", customer_name: "Tom Reynolds", reg: "TV22 HNP", start: `${today}T07:45:00.000Z`, end: `${today}T12:00:00.000Z`, bay: "MOT Bay", type: "Service + MOT" },
  { id: "demo-appt-004", job_id: 1045, job_number: "DEMO-1045", customer_id: "demo-cust-004", customer_name: "Sarah Bennett", reg: "WS24 GLS", start: `${tomorrow}T09:00:00.000Z`, end: `${tomorrow}T11:00:00.000Z`, bay: "Bay 1", type: "Brake Service" },
  { id: "demo-appt-005", job_id: 1046, job_number: "DEMO-1046", customer_id: "demo-cust-005", customer_name: "James Holt", reg: "LB23 RTV", start: `${today}T09:15:00.000Z`, end: `${today}T17:00:00.000Z`, bay: "Bay 4", type: "AC Diagnostics" },
  { id: "demo-appt-006", job_id: 1048, job_number: "DEMO-1048", customer_id: "demo-cust-007", customer_name: "Mark Wilson", reg: "PL22 NHS", start: `${today}T08:00:00.000Z`, end: `${today}T17:00:00.000Z`, bay: "Bay 5", type: "Cambelt" },
];

export const rows = rawRows.map((row, index) => ({
  appointment_id: index + 1,
  scheduled_time: row.start,
  status: "booked",
  notes: row.type,
  created_at: row.start,
  updated_at: row.start,
  ...row,
}));
