// Presentation overlays for the job-cards landing route and the legacy
// job-cards appointments route. Deck order is driven by
// docs/ui/ui-presentation.

const JOB_CARD_MANAGER_ROLES = [
  "admin", "admin manager", "owner", "service", "service manager",
  "workshop manager", "general manager", "receptionist",
];

export const jobCardsIndexSlide = {
  id: "job-cards-index",
  route: "/job-cards",
  title: "Job Cards",
  roles: JOB_CARD_MANAGER_ROLES,
  workflowIndex: 155,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The job-cards entry point",
      body: "The job-cards landing route opens straight onto the live workshop board, the central list of every vehicle on site.",
    },
  ],
};

export const jobCardsAppointmentsSlide = {
  id: "job-cards-appointments",
  route: "/job-cards/appointments",
  title: "Job Cards - Appointments",
  roles: JOB_CARD_MANAGER_ROLES,
  workflowIndex: 156,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Appointments, from the job-cards side",
      body: "The job-cards appointments route leads into the shared diary so booking and the workshop board stay joined up.",
    },
  ],
};
