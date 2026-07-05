// file location: src/components/HR/HrTabsBar.js
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";
import { getPageTabs, isPageTabActive } from "@/config/workspace/manifest";

export default function HrTabsBar() {
  const router = useRouter();
  const currentPath = router.asPath?.split("?")[0] || router.pathname || "";
  const tabs = getPageTabs(currentPath, [], { groupKey: "hr-modules" });

  if (tabs.items.length === 0) return null;

  return (
    <LayerSurface
      as="div"
      padding="var(--space-4)"
      gap="0"
      style={{ marginBottom: "var(--space-6)" }}
    >
      <TabLinkGroup
        items={tabs.items}
        ariaLabel={tabs.ariaLabel}
        isActive={(tab) => isPageTabActive(tab, currentPath)}
      />
    </LayerSurface>
  );
}
