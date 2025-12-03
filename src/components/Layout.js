// file location: src/components/Layout.js
// Edit: Add status button next to navigation on phone view, make all top controls scroll with page
// ✅ Imports converted to use absolute alias "@/"
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context
import GlobalSearch from "@/components/GlobalSearch"; // import global search component
import JobCardModal from "@/components/JobCards/JobCardModal"; // import job modal
import StatusSidebar from "@/components/StatusTracking/StatusSidebar"; // import status sidebar
import JobTimeline from "@/components/Timeline/JobTimeline";
import Sidebar from "@/components/Sidebar";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import TopbarAlerts, { AlertBadge } from "@/components/TopbarAlerts";
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";
import { useRoster } from "@/context/RosterContext";
import HrTabsBar from "@/components/HR/HrTabsBar";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { roleCategories } from "@/config/users";

const WORKSHOP_SHORTCUT_ROLES = ["workshop manager", "aftersales manager"];

const WORKSHOP_SHORTCUT_LINKS = [
  {
    label: "⏱️ Clocking",
    href: "/clocking",
    roles: WORKSHOP_SHORTCUT_ROLES,
    keywords: ["clocking", "time", "overview"],
    description: "Unified clocking workspace",
  },
];

const WORKSHOP_SHORTCUT_SECTIONS = [
  {
    label: "Workshop Shortcuts",
    category: "departments",
    items: WORKSHOP_SHORTCUT_LINKS,
  },
];

const SERVICE_ACTION_ROLES = new Set([
  "service",
  "service department",
  "service dept",
  "service manager",
  "workshop manager",
  "after sales manager",
  "after sales director",
  "aftersales manager",
]);

const PARTS_NAV_ROLES = new Set(["parts", "parts manager"]);

const SERVICE_ACTION_LINKS = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/workshop/check-in" },
];

const MODE_STORAGE_KEY = "appModeSelection";
const MODE_ROLE_MAP = {
  Retail: new Set((roleCategories.Retail || []).map((role) => role.toLowerCase())),
  Sales: new Set((roleCategories.Sales || []).map((role) => role.toLowerCase())),
};
const NAV_DRAWER_WIDTH = 260;

export default function Layout({ children, jobNumber }) {
  const { user, status, setStatus, currentJob, dbUserId } = useUser(); // get user context data
  const { usersByRole } = useRoster();
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";
  const showHrTabs = router.pathname.startsWith("/hr") || router.pathname.startsWith("/admin/users");

  const getViewportWidth = () =>
    typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1440;

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());
  const { unreadCount: messagesUnread } = useMessagesBadge(dbUserId);

  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 640; // phone view cutoff
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusSidebarOpen, setIsStatusSidebarOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  const urlJobId =
    router.query.id ||
    router.query.jobId ||
    router.query.jobNumber ||
    router.query.jobnumber ||
    router.query.job ||
    null;
  const [searchedJobId, setSearchedJobId] = useState(null);
  const [isAutoJobCleared, setIsAutoJobCleared] = useState(false);
  const hasActiveAutoJob = !!(urlJobId && !isAutoJobCleared);
  const activeJobId = searchedJobId || (hasActiveAutoJob ? urlJobId : null);
  const timelineJobNumber = jobNumber || activeJobId || currentJob?.jobNumber || null;
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

  const rawUserRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const availableModes = Object.entries(MODE_ROLE_MAP).reduce((acc, [mode, roleSet]) => {
    if (rawUserRoles.some((role) => roleSet.has(role))) {
      acc.push(mode);
    }
    return acc;
  }, []);
  const [selectedMode, setSelectedMode] = useState(() =>
    availableModes.length === 1 ? availableModes[0] : null
  );
  const availableModesKey = availableModes.join("|");

  useEffect(() => {
    if (availableModes.length === 0) {
      if (selectedMode !== null) {
        setSelectedMode(null);
      }
      return;
    }
    if (availableModes.length === 1) {
      if (selectedMode !== availableModes[0]) {
        setSelectedMode(availableModes[0]);
      }
      return;
    }
    if (selectedMode && availableModes.includes(selectedMode)) {
      return;
    }
    if (typeof window !== "undefined") {
      const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (storedMode && availableModes.includes(storedMode)) {
        setSelectedMode(storedMode);
        return;
      }
    }
    setSelectedMode(availableModes[0]);
  }, [availableModesKey, selectedMode]);

  useEffect(() => {
    if (!selectedMode) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_STORAGE_KEY, selectedMode);
  }, [selectedMode]);

  const modeRoleSet = selectedMode ? MODE_ROLE_MAP[selectedMode] : null;
  const scopedRoles =
    availableModes.length > 1 && modeRoleSet
      ? rawUserRoles.filter((role) => modeRoleSet.has(role))
      : rawUserRoles;
  const userRoles = scopedRoles.length > 0 ? scopedRoles : rawUserRoles;
  const activeModeLabel = selectedMode || availableModes[0] || null;

  const matchesDepartment = (rolesToMatch = []) => {
    if (!rolesToMatch || rolesToMatch.length === 0) return true;
    return rolesToMatch.some((roleName) => userRoles.includes(roleName));
  };
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) =>
    matchesDepartment(shortcut.roles || [])
  );
  const canUseServiceActions = userRoles.some((role) => SERVICE_ACTION_ROLES.has(role));
  const retailManagerDashboardRoles = ["service manager", "workshop manager", "after sales director"];
  const hasRetailDashboardAccess = userRoles.some((role) =>
    retailManagerDashboardRoles.includes(role)
  );
  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];
  const allowedTechNames = new Set([...techsList, ...motTestersList]);
  const normalizedUsername = typeof user?.username === "string" ? user.username.trim() : "";
  const hasTechRole = userRoles.some((role) => role.includes("tech") || role.includes("mot"));
  const isTech = (normalizedUsername && allowedTechNames.has(normalizedUsername)) || hasTechRole;
  const canViewStatusSidebar = userRoles.some((role) =>
    statusSidebarRoles.includes(role)
  );
  const hasPartsAccess = userRoles.some((role) => PARTS_NAV_ROLES.has(role));
  const isPartsManager = userRoles.includes("parts manager");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(getViewportWidth());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsStatusSidebarOpen(false);
  }, [isTablet]);

  useEffect(() => {
    if (typeof window === "undefined" || !isTablet || !isSidebarOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, isTablet]);

  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  useEffect(() => {
    if (activeJobId) fetchCurrentJobStatus(activeJobId);
  }, [activeJobId]);

  useEffect(() => {
    if (urlJobId) {
      setSearchedJobId(null);
      setIsAutoJobCleared(false);
    }
  }, [urlJobId]);

  const handleJobSearch = (jobId) => {
    setSearchedJobId(jobId);
    setIsAutoJobCleared(false);
  };

  const handleJobClear = () => {
    setSearchedJobId(null);
    if (urlJobId) {
      setIsAutoJobCleared(true);
    }
  };

  const handleModeSelect = (mode) => {
    if (!mode || mode === selectedMode) return;
    setSelectedMode(mode);
  };

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
  const vhcAccessRoles = new Set([
    "admin",
    "service",
    "service manager",
    "workshop manager",
    "after sales director",
    "general manager",
    "parts",
    "parts manager",
  ]);
  const isActive = (path) => router.pathname.startsWith(path);

  const colors = appShellTheme.light;
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

  const serviceSidebarSections = WORKSHOP_SHORTCUT_SECTIONS;
  const combinedSidebarSections = [...sidebarSections, ...serviceSidebarSections];
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

  combinedSidebarSections.forEach((section) => {
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
    addNavItem("📝 Request Consumables", "/tech/consumables-request", {
      keywords: ["consumables", "request", "supplies"],
      description: "Submit consumable restock requests to management",
      section: "Workshop",
    });
  }

  if (
    ["service manager", "workshop manager", "admin manager"].some((roleName) =>
      userRoles.includes(roleName)
    )
  ) {
    addNavItem("🔜 Next Jobs", "/job-cards/waiting/nextjobs", {
      keywords: ["next jobs", "waiting list", "queue"],
      section: "Workshop",
    });
  }

  if (userRoles.includes("workshop manager")) {
    addNavItem("🧾 Consumables Tracker", "/workshop/consumables-tracker", {
      keywords: ["consumables", "tracker", "budget"],
      description: "Monitor consumable spend, reminders, and supplier details",
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

  if (hasPartsAccess) {
    addNavItem("🧰 Parts Workspace", "/parts", {
      keywords: ["parts", "inventory", "vhc parts"],
      description: "Manage parts allocations and deliveries",
      section: "Parts",
    });
    addNavItem("🚚 Deliveries", "/parts/deliveries", {
      keywords: ["parts deliveries", "goods in", "stock"],
      description: "Review inbound deliveries and update stock",
      section: "Parts",
    });
    addNavItem("🗓️ Delivery Planner", "/parts/delivery-planner", {
      keywords: ["delivery planner", "routes", "outbound"],
      description: "Plan outbound parts run timing, stops, and costs",
      section: "Parts",
    });
  }

  if (isPartsManager) {
    addNavItem("📈 Parts Manager Dashboard", "/parts/manager", {
      keywords: ["parts manager", "stock value", "parts dashboard"],
      description: "View stock, spending, and income KPIs",
      section: "Parts",
    });
  }

  if (userRoles.some((role) => vhcAccessRoles.has(role))) {
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

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const mainColumnMaxWidth = "100%";
  const layoutStyles = {
    display: "flex",
    flexDirection: isTablet ? "column" : "row",
    height: "auto",
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
    overflow: "visible",
  };
  const showDesktopSidebar = !hideSidebar && !isTablet;
  const showMobileSidebar = !hideSidebar && isTablet;
  const showDesktopStatusControls = canViewStatusSidebar && !isTablet;
  const showMobileStatusSidebar = canViewStatusSidebar && isTablet && isStatusSidebarOpen;
  const mobileDrawerWidth = Math.min(420, viewportWidth);
  const navDrawerTargetWidth = isTablet ? mobileDrawerWidth : NAV_DRAWER_WIDTH;
  const navButtonPaddingOffset = !isTablet && !hideSidebar ? 16 : 0;
  const navToggleButtonLeft = isSidebarOpen
    ? `${navDrawerTargetWidth + navButtonPaddingOffset}px`
    : "0px";
  const showNavToggleButton = !hideSidebar;

  return (
    <div style={layoutStyles}>
      {showDesktopSidebar && (
        <div
          style={{
            width: isSidebarOpen ? `${NAV_DRAWER_WIDTH}px` : "0px",
            padding: "16px 0",
            alignSelf: "stretch",
            height: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            transition: "width 0.25s ease",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {isSidebarOpen && (
            <Sidebar
              onToggle={!isTablet ? undefined : closeSidebar}
              extraSections={serviceSidebarSections}
              visibleRoles={userRoles}
              modeLabel={activeModeLabel}
            />
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
          height: "auto",
          maxHeight: "none",
          overflowY: "visible", // allow full page scroll across breakpoints
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {showMobileSidebar && (
          <>
            {canViewStatusSidebar && (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsStatusSidebarOpen(true)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.accent}`,
                    background: "linear-gradient(90deg, #fff5f5, #ffffff)",
                    fontWeight: 600,
                    color: colors.accent,
                    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span role="img" aria-hidden="true">
                    📊
                  </span>
                  Status
                </button>
              </div>
            )}

            {isSidebarOpen && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 150,
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                }}
              >
                <div
                  onClick={closeSidebar}
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
                    width: `${mobileDrawerWidth}px`,
                    maxWidth: "100%",
                    height: "100%",
                    background: colors.mainBg,
                    borderTopRightRadius: "28px",
                    borderBottomRightRadius: "28px",
                    boxShadow: "20px 0 40px rgba(0,0,0,0.35)",
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    overflowY: "auto",
                  }}
                >
                  <Sidebar
                    onToggle={closeSidebar}
                    isCondensed
                    extraSections={serviceSidebarSections}
                    visibleRoles={userRoles}
                    modeLabel={activeModeLabel}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {!hideSidebar && (
          <section
            style={{
              background: "rgba(255,255,255,0.92)",
              borderRadius: "16px",
              border: "1px solid rgba(209,0,0,0.12)",
              boxShadow: "0 10px 20px rgba(209,0,0,0.12)",
              padding: isMobile ? "10px 12px" : "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "8px" : "12px",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                justifyContent: "space-between",
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
                  {availableModes.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: colors.mutedText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Mode
                      </span>
                      {availableModes.length > 1 ? (
                        <select
                          value={selectedMode || activeModeLabel || ""}
                          onChange={(event) => handleModeSelect(event.target.value)}
                          style={{
                            borderRadius: "999px",
                            border: "1px solid rgba(209,0,0,0.3)",
                            padding: "4px 12px",
                            background: "#fff5f5",
                            color: colors.accent,
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          {availableModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "999px",
                            background: "rgba(16,185,129,0.15)",
                            color: "#047857",
                          }}
                        >
                          {activeModeLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {canUseServiceActions && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    justifyContent: isTablet ? "flex-start" : "center",
                    alignItems: "center",
                    flex: "1 1 260px",
                    minWidth: isMobile ? "100%" : "260px",
                  }}
                >
                  {SERVICE_ACTION_LINKS.map((action) => {
                    const active =
                      router.pathname === action.href ||
                      router.pathname.startsWith(`${action.href}/`);
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "999px",
                          border: active ? "1px solid #b10000" : "1px solid #ffe0e0",
                          backgroundColor: active ? "#b10000" : "#fff5f5",
                          color: active ? "#ffffff" : "#720000",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          boxShadow: active
                            ? "0 12px 24px rgba(177, 0, 0, 0.2)"
                            : "0 6px 16px rgba(209, 0, 0, 0.1)",
                          transition:
                            "background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              )}

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
                    position: "relative",
                  }}
                >
                  <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />
                  <AlertBadge />
                </div>

                <div
                  style={{
                    flexShrink: 0,
                  }}
                >
                  <NextActionPrompt />
                </div>

                {hasPartsAccess && (
                  <Link
                    href="/parts/deliveries"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "14px",
                      border: "1px solid #ffe0e0",
                      background: "#fff5f5",
                      color: "#720000",
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 6px 16px rgba(209,0,0,0.12)",
                    }}
                  >
                    <span role="img" aria-label="deliveries">
                      🚚
                    </span>
                    Deliveries
                  </Link>
                )}
                <Link
                  href="/messages"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "14px",
                    border: "1px solid #ffe0e0",
                    background: "#fff5f5",
                    color: "#720000",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 6px 16px rgba(209,0,0,0.12)",
                  }}
                >
                  <span role="img" aria-label="messages">
                    📨
                  </span>
                  Messages
                  {messagesUnread > 0 && (
                    <span
                      style={{
                        minWidth: 24,
                        minHeight: 24,
                        padding: "0 6px",
                        borderRadius: 999,
                        background: "#d10000",
                        color: "#ffffff",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {messagesUnread > 99 ? "99+" : messagesUnread}
                    </span>
                  )}
                </Link>

                {userRoles.includes("admin manager") && (
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

            {isTech && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
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
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "12px",
                    border: "1px solid #d10000",
                    background: "#ffffff",
                    color: "#d10000",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 6px 14px rgba(209,0,0,0.12)",
                    transition: "all 0.2s ease",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Start Job
                </button>
              </div>
            )}
          </section>
        )}

        <main
          style={{
            flex: 1,
            minHeight: 0,
            height: "auto",
            overflow: "visible",
          }}
        >
          <div
            key={contentKey}
            style={{
              minHeight: "100%",
              background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
              borderRadius: hideSidebar ? "0px" : "28px",
              border: hideSidebar ? "none" : "1px solid #ffe0e0",
              boxShadow: hideSidebar ? "none" : "0 32px 64px rgba(209,0,0,0.1)",
              padding: hideSidebar ? "0" : isMobile ? "18px 14px" : "32px",
              overflow: "visible",
            }}
          >
            {showHrTabs && <HrTabsBar />}
            {children}
          </div>
        </main>
      </div>

      {showNavToggleButton && (
        <button
          type="button"
          onClick={toggleSidebar}
          style={{
            position: "fixed",
            top: "50%",
            left: navToggleButtonLeft,
            transform: "translateY(-50%)",
            width: "52px",
            height: "52px",
            borderRadius: "0 999px 999px 0",
            border: "none",
            background: isSidebarOpen
              ? "linear-gradient(135deg, #8b0000, #b10000)"
              : "linear-gradient(135deg, #d10000, #a00000)",
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 700,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
            cursor: "pointer",
            zIndex: 160,
          }}
          aria-label={isSidebarOpen ? "Close navigation sidebar" : "Open navigation sidebar"}
        >
          {isSidebarOpen ? "‹" : "›"}
        </button>
      )}

      {/* Desktop floating status sidebar */}
      {showDesktopStatusControls && (
        <>
          <button
            type="button"
            onClick={() => setIsStatusSidebarOpen((prev) => !prev)}
            style={{
              position: "fixed",
              top: "50%",
              right: isStatusSidebarOpen ? "280px" : "0",
              transform: "translateY(-50%)",
              width: "52px",
              height: "52px",
              borderRadius: "999px 0 0 999px",
              border: "none",
              background: isStatusSidebarOpen
                ? "linear-gradient(135deg, #b10000, #8b0000)"
                : "linear-gradient(135deg, #d10000, #a00000)",
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 700,
              boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              cursor: "pointer",
              zIndex: 140,
            }}
            aria-label={isStatusSidebarOpen ? "Close status sidebar" : "Open status sidebar"}
          >
            {isStatusSidebarOpen ? "›" : "‹"}
          </button>
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "280px",
              padding: "12px",
              boxSizing: "border-box",
              transform: isStatusSidebarOpen ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.35s ease",
              zIndex: 130,
              pointerEvents: isStatusSidebarOpen ? "auto" : "none",
            }}
          >
            <StatusSidebar
              jobId={activeJobId}
              currentStatus={currentJobStatus}
              isOpen={isStatusSidebarOpen}
              onToggle={() => {}}
              onJobSearch={handleJobSearch}
              onJobClear={handleJobClear}
              hasUrlJobId={hasActiveAutoJob}
              viewportWidth={viewportWidth}
              isCompact={false}
              timelineContent={
                timelineJobNumber ? (
                  <JobTimeline jobNumber={String(timelineJobNumber)} />
                ) : null
              }
              showToggleButton={false}
              variant="docked"
              canClose={false}
            />
          </div>
        </>
      )}

      {/* Status sidebar overlay for tablets/phones */}
      {showMobileStatusSidebar && (
        <StatusSidebar
          jobId={activeJobId}
          currentStatus={currentJobStatus}
          isOpen={isStatusSidebarOpen}
          onToggle={() => setIsStatusSidebarOpen(false)}
          onJobSearch={handleJobSearch}
          onJobClear={handleJobClear}
          hasUrlJobId={hasActiveAutoJob}
          viewportWidth={viewportWidth}
          isCompact={isTablet && !isMobile}
          timelineContent={
            timelineJobNumber ? (
              <JobTimeline jobNumber={String(timelineJobNumber)} />
            ) : null
          }
          showToggleButton={false}
        />
      )}

      {isTech && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      <TopbarAlerts />
    </div>
  );
}
