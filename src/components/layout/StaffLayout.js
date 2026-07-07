// file location: src/components/layout/StaffLayout.js
// Persistent staff app shell: sidebar rail + topbar + status sidebar + main
// content card. Mounted once by _app via getLayout so only the inner page
// children swap on navigation.
//
// Moved here from src/components/Layout.js during the layout cleanup
// (src/components/Layout.js is now a thin re-export shim for back-compat).
// The desktop topbar JSX now lives in ./StaffTopbar; the navigation rail in
// ./StaffSidebar. This file owns the shared layout state they consume.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"; // import React hooks
import dynamic from "next/dynamic"; // code-split heavy Layout children out of the shell bundle
import useSWR from "swr"; // SWR for deduped, cache-backed data fetching
// usePolling removed — SWR + slot-keyed caching covers the welcome-quote refresh.
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context
import GlobalSearch from "@/components/GlobalSearch"; // import global search component (mobile drawer)
// Heavy, conditionally-rendered Layout children — dynamically imported so the initial
// shell JS bundle stays small. The Layout itself is persistent (mounted once by _app),
// so these only load when their gate conditions fire (tech role, status role, etc.).
const JobCardModal = dynamic(() => import("@/components/JobCards/JobCardModal"), { ssr: false });
const StatusSidebar = dynamic(() => import("@/components/StatusTracking/StatusSidebar"), { ssr: false });
const JobTimeline = dynamic(() => import("@/components/Timeline/JobTimeline"), { ssr: false });
import Sidebar from "@/components/layout/StaffSidebar";
import StaffTopbar from "@/components/layout/StaffTopbar";
import WorkspaceCommandCenter from "@/components/topbar/WorkspaceCommandCenter";
import useAutoHideTopbar from "@/hooks/useAutoHideTopbar";
import { SERVICE_ACTION_ROLE_SET as SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";
import TopbarAlerts from "@/components/TopbarAlerts";
import { appShellTheme } from "@/styles/appTheme";
import { sidebarSections } from "@/config/navigation";
import {
  getActiveWorkspaceDepartment,
  getQuickActions,
  getSearchItems,
  isWorkspaceNavEnabled,
} from "@/config/workspace/manifest";
import { useRoster } from "@/context/RosterContext";
import { resolveDepartmentForRoles } from "@/lib/reporting/config/departments";
import { useOperationalSnapshot } from "@/hooks/useOperationalSnapshot";
import { buildTopbarSections } from "@/config/topbar/statusViews";
import { resolveQuickActions } from "@/config/topbar/quickActions";
import { useContinueContext } from "@/hooks/useContinueContext";
import HrTabsBar from "@/components/HR/HrTabsBar";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { useNativeTitleTooltips } from "@/hooks/useNativeTitleTooltips";
import { roleCategories } from "@/config/users";
import { getUserActiveJobs, clockOutFromJob } from "@/lib/database/jobClocking";
import { getWelcomeQuoteSlotKey } from "@/lib/welcomeQuoteSlot";
import BrandLogo from "@/components/BrandLogo";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";
import { trace, useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed

const PRESENTATION_ROLE_STORAGE_KEY = "presentation:activeRoleKey";

const PARTS_NAV_ROLES = new Set(["parts", "parts manager"]);

const MODE_STORAGE_KEY = "appModeSelection";
const MODE_ROLE_MAP = {
  Retail: new Set((roleCategories.Retail || []).map((role) => role.toLowerCase())),
  Sales: new Set((roleCategories.Sales || []).map((role) => role.toLowerCase())),
};
const NAV_DRAWER_WIDTH = 260;
// Collapsed desktop rail: the sidebar shrinks to an icon-only strip instead of
// hiding entirely when "closed" (see StaffSidebar isCollapsed mode).
const COLLAPSED_RAIL_WIDTH = 48;
const STATUS_DRAWER_WIDTH = 560;
const LOGIN_SHELL_LOADING_EVENT = "hnp:login-shell-loading";
const LOGIN_SHELL_LOADING_STORAGE_KEY = "hnp-login-shell-loading";
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
  publicRoute = false,
}) {
  const { user, loading: userLoading, status, setStatus, currentJob, dbUserId } = useUser(); // get user context data
  const { usersByRole } = useRoster();
  const router = useRouter();
  const [showLoginShellLoading, setShowLoginShellLoading] = useState(false);
  // Optimistic sidebar highlight. Driven by router.events so the sidebar can
  // highlight the clicked item the instant a real navigation starts, before
  // router.asPath catches up (Pages Router only updates asPath on completion).
  // We deliberately do NOT use this to swap the page content for a skeleton —
  // the destination page renders its own shell instead (see showPageSkeleton).
  const [pendingHref, setPendingHref] = useState(null);
  // Customer PORTAL route (singular "/customer"). Must NOT match the staff-side
  // customer pages at "/customers" (plural) — those are normal staff pages that
  // need the full staff chrome. A bare startsWith("/customer") wrongly matched
  // "/customers/[slug]" and stripped its sidebar/topbar.
  const customerPortalPath = router.pathname || "";
  const isCustomerRoute =
    customerPortalPath === "/customer" || customerPortalPath.startsWith("/customer/");
  const hideSidebar =
    (router.pathname === "/login" && !showLoginShellLoading) ||
    router.pathname === "/loginPresentation";
  const showHrTabs =
    (router.pathname.startsWith("/hr") && router.pathname !== "/hr/manager") ||
    router.pathname.startsWith("/admin/users");
  const isMessagesRoute = router.pathname === "/messages";

  const [viewportWidth, setViewportWidth] = useState(1440);
  const [viewportHeight, setViewportHeight] = useState(900);
  useMessagesBadge(dbUserId);
  // Replace native browser title= tooltips on buttons app-wide with the
  // staffglobal styled tooltip (.app-hover-tooltip). Mounted once here.
  useNativeTitleTooltips();

  const isTablet = viewportWidth <= 1024;
  const isMobile = viewportWidth <= 640; // phone view cutoff
  const isVerticalPhone = isMobile && viewportHeight >= viewportWidth;
  // Fixed-card scroll model gate. On desktop staff pages the whole chrome is
  // locked to the viewport (no page scroll); the page card becomes a constant-
  // size rounded panel that scrolls its content internally, with the topbar
  // folding away as you scroll so the card grows up into its space. Excluded:
  // login (hideSidebar), tablet/mobile (kept on whole-page scroll), and the
  // messages route (which already runs its own fixed-height layout).
  const lockViewport = !hideSidebar && !isTablet && !isMessagesRoute;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusSidebarOpen, setIsStatusSidebarOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [navToggleHover, setNavToggleHover] = useState(false);
  const workspaceNavEnabled = !presentationShell && isWorkspaceNavEnabled();
  const closeSidebar = () => setIsSidebarOpen(false);
  // Fixed-card scroll model (desktop staff pages): the page card is a constant-
  // size rounded frosted frame; its content scrolls inside an inner scroller
  // (pageScrollRef) that runs up behind the always-visible topbar at the top and
  // tucks behind the card's frame at the bottom/sides, so the content slides
  // behind the panel edges instead of butting against the border.
  const pageScrollRef = useRef(null);
  // Measured content/scroller geometry for the "in-between zone" fix below.
  // pageStackRef = the in-flow content stack; availSmallRef caches the card's
  // at-rest (bar-shown) inner height; topbarScrolledRef mirrors the bar's folded
  // state for the ResizeObserver callback (which can't read React state directly).
  const pageStackRef = useRef(null);
  const availSmallRef = useRef(0);
  const topbarScrolledRef = useRef(false);
  // Extra scroll room added to the bottom of the inner scroller ONLY when the
  // page content is in the in-between zone — tall enough to overflow the card
  // while the bar is shown, short enough to (nearly) fit once the bar folds.
  // Without it that zone jitters: folding grows the card, the content fits,
  // scrollTop snaps to 0, the bar unfolds, it overflows again. The spacer keeps
  // a little range past the fold so the bar stays folded and all content shows.
  const [lockedBottomSpacer, setLockedBottomSpacer] = useState(0);

  // Auto-hide topbar (desktop). Lifted here — rather than owned inside
  // StaffTopbar — so the page card can react to the bar's folded state: when the
  // bar folds away the card rises up into its vacated slot (top moves up, bottom
  // stays pinned); when the bar is shown the card rests below it with a gap. In
  // the locked model the bar is an absolute overlay and the page itself does not
  // scroll, so the hook watches the inner page scroller (pageScrollRef).
  const enableTopbarAutoHide = !isTablet && !hideSidebar;
  // While the topbar's global search is in use (focused or its results list open)
  // the bar must stay visible and never fold away — fed to the hook as suppressHide.
  const [topbarSearchActive, setTopbarSearchActive] = useState(false);
  const {
    wrapperRef: topbarWrapperRef,
    barRef: topbarBarRef,
    wrapperStyle: topbarWrapperStyle,
    barStyle: topbarBarStyle,
    floating: topbarScrolled,
  } = useAutoHideTopbar({
    enabled: enableTopbarAutoHide,
    overlay: lockViewport,
    scrollRef: pageScrollRef,
    suppressHide: topbarSearchActive,
  });

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
  const activeWorkspaceDepartment = workspaceNavEnabled
    ? getActiveWorkspaceDepartment(router.asPath || router.pathname, userRoles)
    : null;
  const workspaceQuickActions = workspaceNavEnabled
    ? getQuickActions(userRoles, activeWorkspaceDepartment)
    : null;

  const canUseServiceActions = userRoles.some((role) => SERVICE_ACTION_ROLES.has(role));
  const techsList = usersByRole?.["Techs"] || [];
  const motTestersList = usersByRole?.["MOT Tester"] || [];
  const allowedTechNames = new Set([...techsList, ...motTestersList]);
  // In presentation mode the real user's identity must NOT bleed through —
  // name-derived flags and welcome-quote keying should all be driven by the
  // picked demo role, never the actual logged-in user.
  const realUsername = typeof user?.username === "string" ? user.username.trim() : "";
  const normalizedUsername = presentationShell ? "" : realUsername;
  const userIdForQuote = presentationShell
    ? null
    :
    user?.authUuid ||
    user?.id ||
    user?.email ||
    normalizedUsername ||
    null;
  const hasTechRole = userRoles.some((role) => role.includes("tech") || role.includes("mot"));
  const isTech = presentationShell
    ? hasTechRole
    : (normalizedUsername && allowedTechNames.has(normalizedUsername)) || hasTechRole;
  const canViewStatusSidebar = presentationShell || userRoles.some((role) =>
    statusSidebarRoles.includes(role)
  );
  const hasPartsAccess = userRoles.some((role) => PARTS_NAV_ROLES.has(role));
  const isPartsManager = userRoles.includes("parts manager");

  // Role-aware workspace for the top bar (computed centrally here so the bar
  // stays presentational). All the reusable pieces live in src/config/topbar,
  // src/hooks and src/lib/topbar; adding a department extends those, not the bar.
  const departmentCode = resolveDepartmentForRoles(userRoles);

  // Phase 2.1/2.2: live operational metrics (endpoint + roster). The 2026-07
  // layout refinement surfaces these as their own Live KPI + Smart Insight
  // sections (see buildTopbarSections) instead of one rotating status line.
  const operationalSnapshot = useOperationalSnapshot({
    department: departmentCode,
    isPresentation: presentationShell,
    // The KPI/insight sections are desktop-only, so don't poll on tablet/mobile.
    enabled: !isTablet,
  });
  // Live KPI widgets (2.2) + Smart Insight prompts (2.6) as separate sections.
  const topbarSections = useMemo(
    () =>
      buildTopbarSections(departmentCode, operationalSnapshot.metrics, {
        isPresentation: presentationShell,
      }),
    [departmentCode, operationalSnapshot.metrics, presentationShell]
  );
  // Phase 2.4: configurable role-specific quick actions (manifest wins, else the
  // capability defaults). Preserves the previous behaviour, de-hardcoded.
  const topbarQuickActions = resolveQuickActions({
    manifestQuickActions: workspaceQuickActions,
    canUseServiceActions,
    hasPartsAccess,
  });
  // Phase 2.3: Continue Where You Left Off.
  const continueContext = useContinueContext(router.asPath, {
    enabled: !presentationShell,
  });
  // The current page as a candidate for the command palette's favourite/recent
  // surfaces (WorkspaceCommandCenter). The bar's own Pinned Shortcuts section was
  // removed in the 2026-07 layout refinement, but the command centre still uses
  // this to offer "favourite this page".
  const currentPinItem = useMemo(() => {
    const base = (router.asPath || "").split("?")[0].split("#")[0];
    if (!base || base === "/") return null;
    const segs = base.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "home";
    const label = last
      .replace(/\[|\]/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { href: base, label };
  }, [router.asPath]);

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
    if (typeof window === "undefined") return undefined;

    const readLoginShellLoading = () => {
      const shouldShow =
        router.pathname === "/login" &&
        window.sessionStorage.getItem(LOGIN_SHELL_LOADING_STORAGE_KEY) === "1";
      setShowLoginShellLoading(shouldShow);
    };

    readLoginShellLoading();
    window.addEventListener(LOGIN_SHELL_LOADING_EVENT, readLoginShellLoading);
    return () => window.removeEventListener(LOGIN_SHELL_LOADING_EVENT, readLoginShellLoading);
  }, [router.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (router.pathname === "/login") return;
    window.sessionStorage.removeItem(LOGIN_SHELL_LOADING_STORAGE_KEY);
    setShowLoginShellLoading(false);
  }, [router.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (requiresLandscape) {
      document.body.classList.add("require-landscape");
    }
    return () => {
      document.body.classList.remove("require-landscape");
    };
  }, [requiresLandscape]);

  // Reset the inner scroller to the top on navigation (the layout — and so the
  // scrolling element — persists across route changes, so scrollTop would
  // otherwise carry over from the previous page).
  useEffect(() => {
    if (pageScrollRef.current) pageScrollRef.current.scrollTop = 0;
  }, [router.pathname]);

  // Mirror the bar's folded state into a ref so the ResizeObserver below can read
  // it without re-subscribing on every fold.
  useEffect(() => {
    topbarScrolledRef.current = topbarScrolled;
  }, [topbarScrolled]);

  // In-between-zone hold (locked-viewport model only). When the page content is
  // taller than the bar-shown card but fits — or nearly fits — once the bar folds
  // and the card grows, we add just enough bottom spacing inside the inner
  // scroller that scrolling can fold the bar AND keep a little range past the
  // fold. That stops the fold → card-grows → content-fits → snap-to-top → unfold
  // jitter, so the bar stays folded (the section extends down) and all content
  // becomes reachable. Short content (no overflow) and tall content (genuine
  // scroll) both compute a zero spacer and behave exactly as before.
  useEffect(() => {
    if (!lockViewport || typeof window === "undefined") {
      setLockedBottomSpacer(0);
      return undefined;
    }
    const scroller = pageScrollRef.current;
    const stack = pageStackRef.current;
    if (!scroller || !stack || typeof ResizeObserver === "undefined") return undefined;

    // Distance the card grows when the bar folds away — mirrors lockedCardTopOffset
    // (page gutter + 75px topbar + 12px gap). Read the gutter from the same token.
    const computeCollapseDistance = () => {
      const parsed = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--page-gutter-y")
      );
      const gutter = Number.isFinite(parsed) ? parsed : 18;
      return gutter + 75 + 12;
    };

    const HOLD_MARGIN = 12; // keep a little range past the fold so it never snaps back

    const recompute = () => {
      const collapse = computeCollapseDistance();
      // The card's height animates as the bar folds, so only trust a reading taken
      // while the bar is docked; reuse the cached value during/after a fold.
      if (!topbarScrolledRef.current) {
        availSmallRef.current = scroller.clientHeight;
      }
      const availSmall = availSmallRef.current || scroller.clientHeight;
      const availBig = availSmall + collapse;
      const content = stack.getBoundingClientRect().height;
      const spacer =
        content > availSmall + 1 ? Math.max(0, availBig + HOLD_MARGIN - content) : 0;
      setLockedBottomSpacer((prev) => (Math.abs(prev - spacer) < 0.5 ? prev : spacer));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(scroller);
    ro.observe(stack);
    recompute();
    return () => ro.disconnect();
  }, [lockViewport, router.pathname]);

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
    if (publicRoute) return;
    if (showLoginShellLoading) return;
    if (userLoading) return;
    if (user === null && !hideSidebar) {
      trace("layout", "user is null on a gated route -> router.replace(/login)", {
        route: router.pathname,
      });
      router.replace("/login");
    }
  }, [user, userLoading, hideSidebar, router, presentationShell, publicRoute, showLoginShellLoading]);

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
  // The global PageSkeleton is shown ONLY while the session is still resolving
  // on a gated route (pre-auth) — i.e. there is genuinely no page to render yet
  // because we don't know who the user is. We deliberately do NOT swap children
  // for a generic skeleton during client-side route transitions: doing so hid
  // the destination page's own shell behind a generic placeholder and made
  // navigation feel like "the app is loading a page" rather than the page
  // opening instantly. Route-transition feedback is handled entirely by the top
  // RouteProgressBar (mounted in _app.js) plus the sidebar's optimistic active
  // state (driven by pendingHref). Each destination page renders its own shell
  // immediately and skeletons only its inner data areas while data loads.
  const isPreAuthLoading = !publicRoute && !presentationShell && !hideSidebar && (userLoading || !user);
  const showPageSkeleton = isPreAuthLoading;

  // TEMP diagnostic: each of these flipping is a candidate for the page
  // "flicking off then coming back" — skeleton flags swap children for the
  // shared loading skeleton while keeping the layout shell mounted.
  useTraceValue("layout.route", router.pathname);
  useTraceValue("layout.isPreAuthLoading", isPreAuthLoading);
  useTraceValue("layout.showLoginShellLoading", showLoginShellLoading);
  useTraceValue("layout.hideSidebar", hideSidebar);

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

  // Optimistic sidebar highlight. On routeChangeStart for a *real* navigation
  // (not shallow, not hash/query-only) we record the destination href so the
  // clicked sidebar item lights up immediately — the only content-area feedback
  // during a transition is the destination page rendering its own shell. The
  // top RouteProgressBar handles the "click acknowledged" cue. Cleared on
  // complete/error.
  useEffect(() => {
    if (!router?.events) return undefined;

    const pathOnly = (url = "") => String(url).split("#")[0].split("?")[0];

    const handleStart = (url, { shallow } = {}) => {
      if (shallow) return;
      if (pathOnly(url) === pathOnly(router.asPath)) return; // hash/query-only — ignore
      setPendingHref(pathOnly(url)); // light up the clicked sidebar item immediately
    };
    const handleDone = () => {
      setPendingHref(null);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
    };
  }, [router]);

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

  // The full Layout (sidebar + topbar) always mounts. The inner content area
  // renders a <PageSkeleton /> in place of {children} ONLY during the pre-auth
  // window (session still resolving on a gated route). During ordinary
  // client-side navigation the destination page's own shell renders straight
  // away — no generic placeholder swap.

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
  const serviceSidebarSections = [
    ...accountsSidebarSections,
  ];
  const sidebarExtraSections = workspaceNavEnabled ? [] : serviceSidebarSections;
  const combinedSidebarSections = [...sidebarSections, ...sidebarExtraSections];
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
    if (workspaceNavEnabled) return;
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

  if (workspaceNavEnabled) {
    getSearchItems(userRoles).forEach((item) => {
      const sanitized = item.label.replace(/[^a-zA-Z0-9\s]/g, " ").toLowerCase();
      navigationItems.push({
        label: item.label,
        href: item.href,
        keywords: sanitized
          .split(" ")
          .map((part) => part.trim())
          .filter(Boolean),
        section: item.department || "Workspace",
      });
    });
  }

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
    addNavItem("Archive Job", "/archive", {
      keywords: ["archive", "job archive", "archived jobs"],
      description: "Archive completed job cards",
      section: "General",
    });
  }

  if (isTech) {
    addNavItem("My Jobs", "/tech", {
      keywords: ["my jobs", "jobs", "tech"],
      section: "Workshop",
    });
    addNavItem("Start Job", "/tech", {
      keywords: ["start job", "tech"],
      section: "Workshop",
    });
    addNavItem("Request Consumables", "/consumables-request", {
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
    addNavItem("Next Jobs", "/nextjobs", {
      keywords: ["next jobs", "waiting list", "queue"],
      section: "Workshop",
    });
  }

  if (userRoles.includes("workshop manager")) {
    addNavItem("Consumables Tracker", "/consumables-tracker", {
      keywords: ["consumables", "tracker", "budget"],
      description: "Monitor consumable spend, reminders, and supplier details",
      section: "Workshop",
    });
  }

  if (viewRoles.some((r) => userRoles.includes(r))) {
    addNavItem("Job Cards", "/jobs", {
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
    addNavItem("Deliveries", "/deliveries", {
      keywords: ["parts deliveries", "goods in", "stock"],
      description: "Review inbound deliveries and update stock",
      section: "Parts",
    });
    addNavItem("Delivery/Collection Planner", "/delivery-planner", {
      keywords: ["delivery planner", "collection planner", "routes", "outbound"],
      description: "Plan outbound runs and manage scheduled collections",
      section: "Parts",
    });
  }

  if (isPartsManager) {
    addNavItem("Parts Manager Dashboard", "/parts-manager", {
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
  const allowPresentationChromeInteraction = (event) =>
    Boolean(event.target?.closest?.("[data-presentation-allow-interaction='true']"));
  const lockChromeInteraction = presentationShell
    ? {
        onClickCapture: (event) => {
          if (allowPresentationChromeInteraction(event)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        onSubmitCapture: (event) => {
          if (allowPresentationChromeInteraction(event)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        onInputCapture: (event) => {
          if (allowPresentationChromeInteraction(event)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        onChangeCapture: (event) => {
          if (allowPresentationChromeInteraction(event)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        onKeyDownCapture: (event) => {
          if (allowPresentationChromeInteraction(event)) return;
          event.preventDefault();
          event.stopPropagation();
        },
      }
    : {};

  const mainColumnMaxWidth = hideSidebar ? "100%" : "100%";
  const layoutStyles = {
    display: hideSidebar ? "block" : "flex",
    flexDirection: isTablet ? "column" : "row",
    // Locked-viewport (fixed-card) model pins the whole chrome to the viewport so
    // the page card scrolls internally instead of the page scrolling. Other modes
    // keep the natural min-height/auto-grow with page scroll.
    height: lockViewport ? "100vh" : "auto",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    fontFamily: "var(--font-family)",
    background: "transparent",
    color: colors.text,
    justifyContent: hideSidebar ? "center" : "flex-start",
    alignItems: hideSidebar ? "center" : "stretch",
    gap: hideSidebar ? "0" : "12px",
    padding: hideSidebar ? "0" : isTablet ? "12px" : "0 16px",
    boxSizing: "border-box",
    overflow: hideSidebar || lockViewport ? "hidden" : "visible",
    position: "relative",
  };
  const showDesktopSidebar = !hideSidebar && !isTablet;
  const showMobileSidebar = !hideSidebar && isTablet;
  const showDesktopStatusControls = !hideSidebar && canViewStatusSidebar && !isTablet;
  const showMobileStatusSidebar = !hideSidebar && canViewStatusSidebar && isTablet && isStatusSidebarOpen;
  const mobileDrawerWidth = Math.min(420, viewportWidth);
  const navDrawerTargetWidth = isTablet ? mobileDrawerWidth : NAV_DRAWER_WIDTH;
  // +16 compensates for the chrome's 16px left padding so the open-state toggle
  // anchors to the sidebar's right edge.
  const navButtonPaddingOffset = !isTablet && !hideSidebar ? 16 : 0;
  // The toggle's flat side anchors to the screen edge when closed and to the
  // sidebar's right edge when open.
  const navToggleAnchor = isSidebarOpen
    ? navDrawerTargetWidth + navButtonPaddingOffset
    : COLLAPSED_RAIL_WIDTH + navButtonPaddingOffset;
  // Direction-aware sidebar motion — must mirror StaffSidebar's MOTION so the
  // rail, shell, buttons and edge nub all move as one. Opening reveals with a
  // longer, softer easeOutExpo; closing keeps the snappier easeInOutCubic.
  const sidebarMotion = isSidebarOpen
    ? "0.52s cubic-bezier(0.16, 1, 0.3, 1)"
    : "0.4s cubic-bezier(0.65, 0, 0.35, 1)";
  const showNavToggleButton = !hideSidebar && !isTablet; // Hide on tablet/mobile since we use tab-style buttons
  // Sidebar toggle geometry. The button is drawn double-width and then clipped
  // back to its outer half, so only a clean semicircular nub protrudes past the
  // anchor edge. This makes the close ("‹") nub identical to the open ("›") nub:
  // the flat back is removed by the clip exactly the way the viewport edge hides
  // it in the closed state — instead of the nub floating as a full oval beside
  // the translucent panel.
  const toggleNub = isMobile ? 16 : isTablet ? 18 : 20; // visible protrusion + corner radius
  const toggleHeight = isMobile ? 48 : isTablet ? 52 : 56;
  const toggleFontSize = isMobile ? "14px" : isTablet ? "16px" : "18px";
  const fixedMessagesPageHeight = isTablet
    ? "calc(100vh - 75px - 12px - (var(--page-gutter-y-mobile) * 2))"
    : "calc(100vh - 75px - 12px - (var(--page-gutter-y) * 2))";

  // Fixed-card model: the page card is a frosted *frame* that clips (overflow
  // hidden) and scrolls its content internally. It sits BELOW the overlay topbar
  // with a clean gap (see lockedCardTopOffset) and keeps its normal padding all
  // round, so the card reads as its own panel — like the sidebar beside it —
  // rather than tucking up behind the bar.
  const lockedCardFrameStyle = lockViewport
    ? { height: "100%", minHeight: 0, overflow: "hidden" }
    : null;
  // Two resting heights for the card's top edge in the locked model:
  //  • at top      → card sits BELOW the bar: gutter + 75px bar + 12px gap (the
  //    12px matches the sidebar-to-main-column chrome gap, so both gaps read
  //    alike).
  //  • scrolled    → the moment scrolling starts the bar folds away and the card
  //    RISES into the bar's slot, its top edge landing at the topbar's top edge.
  //    The main column already contributes the page gutter, so the scrolled
  //    offset is zero; adding the gutter here created a visible ~20px drop.
  //    The two animate together. The bar (and the gap) come back only when
  //    scrolled all the way back to the top. Bottom stays pinned throughout.
  const lockedCardTopOffset = "calc(var(--page-gutter-y) + 75px + 12px)"; // gutter + topbar height + gap
  const lockedCardScrolledOffset = "0"; // card top rises to the topbar's top edge once scrolled


  // Customer portal owns its own shell (CustomerLayout). Bypass the staff app
  // chrome — no global Sidebar, no topbar, no status sidebar, no floating
  // notes — and render the page directly so it can occupy the full viewport.
  if (isCustomerRoute) {
    return <>{children}</>;
  }

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
            width: isSidebarOpen ? `${NAV_DRAWER_WIDTH}px` : `${COLLAPSED_RAIL_WIDTH}px`,
            minWidth: isSidebarOpen ? `${NAV_DRAWER_WIDTH}px` : `${COLLAPSED_RAIL_WIDTH}px`,
            padding: "16px 0",
            // Pin the rail to the viewport so the page scrolls behind it while the
            // sidebar keeps its own internal scroll. flex-start stops it stretching
            // to the full content height (which is what let it scroll away before).
            // height 100vh + the 16px top/bottom padding mirrors the Job Tracker
            // sidebar's 16px viewport gap.
            alignSelf: "flex-start",
            height: "100vh",
            maxHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transition: `width ${sidebarMotion}, min-width ${sidebarMotion}`,
            willChange: "width",
            position: "sticky",
            top: 0,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Sidebar
            onToggle={!isTablet ? undefined : closeSidebar}
            isCollapsed={!isSidebarOpen}
            extraSections={sidebarExtraSections}
            visibleRoles={userRoles}
            allowedRoutes={presentationAllowedRoutes}
            presentationRoleKey={activePresentationRole?.key || null}
            inPresentationMode={presentationShell}
            pendingHref={pendingHref}
            isAuthLoading={isPreAuthLoading}
          />
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
          minWidth: 0,
          width: hideSidebar ? "100%" : "100%",
          display: "flex",
          flexDirection: "column",
          gap: hideSidebar ? 0 : "12px",
          padding: hideSidebar
            ? "0"
            : isMessagesRoute
              ? isTablet
                ? "var(--page-gutter-y-mobile) var(--page-gutter-x-mobile)"
                : "var(--page-gutter-y) var(--page-gutter-x) 16px"
              : undefined,
          background: "transparent",
          // Locked-viewport model fills the chrome height and clips, so the page
          // card below scrolls internally; other modes auto-grow with page scroll.
          height: lockViewport ? "100%" : "auto",
          maxHeight: lockViewport ? "100%" : "none",
          minHeight: lockViewport ? 0 : undefined,
          overflowY: (isMessagesRoute || lockViewport) && !hideSidebar ? "hidden" : "visible", // allow full page scroll across breakpoints
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
                onClick={() => setIsSidebarOpen(true)}
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
                    background: "rgba(var(--text-1-rgb), 0.65)",
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
                    extraSections={sidebarExtraSections}
                    visibleRoles={userRoles}
                    allowedRoutes={presentationAllowedRoutes}
                    presentationRoleKey={activePresentationRole?.key || null}
                    inPresentationMode={presentationShell}
                    pendingHref={pendingHref}
                    isAuthLoading={isPreAuthLoading}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {!hideSidebar && (
          <StaffTopbar
            isMobile={isMobile}
            isTablet={isTablet}
            isVerticalPhone={isVerticalPhone}
            lockChromeInteraction={lockChromeInteraction}
            colors={colors}
            kpis={topbarSections.kpis}
            insightViews={topbarSections.insights}
            isTech={isTech}
            status={status}
            presentationShell={presentationShell}
            currentJob={currentJob}
            onStartJob={() => setIsModalOpen(true)}
            onStatusChange={handleStatusChange}
            navigationItems={navigationItems}
            userRoles={userRoles}
            resumeItem={continueContext.mostRecent}
            overlay={lockViewport}
            onSearchActiveChange={setTopbarSearchActive}
            wrapperRef={topbarWrapperRef}
            barRef={topbarBarRef}
            wrapperStyle={topbarWrapperStyle}
            barStyle={topbarBarStyle}
          />
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
            minHeight: 0,
            // Locked model: the card frame rests below the overlay topbar (gap)
            // at the top, and rises into the bar's slot (top edge to the bar's
            // top) the moment scrolling starts, as the bar folds away — bottom
            // stays pinned, only the top edge moves. Animated.
            marginTop:
              lockViewport && !hideSidebar
                ? topbarScrolled
                  ? lockedCardScrolledOffset
                  : lockedCardTopOffset
                : undefined,
            transition:
              lockViewport && !hideSidebar
                ? "margin-top 0.45s cubic-bezier(0.4, 0, 0.2, 1)"
                : undefined,
            height: isMessagesRoute && !hideSidebar ? fixedMessagesPageHeight : undefined,
            maxHeight: isMessagesRoute && !hideSidebar ? fixedMessagesPageHeight : undefined,
            overflow: (isMessagesRoute || lockViewport) && !hideSidebar ? "hidden" : undefined,
          }}
        >
          <div
            className="app-page-content"
            style={{
              maxWidth: hideSidebar ? "100%" : undefined,
              minHeight: (isMessagesRoute || lockViewport) && !hideSidebar ? 0 : "100%",
              height: (isMessagesRoute || lockViewport) && !hideSidebar ? "100%" : undefined,
              overflow: (isMessagesRoute || lockViewport) && !hideSidebar ? "hidden" : "visible",
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
                  ? lockedCardFrameStyle || undefined
                  : contentBackground
                    ? { background: contentBackground, ...(lockedCardFrameStyle || {}) }
                    : isMessagesRoute
                      ? {
                          height: "100%",
                          minHeight: 0,
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }
                      : lockedCardFrameStyle || undefined
              }
            >
              {/* In the fixed-card model this wrapper is the inner scroller: it
                  fills the card frame (which already sits below the overlay topbar)
                  and scrolls the content internally. */}
              <div
                ref={lockViewport ? pageScrollRef : undefined}
                style={
                  lockViewport
                    ? {
                        width: "100%",
                        height: "100%",
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        overscrollBehavior: "contain",
                        position: "relative",
                      }
                    : {
                        width: "100%",
                        minHeight: isMessagesRoute && !hideSidebar ? 0 : "100%",
                        height: isMessagesRoute && !hideSidebar ? "100%" : undefined,
                        position: "relative",
                      }
                }
              >
                <div ref={pageStackRef} className="app-page-stack" style={isMessagesRoute && !hideSidebar ? { height: "100%", minHeight: 0, overflow: "hidden" } : undefined}>
                  {showHrTabs && <HrTabsBar />}
                  {showPageSkeleton ? <PageSkeleton /> : children}
                </div>
                {/* In-between-zone hold (see lockedBottomSpacer): keeps a little
                    scroll range past the fold so the bar stays folded and the
                    section's content extends fully into view. Zero on short and
                    genuinely-tall pages, so it never adds dead space there. */}
                {lockViewport && lockedBottomSpacer > 0 && (
                  <div aria-hidden="true" style={{ height: `${lockedBottomSpacer}px` }} />
                )}
              </div>
            </DevLayoutSection>
          </div>
        </DevLayoutSection>
      </DevLayoutSection>

      {showNavToggleButton && (
        <button
          type="button"
          onClick={toggleSidebar}
          onMouseEnter={() => setNavToggleHover(true)}
          onMouseLeave={() => setNavToggleHover(false)}
          onFocus={() => setNavToggleHover(true)}
          onBlur={() => setNavToggleHover(false)}
          // Edge-toggle, not a square dismiss button — class exempts it from the
          // global `[aria-label*="Close "]` close-button sizing rule.
          className="app-sidebar-edge-toggle"
          style={{
            position: "fixed",
            top: "50%",
            // Drawn double-width starting one nub to the left of the anchor; the
            // clip below hides that left half so the flat back never shows.
            left: `${navToggleAnchor - toggleNub}px`,
            transform: "translateY(-50%)",
            width: `${toggleNub * 2}px`,
            height: `${toggleHeight}px`,
            borderRadius: "0 var(--radius-pill) var(--radius-pill) 0",
            clipPath: `inset(0 0 0 ${toggleNub}px)`, // reveal only the rounded outer half
            // Full shorthand overrides the global --control-padding so the arrow
            // centres in the visible nub; left pad = nub offsets the clipped half.
            padding: `0 0 0 ${toggleNub}px`,
            boxSizing: "border-box",
            border: "none",
            background: "var(--primary)",
            color: "var(--surface)",
            fontSize: toggleFontSize,
            fontWeight: 700,
            boxShadow: "none",
            cursor: "pointer",
            zIndex: 3600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center", // centre the arrow within the visible half-circle nub
            // Glide the edge nub in lockstep with the rail width (same
            // direction-aware motion) so it tracks the sidebar edge smoothly.
            transition: `left ${sidebarMotion}`,
          }}
          aria-label={isSidebarOpen ? "Close navigation sidebar" : "Open navigation sidebar"}
        >
          {isSidebarOpen ? "‹" : "›"}
        </button>
      )}

      {/* Tooltip anchored ABOVE the edge toggle. Rendered as a sibling (not a
          child) because the button's clipPath would otherwise clip it. Centred
          on the visible nub and pinned just above it; it glides with the nub via
          the same direction-aware motion. */}
      {showNavToggleButton && navToggleHover && (
        <div
          role="tooltip"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: `${navToggleAnchor + toggleNub / 2}px`,
            bottom: `calc(50% + ${toggleHeight / 2 + 10}px)`,
            transform: "translateX(-50%)",
            zIndex: 3601,
            padding: "6px 10px",
            borderRadius: "var(--control-radius-xs)",
            background: "var(--primary-hover)",
            color: "var(--onAccentText)",
            fontSize: "12px",
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "none",
            transition: `left ${sidebarMotion}`,
          }}
        >
          {isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          {/* Little caret pointing down at the nub. */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              marginTop: "-4px",
              width: 8,
              height: 8,
              background: "var(--primary-hover)",
            }}
          />
        </div>
      )}

      {/* Desktop floating status sidebar */}
      {showDesktopStatusControls && (
        <>
          <button
            type="button"
            onClick={() => setIsStatusSidebarOpen((prev) => !prev)}
            // Edge-toggle, not a square dismiss button — class exempts it from the
            // global `[aria-label*="Close "]` close-button sizing rule.
            className="app-sidebar-edge-toggle"
            style={{
              position: "fixed",
              top: "50%",
              // Mirror of the nav toggle: drawn double-width starting one nub to
              // the right of the anchor; the clip hides that right half.
              right: `${(isStatusSidebarOpen ? STATUS_DRAWER_WIDTH : 0) - toggleNub}px`,
              transform: "translateY(-50%)",
              width: `${toggleNub * 2}px`,
              height: `${toggleHeight}px`,
              borderRadius: "var(--radius-pill) 0 0 var(--radius-pill)",
              clipPath: `inset(0 ${toggleNub}px 0 0)`, // reveal only the rounded outer half
              // Full shorthand overrides the global --control-padding so the arrow
              // centres in the visible nub; right pad = nub offsets the clipped half.
              padding: `0 ${toggleNub}px 0 0`,
              boxSizing: "border-box",
              border: "none",
              background: "var(--primary)",
              color: "var(--surface)",
              fontSize: toggleFontSize,
              fontWeight: 700,
              boxShadow: "none",
              cursor: "pointer",
              zIndex: 3400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center", // centre the arrow within the visible half-circle nub
              transition: "right 0.35s ease",
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
            isVerticalPhone={isVerticalPhone}
          />
        </div>
      )}

      {isTech && (
        <JobCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      <TopbarAlerts />
      {/* Phase 3 productivity system — command palette + (progressively) recent,
          favourites, suggestions, shortcuts and widgets. Globally mounted and
          overlay/keyboard-driven so the top bar's height/design is untouched.
          Disabled in the demo shell and on the login shell. */}
      <WorkspaceCommandCenter
        enabled={!presentationShell && !hideSidebar && Boolean(user)}
        currentAsPath={router.asPath}
        currentPage={currentPinItem}
        navigationItems={navigationItems}
        quickActions={topbarQuickActions}
        userRoles={userRoles}
        department={departmentCode}
        metrics={operationalSnapshot.metrics}
      />
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
