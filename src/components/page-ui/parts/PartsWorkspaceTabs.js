import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";
import { getPageTabs, isPageTabActive } from "@/config/workspace/manifest";

export default function PartsWorkspaceTabs() {
  const router = useRouter();
  const { user } = useUser() || {};
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const currentPath = router.asPath?.split("?")[0] || router.pathname || "";
  const tabs = getPageTabs(currentPath, roles, { groupKey: "parts-workspace" });

  if (tabs.items.length === 0) return null;

  return (
    <TabLinkGroup
      ariaLabel={tabs.ariaLabel}
      className="tab-api--wrap"
      items={tabs.items}
      isActive={(tab) => isPageTabActive(tab, currentPath)}
    />
  );
}
