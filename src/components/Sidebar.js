// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";

// Navigation items for H&P Dealer Management System
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
];

export default function Sidebar() {
  const pathname = usePathname();
  const { roles: userRolesRaw } = useUser();

  // Normalize roles to lowercase for consistent comparison
  const userRoles = (userRolesRaw || []).map((r) => r.toLowerCase().trim());

  // Function to check if a nav item can be accessed by the current user
  const canAccess = (item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => userRoles.includes(role.toLowerCase()));
  };

  return (
    <aside className="w-64 h-screen bg-box text-text fixed left-0 top-0 flex flex-col shadow-lg">
      <div className="p-md text-2xl font-bold border-b border-muted">
        H&P DMS
      </div>
      <nav className="flex-1 p-md flex flex-col gap-sm">
        {navItems.filter(canAccess).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
