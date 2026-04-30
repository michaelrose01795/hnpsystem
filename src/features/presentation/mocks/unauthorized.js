import UnauthorizedPageUi from "@/components/page-ui/unauthorized-ui";
import Link from "next/link";
import { MockPage } from "./_helpers";

export default function UnauthorizedMock() {
  return <MockPage Ui={UnauthorizedPageUi} overrides={{ view: "section1", Link }} />;
}
