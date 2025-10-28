// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import Next.js router
import { useUser } from "../context/UserContext"; // import user context
import ClockInButton from "./Clocking/ClockInButton"; // import clock in button
import JobCardModal from "./JobCards/JobCardModal"; // import job modal

export default function Layout({ children }) {
  const { user, logout, status, setStatus } = useUser(); // include status state
  const router = useRouter(); // get router object
  const hideSidebar = router.pathname === "/login"; // hide sidebar on login page
  const [isModalOpen, setIsModalOpen] = useState(false); // modal state
  const [darkMode, setDarkMode] = useState(false); // dark mode state

  // Load saved dark mode setting from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode"); // get from storage
    if (savedMode === "true") setDarkMode(true); // enable if saved
  }, []);

  // Apply dark or light mode class to the document body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "true");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  // Redirect to login if no user
  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  // Show loading state while checking user
  if (user === undefined && !hideSidebar) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  // Normalize user roles to lowercase
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const role = userRoles[0] || "guest"; // get primary role

  // Sidebar navigation links
  const links = [
    { href: "/newsfeed", label: "📰 News Feed" },
    { href: "/dashboard", label: "📊 Dashboard" },
  ];

  // Define roles that can view job cards
  const viewRoles = ["manager", "service", "sales", "service manager", "workshop manager", "after sales manager"];
  // Define roles that can access appointments
  const appointmentRoles = ["admin", "sales", "service", "manager", "service manager", "workshop manager", "after sales manager"];
  // Check if current path is active
  const isActive = (path) => router.pathname.startsWith(path);

  // Define colors for dark and light mode
  const colors = darkMode
    ? {
        sidebarBg: "#1E1E1E",
        sidebarText: "#E0E0E0",
        accent: "#FF4040",
        mainBg: "#121212",
        headerBg: "#222",
      }
    : {
        sidebarBg: "#FFF0F0",
        sidebarText: "black",
        accent: "#FF4040",
        mainBg: "#FFF8F8",
        headerBg: "white",
      };

  // Check if user is a manager (service, workshop, or after sales)
  const isManager = userRoles.some((r) => 
    r.includes("service manager") || 
    r.includes("workshop manager") || 
    r.includes("after sales manager")
  );

  // Check if user is a tech
  const isTech = userRoles.includes("techs");

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        backgroundColor: colors.mainBg,
        color: colors.sidebarText,
      }}
    >
      {/* Sidebar - hidden on login page */}
      {!hideSidebar && (
        <aside
          style={{
            width: "10%",
            minWidth: "160px",
            backgroundColor: colors.sidebarBg,
            color: colors.sidebarText,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px",
            borderRight: `1px solid ${darkMode ? "#333" : "#FFCCCC"}`,
          }}
        >
          <div>
            {/* Sidebar header */}
            <h2
              style={{
                marginBottom: "20px",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: colors.accent,
              }}
            >
              H&P DMS
            </h2>

            {/* Dark mode toggle button */}
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              style={{
                backgroundColor: colors.accent,
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "8px",
                width: "100%",
                cursor: "pointer",
                marginBottom: "16px",
                fontWeight: "bold",
              }}
            >
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>

            {/* Navigation links */}
            <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {links.map((link, index) => (
                <React.Fragment key={link.href}>
                  <Link href={link.href}>
                    <span
                      style={{
                        display: "block",
                        padding: "10px",
                        borderRadius: "6px",
                        textDecoration: "none",
                        color: isActive(link.href) ? "white" : colors.accent,
                        backgroundColor: isActive(link.href)
                          ? colors.accent
                          : "transparent",
                        transition: "all 0.2s",
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {link.label}
                    </span>
                  </Link>

                  {/* Show clock-in button after dashboard for techs and managers */}
                  {index === 1 && (isTech || isManager) && (
                    <div style={{ marginTop: "10px" }}>
                      <ClockInButton />
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Show My Jobs and Start Job button for techs AND managers */}
              {(isTech || isManager) && (
                <>
                  <Link href="/job-cards/myjobs">
                    <span
                      style={{
                        display: "block",
                        padding: "10px",
                        borderRadius: "6px",
                        textDecoration: "none",
                        color: "white",
                        backgroundColor: colors.accent,
                        textAlign: "center",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        marginTop: "10px",
                        cursor: "pointer",
                      }}
                    >
                      🧰 My Jobs
                    </span>
                  </Link>

                  <button
                    onClick={() => setIsModalOpen(true)} // open job card modal
                    style={{
                      display: "block",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                      fontWeight: 500,
                      marginTop: "10px",
                      cursor: "pointer",
                      border: `1px solid ${colors.accent}`,
                      backgroundColor: "transparent",
                      color: colors.accent,
                    }}
                  >
                    🔧 Start Job
                  </button>
                </>
              )}

              {/* Create Job Card button - for service, admin, managers */}
              {(userRoles.includes("service") ||
                userRoles.includes("admin") ||
                userRoles.some((r) => r.includes("manager"))) && (
                <Link href="/job-cards/create">
                  <span
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: colors.accent,
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ➕ Create Job Card
                  </span>
                </Link>
              )}

              {/* Next Jobs button - for service, workshop, and after sales managers */}
              {["service manager", "workshop manager", "after sales manager"].some((r) =>
                userRoles.includes(r.toLowerCase())
              ) && (
                <Link href="/job-cards/waiting/nextjobs">
                  <span
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: colors.accent,
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔜 Next Jobs
                  </span>
                </Link>
              )}

              {/* View Job Cards - for managers, service, sales */}
              {viewRoles.some((r) => userRoles.includes(r)) && (
                <Link href="/job-cards/view">
                  <span
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: colors.accent,
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    👀 View Job Cards
                  </span>
                </Link>
              )}

              {/* Appointments - for admin, sales, service, managers */}
              {appointmentRoles.some((r) => userRoles.includes(r)) && (
                <Link href="/appointments">
                  <span
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: "white",
                      backgroundColor: colors.accent,
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    📅 Appointments
                  </span>
                </Link>
              )}
            </nav>
          </div>

          {/* Logout button at bottom of sidebar */}
          <div>
            <button
              onClick={() => {
                logout(); // logout user
                router.push("/login"); // redirect to login
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: colors.accent,
                border: "none",
                color: "white",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.9rem",
                marginTop: "20px",
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
          flex: 1,
          backgroundColor: colors.mainBg,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header - hidden on login page */}
        {!hideSidebar && (
          <header
            style={{
              backgroundColor: colors.headerBg,
              padding: "16px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: colors.accent }}>
              Welcome {user?.username || "Guest"} ({role})
            </h1>

            {/* Status dropdown - for techs AND managers */}
            {(isTech || isManager) && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)} // update status
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.accent}`,
                  backgroundColor: "white",
                  color: colors.accent,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                <option>Waiting for Job</option>
                <option>In Progress</option>
                <option>Break</option>
                <option>Completed</option>
              </select>
            )}
          </header>
        )}

        {/* Main content render */}
        <main style={{ padding: "24px", boxSizing: "border-box" }}>{children}</main>
      </div>

      {/* Job Card Modal - for techs AND managers */}
      {(isTech || isManager) && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}