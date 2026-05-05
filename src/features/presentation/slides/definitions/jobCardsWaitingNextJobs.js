export const jobCardsWaitingNextJobsSlide = {
  id: "job-cards-waiting-nextjobs",
  route: "/job-cards/waiting/nextjobs",
  title: "Waiting / Next Jobs",
  roles: null,
  workflowIndex: 72,
  steps: [
    {
      kind: "main",
      position: "center",
      anchor: "[data-presentation=\"nextjobs-board\"]",
      title: "What is queued for the workshop",
      body: "Cars booked in but not yet allocated, and the next priority cards for each technician - the manager's pull-ahead view.",
    },
    {
      kind: "feature",
      position: "top-left",
      anchor: "[data-presentation=\"nextjobs-outstanding\"]",
      title: "Unallocated arrivals",
      body: "Checked-in vehicles sit in a searchable outstanding queue until the workshop manager assigns them to the right technician.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      anchor: "[data-presentation=\"nextjobs-technicians\"]",
      title: "Technician workload",
      body: "Each technician panel shows the work already allocated, making gaps and overloaded bays easier to spot while planning the next job.",
    },
  ],
};
