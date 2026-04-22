// file location: src/features/customerPortal/components/CustomerSidebar.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";

const NAV_LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/vhc", label: "VHC & Media" },
  { href: "/customer/vehicles", label: "My Vehicles" },
  { href: "/customer/parts", label: "Parts & Accessories" },
  { href: "/customer/payments", label: "Payments & Billing" },
  { href: "/customer/messages", label: "Messages" },
];

export default function CustomerSidebar() {
  const router = useRouter();
  const pathname = router.pathname;
  const { dbUserId } = useUser();
  const { unreadCount } = useMessagesBadge(dbUserId);

  return (
    <aside className="customer-portal-card flex w-full flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:w-[260px] lg:min-w-[220px] lg:flex-shrink-0">
      <div className="bg-[var(--primary)] px-6 py-5 text-white">
        <p className="m-0 text-[0.85rem] uppercase tracking-[0.08em] text-white/80">
          Customer Portal
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Workspace</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const isMessagesLink = link.href === "/customer/messages";
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div
                className={`mb-3 flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--text-inverse)]"
                    : "bg-[var(--surface-light)] text-[var(--primary-dark)]"
                }`}
              >
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span>{link.label}</span>
                  {isMessagesLink && unreadCount > 0 && (
                    <span
                      className="app-badge app-badge--control app-badge--accent-soft"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
