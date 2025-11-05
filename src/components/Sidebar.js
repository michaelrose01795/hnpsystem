// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];

  // Define all navigation items for the sidebar
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Car Buying", href: "/car-buying", roles: ["admin", "sales", "workshop"] },
    { label: "Contractors", href: "/contractors", roles: ["admin"] },
    { label: "Vehicle Processing", href: "/vehicle-processing", roles: ["admin", "workshop"] },
    { label: "Smart Repair", href: "/smartrepair", roles: ["workshop"] },
    { label: "Create Job Card", href: "/job-cards/create", roles: ["admin", "sales", "workshop"] },
    { label: "View Job Cards", href: "/job-cards/view", roles: ["admin", "sales", "workshop", "service", "manager"] },
    { label: "Appointments", href: "/appointments", roles: ["admin", "sales", "service", "manager"] },
    { label: "Next Jobs", href: "/job-cards/waiting/nextjobs", roles: ["service manager", "workshop manager"] },
    { label: "VHC", href: "/vhc", roles: ["techs", "service", "manager", "workshop manager"] },
    { label: "Parts Workspace", href: "/parts", roles: ["parts", "parts manager"] },
    { label: "Parts Manager Overview", href: "/parts/manager", roles: ["parts manager"] },
    { label: "Messages", href: "/messages" },
  ];

  // Filter items based on user roles
  const visibleNav = navItems.filter(
    (item) =>
      !item.roles || item.roles.some((role) => userRoles.includes(role.toLowerCase()))
  );

  return (
    <aside
      style={{
        background: "#FFF0F0",
        padding: "20px",
        width: "200px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {visibleNav.map((item) => (
        <Link key={item.href} href={item.href}>
          <span
            style={{
              display: "block",
              padding: "10px",
              backgroundColor: pathname === item.href ? "#FF4040" : "transparent",
              color: pathname === item.href ? "white" : "#FF4040",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {item.label}
          </span>
        </Link>
      ))}
    </aside>
  );
}
