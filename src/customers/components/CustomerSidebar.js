// file location: src/customers/components/CustomerSidebar.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";

const NAV_LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/vhc", label: "VHC & Media" },
  { href: "/customer/vehicles", label: "My Vehicles" },
  { href: "/customer/parts", label: "Parts & Accessories" },
  { href: "/customer/payments", label: "Payments & Billing" },
  { href: "/customer/messages", label: "Messages" },
];

export default function CustomerSidebar() {
  const router = useRouter();
  const pathname = router.pathname;
  const { dbUserId } = useUser();
  const { unreadCount } = useMessagesBadge(dbUserId);

  return (
    <aside
      style={{
        width: "260px",
        minWidth: "220px",
        maxHeight: "calc(100vh - 32px)",
        position: "sticky",
        top: "16px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--surface)",
        borderRadius: "16px",
        boxShadow: "0 20px 40px rgba(var(--primary-rgb), 0.12)",
        border: "1px solid var(--surface-light)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: "linear-gradient(to right, var(--primary), var(--primary-dark))",
          padding: "24px",
          color: "white",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.8,
          }}
        >
          Customer Portal
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>Workspace</h2>
      </div>
      <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const isMessagesLink = link.href === "/customer/messages";
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: isActive
                    ? "linear-gradient(90deg, var(--primary), var(--primary-dark))"
                    : "var(--surface-light)",
                  color: isActive ? "var(--surface)" : "var(--primary-dark)",
                  fontWeight: 600,
                  boxShadow: isActive
                    ? "0 12px 20px rgba(var(--danger-rgb), 0.25)"
                    : "0 4px 12px rgba(var(--shadow-rgb), 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span>{link.label}</span>
                  {isMessagesLink && unreadCount > 0 && (
                    <span
                      style={{
                        minWidth: 24,
                        minHeight: 24,
                        padding: "0 6px",
                        borderRadius: 999,
                        background: "var(--primary)",
                        color: "var(--surface)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
