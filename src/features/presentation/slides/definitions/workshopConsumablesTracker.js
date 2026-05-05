export const workshopConsumablesTrackerSlide = {
  id: "workshop-consumables-tracker",
  route: "/workshop/consumables-tracker",
  title: "Consumables Tracker",
  roles: null,
  workflowIndex: 105,
  steps: [
    {
      kind: "main",
      position: "center",
      anchor: "[data-presentation=\"workshop-consumables-budget\"]",
      title: "Workshop consumables ledger",
      body: "Bay usage of oils, gloves and abrasives is visible against the month budget, so the workshop manager spots over-use without combing through receipts.",
    },
    {
      kind: "feature",
      position: "top-right",
      anchor: "[data-presentation=\"workshop-consumables-logs\"]",
      title: "Monthly spend at a glance",
      body: "Spend, quantity, order count and supplier totals sit above the line-by-line ledger before the manager drills into the detail.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      anchor: "[data-presentation=\"workshop-consumables-scheduled\"]",
      title: "Scheduled consumables",
      body: "The main tracker highlights what is due, overdue or not required, with search and order actions in the same operational view.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      anchor: "[data-presentation=\"workshop-consumables-requests\"]",
      title: "Technician requests",
      body: "Requests raised from the workshop are visible to the manager, so stock checks and follow-up orders do not disappear into messages.",
    },
  ],
};
