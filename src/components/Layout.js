// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "../context/UserContext"; // import user context
import ClockInButton from "./Clocking/ClockInButton"; // import clock in button
import GlobalSearch from "./GlobalSearch"; // import global search component
import JobCardModal from "./JobCards/JobCardModal"; // import job modal
import StatusSidebar from "../components/StatusTracking/StatusSidebar"; // import status sidebar
import Sidebar from "./Sidebar";
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
  const isPartsUser = userRoles.some(
    (role) => role === "parts" || role === "parts manager"
  );
  const trackingAccessRoles = [
    "techs",
    "service",
    "service manager",
    "workshop manager",
    "valet service",
    "admin",
  ];
  const canAccessTracking = userRoles.some((role) =>
    trackingAccessRoles.includes(role)
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

  const isUserLoading = user === undefined && !hideSidebar;

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
    "parts",
    "parts manager",
  ];
  const isActive = (path) => router.pathname.startsWith(path);

  const colors = darkMode ? appShellTheme.dark : appShellTheme.light;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebarOpen");
    if (stored !== null) {
      setIsSidebarOpen(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sidebarOpen", isSidebarOpen ? "true" : "false");
  }, [isSidebarOpen]);

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

  const isRouteActive = (href) => {
    if (!href) return false;
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const mainColumnMaxWidth = hideSidebar
    ? "100%"
    : isSidebarOpen
    ? "1080px"
    : "1240px";
  const topBarOffset = hideSidebar ? 0 : 150;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
        background: colors.background || colors.mainBg,
        color: colors.text,
        justifyContent: "center",
        gap: "24px",
        padding: hideSidebar ? "0" : "0 16px",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      {!hideSidebar && (
        <div
          style={{
            width: isSidebarOpen ? "260px" : "64px",
            padding: "16px 0",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            transition: "width 0.25s ease",
            position: "relative",
          }}
        >
          {isSidebarOpen ? (
            <>
              <Sidebar onToggle={toggleSidebar} />

              <div
                style={{
                  width: "220px",
                  background: "linear-gradient(135deg, rgba(209,0,0,0.95), rgba(160,0,0,0.95))",
                  borderRadius: "16px",
                  padding: "18px",
                  color: "#ffffff",
                  boxShadow: "0 15px 35px rgba(161,0,0,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <button
                  onClick={() => setDarkMode((prev) => !prev)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    backgroundColor: "#ffffff",
                    color: colors.accent,
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>

                {userRoles.includes("techs") && (
                  <>
                    <Link
                      href="/job-cards/myjobs"
                      style={{
                        textDecoration: "none",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "12px",
                          backgroundColor: isRouteActive("/job-cards/myjobs")
                            ? "#ffffff"
                            : "rgba(255,255,255,0.12)",
                          border: isRouteActive("/job-cards/myjobs")
                            ? `1px solid ${colors.accent}`
                            : "1px solid rgba(255,255,255,0.3)",
                          color: isRouteActive("/job-cards/myjobs") ? colors.accent : "#ffffff",
                          boxShadow: isRouteActive("/job-cards/myjobs")
                            ? "0 10px 25px rgba(0,0,0,0.12)"
                            : "none",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      >
                        🧰 My Jobs
                      </div>
                    </Link>

                    <button
                      onClick={() => setIsModalOpen(true)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        border: "1px dashed rgba(255,255,255,0.5)",
                        backgroundColor: "transparent",
                        color: "#ffffff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🔧 Start Job
                    </button>
                  </>
                )}

                {(userRoles.includes("service") ||
                  userRoles.includes("admin") ||
                  userRoles.some((r) => r.includes("manager"))) && (
                  <Link href="/job-cards/create" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isRouteActive("/job-cards/create") ? "#ffffff" : "rgba(255,255,255,0.12)",
                        color: isRouteActive("/job-cards/create") ? colors.accent : "#ffffff",
                        border: isRouteActive("/job-cards/create")
                          ? `1px solid ${colors.accent}`
                          : "1px solid rgba(255,255,255,0.3)",
                        fontWeight: 700,
                        textAlign: "center",
                        boxShadow: isRouteActive("/job-cards/create")
                          ? "0 10px 25px rgba(0,0,0,0.12)"
                          : "none",
                      }}
                    >
                      ➕ Create Job Card
                    </div>
                  </Link>
                )}

                {["service manager", "workshop manager"].some((r) =>
                  userRoles.includes(r.toLowerCase())
                ) && (
                  <Link href="/job-cards/waiting/nextjobs" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isRouteActive("/job-cards/waiting/nextjobs")
                          ? "#ffffff"
                          : "rgba(255,255,255,0.12)",
                        border: isRouteActive("/job-cards/waiting/nextjobs")
                          ? `1px solid ${colors.accent}`
                          : "1px solid rgba(255,255,255,0.3)",
                        fontWeight: 600,
                        textAlign: "center",
                        color: isRouteActive("/job-cards/waiting/nextjobs") ? colors.accent : "#ffffff",
                        boxShadow: isRouteActive("/job-cards/waiting/nextjobs")
                          ? "0 10px 25px rgba(0,0,0,0.12)"
                          : "none",
                      }}
                    >
                      🔜 Next Jobs
                    </div>
                  </Link>
                )}

                {canAccessTracking && (
                  <Link href="/tracking" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isRouteActive("/tracking") ? "#ffffff" : "rgba(255,255,255,0.12)",
                        border: isRouteActive("/tracking")
                          ? `1px solid ${colors.accent}`
                          : "1px solid rgba(255,255,255,0.3)",
                        fontWeight: 600,
                        textAlign: "center",
                        color: isRouteActive("/tracking") ? colors.accent : "#ffffff",
                        boxShadow: isRouteActive("/tracking") ? "0 10px 25px rgba(0,0,0,0.12)" : "none",
                      }}
                    >
                      🚗 Tracking Hub
                    </div>
                  </Link>
                )}

                {isPartsUser && (
                  <Link href="/vhc/dashboard" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isRouteActive("/vhc/dashboard") ? "#ffffff" : "rgba(255,255,255,0.12)",
                        color: isRouteActive("/vhc/dashboard") ? colors.accent : "#ffffff",
                        border: isRouteActive("/vhc/dashboard")
                          ? `1px solid ${colors.accent}`
                          : "1px solid rgba(255,255,255,0.3)",
                        fontWeight: 700,
                        textAlign: "center",
                        boxShadow: isRouteActive("/vhc/dashboard")
                          ? "0 10px 25px rgba(0,0,0,0.12)"
                          : "none",
                      }}
                    >
                      🧾 Parts VHC Dashboard
                    </div>
                  </Link>
                )}

                {(userRoles.includes("valet service") ||
                  userRoles.includes("service manager") ||
                  userRoles.includes("admin")) && (
                  <Link href="/valet" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isRouteActive("/valet") ? "#ffffff" : "rgba(255,255,255,0.12)",
                        border: isRouteActive("/valet")
                          ? `1px solid ${colors.accent}`
                          : "1px solid rgba(255,255,255,0.3)",
                        fontWeight: 600,
                        textAlign: "center",
                        color: isRouteActive("/valet") ? colors.accent : "#ffffff",
                        boxShadow: isRouteActive("/valet")
                          ? "0 10px 25px rgba(0,0,0,0.12)"
                          : "none",
                      }}
                    >
                      🧽 Valet Jobs
                    </div>
                  </Link>
                )}

                {user && (
                  <Link href="/profile" style={{ textDecoration: "none", width: "100%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        border: "1px solid rgba(255,255,255,0.35)",
                        fontWeight: 600,
                        textAlign: "center",
                        color: "#ffffff",
                      }}
                    >
                      View Employee Profile
                    </div>
                  </Link>
                )}

                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    backgroundColor: "#000000",
                    color: "#ffffff",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    marginTop: "4px",
                  }}
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                border: "1px solid rgba(209,0,0,0.25)",
                backgroundColor: "#ffffff",
                color: colors.accent,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              }}
            >
              ⟩
            </button>
          )}
        </div>
      )}

      <div
        data-loader-region="main"
        style={{
          flex: 1,
          maxWidth: mainColumnMaxWidth,
          display: "flex",
          flexDirection: "column",
          gap: hideSidebar ? 0 : "20px",
          padding: hideSidebar ? "0" : "24px 16px",
          background: colors.mainBg,
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isUserLoading && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  padding: "32px 40px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.9)",
                  boxShadow: "0 20px 45px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  minWidth: "220px",
                  minHeight: "120px",
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                <img
                  src="/images/loading_car.png"
                  alt="Loading indicator"
                  style={{
                    width: "140px",
                    animation: "layoutLoaderSlide 3s ease-in-out infinite",
                    filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.25))",
                  }}
                />
              </div>
            </div>
            <style jsx>{`
              @keyframes layoutLoaderSlide {
                0% {
                  transform: translateX(-20%) translateY(0);
                }
                50% {
                  transform: translateX(20%) translateY(-6px);
                }
                100% {
                  transform: translateX(-20%) translateY(0);
                }
              }
            `}</style>
          </>
        )}
        {!hideSidebar && (
          <section
            style={{
              background: "linear-gradient(135deg, #ffffff, #fff7f7)",
              borderRadius: "24px",
              border: "1px solid #ffe0e0",
              boxShadow: "0 18px 40px rgba(209,0,0,0.12)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "stretch",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flex: 1,
                  minWidth: "320px",
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    minWidth: "190px",
                    flex: "0 0 auto",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.65rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: colors.mutedText,
                    }}
                  >
                    Operations Overview
                  </p>
                  <h1
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      margin: 0,
                      color: colors.accent,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Welcome back, {user?.username || "Guest"}
                  </h1>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    flex: 1,
                    minWidth: "200px",
                  }}
                >
                  {[
                    { label: "Active Role", value: roleDisplay || "Guest" },
                    { label: "Focus Status", value: status || "Waiting for Job" },
                    {
                      label: "Current Job",
                      value: currentJob?.jobNumber ? `#${currentJob.jobNumber}` : "None assigned",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        borderRadius: "14px",
                        border: "1px solid #ffe0e0",
                        backgroundColor: "#fff5f5",
                        padding: "10px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        minWidth: "160px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.65rem",
                          letterSpacing: "0.08em",
                          color: "#b91c1c",
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        {item.label}
                      </span>
                      <strong style={{ fontSize: "0.9rem", color: colors.text }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: "0 1 360px", minWidth: "220px", maxWidth: "380px" }}>
                <GlobalSearch accentColor={colors.accent} isDarkMode={darkMode} navigationItems={navigationItems} />
              </div>

              {userRoles.includes("admin manager") && (
                <Link
                  href="/admin/users"
                  style={{
                    padding: "9px 16px",
                    borderRadius: "999px",
                    backgroundColor: colors.accent,
                    color: "#ffffff",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 10px 18px rgba(209,0,0,0.22)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  ➕ Create User
                </Link>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  color: colors.mutedText,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                Role: {roleDisplay}
              </span>

              {isTech && (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: `1px solid ${colors.accent}`,
                      backgroundColor: "#ffffff",
                      color: colors.accent,
                      fontWeight: 600,
                      cursor: "pointer",
                      minWidth: "170px",
                      boxShadow: "0 6px 16px rgba(209,0,0,0.15)",
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
                    onClick={() =>
                      currentJob?.jobNumber && router.push(`/job-cards/myjobs/${currentJob.jobNumber}`)
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: "none",
                      background: currentJob?.jobNumber
                        ? "linear-gradient(90deg, #d10000, #a00000)"
                        : "#f3f4f6",
                      color: currentJob?.jobNumber ? "#ffffff" : "#9ca3af",
                      fontWeight: 600,
                      cursor: currentJob?.jobNumber ? "pointer" : "not-allowed",
                      boxShadow: currentJob?.jobNumber
                        ? "0 10px 24px rgba(209,0,0,0.25)"
                        : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {currentJob?.jobNumber ? `Open Job ${currentJob.jobNumber}` : "No Current Job"}
                  </button>
                </div>
              )}

              <div style={{ flexShrink: 0 }}>
                <ClockInButton />
              </div>
            </div>
          </section>
        )}

        <main
          style={{
            flex: 1,
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              minHeight: hideSidebar ? "100vh" : `calc(100vh - ${topBarOffset}px)`,
              background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
              borderRadius: hideSidebar ? "0px" : "28px",
              border: hideSidebar ? "none" : "1px solid #ffe0e0",
              boxShadow: hideSidebar ? "none" : "0 32px 64px rgba(209,0,0,0.1)",
              padding: hideSidebar ? "0" : "32px",
              overflow: "auto",
            }}
          >
            {children}
          </div>
        </main>
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
