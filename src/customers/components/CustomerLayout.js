// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/components/CustomerLayout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import CustomerSidebar from "@/customers/components/CustomerSidebar";

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];

export default function CustomerLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useUser();

  const roleList = []
    .concat(user?.roles || [])
    .concat(user?.role ? [user.role] : [])
    .map((role) => (role || "").toString().toUpperCase());
  const isCustomer = roleList.some((role) => CUSTOMER_ROLE_ALLOWLIST.includes(role));

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--accent-purple-surface)]">
        <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-8 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Customer Portal</h1>
            <p className="text-[var(--text-secondary)]">
              Please log in with the email you used when booking your vehicle in.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2 font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--accent-purple-surface)] px-4">
        <div className="max-w-lg rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-8 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Restricted area</h1>
            <p className="text-[var(--text-secondary)]">
              This part of the platform is dedicated to customers only. Switch to a customer user
              through the developer login to preview the experience.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2 font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              Switch user
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";

  const handleLogout = () => {
    logout?.();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--accent-purple-surface)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
        <CustomerSidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-3">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                  Signed in
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {user.username || "Customer"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-3">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                  Portal link
                </p>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-sm font-semibold text-[var(--primary-dark)] underline"
                >
                  Open website
                </a>
              </div>
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                    Session
                  </p>
                  <span className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--danger)]">
                    VHC linked
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Active</p>
                  <button
                    onClick={handleLogout}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-dark)]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex flex-col gap-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
