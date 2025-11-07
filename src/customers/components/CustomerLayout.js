// file location: src/customers/components/CustomerLayout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];
const NAV_LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/vhc", label: "VHC & Media" },
  { href: "/customer/vehicles", label: "My Vehicles" },
  { href: "/customer/parts", label: "Parts & Accessories" },
  { href: "/customer/messages", label: "Messages" },
];

export default function CustomerLayout({ pageTitle = "Customer Portal", children }) {
  const router = useRouter();
  const { user, logout } = useUser();

  const isCustomer = user?.roles?.some((role) =>
    CUSTOMER_ROLE_ALLOWLIST.includes((role || "").toUpperCase())
  );

  const portalUrl =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Customer Portal</h1>
          <p className="text-gray-600">
            Please log in with the email you used when booking your vehicle in.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2 text-white font-semibold shadow hover:bg-red-700"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl bg-white p-8 shadow-lg space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Restricted area</h1>
          <p className="text-gray-600">
            This part of the platform is dedicated to customers only. Switch to a customer user
            through the developer login to preview the experience.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2 text-white font-semibold shadow hover:bg-red-700"
          >
            Switch user
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout?.();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-600">
              H&P Automotive
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Main website
            </a>
            <div className="hidden text-right md:block">
              <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-800">{user.username || "Customer"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-3 overflow-x-auto px-4 pb-4 pt-2 text-sm font-semibold">
          {NAV_LINKS.map((link) => {
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 transition ${
                  isActive
                    ? "bg-red-600 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
