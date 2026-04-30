import AppointmentsUi from "@/components/page-ui/appointments/appointments-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const demoAppointments = demoJobs.map((j, i) => ({
  id: `appt-${i + 1}`,
  job_number: j.job_number,
  customer_name: j.customer_name,
  reg: j.reg,
  start_time: j.booked_in,
  end_time: j.estimated_completion,
  status: i === 0 ? "Booked" : i === 1 ? "Awaiting Parts" : "Confirmed",
  technician: j.assigned_technician,
  type: "Service",
}));

export default function AppointmentsMock() {
  return (
    <MockPage
      Ui={AppointmentsUi}
      overrides={{
        view: "section1",
        appointments: demoAppointments,
        filteredAppointments: demoAppointments,
        selectedDate: "2026-04-23",
        searchTerm: "",
        statusFilter: "all",
      }}
    />
  );
}
