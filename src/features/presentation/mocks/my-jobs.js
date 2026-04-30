import MyJobsPageUi from "@/components/page-ui/job-cards/myjobs/job-cards-myjobs-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const myJobs = demoJobs.map((j) => ({
  id: j.id,
  job_number: j.job_number,
  jobNumber: j.job_number,
  reg: j.reg,
  customer: j.customer_name,
  make: j.make,
  model: j.model,
  status: j.status,
  technician: j.assigned_technician,
  job_type: "Service",
  appointment_date: j.booked_in,
  parts_status: "Pending",
  tech_status: "Working",
}));

export default function MyJobsMock() {
  return (
    <MockPage
      Ui={MyJobsPageUi}
      overrides={{
        view: "section3",
        myJobs,
        filteredJobs: myJobs,
        activeJobIds: new Set(),
        filter: "all",
        searchTerm: "",
        loading: false,
        prefilledJobNumber: "",
        showStartJobModal: false,
        SKELETON_ROW_COUNT: 5,
        rowSkeletonCells: [],
        deriveJobTypeDisplay: (j) => j.job_type || "Service",
        getMakeModel: (j) => `${j.make} ${j.model}`,
        getStatusBadgeStyle: () => ({}),
        getTechStatusCategory: () => "working",
        resolveTechStatusLabel: (s) => s || "Working",
        resolveTechStatusTooltip: () => "",
        summarizePartsPipeline: () => ({ ordered: 1, delivered: 0, fitted: 0 }),
      }}
    />
  );
}
