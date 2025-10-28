// file location: src/components/Sidebar.js
"use client";

import Link from "next/link"; // import Next.js Link component for navigation
import { usePathname } from "next/navigation"; // import pathname hook to highlight active links
import { useUser } from "@/context/UserContext"; // import user context to get roles

// Define all navigation items for the sidebar
const navItems = [
  { label: "Home", href: "/" }, // always visible
  { label: "Dashboard", href: "/dashboard" }, // always visible
  { label: "Car Buying", href: "/car-buying", roles: ["admin", "sales", "workshop"] }, // restricted access
  { label: "Contractors", href: "/contractors", roles: ["admin"] }, // admin only
  { label: "Vehicle Processing", href: "/vehicle-processing", roles: ["admin", "workshop"] }, // limited access
  { label: "Smart Repair", href: "/smartrepair", roles: ["workshop"] }, // workshop only
  { label: "Create Job Card", href: "/job-cards/create", roles: ["admin", "sales", "workshop"] }, // allowed for admin/sales/workshop
  { label: "View Job Cards", href: "/job-cards/view", roles: ["admin", "sales", "workshop", "service", "manager"] }, // view access
  { label: "Appointments", href: "/appointments", roles: ["admin", "sales", "service", "manager"] }, // appointment roles
  { label: "Next Jobs", href: "/job-cards/waiting/nextjobs", roles: ["service manager", "workshop manager"] }, // manager-only
  { label: "My Jobs", href: "/job-cards/myjobs", roles: ["techs"] }, // ✅ new tech-only link
];

export default function Sidebar() {
  const pathname = usePathname(); // get the current page path
  const { roles: userRolesRaw } = useUser(); // get user roles from context

  // Normalize roles to lowercase for consistent comparison
  const userRoles = (userRolesRaw || []).map((r) => r.toLowerCase().trim());

  // Check if the user can access each navigation item based on their role
  const canAccess = (item) => {
    if (!item.roles) return true; // if no roles defined, open to all
    return item.roles.some((role) => userRoles.includes(role.toLowerCase())); // check for matching roles
  };

  return (
    <aside
      className="w-64 h-screen bg-box text-text fixed left-0 top-0 flex flex-col shadow-lg"
    >
      {/* Sidebar Header */}
      <div className="p-md text-2xl font-bold border-b border-muted">
        H&P DMS
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 p-md flex flex-col gap-sm">
        {navItems.filter(canAccess).map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/"); // highlight active link
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