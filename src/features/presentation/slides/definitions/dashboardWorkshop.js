export const dashboardWorkshopSlide = {
  id: "dashboard-workshop",
  route: "/dashboard/workshop",
  title: "Workshop Dashboard",
  roles: null,
  workflowIndex: 11,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Workshop control room",
      body: "The workshop dashboard is the daily starting point for the manager — live job board, technician availability, and the queues that need attention before the morning meeting.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Pulled from the operational record",
      body: "Every card refreshes from the same data the technicians and reception use, so nothing is older than a few seconds.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Replaces whiteboards",
      body: "The status, location and parts state of every car move from physical boards into one shared view.",
    },
  ],
};
