import { WORKFLOW } from "../workflow";

export const appointmentsSlide = {
  id: "appointments",
  route: "/job-cards/appointments",
  title: "Appointments",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "receptionist",
  ],
  workflowIndex: WORKFLOW.APPOINTMENTS,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Scheduling & diary management",
      body: "All upcoming bookings for the workshop, service bay, MOT bay and valeting team — in one calendar. Each slot links directly to a job card so there's no hand-off gap between booking and work starting.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "No more double-booking",
      body: "Conflicts are detected the moment a slot is selected. The paper diary used to miss them 2-3 times per week.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Customer SMS reminders",
      body: "Automatic day-before reminders cut no-shows by around a third — real ROI on the subscription cost alone.",
    },
  ],
};
