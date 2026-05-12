const rawRows = [
  { id: "demo-user-001", username: "demo.manager", display_name: "Demo Manager", email: "demo.manager@hnp.example", roles: ["manager"], department: "Service", active: true, created_at: "2024-01-15T09:00:00.000Z" },
  { id: "demo-user-002", username: "demo.tech", display_name: "Demo Tech", email: "demo.tech@hnp.example", roles: ["techs"], department: "Workshop", active: true, created_at: "2024-02-01T09:00:00.000Z" },
  { id: "demo-user-003", username: "demo.parts", display_name: "Demo Parts", email: "demo.parts@hnp.example", roles: ["parts"], department: "Parts", active: true, created_at: "2024-03-12T09:00:00.000Z" },
  { id: "demo-user-004", username: "demo.recep", display_name: "Demo Reception", email: "demo.recep@hnp.example", roles: ["receptionist"], department: "Front of House", active: true, created_at: "2024-04-08T09:00:00.000Z" },
  { id: "demo-user-005", username: "demo.accounts", display_name: "Demo Accounts", email: "demo.accounts@hnp.example", roles: ["accounts manager"], department: "Accounts", active: true, created_at: "2024-05-22T09:00:00.000Z" },
  { id: "demo-user-006", username: "demo.mot", display_name: "Demo MOT", email: "demo.mot@hnp.example", roles: ["mot tester"], department: "MOT", active: true, created_at: "2024-06-04T09:00:00.000Z" },
  { id: "demo-user-007", username: "demo.painter", display_name: "Demo Painter", email: "demo.painter@hnp.example", roles: ["painters"], department: "Body Shop", active: true, created_at: "2024-07-19T09:00:00.000Z" },
  { id: "demo-user-008", username: "demo.valet", display_name: "Demo Valet", email: "demo.valet@hnp.example", roles: ["valet service"], department: "Valeting", active: true, created_at: "2024-08-26T09:00:00.000Z" },
  { id: "demo-user-009", username: "demo.mobile", display_name: "Demo Mobile", email: "demo.mobile@hnp.example", roles: ["mobile technician", "techs"], department: "Mobile", active: true, created_at: "2024-09-11T09:00:00.000Z" },
  { id: "demo-user-010", username: "demo.owner", display_name: "Demo Owner", email: "demo.owner@hnp.example", roles: ["owner"], department: "Management", active: true, created_at: "2023-10-02T09:00:00.000Z" },
  { id: "demo-user-011", username: "demo.hr", display_name: "Demo HR", email: "demo.hr@hnp.example", roles: ["hr manager"], department: "HR", active: true, created_at: "2024-11-08T09:00:00.000Z" },
  { id: "demo-user-012", username: "demo.admin", display_name: "Demo Admin", email: "demo.admin@hnp.example", roles: ["admin manager"], department: "Admin", active: true, created_at: "2024-12-15T09:00:00.000Z" },
];

export const rows = rawRows.map((row, index) => {
  const [firstName, ...lastParts] = row.display_name.replace(/^Demo\s+/i, "Demo ").split(" ");
  const roleLabel =
    row.roles[0] === "techs"
      ? "Techs"
      : row.roles[0] === "mot tester"
      ? "MOT Tester"
      : row.roles[0];
  return {
    user_id: index + 1,
    first_name: firstName || "Demo",
    last_name: lastParts.join(" ") || row.department,
    role: roleLabel,
    is_active: true,
    ...row,
  };
});
