// file location: src/components/Layout.js
// This component provides a sidebar + topbar layout that adapts based on user roles.

import React from "react"; // React core
import Link from "next/link"; // Next.js routing
import { useRouter } from "next/router"; // For navigation
import { useUser } from "../context/UserContext"; // Get current user + role

export default function Layout({ children }) {
  const { user, logout } = useUser(); // Access user + logout
  const router = useRouter();

  // Define navigation links per role
  const navLinks = {
    Admin: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/users", label: "User Management" },
      { href: "/reports", label: "Reports" },
    ],
    Sales: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/sales", label: "Sales Tracking" },
      { href: "/cars", label: "Car Inventory" },
    ],
    Workshop: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/jobs", label: "Job Cards" },
      { href: "/clocking", label: "Clocking System" },
    ],
    Parts: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/parts", label: "Parts Management" },
      { href: "/requests", label: "Parts Requests" },
    ],
    Manager: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/overview", label: "Overview" },
      { href: "/approvals", label: "Approvals" },
    ],
  };

  // Fallback links if role missing
  const role = user?.role || "Guest";
  const links = navLinks[role] || [{ href: "/dashboard", label: "Dashboard" }];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-gray-700">
          H&P System
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block p-2 rounded ${
                    router.pathname === link.href
                      ? "bg-red-600"
                      : "hover:bg-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full bg-red-600 hover:bg-red-700 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-lg font-semibold">
            Welcome {user?.name || "Guest"} ({role})
          </h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
