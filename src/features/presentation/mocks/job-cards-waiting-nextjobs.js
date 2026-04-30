import JobCardsWaitingNextJobsUi from "@/components/page-ui/job-cards/waiting/job-cards-waiting-nextjobs-ui";
import { MockPage } from "./_helpers";

// section1=loading, section2=Access Denied, section3=empty, section4=main board.
export default function JobCardsWaitingNextJobsMock() {
  return (
    <MockPage
      Ui={JobCardsWaitingNextJobsUi}
      overrides={{ view: "section4", hasAccess: true }}
    />
  );
}
