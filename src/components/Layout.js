// file location: src/components/Layout.js
// ✅ Imports converted to use absolute alias "@/"
import React, { useEffect, useState } from "react"; // import React hooks
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context
import GlobalSearch from "@/components/GlobalSearch"; // import global search component
import JobCardModal from "@/components/JobCards/JobCardModal"; // import job modal
import Sidebar from "@/components/Sidebar";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import TopbarAlerts, { AlertBadge } from "@/components/TopbarAlerts";
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";
import { useRoster } from "@/context/RosterContext";
import HrTabsBar from "@/components/HR/HrTabsBar";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import { roleCategories } from "@/config/users";

// Define roles that should see workshop shortcuts
const WORKSHOP_SHORTCUT_ROLES = ["workshop manager", "aftersales manager"];

// Define workshop shortcut navigation links
const WORKSHOP_SHORTCUT_LINKS = [
  {
    label: "⏱️ Clocking",
    href: "/clocking",
    roles: WORKSHOP_SHORTCUT_ROLES,
    keywords: ["clocking", "time", "overview"],
    description: "Unified clocking workspace",
  },
];

// Group workshop shortcuts into a navigation section
const WORKSHOP_SHORTCUT_SECTIONS = [
  {
    label: "Workshop Shortcuts",
    category: "departments",
    items: WORKSHOP_SHORTCUT_LINKS,
  },
];

// Define roles that should see service action buttons
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

// Define roles that should have parts navigation access
const PARTS_NAV_ROLES = new Set(["parts", "parts manager"]);

// Define quick action links for service department
const SERVICE_ACTION_LINKS = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/workshop/check-in" },
];

// Storage key for persisting user's mode selection
const MODE_STORAGE_KEY = "appModeSelection";

// Map modes to their associated roles
const MODE_ROLE_MAP = {
  Retail: new Set((roleCategories.Retail || []).map((role) => role.toLowerCase())),
  Sales: new Set((roleCategories.Sales || []).map((role) => role.toLowerCase())),
};

export default function Layout({ children }) {
  const { user, status, setStatus, currentJob, dbUserId } = useUser(); // get user context data
  const { usersByRole } = useRoster(); // get roster data for role-based checks
  const router = useRouter();
  const hideSidebar = router.pathname === "/login"; // hide sidebar on login page
  const showHrTabs = router.pathname.startsWith("/hr") || router.pathname.startsWith("/admin/users"); // show HR tabs on HR pages

  // Get current viewport width for responsive layout
  const getViewportWidth = () =>
    typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1440;

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());

  const [isModalOpen, setIsModalOpen] = useState(false); // job card modal state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // mobile menu toggle state

  // Responsive breakpoint checks
  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 640;
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Get user's raw roles from context
  const rawUserRoles = user?.roles?.map((r) => r.toLowerCase()) || [];

  // Determine which modes are available to this user based on their roles
  const availableModes = Object.entries(MODE_ROLE_MAP).reduce((acc, [mode, roleSet]) => {
    if (rawUserRoles.some((role) => roleSet.has(role))) {
      acc.push(mode);
    }
    return acc;
  }, []);

  // Set initial selected mode (if only one mode available, auto-select it)
  const [selectedMode, setSelectedMode] = useState(() =>
    availableModes.length === 1 ? availableModes[0] : null
  );
  const availableModesKey = availableModes.join("|"); // unique key for mode array to detect changes

  // Handle mode selection logic when available modes change
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

  // Persist selected mode to localStorage
  useEffect(() => {
    if (!selectedMode) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_STORAGE_KEY, selectedMode);
  }, [selectedMode]);

  // Filter user roles based on selected mode (if multi-mode user)
  const modeRoleSet = selectedMode ? MODE_ROLE_MAP[selectedMode] : null;
  const scopedRoles =
    availableModes.length > 1 && modeRoleSet
      ? rawUserRoles.filter((role) => modeRoleSet.has(role))
      : rawUserRoles;
  const userRoles = scopedRoles.length > 0 ? scopedRoles : rawUserRoles; // fallback to all roles if no scoped roles
  const activeModeLabel = selectedMode || availableModes[0] || null; // get active mode label for display

  // Check if user's roles match required department roles
  const matchesDepartment = (rolesToMatch = []) => {
    if (!rolesToMatch || rolesToMatch.length === 0) return true;
    return rolesToMatch.some((roleName) => userRoles.includes(roleName));
  };

  // Filter dashboard shortcuts based on user's department roles
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) =>
    matchesDepartment(shortcut.roles || [])
  );

  // Check if user can use service action buttons
  const canUseServiceActions = userRoles.some((role) => SERVICE_ACTION_ROLES.has(role));

  // Define roles for retail manager dashboard access
  const retailManagerDashboardRoles = ["service manager", "workshop manager", "after sales director"];
  const hasRetailDashboardAccess = userRoles.some((role) =>
    retailManagerDashboardRoles.includes(role)
  );

  // Get lists of technicians and MOT testers from roster
  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];

  // Build set of allowed technician names
  const allowedTechNames = new Set([...techsList, ...motTestersList]);

  // Determine if current user is a technician
  const normalizedUsername = typeof user?.username === "string" ? user.username.trim() : "";
  const hasTechRole = userRoles.some((role) => role.includes("tech") || role.includes("mot"));
  const isTech = (normalizedUsername && allowedTechNames.has(normalizedUsername)) || hasTechRole;

  // Check if user has parts department access
  const hasPartsAccess = userRoles.some((role) => PARTS_NAV_ROLES.has(role));
  const isPartsManager = userRoles.includes("parts manager");

  // Update viewport width on window resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(getViewportWidth());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile menu when switching to desktop view
  useEffect(() => {
    if (!isTablet) setIsMobileMenuOpen(false);
  }, [isTablet]);

  // Handle escape key to close mobile menu
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

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  // Handle mode selection from dropdown
  const handleModeSelect = (mode) => {
    if (!mode || mode === selectedMode) return;
    setSelectedMode(mode);
  };

  // Define roles that can view job cards
  const viewRoles = ["manager", "service", "sales"];

  // Define roles that can access VHC features
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

  // Check if current route is active
  const isActive = (path) => router.pathname.startsWith(path);

  // Get theme colors
  const colors = appShellTheme.light;

  // Sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Content key for forcing re-render on route change
  const [contentKey, setContentKey] = useState(() => router.asPath || "initial");

  // Initialize sidebar state based on viewport and localStorage
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

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || isTablet) return;
    window.localStorage.setItem("sidebarOpen", isSidebarOpen ? "true" : "false");
  }, [isSidebarOpen, isTablet]);

  // Update content key on route change to force component remount
  useEffect(() => {
    setContentKey(router.asPath || `${router.pathname}-${Date.now()}`);
  }, [router.asPath, router.pathname]);

  // iOS-specific fix for rendering issues on route change
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

  // Combine sidebar sections with workshop shortcuts
  const serviceSidebarSections = WORKSHOP_SHORTCUT_SECTIONS;
  const combinedSidebarSections = [...sidebarSections, ...serviceSidebarSections];

  // Build navigation items array for global search
  const navigationItems = [];
  const seenNavItems = new Set(); // track added items to prevent duplicates

  // Check if user's roles match required roles for navigation item
  const roleMatches = (requiredRoles = []) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.some((role) => userRoles.includes(role.toLowerCase()));
  };

  // Add navigation item to search index
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

  // Add all sidebar section items to navigation search
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

  // Add user profile to navigation
  if (user) {
    addNavItem("🙋 My Profile", "/profile", {
      keywords: ["profile", "employee profile", "my profile"],
      description: "View your personal employment info",
      section: "General",
    });
  }

  // Add technician-specific navigation items
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

  // Add next jobs navigation for managers
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

  // Add consumables tracker for workshop managers
  if (userRoles.includes("workshop manager")) {
    addNavItem("🧾 Consumables Tracker", "/workshop/consumables-tracker", {
      keywords: ["consumables", "tracker", "budget"],
      description: "Monitor consumable spend, reminders, and supplier details",
      section: "Workshop",
    });
  }

  // Add view job cards for managers/service
  if (viewRoles.some((r) => userRoles.includes(r))) {
    addNavItem("👀 View Job Cards", "/job-cards/view", {
      keywords: ["view job", "job cards"],
      description: "Browse all job cards",
      section: "Workshop",
    });
  }

  // Add parts department navigation items
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

  // Add parts manager dashboard
  if (isPartsManager) {
    addNavItem("📈 Parts Manager Dashboard", "/parts/manager", {
      keywords: ["parts manager", "stock value", "parts dashboard"],
      description: "View stock, spending, and income KPIs",
      section: "Parts",
    });
  }

  // Add VHC dashboard for authorized roles
  if (userRoles.some((role) => vhcAccessRoles.has(role))) {
    addNavItem("📝 VHC Dashboard", "/vhc/dashboard", {
      keywords: ["vhc", "vehicle health check", "dashboard"],
      section: "Workshop",
    });
  }

  // Add HR navigation items based on role
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

  // Add valet navigation for authorized roles
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

  // Toggle sidebar open/closed
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  // Layout styling
  const mainColumnMaxWidth = "100%";
  const layoutStyles = {
    display: "flex",
    flexDirection: isTablet ? "column" : "row",
    height: "100vh",
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
    overflow: "hidden",
  };

  // Determine which sidebar to show based on viewport
  const showDesktopSidebar = !hideSidebar && !isTablet;
  const showMobileSidebar = !hideSidebar && isTablet;

  return (
    <div style={layoutStyles}>
      {/* Desktop Sidebar */}
      {showDesktopSidebar && (
        <div
          style={{
            width: isSidebarOpen ? "260px" : "64px",
            padding: "16px 0",
            alignSelf: "stretch",
            height: "100%",
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            transition: "width 0.25s ease",
            position: "relative",
          }}
        >
          {isSidebarOpen ? (
            <Sidebar
              onToggle={toggleSidebar}
              extraSections={serviceSidebarSections}
              visibleRoles={userRoles}
              modeLabel={activeModeLabel}
            />
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

      {/* Main Content Column */}
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
          maxHeight: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {/* Mobile Navigation Buttons */}
        {showMobileSidebar && (
          <>
            <div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.accent}`,
                  background: "linear-gradient(90deg, #ffffff, #fff5f5)",
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
                <span aria-hidden="true">☰</span> Navigation
              </button>
            </div>

            {/* Mobile Menu Overlay */}
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
                  <Sidebar
                    onToggle={closeMobileMenu}
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

        {/* Header Section */}
        {!hideSidebar && (
          <section
            style={{
              background: "rgba(255,255,255,0.95)",
              borderRadius: "14px",
              border: "1px solid rgba(209,0,0,0.1)",
              boxShadow: "0 12px 24px rgba(209,0,0,0.08)",
              padding: isMobile ? "8px 10px" : "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "12px" : "14px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : canUseServiceActions
                  ? "minmax(220px, 1fr) minmax(240px, 1fr) minmax(220px, 1fr)"
                  : "minmax(220px, 1fr) minmax(220px, 1fr)",
                gap: isMobile ? "12px" : "16px",
                alignItems: "stretch",
              }}
            >
              {/* Welcome Section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  minWidth: 0,
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
                    alignItems: isMobile ? "flex-start" : "center",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <h1
                    style={{
                      fontSize: isMobile ? "0.95rem" : "1.1rem",
                      fontWeight: 700,
                      margin: 0,
                      color: colors.accent,
                      lineHeight: 1.1,
                    }}
                  >
                    Welcome back, {user?.username || "Guest"}
                  </h1>
                  {availableModes.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color: colors.mutedText,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Mode
                      </span>
                      {availableModes.length > 1 ? (
                        <select
                          value={selectedMode || activeModeLabel || ""}
                          onChange={(event) => handleModeSelect(event.target.value)}
                          style={{
                            borderRadius: "999px",
                            border: "1px solid rgba(209,0,0,0.3)",
                            padding: "3px 10px",
                            background: "#fff5f5",
                            color: colors.accent,
                            fontWeight: 600,
                            fontSize: "0.7rem",
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
                            padding: "3px 10px",
                            borderRadius: "999px",
                            background: "rgba(16,185,129,0.12)",
                            color: "#047857",
                            fontWeight: 600,
                          }}
                        >
                          {activeModeLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Section */}
              {canUseServiceActions && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: colors.mutedText,
                    }}
                  >
                    Quick Actions
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: isMobile ? "nowrap" : "wrap",
                      gap: "8px",
                      overflowX: isMobile ? "auto" : "visible",
                      paddingBottom: isMobile ? "4px" : 0,
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
                            padding: "6px 12px",
                            borderRadius: "999px",
                            border: active ? "1px solid #b10000" : "1px solid #ffe0e0",
                            backgroundColor: active ? "#b10000" : "#fff5f5",
                            color: active ? "#ffffff" : "#720000",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            textDecoration: "none",
                            boxShadow: active
                              ? "0 8px 16px rgba(177, 0, 0, 0.18)"
                              : "0 4px 10px rgba(209, 0, 0, 0.08)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {action.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search and Utilities Section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />
                  <AlertBadge />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    justifyContent: isMobile ? "flex-start" : "flex-end",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      minWidth: isMobile ? "100%" : "auto",
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
                        padding: "6px 12px",
                        borderRadius: "12px",
                        border: "1px solid #ffe0e0",
                        background: "#fff5f5",
                        color: "#720000",
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: "0 4px 10px rgba(209,0,0,0.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span role="img" aria-label="deliveries">
                        🚚
                      </span>
                      Deliveries
                    </Link>
                  )}

                  {userRoles.includes("admin manager") && (
                    <Link
                      href="/admin/users"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #d10000, #a60000)",
                        color: "#ffffff",
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: "0 10px 18px rgba(209,0,0,0.18)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ➕ Create User
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Technician Quick Controls */}
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

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
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
            }}
          >
            {showHrTabs && <HrTabsBar />}
            {children}
          </div>
        </main>
      </div>

      {/* Job Card Modal for Technicians */}
      {isTech && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}

      {/* Topbar Alerts */}
      <TopbarAlerts />
    </div>
  );
}
