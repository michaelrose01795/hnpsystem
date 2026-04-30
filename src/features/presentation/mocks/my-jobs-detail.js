import MyJobsDetailUi from "@/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui";
import { MockPage } from "./_helpers";

// section1=Access Denied, sections 2-4=loading/error states, section5=main detail.
export default function MyJobsDetailMock() {
  return <MockPage Ui={MyJobsDetailUi} overrides={{ view: "section5" }} />;
}
