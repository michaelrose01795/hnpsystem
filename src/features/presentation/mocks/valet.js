import ValetDashboardUi from "@/components/page-ui/valet/valet-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const filteredJobs = demoJobs.map((j) => ({
  id: j.id,
  job_number: j.job_number,
  jobNumber: j.job_number,
  reg: j.reg,
  customer_name: j.customer_name,
  customer: j.customer_name,
  make: j.make,
  model: j.model,
  status: j.status,
  technician: j.assigned_technician,
  valet_status: "Pending",
}));

export default function ValetMock() {
  return (
    <MockPage
      Ui={ValetDashboardUi}
      overrides={{
        view: "section4",
        filteredJobs,
        valetState: {},
        savingMap: {},
        searchTerm: "",
        selectedDay: "2026-04-23",
        etaNow: "2026-04-23T11:00:00.000Z",
        etaSignalsByJobId: {},
        VALET_TABLE_COLUMNS: [
          { key: "job_number", label: "Job" },
          { key: "reg", label: "Reg" },
          { key: "customer_name", label: "Customer" },
          { key: "valet_status", label: "Valet Status" },
        ],
        VALET_ROW_HEIGHT: 56,
      }}
    />
  );
}
