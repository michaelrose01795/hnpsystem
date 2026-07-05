// file location: src/components/Workshop/WorkshopTabsBar.js
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";
import { getPageTabs, isPageTabActive } from "@/config/workspace/manifest";

export const workshopTabs = getPageTabs("/workshop", [], {
  groupKey: "workshop-navigation",
}).items;

export const workshopQuickActions = getPageTabs("/workshop", [], {
  groupKey: "workshop-quick-actions",
}).items;

export default function WorkshopTabsBar() {
  const router = useRouter();
  const currentPath = router.asPath?.split("?")[0] || router.pathname || "";
  const tabs = getPageTabs(currentPath, [], { groupKey: "workshop-navigation" });
  const quickActions = getPageTabs(currentPath, [], { groupKey: "workshop-quick-actions" });

  if (tabs.items.length === 0 && quickActions.items.length === 0) return null;

  return (
    <LayerSurface
      padding="var(--space-5)"
      gap="0"
      style={{
        marginBottom: "var(--space-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "block",
            flex: 1,
            minWidth: "260px",
          }}
        >
          <TabLinkGroup
            items={tabs.items}
            ariaLabel={tabs.ariaLabel}
            isActive={(tab) => isPageTabActive(tab, currentPath)}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--control-gap)",
            justifyContent: "flex-end",
          }}
        >
          <TabLinkGroup
            items={quickActions.items}
            ariaLabel={quickActions.ariaLabel}
            isActive={(tab) => isPageTabActive(tab, currentPath)}
          />
        </div>
      </div>
    </LayerSurface>
  );
}
