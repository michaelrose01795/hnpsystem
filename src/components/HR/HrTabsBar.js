// file location: src/components/HR/HrTabsBar.js
import Link from "next/link";
import { useRouter } from "next/router";

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
        background: "#ffffff",
        borderRadius: "18px",
        padding: "14px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 16px 30px rgba(15, 23, 42, 0.04)",
        marginBottom: "20px",
      }}
    >
      <nav
        aria-label="HR modules"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "10px",
        }}
      >
        {hrTabs.map((tab) => {
          const isActive =
            router.pathname === tab.href ||
            (tab.href !== "/admin/users" && router.pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 12px",
                backgroundColor: isActive ? "#0f172a" : "#f8fafc",
                borderRadius: "12px",
                color: isActive ? "#ffffff" : "#0f172a",
                fontWeight: 600,
                fontSize: "0.85rem",
                textDecoration: "none",
                border: isActive ? "1px solid #0f172a" : "1px solid #e5e7eb",
                boxShadow: isActive ? "0 6px 16px rgba(15, 23, 42, 0.25)" : "inset 0 -1px 0 rgba(15, 23, 42, 0.05)",
                transition: "background-color 0.2s ease, color 0.2s ease",
                textAlign: "center",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
