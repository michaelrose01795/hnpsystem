import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";

const BASE_PARTS_TABS = [
  { label: "Goods In", href: "/parts/goods-in", match: (path) => path.startsWith("/parts/goods-in") },
  { label: "Deliveries", href: "/parts/deliveries", match: (path) => path.startsWith("/parts/deliveries") },
  {
    label: "Delivery/Collection Planner",
    href: "/parts/delivery-planner",
    match: (path) => path.startsWith("/parts/delivery-planner"),
  },
];

const MANAGER_TAB = {
  label: "Manager",
  href: "/parts/manager",
  match: (path) => path.startsWith("/parts/manager"),
};

export default function PartsWorkspaceTabs() {
  const router = useRouter();
  const { user } = useUser() || {};
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const items = roles.includes("parts manager") ? [...BASE_PARTS_TABS, MANAGER_TAB] : BASE_PARTS_TABS;
  const currentPath = router.asPath?.split("?")[0] || router.pathname || "";

  return (
    <TabLinkGroup
      ariaLabel="Parts workspace pages"
      className="tab-api--inline"
      items={items}
      isActive={(item) => item.match?.(currentPath)}
    />
  );
}
