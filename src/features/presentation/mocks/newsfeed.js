import NewsFeedUi from "@/components/page-ui/newsfeed-ui";
import { MockPage } from "./_helpers";

const accessibleUpdates = [
  { id: "u-1", title: "Bay 3 lift booked for service tomorrow", body: "All techs to use Bay 5 for AM jobs.", author: "Workshop Manager", created_at: "2026-04-29T15:00:00.000Z", departments: ["WORKSHOP"] },
  { id: "u-2", title: "Q1 results", body: "Service department over-target by 6%. Well done all.", author: "Owner", created_at: "2026-04-25T09:30:00.000Z", departments: ["ALL"] },
];

export default function NewsfeedMock() {
  return (
    <MockPage
      Ui={NewsFeedUi}
      overrides={{
        view: "section1",
        accessibleUpdates,
        canManageUpdates: false,
        modalOpen: false,
        formState: { title: "", body: "", departments: [] },
        loading: false,
        saving: false,
        notificationError: "",
        AVAILABLE_DEPARTMENTS: ["ALL", "WORKSHOP", "PARTS", "ACCOUNTS", "HR"],
        formatTimeAgo: (d) => new Date(d).toLocaleDateString("en-GB"),
      }}
    />
  );
}
