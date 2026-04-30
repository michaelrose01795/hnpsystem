import WorkshopConsumablesTrackerUi from "@/components/page-ui/workshop/workshop-consumables-tracker-ui";
import { MockPage } from "./_helpers";

// section1 is the role-gated "Workshop Manager Access Only" screen — for the
// presentation we always want the populated tracker view (section2) and pass
// isWorkshopManager=true so any nested manager-only buttons show.
export default function WorkshopConsumablesTrackerMock() {
  return (
    <MockPage
      Ui={WorkshopConsumablesTrackerUi}
      overrides={{ view: "section2", isWorkshopManager: true }}
    />
  );
}
