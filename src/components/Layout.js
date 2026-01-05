// file location: src/components/Layout.js
// Edit: Add status button next to navigation on phone view, make all top controls scroll with page
// Edit: Responsive improvements - status button and sidebar toggle optimized for mobile/tablet
//       - Status button sticks to far right edge with reduced size on mobile/tablet
//       - Sidebar toggle button shrunk and edge-aligned on mobile/tablet
//       - All page sections optimized for vertical phone mode
// ✅ Imports converted to use absolute alias "@/"
import React, { useCallback, useEffect, useState } from "react"; // import React hooks
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
import { getUserActiveJobs, clockOutFromJob } from "@/lib/database/jobClocking";
import { DropdownField } from "@/components/dropdownAPI";

const WORKSHOP_SHORTCUT_ROLES = ["workshop manager", "aftersales manager"];

const WORKSHOP_SHORTCUT_LINKS = [
  {
    label: "Clocking",
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
];

const PARTS_ACTION_LINKS = [
  { label: "Delivery/Collection Planner", href: "/parts/delivery-planner" },
  { label: "Create Order", href: "/parts/create-order" },
  { label: "Goods In", href: "/parts/goods-in" },
];

const MODE_STORAGE_KEY = "appModeSelection";
const MODE_ROLE_MAP = {
  Retail: new Set((roleCategories.Retail || []).map((role) => role.toLowerCase())),
  Sales: new Set((roleCategories.Sales || []).map((role) => role.toLowerCase())),
};
const NAV_DRAWER_WIDTH = 260;
const STATUS_DRAWER_WIDTH = 280;

export default function Layout({ children, jobNumber }) {
  const { user, loading: userLoading, status, setStatus, currentJob, dbUserId } = useUser(); // get user context data
  const { usersByRole } = useRoster();
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";
  const showHrTabs =
    (router.pathname.startsWith("/hr") && router.pathname !== "/hr/manager") ||
    router.pathname.startsWith("/admin/users");

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
  const [statusSidebarRefreshKey, setStatusSidebarRefreshKey] = useState(0);

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

  const fetchCurrentJobStatus = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${id}`);
      const data = await response.json();
      if (data.success) setCurrentJobStatus(data.status);
    } catch (error) {
      console.error("Error fetching job status:", error);
    }
  }, []);

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
    if (typeof window === "undefined") return;

    const handleOpenStatusFlow = (event) => {
      if (!canViewStatusSidebar) return;

      const incomingId = event?.detail?.jobNumber
        ? String(event.detail.jobNumber)
        : null;
      const currentActiveId = activeJobId ? String(activeJobId) : null;

      if (incomingId && incomingId !== currentActiveId) {
        setSearchedJobId(incomingId);
        setIsAutoJobCleared(false);
      }

      setIsStatusSidebarOpen(true);
    };

    window.addEventListener("openStatusFlow", handleOpenStatusFlow);
    return () => window.removeEventListener("openStatusFlow", handleOpenStatusFlow);
  }, [canViewStatusSidebar, activeJobId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStatusFlowRefresh = (event) => {
      if (!canViewStatusSidebar) return;
      const incomingId = event?.detail?.jobNumber
        ? String(event.detail.jobNumber)
        : null;
      if (!incomingId) return;

      const matchesActive = activeJobId && String(activeJobId) === incomingId;
      const matchesTimeline =
        timelineJobNumber && String(timelineJobNumber) === incomingId;

      if (matchesActive || matchesTimeline) {
        fetchCurrentJobStatus(incomingId);
        setStatusSidebarRefreshKey((prev) => prev + 1);
      }
    };

    window.addEventListener("statusFlowRefresh", handleStatusFlowRefresh);
    return () => window.removeEventListener("statusFlowRefresh", handleStatusFlowRefresh);
  }, [activeJobId, timelineJobNumber, canViewStatusSidebar, fetchCurrentJobStatus]);

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
    if (userLoading) return;
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, userLoading, hideSidebar, router]);

  useEffect(() => {
    if (activeJobId) fetchCurrentJobStatus(activeJobId);
  }, [activeJobId, fetchCurrentJobStatus]);

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

  // Handle Tea Break - unclock from all active jobs
  const handleTeaBreak = async () => {
    if (!dbUserId) return;

    try {
      const { success, data: activeJobs } = await getUserActiveJobs(dbUserId);

      if (success && activeJobs && activeJobs.length > 0) {
        // Clock out from all active jobs
        for (const job of activeJobs) {
          await clockOutFromJob({
            userId: dbUserId,
            jobId: job.jobId,
            clockingId: job.clockingId
          });
        }
      }

      setStatus("Tea Break");
    } catch (error) {
      console.error("Error handling tea break:", error);
      setStatus("Tea Break");
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus) => {
    if (newStatus === "Tea Break") {
      await handleTeaBreak();
    } else {
      setStatus(newStatus);
    }
  };

  // Sync status with job clocking state
  useEffect(() => {
    if (!isTech || !dbUserId) return;

    const syncStatus = async () => {
      try {
        const { success, data: activeJobs } = await getUserActiveJobs(dbUserId);

        if (success) {
          if (activeJobs && activeJobs.length > 0) {
            // User is clocked into a job
            if (status !== "In Progress" && status !== "Tea Break") {
              setStatus("In Progress");
            }
          } else {
            // User is not clocked into any job
            if (status === "In Progress") {
              setStatus("Waiting for Job");
            }
          }
        }
      } catch (error) {
        console.error("Error syncing status:", error);
      }
    };

    syncStatus();
    // Re-sync when currentJob changes
  }, [isTech, dbUserId, currentJob]);

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

  const accountsRoleCandidates = (roleCategories?.Sales || []).filter((roleName) =>
    roleName.toLowerCase().includes("accounts")
  );
  const normalizedAccountsRoles = accountsRoleCandidates.map((roleName) => roleName.toLowerCase());
  const hasAccountsSidebarAccess = userRoles.some((role) => normalizedAccountsRoles.includes(role));
  const accountsSidebarSections = hasAccountsSidebarAccess
    ? [
        {
          label: "Accounts",
          category: "departments",
          items: [
            { label: "Accounts", href: "/accounts", roles: accountsRoleCandidates },
            { label: "Invoices", href: "/accounts/invoices", roles: accountsRoleCandidates },
            { label: "Reports", href: "/accounts/reports", roles: accountsRoleCandidates },
            { label: "Settings", href: "/accounts/settings", roles: accountsRoleCandidates },
          ],
        },
      ]
    : [];
  const serviceSidebarSections = [...WORKSHOP_SHORTCUT_SECTIONS, ...accountsSidebarSections];
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
    addNavItem("My Profile", "/profile", {
      keywords: ["profile", "employee profile", "my profile"],
      description: "View your personal employment info",
      section: "General",
    });
  }

  if (isTech) {
    addNavItem("My Jobs", "/job-cards/myjobs", {
      keywords: ["my jobs", "jobs", "tech"],
      section: "Workshop",
    });
    addNavItem("Start Job", "/job-cards/myjobs", {
      keywords: ["start job", "tech"],
      section: "Workshop",
    });
    addNavItem("Request Consumables", "/tech/consumables-request", {
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
    addNavItem("Next Jobs", "/job-cards/waiting/nextjobs", {
      keywords: ["next jobs", "waiting list", "queue"],
      section: "Workshop",
    });
  }

  if (userRoles.includes("workshop manager")) {
    addNavItem("Consumables Tracker", "/workshop/consumables-tracker", {
      keywords: ["consumables", "tracker", "budget"],
      description: "Monitor consumable spend, reminders, and supplier details",
      section: "Workshop",
    });
  }

  if (viewRoles.some((r) => userRoles.includes(r))) {
    addNavItem("Job Cards", "/job-cards/view", {
      keywords: ["view job", "job cards"],
      description: "Browse all job cards",
      section: "Workshop",
    });
  }

  if (hasPartsAccess) {
    addNavItem("Parts Workspace", "/parts", {
      keywords: ["parts", "inventory", "vhc parts"],
      description: "Manage parts allocations and deliveries",
      section: "Parts",
    });
    addNavItem("Deliveries", "/parts/deliveries", {
      keywords: ["parts deliveries", "goods in", "stock"],
      description: "Review inbound deliveries and update stock",
      section: "Parts",
    });
    addNavItem("Delivery/Collection Planner", "/parts/delivery-planner", {
      keywords: ["delivery planner", "collection planner", "routes", "outbound"],
      description: "Plan outbound runs and manage scheduled collections",
      section: "Parts",
    });
  }

  if (isPartsManager) {
    addNavItem("Parts Manager Dashboard", "/parts/manager", {
      keywords: ["parts manager", "stock value", "parts dashboard"],
      description: "View stock, spending, and income KPIs",
      section: "Parts",
    });
  }

  const hrAccessRoles = ["hr manager", "admin manager", "owner", "admin"];
  if (userRoles.some((role) => hrAccessRoles.includes(role))) {
    addNavItem("HR Dashboard", "/hr", {
      keywords: ["hr", "people", "culture", "training"],
      description: "Headcount, attendance, and compliance overview",
      section: "HR",
    });
  } else if (userRoles.some((role) => role.includes("manager"))) {
    addNavItem("Team HR", "/hr/employees", {
      keywords: ["team hr", "people", "hr"],
      description: "View team employee directory and leave",
      section: "HR",
    });
    addNavItem("Leave", "/hr/leave", {
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
    addNavItem("Valet Jobs", "/valet", {
      keywords: ["valet", "wash", "valeting"],
      description: "View vehicles awaiting wash",
      section: "Workshop",
    });
  }

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const mainColumnMaxWidth = hideSidebar ? "100%" : "100%";
  const layoutStyles = {
    display: hideSidebar ? "block" : "flex",
    flexDirection: isTablet ? "column" : "row",
    height: "auto",
    minHeight: "100vh",
    width: "100%",
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
    background: colors.background || colors.mainBg,
    color: colors.text,
    justifyContent: hideSidebar ? "center" : "flex-start",
    alignItems: hideSidebar ? "center" : "stretch",
    gap: hideSidebar ? "0" : isTablet ? "12px" : "24px",
    padding: hideSidebar ? "0" : isTablet ? "12px" : "0 16px",
    boxSizing: "border-box",
    overflow: hideSidebar ? "hidden" : "visible",
    position: "relative",
  };
  const showDesktopSidebar = !hideSidebar && !isTablet;
  const showMobileSidebar = !hideSidebar && isTablet;
  const showDesktopStatusControls = !hideSidebar && canViewStatusSidebar && !isTablet;
  const showMobileStatusSidebar = !hideSidebar && canViewStatusSidebar && isTablet && isStatusSidebarOpen;
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
          flex: hideSidebar ? "none" : 1,
          maxWidth: mainColumnMaxWidth,
          width: hideSidebar ? "100%" : "100%",
          display: "flex",
          flexDirection: "column",
          gap: hideSidebar ? 0 : isTablet ? "16px" : "20px",
          padding: hideSidebar ? "0" : isTablet ? "16px 12px" : "16px 16px",
          background: hideSidebar ? "transparent" : colors.mainBg,
          height: "auto",
          maxHeight: "none",
          overflowY: "visible", // allow full page scroll across breakpoints
          overflowX: "hidden",
          position: "relative",
          margin: hideSidebar ? "0" : "0",
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
                    background: "var(--surface)",
                    fontWeight: 600,
                    color: colors.accent,
                    boxShadow: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
                    background: "rgba(var(--text-primary-rgb), 0.65)",
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
                    boxShadow: "none",
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
              background: "rgba(var(--surface-rgb), 0.92)",
              borderRadius: "16px",
              border: "1px solid rgba(var(--primary-rgb),0.12)",
              boxShadow: "none",
              padding: isMobile ? "10px 12px" : "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "8px" : "12px",
              backdropFilter: "blur(10px)",
              minHeight: isMobile ? "auto" : "75px",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "16px",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  minWidth: isMobile ? "100%" : "auto",
                  flex: "0 0 auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
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
                  {availableModes.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: colors.mutedText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Mode:
                      </span>
                      {availableModes.length > 1 ? (
                        <DropdownField
                          value={selectedMode || activeModeLabel || ""}
                          onChange={(event) => handleModeSelect(event.target.value)}
                          style={{
                            borderRadius: "999px",
                            border: "none",
                            padding: "2px 8px",
                            background: "var(--surface-light)",
                            color: colors.accent,
                            fontWeight: 600,
                            fontSize: "0.65rem",
                            cursor: "pointer",
                          }}
                        >
                          {availableModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </DropdownField>
                      ) : (
                        <span
                          style={{
                            color: colors.accent,
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

              {isTech && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isTablet ? "flex-end" : "center",
                    flex: isTablet ? "1 1 auto" : "0 0 auto",
                    marginLeft: isTablet ? "auto" : "0",
                  }}
                >
                  <DropdownField
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{
                      padding: isMobile ? "4px 10px" : isTablet ? "5px 12px" : "6px 14px",
                      borderRadius: isMobile ? "10px" : "12px",
                      border: "none",
                      backgroundColor: "var(--surface)",
                      color: colors.accent,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "none",
                      fontSize: isMobile ? "0.75rem" : "0.85rem",
                      minWidth: "auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <option>Waiting for Job</option>
                    <option>In Progress</option>
                    <option>Tea Break</option>
                  </DropdownField>
                </div>
              )}

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
                          border: active ? "1px solid var(--primary-dark)" : "1px solid var(--surface-light)",
                          backgroundColor: active ? "var(--primary-dark)" : "var(--surface-light)",
                          color: active ? "var(--surface)" : "var(--primary-dark)",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          boxShadow: "none",
                          transition:
                            "background-color 0.2s ease, color 0.2s ease",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {action.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              {hasPartsAccess && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    justifyContent: "center",
                    alignItems: "center",
                    flex: isMobile ? "1 1 100%" : "0 1 auto",
                    minWidth: isMobile ? "100%" : "260px",
                    marginLeft: isMobile ? 0 : "auto",
                    marginRight: isMobile ? 0 : "auto",
                    textAlign: "center",
                  }}
                >
                  {PARTS_ACTION_LINKS.map((action) => {
                    const active =
                      router.pathname === action.href ||
                      router.pathname.startsWith(`${action.href}/`);
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        style={{
                          padding: isMobile ? "10px 18px" : "10px 20px",
                          borderRadius: "999px",
                          border: active ? "1px solid var(--primary-dark)" : "1px solid rgba(var(--primary-rgb),0.35)",
                          backgroundColor: active ? "var(--primary-dark)" : "rgba(var(--primary-rgb),0.08)",
                          color: active ? "var(--surface)" : "var(--primary-dark)",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          textDecoration: "none",
                          boxShadow: "none",
                          transition: "background-color 0.2s ease, color 0.2s ease",
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
                  gap: "12px",
                  flex: "1 1 auto",
                  minWidth: isTablet ? "100%" : "320px",
                  justifyContent: isTablet ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    flex: "1 1 auto",
                    minWidth: "240px",
                    width: "100%",
                    maxWidth: isMobile ? "100%" : "600px",
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

                {userRoles.includes("admin manager") && (
                  <Link
                    href="/admin/users"
                    style={{
                      padding: "8px 14px",
                      borderRadius: "14px",
                      background: "var(--primary)",
                      color: "var(--surface)",
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Create User
                  </Link>
                )}
              </div>
            </div>

            {isTech && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <button
                  type="button"
                  disabled={!currentJob?.jobNumber}
                  onClick={() =>
                    currentJob?.jobNumber && router.push(`/job-cards/myjobs/${currentJob.jobNumber}`)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: "10px",
                    border: "none",
                    background: currentJob?.jobNumber
                      ? "var(--primary)"
                      : "var(--info-surface)",
                    color: currentJob?.jobNumber ? "var(--surface)" : "var(--info)",
                    fontWeight: 600,
                    cursor: currentJob?.jobNumber ? "pointer" : "not-allowed",
                    boxShadow: "none",
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
                    padding: "6px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--primary)",
                    background: "var(--surface)",
                    color: "var(--primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "none",
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
              background: "var(--surface)",
              borderRadius: hideSidebar ? "0px" : "28px",
              border: hideSidebar ? "none" : "1px solid var(--surface-light)",
              boxShadow: "none",
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
            width: isMobile ? "16px" : isTablet ? "18px" : "20px",
            height: isMobile ? "48px" : isTablet ? "52px" : "56px",
            borderRadius: "0 999px 999px 0",
            border: "none",
            background: isSidebarOpen
              ? "var(--primary)"
              : "var(--primary)",
            color: "var(--surface)",
            fontSize: isMobile ? "14px" : isTablet ? "16px" : "18px",
            fontWeight: 700,
            boxShadow: "none",
            cursor: "pointer",
            zIndex: 160,
            transition: "left 0.25s ease, width 0.2s ease, height 0.2s ease",
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
              right: isStatusSidebarOpen ? `${STATUS_DRAWER_WIDTH}px` : "0",
              transform: "translateY(-50%)",
              width: isMobile ? "16px" : isTablet ? "18px" : "20px",
              height: isMobile ? "48px" : isTablet ? "52px" : "56px",
              borderRadius: "999px 0 0 999px",
              border: "none",
              background: isStatusSidebarOpen
                ? "var(--primary)"
                : "var(--primary)",
              color: "var(--surface)",
              fontSize: isMobile ? "14px" : isTablet ? "16px" : "18px",
              fontWeight: 700,
              boxShadow: "none",
              cursor: "pointer",
              zIndex: 140,
              transition: "right 0.35s ease, width 0.2s ease, height 0.2s ease",
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
              width: `${STATUS_DRAWER_WIDTH}px`,
              padding: "12px 12px 12px 0",
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
              refreshKey={statusSidebarRefreshKey}
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
          refreshKey={statusSidebarRefreshKey}
        />
      )}

      {isTech && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      <TopbarAlerts />
    </div>
  );
}
