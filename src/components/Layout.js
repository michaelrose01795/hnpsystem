// file location: src/components/Layout.js
// Edit: Add status button next to navigation on phone view, make all top controls scroll with page
// Edit: Responsive improvements - status button and sidebar toggle optimized for mobile/tablet
//       - Status button sticks to far right edge with reduced size on mobile/tablet
//       - Sidebar toggle button shrunk and edge-aligned on mobile/tablet
//       - All page sections optimized for vertical phone mode
// ✅ Imports converted to use absolute alias "@/"
import React, { useCallback, useEffect, useMemo, useState } from "react"; // import React hooks
import dynamic from "next/dynamic"; // code-split heavy Layout children out of the shell bundle
import useSWR from "swr"; // SWR for deduped, cache-backed data fetching
// usePolling removed — SWR + slot-keyed caching covers the welcome-quote refresh.
import Link from "next/link"; // import Next.js link component
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context
import GlobalSearch from "@/components/GlobalSearch"; // import global search component
// Heavy, conditionally-rendered Layout children — dynamically imported so the initial
// shell JS bundle stays small. The Layout itself is persistent (mounted once by _app),
// so these only load when their gate conditions fire (tech role, status role, etc.).
const JobCardModal = dynamic(() => import("@/components/JobCards/JobCardModal"), { ssr: false });
const StatusSidebar = dynamic(() => import("@/components/StatusTracking/StatusSidebar"), { ssr: false });
const JobTimeline = dynamic(() => import("@/components/Timeline/JobTimeline"), { ssr: false });
import Sidebar from "@/components/Sidebar";
import NextActionPrompt from "@/components/popups/NextActionPrompt";
import TopbarAlerts from "@/components/TopbarAlerts";
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";
import { useRoster } from "@/context/RosterContext";
import HrTabsBar from "@/components/HR/HrTabsBar";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { roleCategories } from "@/config/users";
import { getUserActiveJobs, clockOutFromJob } from "@/lib/database/jobClocking";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { getWelcomeQuoteSlotKey } from "@/lib/welcomeQuoteSlot";
import BrandLogo from "@/components/BrandLogo";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";

const PRESENTATION_ROLE_STORAGE_KEY = "presentation:activeRoleKey";

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
const STATUS_DRAWER_WIDTH = 560;
// Fallback role union used only if /presentation is somehow rendered without
// a chosen role from /loginPresentation (the provider redirects in that case,
// but Layout sits outside the provider so this keeps it safe during the brief
// pre-redirect render).
const PRESENTATION_SHELL_ROLES = [
  "admin manager",
  "service manager",
  "workshop manager",
  "parts manager",
  "techs",
  "valet service",
  "accounts manager",
];

export default function Layout({
  children,
  jobNumber,
  disableContentCard = false,
  disableContentCardHover = false,
  contentBackground = null,
  requiresLandscape = false,
  presentationShell = false,
}) {
  const { user, loading: userLoading, status, setStatus, currentJob, dbUserId } = useUser(); // get user context data
  const { usersByRole } = useRoster();
  const router = useRouter();
  const hideSidebar =
    router.pathname === "/login" || router.pathname === "/loginPresentation";
  const showHrTabs =
    (router.pathname.startsWith("/hr") && router.pathname !== "/hr/manager") ||
    router.pathname.startsWith("/admin/users");

  const [viewportWidth, setViewportWidth] = useState(1440);
  const [viewportHeight, setViewportHeight] = useState(900);
  useMessagesBadge(dbUserId);

  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 640; // phone view cutoff
  const isVerticalPhone = isMobile && viewportHeight >= viewportWidth;
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

  // When in presentation shell, the active role is chosen on /loginPresentation
  // and passed in via ?role=KEY. Read it from the query first; fall back to
  // sessionStorage so a refresh keeps the shell scoped to the same role.
  const queryRoleKey =
    typeof router.query?.role === "string" ? router.query.role : null;
  const [storedPresentationRoleKey, setStoredPresentationRoleKey] = useState(null);
  useEffect(() => {
    if (!presentationShell) return;
    if (typeof window === "undefined") return;
    if (queryRoleKey) return;
    const stored = window.sessionStorage.getItem(PRESENTATION_ROLE_STORAGE_KEY);
    if (stored) setStoredPresentationRoleKey(stored);
  }, [presentationShell, queryRoleKey]);
  const activePresentationRole = presentationShell
    ? getPresentationRoleByKey(queryRoleKey || storedPresentationRoleKey)
    : null;
  const presentationAllowedRoutes = activePresentationRole?.routes || null;

  const rawUserRoles = presentationShell
    ? activePresentationRole
      ? [activePresentationRole.roleId]
      : PRESENTATION_SHELL_ROLES
    : user?.roles?.map((r) => r.toLowerCase()) || [];
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
  }, [availableModes, availableModesKey, selectedMode]);

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

  const canUseServiceActions = userRoles.some((role) => SERVICE_ACTION_ROLES.has(role));
  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];
  const allowedTechNames = new Set([...techsList, ...motTestersList]);
  const normalizedUsername = typeof user?.username === "string" ? user.username.trim() : "";
  const fallbackName = presentationShell
    ? activePresentationRole?.demoName || "Demo User"
    : typeof user?.username === "string" && user.username.trim() ? user.username.trim() : "Guest";
  const firstName =
    normalizedUsername.split(/\s+/).filter(Boolean)[0] || fallbackName;
  const userIdForQuote = presentationShell
    ? null
    :
    user?.authUuid ||
    user?.id ||
    user?.email ||
    normalizedUsername ||
    null;
  const hasTechRole = userRoles.some((role) => role.includes("tech") || role.includes("mot"));
  const isTech = (normalizedUsername && allowedTechNames.has(normalizedUsername)) || hasTechRole;
  const canViewStatusSidebar = presentationShell || userRoles.some((role) =>
    statusSidebarRoles.includes(role)
  );
  const hasPartsAccess = userRoles.some((role) => PARTS_NAV_ROLES.has(role));
  const isPartsManager = userRoles.includes("parts manager");

  const fetchCurrentJobStatus = useCallback(async (id) => {
    if (presentationShell) return;
    if (!id) return;
    try {
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${id}`);
      const data = await response.json();
      if (data.success) setCurrentJobStatus(data.status);
    } catch (error) {
      console.error("Error fetching job status:", error);
    }
  }, [presentationShell]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const nextWidth = window.innerWidth || 1440;
      const nextHeight = window.innerHeight || 900;
      setViewportWidth(nextWidth);
      setViewportHeight(nextHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (requiresLandscape) {
      document.body.classList.add("require-landscape");
    }
    return () => {
      document.body.classList.remove("require-landscape");
    };
  }, [requiresLandscape]);

  useEffect(() => {
    if (presentationShell) return;
    setIsStatusSidebarOpen(false);
  }, [isTablet, presentationShell]);

  // Welcome quote: keyed by (userId, slotKey) so SWR dedupes automatically across
  // navigations and only refetches when the slot rolls over. Layout is persistent
  // now, so this only runs once per slot change for the whole session.
  const welcomeQuoteSlotKey = useMemo(() => getWelcomeQuoteSlotKey(new Date()), []);
  const welcomeQuoteKey = userIdForQuote
    ? `/api/welcome-quote?userId=${encodeURIComponent(String(userIdForQuote))}&slot=${welcomeQuoteSlotKey}`
    : null;
  useSWR(
    welcomeQuoteKey,
    (url) => fetch(url).then((r) => (r.ok ? r.json() : null)),
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 }
  );

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
    if (presentationShell) return;
    if (userLoading) return;
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, userLoading, hideSidebar, router, presentationShell]);

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
  }, [currentJob, dbUserId, isTech, setStatus, status]);

  const viewRoles = ["manager", "service", "sales"];

  const colors = appShellTheme.light;
  const [contentKey, setContentKey] = useState(() => router.asPath || "initial");
  // While the session is resolving on a protected route, render a PageSkeleton
  // in place of children. Only ONE skeleton is ever visible — no overlay, no
  // stacking, no fade. Pages handle their own data-loading skeletons inside
  // their own render once auth is resolved.
  const isPreAuthLoading = !presentationShell && !hideSidebar && (userLoading || !user);

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

  // The full Layout (sidebar + topbar) always mounts. When the session is still
  // resolving, the inner content area renders a <PageSkeleton /> in place of
  // {children} — one skeleton, one transition, no overlay stacking.

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
            { label: "Company Accounts", href: "/company-accounts", roles: accountsRoleCandidates },
            { label: "Invoices", href: "/accounts/invoices", roles: accountsRoleCandidates },
            { label: "Reports", href: "/accounts/reports", roles: accountsRoleCandidates },
          ],
        },
      ]
    : [];
  const jobDivisionSidebarSections = [
    {
      label: "Job Divisions",
      category: "departments",
      items: [
        {
          label: "Retail Jobs",
          href: "/job-cards/view?division=retail",
          roles: roleCategories?.Retail || [],
        },
        {
          label: "Sales Jobs",
          href: "/job-cards/view?division=sales",
          roles: roleCategories?.Sales || [],
        },
      ],
    },
  ];
  const serviceSidebarSections = [
    ...jobDivisionSidebarSections,
    ...accountsSidebarSections,
  ];
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

  if (user || presentationShell) {
    addNavItem("My Profile", "/profile", {
      keywords: ["profile", "employee profile", "my profile"],
      description: "View your personal employment info",
      section: "General",
    });
    addNavItem("Archive Job", "/job-cards/archive", {
      keywords: ["archive", "job archive", "archived jobs"],
      description: "Archive completed job cards",
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
  const lockChromeInteraction = presentationShell
    ? {
        onClickCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onSubmitCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onInputCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onChangeCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onKeyDownCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
      }
    : {};

  const mainColumnMaxWidth = hideSidebar ? "100%" : "100%";
  const layoutStyles = {
    display: hideSidebar ? "block" : "flex",
    flexDirection: isTablet ? "column" : "row",
    height: "auto",
    minHeight: "100vh",
    width: "100%",
    fontFamily: "var(--font-family)",
    background: colors.background || colors.mainBg,
    color: colors.text,
    justifyContent: hideSidebar ? "center" : "flex-start",
    alignItems: hideSidebar ? "center" : "stretch",
    gap: hideSidebar ? "0" : "12px",
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
  const showNavToggleButton = !hideSidebar && !isTablet; // Hide on tablet/mobile since we use tab-style buttons

  return (
    <DevLayoutSection
      sectionKey="app-layout-chrome"
      sectionType="section-shell"
      shell
      backgroundToken="app-layout-chrome"
      style={layoutStyles}
    >
      {showDesktopSidebar && (
        <DevLayoutSection
          sectionKey="app-layout-sidebar-rail"
          parentKey="app-layout-chrome"
          sectionType="section-shell"
          shell
          {...lockChromeInteraction}
          backgroundToken="app-sidebar-rail"
          style={{
            width: isSidebarOpen ? `${NAV_DRAWER_WIDTH}px` : "0px",
            minWidth: isSidebarOpen ? `${NAV_DRAWER_WIDTH}px` : "0px",
            padding: "16px 0",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transition: "width 0.25s ease, min-width 0.25s ease",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {isSidebarOpen && (
            <Sidebar
              onToggle={!isTablet ? undefined : closeSidebar}
              extraSections={serviceSidebarSections}
              visibleRoles={userRoles}
              modeLabel={activeModeLabel}
              allowedRoutes={presentationAllowedRoutes}
              inPresentationMode={presentationShell}
            />
          )}
        </DevLayoutSection>
      )}

      <DevLayoutSection
        sectionKey="app-layout-main-column"
        parentKey="app-layout-chrome"
        sectionType="section-shell"
        shell
        backgroundToken="app-main-column"
        className="app-layout-main-column"
        style={{
          flex: hideSidebar ? "none" : 1,
          maxWidth: mainColumnMaxWidth,
          width: hideSidebar ? "100%" : "100%",
          display: "flex",
          flexDirection: "column",
          gap: hideSidebar ? 0 : "12px",
          padding: hideSidebar ? "0" : undefined,
          background: "transparent",
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
            {/* 50/50 Tab-style navigation for smaller screens */}
            <div
              style={{
                display: "flex",
                width: "100%",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={presentationShell ? undefined : () => setIsSidebarOpen(true)}
                className={`app-btn ${isSidebarOpen ? "app-btn--primary" : "app-btn--secondary"}`}
                style={{ flex: 1 }}
              >
                Menu
              </button>
              {canViewStatusSidebar && (
                <button
                  type="button"
                  onClick={() => setIsStatusSidebarOpen((prev) => !prev)}
                  className={`app-btn ${isStatusSidebarOpen ? "app-btn--primary" : "app-btn--secondary"}`}
                  style={{ flex: 1 }}
                >
                  Status
                </button>
              )}
            </div>

            {/* Full-width search bar below tab buttons for tablet/mobile - hidden when sidebar/status is open */}
            {!isSidebarOpen && !isStatusSidebarOpen && (
              <div
                {...lockChromeInteraction}
                style={{
                  width: "100%",
                }}
              >
                <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />
              </div>
            )}

            {isSidebarOpen && (
              <div
                {...lockChromeInteraction}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 3500,
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                }}
              >
                <div
                  onClick={presentationShell ? undefined : closeSidebar}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(var(--text-primary-rgb), 0.65)",
                  }}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    maxWidth: "100%",
                    height: "100%",
                    background: colors.mainBg,
                    borderRadius: 0,
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
                    onNavigate={isVerticalPhone ? closeSidebar : undefined}
                    isCondensed
                    extraSections={serviceSidebarSections}
                    visibleRoles={userRoles}
                    modeLabel={activeModeLabel}
                    allowedRoutes={presentationAllowedRoutes}
                    inPresentationMode={presentationShell}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {!hideSidebar && (
          <DevLayoutSection
            as="section"
            sectionKey="app-layout-topbar"
            parentKey="app-layout-main-column"
            sectionType="toolbar"
            shell
            backgroundToken="app-topbar-shell"
            className="app-topbar-shell"
            {...lockChromeInteraction}
            style={{
              background: "rgba(var(--surface-rgb), 0.92)",
              borderRadius: "var(--radius-md)",
              border: "none",
              boxShadow: "none",
              padding: isMobile ? "10px 12px" : "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "8px" : "12px",
              minHeight: isMobile ? "auto" : "75px",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: !isTablet ? "minmax(0, 1fr) auto minmax(0, 1fr)" : "1fr",
                alignItems: "center",
                gap: isMobile ? "10px" : "14px",
                overflow: "visible",
                width: "100%",
              }}
            >
              {/* Hide Welcome back and mode section on tablet/mobile */}
              {!isTablet && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    minWidth: "auto",
                    flex: "0 0 auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "4px",
                    }}
                  >
                    <h1
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        margin: 0,
                        color: colors.accent,
                        lineHeight: 1.1,
                      }}
                    >
                      Welcome {firstName}
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
                            className="app-topbar-dropdown app-topbar-dropdown--mode"
                            value={selectedMode || activeModeLabel || ""}
                            onChange={(event) => handleModeSelect(event.target.value)}
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
              )}

              {(isTech || canUseServiceActions || hasPartsAccess) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    whiteSpace: "nowrap",
                    zIndex: 2,
                    justifySelf: "center",
                  }}
                >
                  {isTech && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <DropdownField
                        className="app-topbar-dropdown app-topbar-dropdown--status"
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                      >
                        <option>Waiting for Job</option>
                        <option>In Progress</option>
                        <option>Tea Break</option>
                      </DropdownField>
                      {currentJob?.jobNumber ? (
                        <Link
                          href={`/job-cards/myjobs/${currentJob.jobNumber}`}
                          className="app-btn app-btn--primary"
                        >
                          {`Open Job ${currentJob.jobNumber}`}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="app-btn app-btn--control"
                        >
                          No Current Job
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="app-btn app-btn--control"
                      >
                        Start Job
                      </button>
                    </div>
                  )}

                  {canUseServiceActions && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "nowrap",
                        gap: "12px",
                        justifyContent: "center",
                        alignItems: "center",
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
                            className={`app-btn app-btn--control${active ? " is-active" : ""}`}
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
                        flexWrap: "nowrap",
                        gap: "12px",
                        justifyContent: "center",
                        alignItems: "center",
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
                            className={`app-btn app-btn--control${active ? " is-active" : ""}`}
                          >
                            {action.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Hide search section on tablet/mobile - shown below tab buttons instead */}
              {!isTablet && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "24px",
                    minWidth: 0,
                    justifyContent: "flex-end",
                    marginLeft: "auto",
                    justifySelf: "end",
                  }}
                >
                  <div
                    style={{
                      flex: "0 1 auto",
                      minWidth: "22ch",
                      width: "clamp(18rem, 20vw, 24rem)",
                      maxWidth: "24rem",
                      position: "relative",
                    }}
                  >
                    <GlobalSearch accentColor={colors.accent} navigationItems={navigationItems} />
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
                      className="app-btn app-btn--primary"
                    >
                      Create User
                    </Link>
                  )}
                </div>
              )}
            </div>
          </DevLayoutSection>
        )}

        <DevLayoutSection
          as="main"
          sectionKey="app-layout-main-shell"
          parentKey="app-layout-main-column"
          sectionType="page-shell"
          shell
          backgroundToken="app-page-shell"
          className="app-page-shell"
          style={{
            flex: 1,
          }}
        >
          <div
            className="app-page-content"
            key={contentKey}
            style={{
              maxWidth: hideSidebar ? "100%" : undefined,
              minHeight: "100%",
              overflow: "visible",
            }}
          >
            <DevLayoutSection
              sectionKey="app-layout-page-card"
              parentKey="app-layout-main-shell"
              sectionType="content-card"
              backgroundToken={contentBackground ? "app-page-card-custom" : "app-page-card"}
              className={
                [
                  "app-page-card",
                  disableContentCard || hideSidebar ? "app-page-card--bare" : "",
                  disableContentCardHover ? "app-page-card--no-hover" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              style={
                disableContentCard || hideSidebar
                  ? undefined
                  : contentBackground
                    ? { background: contentBackground }
                    : undefined
              }
            >
              <div style={{ width: "100%", minHeight: "100%", position: "relative" }}>
                <div className="app-page-stack">
                  {showHrTabs && <HrTabsBar />}
                  {isPreAuthLoading ? <PageSkeleton /> : children}
                </div>
              </div>
            </DevLayoutSection>
          </div>
        </DevLayoutSection>
      </DevLayoutSection>

      {showNavToggleButton && (
        <button
          type="button"
          onClick={presentationShell ? undefined : toggleSidebar}
          style={{
            position: "fixed",
            top: "50%",
            left: navToggleButtonLeft,
            transform: "translateY(-50%)",
            width: isMobile ? "16px" : isTablet ? "18px" : "20px",
            height: isMobile ? "48px" : isTablet ? "52px" : "56px",
            borderRadius: "0 var(--radius-pill) var(--radius-pill) 0",
            border: "none",
            background: isSidebarOpen
              ? "var(--primary)"
              : "var(--primary)",
            color: "var(--surface)",
            fontSize: isMobile ? "14px" : isTablet ? "16px" : "18px",
            fontWeight: 700,
            boxShadow: "none",
            cursor: "pointer",
            zIndex: 3600,
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
              borderRadius: "var(--radius-pill) 0 0 var(--radius-pill)",
              border: "none",
              background: isStatusSidebarOpen
                ? "var(--primary)"
                : "var(--primary)",
              color: "var(--surface)",
              fontSize: isMobile ? "14px" : isTablet ? "16px" : "18px",
              fontWeight: 700,
              boxShadow: "none",
              cursor: "pointer",
              zIndex: 3400,
              transition: "right 0.35s ease, width 0.2s ease, height 0.2s ease",
            }}
            aria-label={isStatusSidebarOpen ? "Close status sidebar" : "Open status sidebar"}
          >
            {isStatusSidebarOpen ? "›" : "‹"}
          </button>
          <div
            {...lockChromeInteraction}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: `${STATUS_DRAWER_WIDTH}px`,
              padding: "16px 16px 16px 0",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              transform: isStatusSidebarOpen ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.35s ease",
              zIndex: 3350,
              pointerEvents: isStatusSidebarOpen ? "auto" : "none",
            }}
          >
            <StatusSidebar
              jobId={activeJobId}
              currentStatus={currentJobStatus}
              isOpen={isStatusSidebarOpen}
              onToggle={() => {}}
              onJobSearch={presentationShell ? () => {} : handleJobSearch}
              onJobClear={presentationShell ? () => {} : handleJobClear}
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
        <div {...lockChromeInteraction}>
          <StatusSidebar
            jobId={activeJobId}
            currentStatus={currentJobStatus}
            isOpen={isStatusSidebarOpen}
            onToggle={presentationShell ? () => {} : () => setIsStatusSidebarOpen(false)}
            onJobSearch={presentationShell ? () => {} : handleJobSearch}
            onJobClear={presentationShell ? () => {} : handleJobClear}
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
        </div>
      )}

      {isTech && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      <TopbarAlerts />
      <div className="orientation-lock" role="status" aria-live="polite">
        <div className="orientation-lock__card redirect-card">
          <div className="login-brand redirect-brand" aria-hidden="true">
            <BrandLogo alt="" className="login-logo" />
          </div>
          <div className="orientation-lock__device-visual" aria-hidden="true">
            <div className="orientation-lock__device orientation-lock__device--portrait">
              <span className="orientation-lock__device-notch"></span>
            </div>
            <div className="orientation-lock__rotate-arrow">↻</div>
            <div className="orientation-lock__device orientation-lock__device--landscape">
              <span className="orientation-lock__device-notch"></span>
            </div>
          </div>
          <div className="orientation-lock__copy redirect-copy">
            <p className="orientation-lock__kicker redirect-kicker">Phone Orientation</p>
            <h2 className="orientation-lock__title redirect-title">
              Please rotate your phone to landscape.
            </h2>
            <p className="orientation-lock__sub redirect-sub">
              This view is designed for a wider layout.
            </p>
          </div>
          <div className="orientation-lock__dots redirect-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </DevLayoutSection>
  );
}
