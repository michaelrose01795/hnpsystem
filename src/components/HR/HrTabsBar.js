// file location: src/components/HR/HrTabsBar.js
import { useRouter } from "next/router";
import { TabLinkGroup } from "@/components/ui/tabAPI/TabGroup";

const hrTabs = [
  { href: "/hr/employees", label: "Employee Records" },
  { href: "/hr/attendance", label: "Attendance" },
  { href: "/hr/payroll", label: "Payroll" },
  { href: "/hr/leave", label: "Leave" },
  { href: "/hr/performance", label: "Performance" },
  { href: "/hr/training", label: "Training" },
  { href: "/hr/disciplinary", label: "Incidents" },
  { href: "/hr/recruitment", label: "Recruitment" },
  { href: "/hr/reports", label: "HR Reports" },
  { href: "/hr/settings", label: "HR Settings" },
  { href: "/admin/users", label: "User Admin" },
];

export default function HrTabsBar() {
  const router = useRouter();

  return (
    <div
      className="app-section-card"
      style={{
        padding: "var(--space-4)",
        marginBottom: "var(--space-6)",
      }}
    >
      <TabLinkGroup
        items={hrTabs}
        ariaLabel="HR modules"
        layout="grid"
        stretch
        isActive={(tab) =>
          router.pathname === tab.href ||
          (tab.href !== "/admin/users" && router.pathname.startsWith(tab.href))
        }
      />
    </div>
  );
}
