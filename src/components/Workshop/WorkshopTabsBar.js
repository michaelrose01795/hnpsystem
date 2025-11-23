// file location: src/components/Workshop/WorkshopTabsBar.js
import Link from "next/link";
import { useRouter } from "next/router";

export const workshopTabs = [
  { href: "/workshop", label: "Dashboard" },
  { href: "/job-cards/waiting/nextjobs", label: "Next Jobs" },
  { href: "/job-cards/view", label: "Job Cards" },
  { href: "/vhc/dashboard", label: "VHC" },
  { href: "/workshop/consumables-tracker", label: "Consumables" },
  { href: "/clocking", label: "Clocking" },
];

export const workshopQuickActions = [
  { href: "/job-cards/create", label: "Create Job Card" },
  { href: "/job-cards/appointments", label: "Appointments" },
  { href: "/workshop/check-in", label: "Check In" },
];

export default function WorkshopTabsBar() {
  const router = useRouter();

  const isActive = (href) =>
    router.pathname === href ||
    router.pathname.startsWith(`${href}/`);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "18px",
        border: "1px solid #ffe0e0",
        boxShadow: "0 16px 30px rgba(209, 0, 0, 0.08)",
        marginBottom: "22px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <nav
          aria-label="Workshop navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            flex: 1,
            minWidth: "260px",
          }}
        >
          {workshopTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: active ? "1px solid #b10000" : "1px solid #ffe0e0",
                  backgroundColor: active ? "#b10000" : "#fff5f5",
                  color: active ? "#ffffff" : "#720000",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  boxShadow: active
                    ? "0 8px 20px rgba(177, 0, 0, 0.25)"
                    : "inset 0 -1px 0 rgba(177, 0, 0, 0.06)",
                  transition: "background-color 0.2s ease, color 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          {workshopQuickActions.map((action) => {
            const active = isActive(action.href);
            return (
              <Link
                key={action.href}
                href={action.href}
                style={{
                  minWidth: "140px",
                  textAlign: "center",
                  padding: "10px 18px",
                  borderRadius: "999px",
                  border: "1px solid #ffb3b3",
                  backgroundColor: active ? "#b10000" : "#ffffff",
                  color: active ? "#ffffff" : "#b10000",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  boxShadow: active
                    ? "0 16px 32px rgba(177, 0, 0, 0.22)"
                    : "0 10px 20px rgba(209, 0, 0, 0.12)",
                  transition: "background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
