// file location: src/components/Workshop/WorkshopTabsBar.js
import { useRouter } from "next/router";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";

export const workshopTabs = [
  { href: "/workshop", label: "Dashboard" },
  { href: "/job-cards/waiting/nextjobs", label: "Next Jobs" },
  { href: "/job-cards/view", label: "Job Cards" },
  { href: "/workshop/consumables-tracker", label: "Consumables" },
  { href: "/clocking", label: "Clocking" },
];

export const workshopQuickActions = [
  { href: "/job-cards/create", label: "Create Job Card" },
  { href: "/job-cards/appointments", label: "Appointments" },
  { href: "/appointments", label: "Check In" },
];

export default function WorkshopTabsBar() {
  const router = useRouter();

  const isActive = (href) =>
    router.pathname === href ||
    router.pathname.startsWith(`${href}/`);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-5)",
        border: "none",
        boxShadow: "none",
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
            items={workshopTabs}
            ariaLabel="Workshop navigation"
            isActive={(tab) => isActive(tab.href)}
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
            items={workshopQuickActions}
            ariaLabel="Workshop quick actions"
            isActive={(tab) => isActive(tab.href)}
          />
        </div>
      </div>
    </div>
  );
}
