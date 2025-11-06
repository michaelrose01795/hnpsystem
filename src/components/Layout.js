// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "../context/UserContext"; // import user context
import ClockInButton from "./Clocking/ClockInButton"; // import clock in button
import GlobalSearch from "./GlobalSearch"; // import global search component
import JobCardModal from "./JobCards/JobCardModal"; // import job modal
import StatusSidebar from "../components/StatusTracking/StatusSidebar"; // import status sidebar
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";

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

  const colors = darkMode ? appShellTheme.dark : appShellTheme.light;

  const [navOpenSections, setNavOpenSections] = useState(() =>
    Object.fromEntries(sidebarSections.map((section) => [section.label, true]))
  );

  const toggleNavSection = (label) => {
    setNavOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const navigationItems = [];
  const seenNavItems = new Set();
  const roleMatches = (requiredRoles = []) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.some((role) => userRoles.includes(role.toLowerCase()));
  };

  const addNavItem = (
    label,
    href,
    { keywords = [], description, section = "General", roles: requiredRoles = [] } = {}
  ) => {
    if (!roleMatches(requiredRoles)) return;
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
      section,
    });
  };

  sidebarSections.forEach((section) => {
    (section.items || []).forEach((item) => {
      addNavItem(item.label, item.href, {
        keywords: item.keywords || [],
        description: item.description,
        section: section.label,
        roles: item.roles || [],
      });
    });
  });

  if (user) {
    addNavItem("🙋 My Profile", "/profile", {
      keywords: ["profile", "employee profile", "my profile"],
      description: "View your personal employment info",
      section: "General",
    });
  }

  if (isTech) {
    addNavItem("🧰 My Jobs", "/job-cards/myjobs", {
      keywords: ["my jobs", "jobs", "tech"],
      section: "Workshop",
    });
    addNavItem("🔧 Start Job", "/job-cards/myjobs", {
      keywords: ["start job", "tech"],
      section: "Workshop",
    });
    addNavItem("Clock In", "/workshop/Clocking", {
      keywords: ["clock in", "clocking", "view clocking"],
      description: "Go to workshop clocking",
      section: "Workshop",
    });
  }

  if (
    userRoles.includes("service") ||
    userRoles.includes("admin") ||
    userRoles.some((r) => r.includes("manager"))
  ) {
    addNavItem("➕ Create Job Card", "/job-cards/create", {
      keywords: ["create job", "new job", "job card"],
      description: "Create a new job card",
      section: "Workshop",
    });
  }

  if (
    ["service manager", "workshop manager"].some((roleName) =>
      userRoles.includes(roleName)
    )
  ) {
    addNavItem("🔜 Next Jobs", "/job-cards/waiting/nextjobs", {
      keywords: ["next jobs", "waiting list", "queue"],
      section: "Workshop",
    });
  }

  if (viewRoles.some((r) => userRoles.includes(r))) {
    addNavItem("👀 View Job Cards", "/job-cards/view", {
      keywords: ["view job", "job cards"],
      description: "Browse all job cards",
      section: "Workshop",
    });
  }

  if (userRoles.includes("parts") || userRoles.includes("parts manager")) {
    addNavItem("🧰 Parts Workspace", "/parts", {
      keywords: ["parts", "inventory", "vhc parts"],
      description: "Manage parts allocations and deliveries",
      section: "Parts",
    });
  }

  if (userRoles.includes("parts manager")) {
    addNavItem("📈 Parts Manager Overview", "/parts/manager", {
      keywords: ["parts manager", "stock value", "parts dashboard"],
      description: "View stock, spending, and income KPIs",
      section: "Parts",
    });
  }

  if (appointmentRoles.some((r) => userRoles.includes(r))) {
    addNavItem("📅 Appointments", "/appointments", {
      keywords: ["appointments", "schedule", "bookings"],
      section: "Sales & Service",
    });
  }

  if (vhcRoles.some((r) => userRoles.includes(r))) {
    addNavItem("📝 VHC Dashboard", "/vhc/dashboard", {
      keywords: ["vhc", "vehicle health check", "dashboard"],
      section: "Workshop",
    });
  }

  const hrAccessRoles = ["hr manager", "admin manager", "owner", "admin"];
  if (userRoles.some((role) => hrAccessRoles.includes(role))) {
    addNavItem("👥 HR Dashboard", "/hr", {
      keywords: ["hr", "people", "culture", "training"],
      description: "Headcount, attendance, and compliance overview",
      section: "HR",
    });
    addNavItem("📇 Employee Records", "/hr/employees", {
      keywords: ["hr employees", "directory", "profiles"],
      description: "Manage employee profiles, documents, and permissions",
      section: "HR",
    });
    addNavItem("🕒 Attendance", "/hr/attendance", {
      keywords: ["attendance", "clocking", "overtime"],
      description: "Clocking logs, absences, and overtime summaries",
      section: "HR",
    });
    addNavItem("💷 Payroll", "/hr/payroll", {
      keywords: ["payroll", "pay rates", "compensation"],
      description: "Pay rates, approvals, and overtime exports",
      section: "HR",
    });
    addNavItem("🏖️ Leave", "/hr/leave", {
      keywords: ["leave", "holiday", "absence"],
      description: "Leave requests, balances, and calendar sync",
      section: "HR",
    });
    addNavItem("⭐ Performance", "/hr/performance", {
      keywords: ["performance", "reviews", "appraisals"],
      description: "Manage reviews and development plans",
      section: "HR",
    });
    addNavItem("🎓 Training", "/hr/training", {
      keywords: ["training", "qualifications"],
      description: "Track training completions and renewals",
      section: "HR",
    });
    addNavItem("⚠️ Incidents", "/hr/disciplinary", {
      keywords: ["disciplinary", "incidents"],
      description: "Log warnings and incident reports",
      section: "HR",
    });
    addNavItem("📨 Recruitment", "/hr/recruitment", {
      keywords: ["recruitment", "applicants", "jobs"],
      description: "Manage hiring pipelines and onboarding",
      section: "HR",
    });
    addNavItem("📈 HR Reports", "/hr/reports", {
      keywords: ["reports", "exports", "analytics"],
      description: "Generate HR analytics and exports",
      section: "HR",
    });
    addNavItem("⚙️ HR Settings", "/hr/settings", {
      keywords: ["settings", "policies", "access"],
      description: "Configure policies, schedules, and access",
      section: "HR",
    });
  } else if (userRoles.some((role) => role.includes("manager"))) {
    addNavItem("👥 Team HR", "/hr/employees", {
      keywords: ["team hr", "people", "hr"],
      description: "View team employee directory and leave",
      section: "HR",
    });
    addNavItem("🏖️ Leave", "/hr/leave", {
      keywords: ["leave", "holiday"],
      description: "Review departmental leave requests",
      section: "HR",
    });
  }

  if (userRoles.includes("admin manager")) {
    addNavItem("🛠️ User Admin", "/admin/users", {
      keywords: ["admin users", "create user", "user management"],
      description: "Create and manage platform accounts",
      section: "Admin",
    });
  }

  if (
    userRoles.includes("valet service") ||
    userRoles.includes("service manager") ||
    userRoles.includes("admin")
  ) {
    addNavItem("🧽 Valet Jobs", "/valet", {
      keywords: ["valet", "wash", "valeting"],
      description: "View vehicles awaiting wash",
      section: "Workshop",
    });
  }

  addNavItem("🛎️ Workshop Check-In", "/workshop/check-in", {
    keywords: ["check in", "arrival", "workshop"],
    section: "Workshop",
  });

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        background: colors.mainBg,
        color: colors.text,
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
            borderRight: `1px solid ${colors.sidebarBorder}`,
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

            <nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sidebarSections.map((section) => {
                const items = (section.items || []).filter((item) => roleMatches(item.roles));
                if (!items.length) return null;
                const isOpen = navOpenSections[section.label];
                return (
                  <div key={section.label}>
                    <button
                      type="button"
                      onClick={() => toggleNavSection(section.label)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        color: colors.accent,
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      {section.label}
                      <span>{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen &&
                      items.map((item) => (
                        <Link key={item.href} href={item.href}>
                          <span
                            style={{
                              display: "block",
                              padding: "10px",
                              borderRadius: "6px",
                              color: isActive(item.href) ? "white" : colors.accent,
                              backgroundColor: isActive(item.href)
                                ? colors.accent
                                : "transparent",
                              fontSize: "0.95rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            {item.label}
                          </span>
                        </Link>
                      ))}
                  </div>
                );
              })}

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

              {userRoles.includes("admin manager") && (
                <Link href="/admin/users">
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
                    🛠️ Manage Users
                  </span>
                </Link>
              )}

              {(userRoles.includes("parts") || userRoles.includes("parts manager")) && (
                <Link href="/parts">
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
                    🧰 Parts Workspace
                  </span>
                </Link>
              )}

              {userRoles.includes("parts manager") && (
                <Link href="/parts/manager">
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
                    📈 Parts Manager Overview
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

              {(userRoles.includes("valet service") ||
                userRoles.includes("service manager") ||
                userRoles.includes("admin")) && (
                <Link href="/valet">
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
                    🧽 Valet Jobs
                  </span>
                </Link>
              )}

            </nav>
          </div>

          <div>
            {user && (
              <Link href="/profile">
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    marginBottom: "12px",
                    borderRadius: "8px",
                    color: colors.accent,
                    backgroundColor: darkMode ? "#f9fafb" : "#eef2ff",
                    textAlign: "center",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: `1px solid ${colors.accent}`,
                  }}
                >
                  View Employee Profile
                </span>
              </Link>
            )}
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

              {userRoles.includes("admin manager") && (
                <Link
                  href="/admin/users"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "999px",
                    backgroundColor: colors.accent,
                    color: "#ffffff",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                  }}
                >
                  ➕ Create User
                </Link>
              )}

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
