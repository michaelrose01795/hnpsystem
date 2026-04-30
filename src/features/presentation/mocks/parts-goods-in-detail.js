import PartsGoodsInDetailUi from "@/components/page-ui/parts/goods-in/parts-goods-in-goods-in-number-ui";
import { MockPage } from "./_helpers";

// section1 = "no permission" gate, section2 = main goods-in detail.
export default function PartsGoodsInDetailMock() {
  return <MockPage Ui={PartsGoodsInDetailUi} overrides={{ view: "section2" }} />;
}
