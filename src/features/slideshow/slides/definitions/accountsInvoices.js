import { WORKFLOW } from "../workflow";

export const accountsInvoicesSlide = {
  id: "accounts-invoices",
  route: "/accounts/invoices",
  title: "Accounts — Invoices",
  roles: ["admin", "admin manager", "owner", "accounts", "accounts manager", "general manager"],
  workflowIndex: WORKFLOW.ACCOUNTS_INVOICES,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Invoicing driven by the job",
      body: "Labour hours, parts used, and VHC extras roll automatically into the invoice. The account manager approves — they don't re-type anything.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Faster cash collection",
      body: "Invoices raised same-day as work completes. Typical 3-5 day reduction in days-sales-outstanding.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Reporting built in",
      body: "Margin per job, per technician, per department — all available without pulling spreadsheets.",
    },
  ],
};
