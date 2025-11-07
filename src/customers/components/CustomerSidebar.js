// file location: src/customers/components/CustomerSidebar.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

const NAV_LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/vhc", label: "VHC & Media" },
  { href: "/customer/vehicles", label: "My Vehicles" },
  { href: "/customer/parts", label: "Parts & Accessories" },
  { href: "/customer/messages", label: "Messages" },
];

export default function CustomerSidebar() {
  const router = useRouter();
  const pathname = router.pathname;

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
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 20px 40px rgba(209, 0, 0, 0.12)",
        border: "1px solid #ffe0e0",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: "linear-gradient(to right, #d10000, #a00000)",
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
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: isActive
                    ? "linear-gradient(90deg, #d10000, #a00000)"
                    : "#fff5f5",
                  color: isActive ? "#ffffff" : "#a00000",
                  fontWeight: 600,
                  boxShadow: isActive
                    ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                    : "0 4px 12px rgba(0, 0, 0, 0.05)",
                }}
              >
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
