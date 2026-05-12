const now = new Date().toISOString();

export const rows = [
  {
    id: "demo-news-001",
    title: "Workshop priority board updated",
    content: "Carry-over work, waiting parts, and collection commitments have been refreshed for today's handover.",
    departments: ["General", "Workshop", "Service", "Parts"],
    author: "Demo Service Manager",
    created_at: now,
  },
  {
    id: "demo-news-002",
    title: "Accounts month-end reminders",
    content: "Invoice checks, company account holds, and payslip approvals are ready for review in the demo data set.",
    departments: ["General", "Accounts", "Admin", "HR"],
    author: "Demo Accounts",
    created_at: now,
  },
  {
    id: "demo-news-003",
    title: "Sales and customer updates",
    content: "Customer-facing VHC links, bookings, and collection updates are available for the presentation walkthrough.",
    departments: ["General", "Sales", "Valeting", "Service"],
    author: "Demo Reception",
    created_at: now,
  },
];
