import { WORKFLOW } from "../workflow";

export const accountsInvoicesSlide = {
  id: "accounts-invoices",
  route: "/accounts/invoices",
  title: "Accounts - Invoices",
  roles: ["admin", "admin manager", "owner", "accounts", "accounts manager", "general manager"],
  workflowIndex: WORKFLOW.ACCOUNTS_INVOICES,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Invoicing driven by the job",
      body: "Labour hours, parts used and VHC extras roll into the invoice. Accounts approve and export instead of re-typing from the job card.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"invoices-actions\"]",
      position: "bottom",
      title: "Management exports",
      body: "The export and accounts actions sit beside the invoice list so reporting can happen without leaving the page.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"invoices-table\"]",
      position: "top",
      title: "Invoice list tied to jobs",
      body: "Every row carries customer, job number, payment status and totals, making cash collection visible from the same workflow.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Faster cash collection",
      body: "Invoices can be raised the same day as work completes, reducing days-sales-outstanding and missed charges.",
    },
  ],
};
