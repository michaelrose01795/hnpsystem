// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "../context/UserContext"; // import user context
import ClockInButton from "./Clocking/ClockInButton"; // import clock in button
import GlobalSearch from "./GlobalSearch"; // import global search component
import JobCardModal from "./JobCards/JobCardModal"; // import job modal
import StatusSidebar from "../components/StatusTracking/StatusSidebar"; // import status sidebar

export default function Layout({ children }) {
  const { user, logout, status, setStatus, currentJob } = useUser(); // get user context data
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isStatusSidebarOpen, setIsStatusSidebarOpen] = useState(false);

  const urlJobId = router.query.id || router.query.jobId || null;
  const [searchedJobId, setSearchedJobId] = useState(null);
  const activeJobId = urlJobId || searchedJobId;
  const [currentJobStatus, setCurrentJobStatus] = useState("booked");

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
    "valet service",
  ];

  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const isTech = userRoles.includes("techs");
  const canViewStatusSidebar = userRoles.some((role) =>
    statusSidebarRoles.includes(role)
  );

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") setDarkMode(true);
  }, []);

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

  useEffect(() => {
    if (activeJobId) fetchCurrentJobStatus(activeJobId);
  }, [activeJobId]);

  useEffect(() => {
    if (urlJobId) setSearchedJobId(null);
  }, [urlJobId]);

  const fetchCurrentJobStatus = async (id) => {
    try {
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${id}`);
      const data = await response.json();
      if (data.success) setCurrentJobStatus(data.status);
    } catch (error) {
      console.error("Error fetching job status:", error);
    }
  };

  if (user === undefined && !hideSidebar) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  const role = userRoles[0] || "guest";
  const roleDisplay = role
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const links = [
    { href: "/newsfeed", label: "📰 News Feed" },
    { href: "/dashboard", label: "📊 Dashboard" },
    { href: "/messages", label: "💬 Messages" },
  ];

  const viewRoles = ["manager", "service", "sales"];
  const appointmentRoles = ["admin", "sales", "service", "manager"];
  const vhcRoles = [
    "admin",
    "service",
    "service manager",
    "workshop manager",
    "after sales director",
    "general manager",
  ];
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

  const navigationItems = [];
  const seenNavItems = new Set();
  const addNavItem = (label, href, keywords = [], description) => {
    if (!label || !href) return;
    const key = `${label}|${href}`;
    if (seenNavItems.has(key)) return;
    seenNavItems.add(key);

    const sanitized = label.replace(/[^a-zA-Z0-9\s]/g, " ").toLowerCase();
    const baseKeywords = sanitized
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    const finalKeywords = Array.from(
      new Set([
        ...baseKeywords,
        ...keywords.map((keyword) => keyword.toLowerCase()),
      ])
    );

    navigationItems.push({
      label,
      href,
      keywords: finalKeywords,
      description,
    });
  };

  links.forEach((link) => addNavItem(link.label, link.href));

  if (isTech) {
    addNavItem("🧰 My Jobs", "/job-cards/myjobs", ["my jobs", "jobs", "tech"]);
    addNavItem("🔧 Start Job", "/job-cards/myjobs", ["start job", "tech"]);
    addNavItem(
      "Clock In",
      "/workshop/Clocking",
      ["clock in", "clocking", "view clocking"],
      "Go to workshop clocking"
    );
  }

  if (
    userRoles.includes("service") ||
    userRoles.includes("admin") ||
    userRoles.some((r) => r.includes("manager"))
  ) {
    addNavItem(
      "➕ Create Job Card",
      "/job-cards/create",
      ["create job", "new job", "job card"],
      "Create a new job card"
    );
  }

  if (
    ["service manager", "workshop manager"].some((roleName) =>
      userRoles.includes(roleName)
    )
  ) {
    addNavItem(
      "🔜 Next Jobs",
      "/job-cards/waiting/nextjobs",
      ["next jobs", "waiting list", "queue"]
    );
  }

  if (viewRoles.some((r) => userRoles.includes(r))) {
    addNavItem(
      "👀 View Job Cards",
      "/job-cards/view",
      ["view job", "job cards"],
      "Browse all job cards"
    );
  }

  if (appointmentRoles.some((r) => userRoles.includes(r))) {
    addNavItem(
      "📅 Appointments",
      "/appointments",
      ["appointments", "schedule", "bookings"]
    );
  }

  if (vhcRoles.some((r) => userRoles.includes(r))) {
    addNavItem(
      "📝 VHC Dashboard",
      "/vhc/dashboard",
      ["vhc", "vehicle health check", "dashboard"]
    );
  }

  addNavItem(
    "🛎️ Workshop Check-In",
    "/workshop/check-in",
    ["check in", "arrival", "workshop"]
  );

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
                        color: isActive(link.href) ? "white" : colors.accent,
                        backgroundColor: isActive(link.href)
                          ? colors.accent
                          : "transparent",
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
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

              {userRoles.includes("techs") && (
                <>
                  <Link href="/job-cards/myjobs">
                    <span
                      style={{
                        display: "block",
                        padding: "10px",
                        borderRadius: "6px",
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

              {/* VHC Dashboard Button in Sidebar */}
              {vhcRoles.some((r) => userRoles.includes(r)) && (
                <Link href="/vhc/dashboard">
                  <span
                    style={{
                      display: "block",
                      padding: "10px",
                      marginTop: "10px",
                      borderRadius: "6px",
                      color: "white",
                      backgroundColor: colors.accent,
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    📝 VHC Dashboard
                  </span>
                </Link>
              )}
            </nav>
          </div>

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
              padding: "20px 28px",
              boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isTech
                  ? "1.2fr minmax(320px, 2.2fr) auto"
                  : "1.2fr minmax(320px, 2.2fr) 1fr",
                alignItems: "center",
                gap: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <h1
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 600,
                    margin: 0,
                    color: colors.accent,
                  }}
                >
                  Welcome back, {user?.username || "Guest"}
                </h1>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: darkMode ? "#bdbdbd" : "#666666",
                  }}
                >
                  Role: {roleDisplay}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <GlobalSearch
                  accentColor={colors.accent}
                  isDarkMode={darkMode}
                  navigationItems={navigationItems}
                />
              </div>

              {isTech && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: `1px solid ${colors.accent}`,
                      backgroundColor: darkMode ? "#1f1f1f" : "#ffffff",
                      color: colors.accent,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      minWidth: "170px",
                    }}
                  >
                    <option>Waiting for Job</option>
                    <option>In Progress</option>
                    <option>Break</option>
                    <option>Completed</option>
                  </select>
                  <button
                    type="button"
                    disabled={!currentJob?.jobNumber}
                    onClick={() => currentJob?.jobNumber && router.push(`/job-cards/myjobs/${currentJob.jobNumber}`)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: "none",
                      backgroundColor: currentJob?.jobNumber ? colors.accent : "#d1d5db",
                      color: currentJob?.jobNumber ? "#ffffff" : "#6b7280",
                      fontWeight: 600,
                      cursor: currentJob?.jobNumber ? "pointer" : "not-allowed",
                      boxShadow: currentJob?.jobNumber ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
                      transition: "background-color 0.2s ease",
                    }}
                  >
                    {currentJob?.jobNumber ? "Current Job" : "No Current Job"}
                  </button>
                </div>
              )}
            </div>
          </header>
        )}

        <main style={{ padding: "24px", boxSizing: "border-box" }}>{children}</main>
      </div>

      {canViewStatusSidebar && (
        <StatusSidebar
          jobId={activeJobId}
          currentStatus={currentJobStatus}
          isOpen={isStatusSidebarOpen}
          onToggle={() => setIsStatusSidebarOpen(!isStatusSidebarOpen)}
          onJobSearch={setSearchedJobId}
          hasUrlJobId={!!urlJobId}
        />
      )}

      {userRoles.includes("techs") && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
