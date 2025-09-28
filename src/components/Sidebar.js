// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";

// Navigation items for H&P Dealer Management System
const navItems = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Car Buying", href: "/car-buying", roles: ["ADMIN", "SALES", "WORKSHOP"] },
  { label: "Contractors", href: "/contractors", roles: ["ADMIN"] },
  { label: "Vehicle Processing", href: "/vehicle-processing", roles: ["ADMIN", "WORKSHOP"] },
  { label: "Smart Repair", href: "/smartrepair", roles: ["WORKSHOP"] },
  { label: "Create Job Card", href: "/job-cards/create", roles: ["ADMIN", "SALES", "WORKSHOP"] }, // always go here
  { label: "View Job Cards", href: "/job-cards/view", roles: ["ADMIN", "SALES", "WORKSHOP"] },
  { label: "Next Jobs", href: "/job-cards/waiting/nextjobs", roles: ["Workshop Manager", "Service Manager"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { roles } = useUser();

  // Check if current user can access the nav item
  const canAccess = (item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles[role]);
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
              className={`p-sm rounded-md transition-colors text-md ${
                isActive
                  ? "bg-accent text-white"
                  : "hover:bg-accent hover:text-white text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
