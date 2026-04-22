import { WORKFLOW } from "../workflow";

export const jobCardsListSlide = {
  id: "job-cards-list",
  route: "/job-cards/view",
  title: "Job Cards — Workshop Backbone",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "receptionist",
  ],
  workflowIndex: WORKFLOW.JOB_CARDS_LIST,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Every live job in one place",
      body: "This is the workshop's central ledger — every vehicle currently with us, its status, its assigned technician, and its progress. What used to live on a whiteboard is now a live, searchable, filterable table.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"job-cards-division-filter\"]",
      position: "bottom",
      title: "Retail vs Sales divisions",
      body: "Managers can instantly split the board by division — workshop retail jobs separate from sales prep and PDI work. No more asking which list to look at.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"job-cards-status-filter\"]",
      position: "bottom",
      title: "Status filters",
      body: "One click filters to 'In Progress', 'Awaiting Parts', or 'Ready for Collection' — the statuses a service advisor calls out all day.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"job-cards-search\"]",
      position: "bottom",
      title: "Unified search",
      body: "Search by reg, customer name, job number, or technician. No more asking 'which book is it in?'",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Time saved",
      body: "Reception used to spend 10+ minutes per customer walk-in looking up status across books, diary, and WhatsApp. Now it's under 5 seconds.",
    },
  ],
};
