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
    <>
      <div className="layout-container">
        {!hideSidebar && (
          <aside className="sidebar">
            <div>
              <h2 className="sidebar-title">H&P DMS</h2>

              {/* Sidebar nav */}
              <nav className="nav-links">
                {links.map((link, index) => (
                  <React.Fragment key={link.href}>
                    <Link href={link.href} legacyBehavior>
                      <a className={`nav-link ${isActive(link.href) ? "active" : ""}`}>
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
                {["service", "admin", "service manager", "workshop manager"].some(r =>
                  userRoles.includes(r)
                ) && (
                  <Link href="/job-cards/create" legacyBehavior>
                    <a className="create-btn">➕ Create Job Card</a>
                  </Link>
                )}

                {/* Appointment Button (Service/Sales/Admin/Manager) */}
                {["service", "sales", "admin", "service manager", "workshop manager"].some(r =>
                  userRoles.includes(r)
                ) && (
                  <Link href="/appointments" legacyBehavior>
                    <a className="create-btn">📅 Appointments</a>
                  </Link>
                )}

                {/* Manager/Service Manager: Next Jobs */}
                {["service manager", "workshop manager"].some(r =>
                  userRoles.includes(r)
                ) && (
                  <Link href="/job-cards/waiting/nextjobs" legacyBehavior>
                    <a className="create-btn">🔜 Next Jobs</a>
                  </Link>
                )}

                {/* Tech-only: Start Job button */}
                {userRoles.includes("techs") && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="create-btn"
                    style={{ cursor: "pointer" }}
                  >
                    🔧 Start Job
                  </button>
                )}

                {/* Manager/Service/Sales: View Job Cards */}
                {viewRoles.some((r) => userRoles.includes(r)) && (
                  <Link href="/job-cards/view" legacyBehavior>
                    <a className="create-btn">👀 View Job Cards</a>
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
                className="logout-btn"
              >
                Logout
              </button>
            </div>
          </aside>
        )}

        {/* Main content area */}
        <div className="main-container" style={{ width: hideSidebar ? "100%" : "90%" }}>
          {!hideSidebar && (
            <header className="header">
              <h1>
                Welcome {user?.username || "Guest"} ({role})
              </h1>
            </header>
          )}

          <main className="main-content">{children}</main>
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
          overflow: hidden;
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

        .nav-link,
        .create-btn {
          display: block;
          padding: 10px;
          border-radius: 6px;
          text-decoration: none;
          color: #ff4040;
          background-color: transparent;
          border: 1px solid #ff4040;
          font-size: 0.95rem;
          font-weight: 500;
          text-align: center;
          transition: all 0.2s;
        }

        .nav-link.active,
        .nav-link:hover,
        .create-btn:hover {
          background-color: #ff4040;
          color: white;
        }

        .create-btn {
          color: white;
          background-color: #ff4040;
          font-weight: 600;
          margin-top: 10px;
          cursor: pointer;
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
          margin-top: 20px;
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

        @media (max-width: 1024px) {
          .sidebar { width: 18%; }
          .header h1 { font-size: 1.1rem; }
        }

        @media (max-width: 768px) {
          .layout-container { flex-direction: column; }
          .sidebar { width: 100%; flex-direction: row; justify-content: space-around; border-right: none; border-bottom: 1px solid #ffcccc; padding: 10px; }
          .nav-links { flex-direction: row; flex-wrap: wrap; gap: 5px; }
          .main-container { width: 100% !important; }
        }

        @media (max-width: 480px) {
          .sidebar { flex-direction: column; align-items: center; }
          .nav-links { flex-direction: column; gap: 8px; }
          .header h1 { font-size: 1rem; }
          .main-content { padding: 12px; }
        }
      `}</style>
    </>
  );
}