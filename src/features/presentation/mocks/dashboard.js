import DashboardUi from "@/components/page-ui/dashboard-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage, DEMO_USER } from "./_helpers";

const mockJobs = demoJobs.map((j) => ({
  id: j.id,
  jobNumber: j.job_number,
  customer: j.customer_name,
  reg: j.reg,
  make: j.make,
  model: j.model,
  status: j.status,
  technician: j.assigned_technician,
}));

export default function DashboardMock() {
  return (
    <MockPage
      Ui={DashboardUi}
      overrides={{
        view: "section7",
        jobs: mockJobs,
        searchResults: [],
        searchTerm: "",
        showSearch: false,
        user: DEMO_USER,
      }}
    />
  );
}
