export const dashboardMotSlide = {
  id: "dashboard-mot",
  route: "/dashboard/mot",
  title: "MOT Dashboard",
  roles: null,
  workflowIndex: 16,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "MOT lane at a glance",
      body: "Today's bookings, current pass/fail/abort counts, and the cars waiting for the next slot — the MOT bay doesn't need a paper diary.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Linked to the workshop",
      body: "MOT failures push back into the job card so any remedial work can be quoted and slotted without retyping.",
    },
  ],
};
