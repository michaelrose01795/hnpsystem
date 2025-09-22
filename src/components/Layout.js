// file location: src/components/Layout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";

export default function Layout({ children }) {
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
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Topbar */}
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Welcome {user?.username || "Guest"} ({role})
        </h1>
      </header>

      {/* Main body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-1/5 min-w-[220px] bg-gray-900 text-white flex flex-col">
          <div className="p-4 text-xl font-bold border-b border-gray-700">
            H&P System
          </div>
          <nav className="flex-1 p-4 overflow-auto">
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block p-3 rounded-lg transition-colors duration-200 ${
                      router.pathname === link.href
                        ? "bg-red-600"
                        : "hover:bg-gray-800"
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
              className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
