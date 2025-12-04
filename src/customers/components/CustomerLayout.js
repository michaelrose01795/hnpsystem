// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/components/CustomerLayout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import CustomerSidebar from "@/customers/components/CustomerSidebar";

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];

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
    <div style={{ minHeight: "100vh", background: "var(--accent-purple-surface)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "20px",
          padding: "24px",
          minHeight: "100vh",
        }}
      >
        <CustomerSidebar />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            paddingBottom: "40px",
          }}
        >
          <header
            style={{
              borderRadius: "18px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              padding: "24px",
              boxShadow: "0 12px 34px rgba(var(--primary-rgb),0.08)",
            }}
          >
            <p
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.35em",
                fontSize: "0.7rem",
                color: "var(--primary)",
                marginBottom: "8px",
              }}
            >
              Customer Experience
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, color: "var(--info-dark)" }}>
                {pageTitle}
              </h1>
              <span
                style={{
                  borderRadius: "999px",
                  background: "var(--surface-light)",
                  color: "var(--danger)",
                  padding: "6px 16px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                VHC linked
              </span>
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              }}
            >
              <div
                style={{
                  borderRadius: "16px",
                  border: "1px solid var(--surface-light)",
                  padding: "16px",
                  background: "var(--surface-light)",
                }}
              >
                <p
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.25em",
                    fontSize: "0.65rem",
                    color: "var(--primary)",
                    marginBottom: "6px",
                  }}
                >
                  Signed in
                </p>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--info-dark)" }}>
                  {user.username || "Customer"}
                </p>
              </div>
              <div
                style={{
                  borderRadius: "16px",
                  border: "1px solid var(--surface-light)",
                  padding: "16px",
                  background: "var(--surface-light)",
                }}
              >
                <p
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.25em",
                    fontSize: "0.65rem",
                    color: "var(--primary)",
                    marginBottom: "6px",
                  }}
                >
                  Portal link
                </p>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--primary-dark)",
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  Open website
                </a>
              </div>
              <div
                style={{
                  borderRadius: "16px",
                  border: "1px solid var(--surface-light)",
                  padding: "16px",
                  background: "var(--surface-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.25em",
                      fontSize: "0.65rem",
                      color: "var(--primary)",
                      marginBottom: "6px",
                    }}
                  >
                    Session
                  </p>
                  <p style={{ margin: 0, color: "var(--info-dark)", fontWeight: 600 }}>Active</p>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    border: "none",
                    background: "linear-gradient(90deg, var(--primary), var(--primary-dark))",
                    color: "var(--surface)",
                    fontWeight: 600,
                    borderRadius: "999px",
                    padding: "10px 18px",
                    cursor: "pointer",
                    boxShadow: "0 10px 24px rgba(var(--primary-rgb),0.25)",
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{children}</main>
        </div>
      </div>
    </div>
  );
}
