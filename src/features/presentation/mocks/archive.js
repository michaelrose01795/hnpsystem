import ArchivedJobsPageUi from "@/components/page-ui/job-cards/archive/job-cards-archive-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const filteredResults = demoJobs.map((j) => ({
  job_number: j.job_number,
  jobNumber: j.job_number,
  reg: j.reg,
  customer_name: j.customer_name,
  customer: j.customer_name,
  status: "Archived",
  archived_at: j.estimated_completion,
  make: j.make,
  model: j.model,
}));

export default function ArchiveMock() {
  return (
    <MockPage
      Ui={ArchivedJobsPageUi}
      overrides={{
        view: "section1",
        availableStatuses: ["Archived", "Completed", "Cancelled"],
        filteredResults,
        query: "",
        regOnly: false,
        sortOrder: "newest",
        statusFilter: "all",
        STATUS_BADGES: {},
        defaultStatusBadge: { background: "var(--surface)", color: "var(--text-1)" },
      }}
    />
  );
}
