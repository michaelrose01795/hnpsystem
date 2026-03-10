// file location: src/components/HR/HrTabsBar.js
import { useRouter } from "next/router";
import { TabLinkGroup } from "@/components/tabAPI/TabGroup";

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
      style={{
        background: "var(--surface)",
        borderRadius: "18px",
        padding: "14px",
        border: "1px solid var(--accent-purple-surface)",
        boxShadow: "none",
        marginBottom: "20px",
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
