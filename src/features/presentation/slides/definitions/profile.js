export const profileSlide = {
  id: "profile",
  route: "/profile",
  title: "Profile - Work",
  roles: null,
  workflowIndex: 104,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Work profile self-service",
      body: "The work tab gives each staff member a single place for employment details, clocking history, leave, payslips and emergency contact information.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-tab-switcher\"]",
      position: "bottom",
      title: "Work and personal tabs",
      body: "Profile is split into work and personal areas so business records stay separate from private planning tools.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-work-kpi-card-group\"]",
      position: "bottom",
      title: "At-a-glance work totals",
      body: "The highlighted summary cards show hours, payslips, estimated pay and leave balance without needing HR to answer routine questions.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-work-summary-card-group\"]",
      position: "top",
      title: "Staff record sections",
      body: "Leave, emergency contact and related staff information are grouped into clear sections for quick checking and self-service updates.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Lower HR admin",
      body: "Staff can check their own records during the presentation, reducing manual requests for payslips, holidays and clocking history.",
    },
  ],
};

export const profilePersonalSlide = {
  id: "profile-personal",
  route: "/profile?tab=personal",
  title: "Profile - Personal",
  roles: null,
  workflowIndex: 105,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Personal planning dashboard",
      body: "The personal tab is kept separate from work data and gives the signed-in user private planning widgets for their own dashboard.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-tab-switcher\"]",
      position: "bottom",
      title: "Personal area",
      body: "This tab is only available when viewing your own profile, keeping another employee's personal dashboard out of admin previews.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-personal-dashboard-insights\"]",
      position: "bottom",
      title: "Personal insights",
      body: "The insights area summarises the user's private dashboard setup and highlights useful patterns without mixing it into HR records.",
    },
    {
      kind: "tooltip",
      anchor: "[data-dev-section-key=\"profile-personal-dashboard-widget-grid\"]",
      position: "top",
      title: "Configurable widgets",
      body: "Widgets can be arranged around the user's personal priorities while the work tab remains focused on dealership records.",
    },
  ],
};
