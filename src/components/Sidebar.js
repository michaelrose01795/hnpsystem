// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";

// ✅ Nav items including Create Job Card with correct hyphen
const navItems = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Auth", href: "/auth", roles: ["ADMIN"] },
  { label: "Car Buying", href: "/car-buying", roles: ["ADMIN","SALES","WORKSHOP"] },
  { label: "Contractors", href: "/contractors" },
  { label: "Vehicle Processing", href: "/vehicle-processing" },
  { label: "Smart Repair", href: "/smartrepair" },
  { label: "Features", href: "/features" },
  { label: "Login", href: "/login" },

  // ✅ Fixed Create Job Card link
  { label: "Create Job Card", href: "/job-cards/create", roles: ["ADMIN","SALES","WORKSHOP"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { roles } = useUser();

  const canAccess = (item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles[role]);
  };

  return (
    <aside className="w-64 h-screen bg-box text-text fixed left-0 top-0 flex flex-col shadow-lg">
      <div className="p-md text-2xl font-bold border-b border-muted">
        H&P System
      </div>
      <nav className="flex-1 p-md flex flex-col gap-sm">
        {navItems.filter(canAccess).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-sm rounded-md transition-colors text-md ${
                isActive
                  ? "bg-accent text-white"
                  : "hover:bg-accent hover:text-white text-muted"
              }`}
              legacyBehavior
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
