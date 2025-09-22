// file location: src/components/Layout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";

export default function Layout({ children, showSidebar = true }) {
  const { user, logout } = useUser();
  const router = useRouter();

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

  const role = user?.roles?.[0] || "Guest";
  const links = navLinks[role] || [{ href: "/dashboard", label: "Dashboard" }];

  return (
    <div className="flex flex-col h-screen font-sans">
      {/* Top bar */}
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Welcome {user?.username || "Guest"} ({role})
        </h1>
      </header>

      {/* Main content row: sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar vertical section */}
        {showSidebar && (
          <aside className="w-1/5 min-w-[220px] bg-red-100 text-red-800 flex flex-col p-4 shadow-inner">
            <div className="text-xl font-bold mb-4 border-b border-red-300">
              H&P System
            </div>

            <nav className="flex-1 overflow-auto">
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`block p-3 rounded-lg transition-colors duration-200 ${
                        router.pathname === link.href
                          ? "bg-red-600 text-white"
                          : "hover:bg-red-200 text-red-800"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-4 border-t border-red-300 pt-2">
              <button
                onClick={logout}
                className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold text-white transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </aside>
        )}

        {/* Page content */}
        <main
          className={`flex-1 overflow-auto p-6 ${
            showSidebar ? "bg-gray-100" : "flex justify-center items-center h-[calc(100vh-64px)]"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
