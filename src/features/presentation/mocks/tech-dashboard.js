import TechDashboardUi from "@/components/page-ui/tech/tech-dashboard-ui";
import { MockPage } from "./_helpers";

// section1=loading, section2=access denied, section3=skeleton, section4=main
export default function TechDashboardMock() {
  return <MockPage Ui={TechDashboardUi} overrides={{ view: "section4" }} />;
}
