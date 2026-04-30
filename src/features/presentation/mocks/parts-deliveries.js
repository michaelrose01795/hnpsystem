import PartsDeliveriesPageUi from "@/components/page-ui/parts/parts-deliveries-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const sortedJobs = demoJobs.map((j) => ({
  id: j.id,
  job_number: j.job_number,
  reg: j.reg,
  customer_name: j.customer_name,
  make: j.make,
  model: j.model,
  delivery_status: "Pending",
  scheduled_for: j.booked_in,
}));

export default function PartsDeliveriesMock() {
  return (
    <MockPage
      Ui={PartsDeliveriesPageUi}
      overrides={{
        view: "section2",
        sortedJobs,
        completedCount: 0,
        pendingCount: sortedJobs.length,
        loading: false,
        error: "",
        selectedDate: "2026-04-23",
        viewJob: null,
        rowActionId: null,
        pageStyles: {},
        formatIsoDate: (d) => (d ? new Date(d).toLocaleDateString("en-GB") : ""),
        adjustIsoDate: (d) => d,
      }}
    />
  );
}
