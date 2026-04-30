import VhcIndexRedirectUi from "@/components/page-ui/vhc/vhc-ui";
import { MockPage } from "./_helpers";

export default function VhcMock() {
  return <MockPage Ui={VhcIndexRedirectUi} overrides={{ view: "section1" }} />;
}
