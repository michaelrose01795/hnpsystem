import { WORKFLOW } from "../workflow";

export const jobCardsListSlide = {
  id: "job-cards-list",
  route: "/job-cards/view",
  title: "Job Cards - Workshop Backbone",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "aftersales manager",
    "receptionist", "parts", "parts manager",
  ],
  workflowIndex: WORKFLOW.JOB_CARDS_LIST,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Every live job in one place",
      body: "This is the workshop's central ledger: every vehicle on site, its status, assigned technician and progress. What used to live on a whiteboard becomes a live operational board.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"job-cards-division-filter\"]",
      position: "bottom",
      title: "Retail and sales split",
      body: "Managers can separate retail workshop jobs from sales prep and PDI work without maintaining two lists.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"job-cards-status-filter\"]",
      position: "bottom",
      title: "Status filters",
      body: "One click filters to in progress, awaiting parts, ready for collection or booked jobs, matching the questions reception gets all day.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"job-cards-search\"]",
      position: "bottom",
      title: "Unified job search",
      body: "Search by registration, customer, job number or vehicle detail so staff do not have to know which book or tab to check.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Customer query time drops",
      body: "Reception can answer 'what is happening with my car?' from the board instead of asking the workshop, parts and service desk separately.",
    },
  ],
};
