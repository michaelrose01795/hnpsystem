import { WORKFLOW } from "../workflow";

export const appointmentsSlide = {
  id: "appointments",
  route: "/appointments",
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
      title: "Scheduling and diary management",
      body: "All upcoming bookings for the workshop, service bay, MOT bay and valeting team are in one calendar. Each slot links directly to a job card so there is no hand-off gap between booking and work starting.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"appointments-booking-toolbar\"]",
      position: "bottom",
      title: "Book from the same diary",
      body: "Search, job number, time and booking action live together so reception can add appointments without jumping between pages.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"appointments-capacity-table\"]",
      position: "right",
      title: "Capacity view by day",
      body: "The diary shows booked hours, available technician time, finish risk and staff off in one row, making overload visible before it reaches the workshop.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"appointments-day-jobs\"]",
      position: "left",
      title: "Daily job list",
      body: "Selecting a day shows the actual jobs due in, their customer status, estimated time and check-in state.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "No more double-booking",
      body: "Conflicts are visible the moment a slot is selected. The paper diary used to hide overload until the day had already gone sideways.",
    },
  ],
};
