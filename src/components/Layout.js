// file location: src/components/Layout.js
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "../context/UserContext"; // import user context
import GlobalSearch from "./GlobalSearch"; // import global search component
import JobCardModal from "./JobCards/JobCardModal"; // import job modal
import StatusSidebar from "../components/StatusTracking/StatusSidebar"; // import status sidebar
import Sidebar from "./Sidebar";
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";

export default function Layout({ children }) {
  const { user, status, setStatus, currentJob } = useUser(); // get user context data
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";

  const getViewportWidth = () =>
    typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1440;

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusSidebarOpen, setIsStatusSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 640;
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

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
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(getViewportWidth());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isTablet) setIsMobileMenuOpen(false);
  }, [isTablet]);

  useEffect(() => {
    if (typeof window === "undefined" || !isMobileMenuOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

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

  const colors = appShellTheme.light;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [contentKey, setContentKey] = useState(() => router.asPath || "initial");

  useEffect(() => {
    if (isTablet) {
      setIsSidebarOpen(false);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebarOpen");
    if (stored !== null) {
      setIsSidebarOpen(stored === "true");
    } else {
      setIsSidebarOpen(true);
    }
  }, [isTablet]);

  useEffect(() => {
    if (typeof window === "undefined" || isTablet) return;
    window.localStorage.setItem("sidebarOpen", isSidebarOpen ? "true" : "false");
  }, [isSidebarOpen, isTablet]);

  useEffect(() => {
    setContentKey(router.asPath || `${router.pathname}-${Date.now()}`);
  }, [router.asPath, router.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !router?.events) return;

    const userAgent = window.navigator?.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (userAgent.includes("Macintosh") && "ontouchend" in document);

    if (!isIOS) return;

    const triggerRepaint = () => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        document.body.style.transform = "translateZ(0)";
        setTimeout(() => {
          document.body.style.transform = "";
        }, 120);
      });
    };

    router.events.on("routeChangeComplete", triggerRepaint);
    router.events.on("routeChangeError", triggerRepaint);

    return () => {
      router.events.off("routeChangeComplete", triggerRepaint);
      router.events.off("routeChangeError", triggerRepaint);
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined" || !router?.events) return;

    const userAgent = window.navigator?.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (userAgent.includes("Macintosh") && "ontouchend" in document);

    if (!isIOS) return;

    let pendingUrl = null;

    const handleStart = (url) => {
      pendingUrl = url;
    };

    const handleComplete = (url) => {
      if (!pendingUrl || !url) {
        pendingUrl = null;
        return;
      }
      if (pendingUrl === url) {
        pendingUrl = null;
        window.location.assign(url);
      }
    };

    const handleError = () => {
      pendingUrl = null;
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleComplete);
    router.events.on("routeChangeError", handleError);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleComplete);
      router.events.off("routeChangeError", handleError);
    };
  }, [router]);

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

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const mainColumnMaxWidth = "100%";
  const topBarOffset = hideSidebar ? 0 : isTablet ? 110 : 150;
  const layoutStyles = {
    display: "flex",
    flexDirection: isTablet ? "column" : "row",
    minHeight: "100vh",
    width: "100%",
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
    background: colors.background || colors.mainBg,
    color: colors.text,
    justifyContent: "flex-start",
    alignItems: "stretch",
    gap: isTablet ? "12px" : "24px",
    padding: hideSidebar ? "0" : isTablet ? "12px" : "0 16px",
    boxSizing: "border-box",
    overflowX: "hidden",
    overflowY: "auto",
  };
  const showDesktopSidebar = !hideSidebar && !isTablet;
  const showMobileSidebar = !hideSidebar && isTablet;

  return (
    <div style={layoutStyles}>
      {showDesktopSidebar && (
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
            <Sidebar onToggle={toggleSidebar} />
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
        style={{
          flex: 1,
          maxWidth: mainColumnMaxWidth,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: hideSidebar ? 0 : isTablet ? "16px" : "20px",
          padding: hideSidebar ? "0" : isTablet ? "16px 12px" : "24px 16px",
          background: colors.mainBg,
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {showMobileSidebar && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: colors.mainBg,
                padding: "8px 0",
              }}
            >
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.accent}`,
                  background: "linear-gradient(90deg, #ffffff, #fff5f5)",
                  fontWeight: 600,
                  color: colors.accent,
                  boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                }}
              >
                ☰ Navigation
              </button>
            </div>

            {isMobileMenuOpen && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 120,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "stretch",
                }}
              >
                <div
                  onClick={closeMobileMenu}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15,15,15,0.65)",
                    backdropFilter: "blur(2px)",
                  }}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "min(420px, 100%)",
                    maxWidth: "100%",
                    height: "100%",
                    background: colors.mainBg,
                    borderTopLeftRadius: "28px",
                    borderBottomLeftRadius: "28px",
                    boxShadow: "-20px 0 40px rgba(0,0,0,0.35)",
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={closeMobileMenu}
                      style={{
                        border: "none",
                        background: "rgba(0,0,0,0.05)",
                        color: colors.text,
                        borderRadius: "12px",
                        padding: "8px 14px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Close ✕
                    </button>
                  </div>
                  <Sidebar onToggle={closeMobileMenu} isCondensed />
                </div>
              </div>
            )}
          </>
        )}

        {!hideSidebar && ( // render the modern compact header when the sidebar is visible
          <section
            style={{
              background: "rgba(255,255,255,0.92)", // soften the header background
              borderRadius: "16px", // tighten radius for slimmer appearance
              border: "1px solid rgba(209,0,0,0.12)", // introduce subtle red border accent
              boxShadow: "0 10px 20px rgba(209,0,0,0.12)", // lighten drop shadow for depth without bulk
              padding: isMobile ? "10px 12px" : "12px 14px", // reduce padding to shrink header height
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "8px" : "12px",
              backdropFilter: "blur(10px)", // add subtle glassmorphism effect
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                justifyContent: "space-between", // keep header content balanced edge to edge
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: isMobile ? "100%" : "220px",
                  flex: "1 1 220px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.55rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: colors.mutedText,
                  }}
                >
                  Operations Overview
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <h1
                    style={{
                      fontSize: isMobile ? "1rem" : "1.15rem",
                      fontWeight: 700,
                      margin: 0,
                      color: colors.accent,
                      lineHeight: 1.1,
                    }}
                  >
                    Welcome back, {user?.username || "Guest"}
                  </h1>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      background: "rgba(209,0,0,0.12)",
                      color: colors.accent,
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  >
                    Role: {roleDisplay}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flex: "1 1 280px",
                  minWidth: isTablet ? "100%" : "280px",
                  justifyContent: isTablet ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    flex: "1 1 220px",
                    minWidth: "180px",
                    width: "100%",
                    maxWidth: isMobile ? "100%" : "260px",
                  }}
                >
                  <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />{/* expose global search with brand accent */}
                </div>

                {userRoles.includes("admin manager") &&
                  ( // quick access for administrators to add new users
                    <Link
                      href="/admin/users"
                      style={{
                        padding: "8px 14px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #d10000, #a60000)",
                        color: "#ffffff",
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: "0 12px 20px rgba(209,0,0,0.22)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      ➕ Create User
                    </Link>
                  )}
              </div>
            </div>

            {isTech && ( // show quick status controls for technicians
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "center",
                  justifyContent: "flex-start", // align controls neatly to the left for readability
                }}
              >
                {(
                  // quick status dropdown for workshop techs
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "12px",
                      border: `1px solid ${colors.accent}`,
                      backgroundColor: "#ffffff",
                      color: colors.accent,
                      fontWeight: 600,
                      cursor: "pointer",
                      minWidth: isMobile ? "100%" : "150px",
                      boxShadow: "0 4px 10px rgba(209,0,0,0.12)",
                    }}
                  >
                    <option>Waiting for Job</option>
                    <option>In Progress</option>
                    <option>Break</option>
                    <option>Completed</option>
                  </select>
                )}
                {(
                  // shortcut button to open the currently assigned job card
                  <button
                    type="button"
                    disabled={!currentJob?.jobNumber}
                    onClick={() =>
                      currentJob?.jobNumber && router.push(`/job-cards/myjobs/${currentJob.jobNumber}`)
                    }
                    style={{
                      padding: "5px 14px",
                      borderRadius: "12px",
                      border: "none",
                      background: currentJob?.jobNumber
                        ? "linear-gradient(135deg, #d10000, #a00000)"
                        : "#f3f4f6",
                      color: currentJob?.jobNumber ? "#ffffff" : "#9ca3af",
                      fontWeight: 600,
                      cursor: currentJob?.jobNumber ? "pointer" : "not-allowed",
                      boxShadow: currentJob?.jobNumber
                        ? "0 8px 18px rgba(209,0,0,0.18)"
                        : "none",
                      transition: "all 0.2s ease",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {currentJob?.jobNumber ? `Open Job ${currentJob.jobNumber}` : "No Current Job"}
                  </button>
                )}
              </div>
            )}
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
            key={contentKey}
            style={{
              height: "100%",
              minHeight: hideSidebar ? "100vh" : `calc(100vh - ${topBarOffset}px)`,
              background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
              borderRadius: hideSidebar ? "0px" : "28px",
              border: hideSidebar ? "none" : "1px solid #ffe0e0",
              boxShadow: hideSidebar ? "none" : "0 32px 64px rgba(209,0,0,0.1)",
              padding: hideSidebar ? "0" : isMobile ? "18px 14px" : "32px",
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
          viewportWidth={viewportWidth}
          isCompact={isTablet}
        />
      )}

      {userRoles.includes("techs") && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
