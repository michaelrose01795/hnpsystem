import TechConsumablesRequestUi from "@/components/page-ui/tech/tech-consumables-request-ui";
import { MockPage } from "./_helpers";

// section1 = "Technician Access Only" gate, section2 = main request form.
export default function TechConsumablesRequestMock() {
  return <MockPage Ui={TechConsumablesRequestUi} overrides={{ view: "section2" }} />;
}
