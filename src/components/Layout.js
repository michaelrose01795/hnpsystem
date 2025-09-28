// file location: src/components/Layout.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";
import ClockInButton from "./Clocking/ClockInButton";
import JobCardModal from "./JobCards/JobCardModal";

export default function Layout({ children }) {
  const { user, logout } = useUser();
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    console.log("User object:", user);
    console.log("Roles (normalized):", user?.roles?.map((r) => r.toLowerCase()));
  }, [user]);

  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  if (user === undefined && !hideSidebar) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const role = userRoles[0] || "guest";

  const links = [
    { href: "/newsfeed", label: "📰 News Feed" },
    { href: "/dashboard", label: "📊 Dashboard" },
  ];

  const viewRoles = ["manager", "service", "sales"];
  const isActive = (path) => router.pathname.startsWith(path);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {!hideSidebar && (
        <aside
          style={{
            width: "10%",
            minWidth: "160px",
            backgroundColor: "#FFF0F0",
            color: "black",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px",
            borderRight: "1px solid #FFCCCC",
          }}
        >
          <div>
            <h2
              style={{
                marginBottom: "20px",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#FF4040",
              }}
            >
              H&P DMS
            </h2>

            {/* Sidebar nav */}
            <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {links.map((link, index) => (
                <React.Fragment key={link.href}>
                  <Link href={link.href} legacyBehavior>
                    <a
                      style={{
                        display: "block",
                        padding: "10px",
                        borderRadius: "6px",
                        textDecoration: "none",
                        color: isActive(link.href) ? "white" : "#FF4040",
                        backgroundColor: isActive(link.href) ? "#FF4040" : "transparent",
                        transition: "all 0.2s",
                        fontSize: "0.95rem",
                        fontWeight: 500,
                      }}
                    >
                      {link.label}
                    </a>
                  </Link>

                  {/* Tech: Clock In Button under Dashboard */}
                  {index === 1 && userRoles.includes("techs") && (
                    <div style={{ marginTop: "10px" }}>
                      <ClockInButton />
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Service/Admin/Managers: Create Job Card */}
              {["service", "admin", "service manager", "workshop manager"].some(r => userRoles.includes(r)) && (
                <Link href="/job-cards/create" legacyBehavior>
                  <a
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: "#FF4040",
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    ➕ Create Job Card
                  </a>
                </Link>
              )}

              {/* Appointment Button (Service/Sales/Admin/Manager) */}
              {["service", "sales", "admin", "service manager", "workshop manager"].some(r => userRoles.includes(r)) && (
                <Link href="/appointments" legacyBehavior>
                  <a
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: isActive("/appointments") ? "white" : "#FF4040",
                      backgroundColor: isActive("/appointments") ? "#FF4040" : "transparent",
                      border: "1px solid #FF4040",
                      textAlign: "left",
                      fontSize: "0.95rem",
                      fontWeight: 500,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#FF4040";
                      e.target.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive("/appointments")) {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.color = "#FF4040";
                      }
                    }}
                  >
                    📅 Appointments
                  </a>
                </Link>
              )}

              {/* Manager/Service Manager: Next Jobs */}
              {["service manager", "workshop manager"].some(r => userRoles.includes(r)) && (
                <Link href="/job-cards/waiting/nextjobs" legacyBehavior>
                  <a
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: "#FF4040",
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    🔜 Next Jobs
                  </a>
                </Link>
              )}

              {/* Tech-only: Start Job button */}
              {userRoles.includes("techs") && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    display: "block",
                    padding: "10px",
                    marginTop: "10px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: isActive("/job-cards/start") ? "white" : "#FF4040",
                    backgroundColor: isActive("/job-cards/start") ? "#FF4040" : "transparent",
                    border: "1px solid #FF4040",
                    textAlign: "left",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "#FF4040";
                    e.target.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/job-cards/start")) {
                      e.target.style.backgroundColor = "transparent";
                      e.target.style.color = "#FF4040";
                    }
                  }}
                >
                  🔧 Start Job
                </button>
              )}

              {/* Manager/Service/Sales: View Job Cards */}
              {viewRoles.some((r) => userRoles.includes(r)) && (
                <Link href="/job-cards/view" legacyBehavior>
                  <a
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      color: isActive("/job-cards/view") ? "white" : "#FF4040",
                      backgroundColor: isActive("/job-cards/view") ? "#FF4040" : "transparent",
                      border: "1px solid #FF4040",
                      textAlign: "left",
                      fontSize: "0.95rem",
                      fontWeight: 500,
                      transition: "all 0.2s",
                    }}
                  >
                    👀 View Job Cards
                  </a>
                </Link>
              )}
            </nav>
          </div>

          {/* Logout */}
          <div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#FF4040",
                border: "none",
                color: "white",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.9rem",
              }}
            >
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main content area */}
      <div
        style={{
          width: hideSidebar ? "100%" : "90%",
          overflow: "auto",
          backgroundColor: "#FFF8F8",
        }}
      >
        {!hideSidebar && (
          <header
            style={{
              backgroundColor: "white",
              padding: "16px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                color: "#FF4040",
              }}
            >
              Welcome {user?.username || "Guest"} ({role})
            </h1>
          </header>
        )}

        <main style={{ padding: "24px", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>

      {/* Job Card Modal for Techs only */}
      {userRoles.includes("techs") && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
