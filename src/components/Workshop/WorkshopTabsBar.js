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
        borderRadius: "18px",
        padding: "18px",
        border: "1px solid var(--surface-light)",
        boxShadow: "none",
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
                  border: active ? "1px solid var(--primary)" : "1px solid var(--surface-light)",
                  backgroundColor: active ? "var(--primary)" : "var(--surface-light)",
                  color: active ? "var(--text-inverse)" : "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  boxShadow: "none",
                  transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
                  whiteSpace: "nowrap",
                  display: "inline-block",
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
                  border: active ? "1px solid var(--primary)" : "1px solid var(--primary)",
                  backgroundColor: active ? "var(--primary)" : "var(--surface)",
                  color: active ? "var(--text-inverse)" : "var(--primary)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  boxShadow: active
                    ? "0 4px 12px rgba(var(--primary-rgb), 0.25)"
                    : "0 2px 8px rgba(var(--primary-rgb), 0.12)",
                  transition: "background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                  whiteSpace: "nowrap",
                  display: "inline-block",
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
