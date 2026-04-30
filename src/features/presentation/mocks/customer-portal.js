import CustomerPortalIndexUi from "@/components/page-ui/customer/customer-ui";
import { MockPage } from "./_helpers";

export default function CustomerPortalMock() {
  return <MockPage Ui={CustomerPortalIndexUi} overrides={{ view: "section1" }} />;
}
