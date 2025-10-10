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
                {(userRoles.includes("service") ||
                  userRoles.includes("admin") ||
                  userRoles.some((r) => r.includes("manager"))) && (
                  <Link href="/job-cards/create" legacyBehavior>
                    <a className="create-btn">➕ Create Job Card</a>
                  </Link>
                )}

                {/* Manager/Service Manager: Next Jobs */}
                {["service manager", "workshop manager"].some((r) =>
                  userRoles.includes(r.toLowerCase())
                ) && (
                  <Link href="/job-cards/waiting/nextjobs" legacyBehavior>
                    <a className="create-btn">🔜 Next Jobs</a>
                  </Link>
                )}

                {/* Tech-only: Start Job button */}
                {userRoles.includes("techs") && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className={`nav-link ${isActive("/job-cards/start") ? "active" : ""}`}
                  >
                    🔧 Start Job
                  </button>
                )}

                {/* Manager/Service/Sales: View Job Cards */}
                {viewRoles.some((r) => userRoles.includes(r)) && (
                  <Link href="/job-cards/view" legacyBehavior>
                    <a
                      className={`nav-link ${
                        isActive("/job-cards/view") ? "active" : ""
                      }`}
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

      {/* Responsive CSS */}
      <style jsx>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          font-family: sans-serif;
          overflow: hidden; /* Prevents extra scroll on large screens */
        }

        .sidebar {
          width: 12%;
          min-width: 180px;
          max-width: 220px;
          background-color: #fff0f0;
          color: black;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 20px;
          border-right: 1px solid #ffcccc;
        }

        .sidebar-title {
          margin-bottom: 20px;
          font-size: 1.2rem;
          font-weight: 700;
          color: #ff4040;
          text-align: center;
        }

        .nav-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .nav-link {
          display: block;
          padding: 10px;
          border-radius: 6px;
          text-decoration: none;
          color: #ff4040;
          background-color: transparent;
          border: 1px solid #ff4040;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s;
          text-align: center;
        }

        .nav-link.active,
        .nav-link:hover {
          background-color: #ff4040;
          color: white;
        }

        .create-btn {
          display: block;
          padding: 10px;
          margin-top: 10px;
          border-radius: 6px;
          text-decoration: none;
          color: white;
          background-color: #ff4040;
          text-align: center;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .logout-btn {
          width: 100%;
          padding: 10px;
          background-color: #ff4040;
          border: none;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .main-container {
          flex: 1;
          background-color: #fff8f8;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .header {
          background-color: white;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .header h1 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #ff4040;
        }

        .main-content {
          flex: 1;
          padding: 16px;
          box-sizing: border-box;
        }

        /* 🔹 Larger screens (no scrollbars if possible) */
        @media (min-width: 1025px) {
          .main-container {
            padding: 10px;
            overflow-y: auto;
          }
          .main-content {
            max-height: calc(100vh - 80px); /* keep everything visible */
            overflow-y: auto;
          }
        }

        /* 🔹 Tablets */
        @media (max-width: 1024px) {
          .sidebar {
            width: 18%;
          }
          .header h1 {
            font-size: 1.1rem;
          }
        }

        /* 🔹 Phones */
        @media (max-width: 768px) {
          .layout-container {
            flex-direction: column;
          }
          .sidebar {
            width: 100%;
            flex-direction: row;
            justify-content: space-around;
            border-right: none;
            border-bottom: 1px solid #ffcccc;
            padding: 10px;
          }
          .nav-links {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 5px;
          }
          .main-container {
            width: 100% !important;
          }
        }

        /* 🔹 Very small phones */
        @media (max-width: 480px) {
          .sidebar {
            flex-direction: column;
            align-items: center;
          }
          .nav-links {
            flex-direction: column;
            gap: 8px;
          }
          .header h1 {
            font-size: 1rem;
          }
          .main-content {
            padding: 12px;
          }
        }
      `}</style>
    </>
  );
}