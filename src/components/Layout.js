// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import Next.js router
import { useUser } from "../context/UserContext"; // import user context
import ClockInButton from "./Clocking/ClockInButton"; // import clock in button
import JobCardModal from "./JobCards/JobCardModal"; // import job modal
import StatusSidebar from "../components/StatusTracking/StatusSidebar"; // import status sidebar

export default function Layout({ children }) {
  const { user, logout, status, setStatus } = useUser(); // include status state
  const router = useRouter(); // get router object
  const hideSidebar = router.pathname === "/login"; // hide sidebar on login page
  const [isModalOpen, setIsModalOpen] = useState(false); // modal state
  const [darkMode, setDarkMode] = useState(false); // dark mode state
  const [isStatusSidebarOpen, setIsStatusSidebarOpen] = useState(false); // status sidebar state
  
  // NEW: Extract jobId from URL if present (e.g., /job-cards/view/12345 or ?id=12345)
  const urlJobId = router.query.id || router.query.jobId || null;
  
  // NEW: State for manually searched job (when not on a job page)
  const [searchedJobId, setSearchedJobId] = useState(null);
  
  // NEW: Determine which jobId to use (URL takes priority over search)
  const activeJobId = urlJobId || searchedJobId;
  
  // Get current job status from API
  const [currentJobStatus, setCurrentJobStatus] = useState('booked');

  // Define roles that can see the status sidebar
  const statusSidebarRoles = [
    "admin manager",
    "service",
    "service manager", 
    "workshop manager",
    "after sales director",
    "techs",
    "parts",
    "parts manager",
    "mot tester",
    "valet service"
  ];

  // Check if current user has access to status sidebar
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const canViewStatusSidebar = userRoles.some(role => 
    statusSidebarRoles.includes(role)
  );

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

  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  // NEW: Fetch current job status when activeJobId changes
  useEffect(() => {
    if (activeJobId) {
      fetchCurrentJobStatus(activeJobId);
    }
  }, [activeJobId]);

  // NEW: Clear searched job when URL changes to a job page
  useEffect(() => {
    if (urlJobId) {
      setSearchedJobId(null); // Clear manual search when on a job page
    }
  }, [urlJobId]);

  // Function to fetch the current status of a job
  const fetchCurrentJobStatus = async (id) => {
    try {
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentJobStatus(data.status); // Update current status
      }
    } catch (error) {
      console.error('Error fetching job status:', error);
    }
  };

  if (user === undefined && !hideSidebar) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  const role = userRoles[0] || "guest";

  // Sidebar navigation
  const links = [
    { href: "/newsfeed", label: "📰 News Feed" },
    { href: "/dashboard", label: "📊 Dashboard" },
  ];

  const viewRoles = ["manager", "service", "sales"];
  const appointmentRoles = ["admin", "sales", "service", "manager"];
  const isActive = (path) => router.pathname.startsWith(path);

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

            {/* Dark mode toggle */}
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

                  {index === 1 && userRoles.includes("techs") && (
                    <div style={{ marginTop: "10px" }}>
                      <ClockInButton />
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Techs-only links */}
              {userRoles.includes("techs") && (
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
                    onClick={() => setIsModalOpen(true)}
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

              {["service manager", "workshop manager"].some((r) =>
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

          {/* Logout button */}
          <div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
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

      {/* Main content */}
      <div
        style={{
          flex: 1,
          backgroundColor: colors.mainBg,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
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

            {/* Techs-only status dropdown */}
            {userRoles.includes("techs") && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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

        <main style={{ padding: "24px", boxSizing: "border-box" }}>{children}</main>
      </div>

      {/* NEW: Status Sidebar - always available for authorized users */}
      {canViewStatusSidebar && (
        <StatusSidebar
          jobId={activeJobId}
          currentStatus={currentJobStatus}
          isOpen={isStatusSidebarOpen}
          onToggle={() => setIsStatusSidebarOpen(!isStatusSidebarOpen)}
          onJobSearch={setSearchedJobId} // NEW: Pass search handler
          hasUrlJobId={!!urlJobId} // NEW: Tell sidebar if we're on a job page
        />
      )}

      {userRoles.includes("techs") && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}