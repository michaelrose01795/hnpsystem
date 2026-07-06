// file location: src/components/layout/StaffSidebar.js
// Staff app navigation rail. Renders the role-filtered navigation, message
// badge, clock in/out + logout controls, and presentation-mode page links.
//
// Moved here from src/components/Sidebar.js during the layout cleanup
// (src/components/Sidebar.js is now a thin re-export shim for back-compat).
// Access filtering uses the shared nav config in src/config/navigation.js.
"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { sidebarSections } from "@/config/navigation";
import {
  getActiveWorkspaceDepartment,
  getDepartmentWorkspaceNav,
  getWorkspaceGroups,
  isContextNavItemActive,
  isWorkspaceNavEnabled,
} from "@/config/workspace/manifest";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import ContextSidebar from "@/components/layout/ContextSidebar";
import { recordWorkspaceRecentHref } from "@/hooks/useWorkspaceShortcuts";
import { getSidebarNavIcon } from "@/components/layout/sidebarNavIcons";
import BrandLogo from "@/components/BrandLogo";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { canShowDevPages, canShowDevSidebarItems } from "@/lib/dev-tools/config";
import {
  isOverlayHidden as readOverlayHidden,
  setOverlayHidden as writeOverlayHidden,
  subscribeOverlayVisibility,
} from "@/features/presentation/runtime/overlayVisibility";

const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const PRESENTATION_LOGOUT_DESTINATION = "/loginPresentation";
const PRESENTATION_ROLE_STORAGE_KEY = "presentation:activeRoleKey";
const WORKSPACE_GROUPS_VIEW = "__groups__";

const hiddenHrRoutes = new Set([
  "/hr/employees",
  "/hr/attendance",
  "/hr/payroll",
  "/hr/leave",
  "/hr/performance",
  "/hr/training",
  "/hr/disciplinary",
  "/hr/recruitment",
  "/hr/reports",
  "/hr/settings",
  "/admin/users",
]);

function buildRouteAllowedChecker(allowedRoutes) {
  if (!Array.isArray(allowedRoutes) || allowedRoutes.length === 0) return null;
  const matchers = allowedRoutes.map((template) => {
    if (!template) return () => false;
    const [templatePathWithHash, templateQuery = ""] = String(template).split("?");
    const [templatePath, templateHash = ""] = templatePathWithHash.split("#");
    if (!template.includes("[")) {
      return (candidate) => {
        const [candidatePathWithHash, candidateQuery = ""] = String(candidate || "").split("?");
        const [candidatePath, candidateHash = ""] = candidatePathWithHash.split("#");
        return candidatePath === templatePath && candidateHash === templateHash && candidateQuery === templateQuery;
      };
    }
    const pattern = new RegExp(
      "^" + templatePath.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
    );
    return (candidate) => {
      const [candidatePathWithHash, candidateQuery = ""] = String(candidate || "").split("?");
      const [candidatePath, candidateHash = ""] = candidatePathWithHash.split("#");
      return pattern.test(candidatePath) && candidateHash === templateHash && candidateQuery === templateQuery;
    };
  });
  return (href) => {
    if (!href) return false;
    return matchers.some((m) => m(href));
  };
}

function routeToSlug(route) {
  const [pathWithHash, query = ""] = String(route || "").split("?");
  const [path, hash = ""] = pathWithHash.split("#");
  const base = path
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    || "home";
  const hashSuffix = hash
    ? `-${hash.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  const querySuffix = query
    ? `-${query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  return `${base}${hashSuffix}${querySuffix}`;
}

function buildPresentationHref(href, allowedRoutes, roleKey) {
  if (!roleKey || !Array.isArray(allowedRoutes)) return href;
  const cleanHref = String(href || "");
  const targetIndex = allowedRoutes.findIndex((template) => {
    const [templatePathWithHash, templateQuery = ""] = String(template || "").split("?");
    const [templatePath, templateHash = ""] = templatePathWithHash.split("#");
    const [hrefPathWithHash, hrefQuery = ""] = cleanHref.split("?");
    const [hrefPath, hrefHash = ""] = hrefPathWithHash.split("#");
    if (templatePath.includes("[")) {
      const pattern = new RegExp(
        "^" + templatePath.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
      );
      if (!pattern.test(hrefPath)) return false;
    } else if (hrefPath !== templatePath) {
      return false;
    }
    if (templateHash && templateHash !== hrefHash) return false;
    return templateQuery ? templateQuery === hrefQuery : true;
  });
  if (targetIndex < 0) return href;
  const route = allowedRoutes[targetIndex];
  return `/presentation/${roleKey}/${routeToSlug(route)}/${targetIndex}`;
}

function routeToLabel(route) {
  const PRESENTATION_ROUTE_LABELS = {
    "/admin/compliance": "Admin / Compliance / Dashboard",
    "/admin/compliance/sars": "Admin / Compliance / Subject Requests",
    "/admin/compliance/breaches": "Admin / Compliance / Breaches",
    "/admin/compliance/dpias": "Admin / Compliance / DPIAs",
    "/admin/compliance/ropa": "Admin / Compliance / ROPA",
    "/admin/compliance/retention": "Admin / Compliance / Retention",
  };
  if (PRESENTATION_ROUTE_LABELS[route]) return PRESENTATION_ROUTE_LABELS[route];

  const [path, query = ""] = String(route || "").split("?");
  const label = (path.replace(/^\//, "") || "home")
    .split("/")
    .map((part) =>
      part
        .replace(/\[|\]/g, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(" / ");
  return query ? `${label} (${query.replace(/=/g, ": ").replace(/&/g, ", ")})` : label;
}

// Safe nav scaffolding shown while the user/roles are still resolving. It does
// NOT render any real route links (so no protected route is exposed before roles
// are known) — just shimmer rows so the rail looks alive instead of empty/dead
// on a hard refresh. Replaced by the real role-filtered nav once roles load.
function SidebarNavSkeleton({ groups = 2, rowsPerGroup = 4 }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SkeletonKeyframes />
      {Array.from({ length: groups }).map((_, g) => (
        <div key={g} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <SkeletonBlock width="90px" height="12px" />
          {Array.from({ length: rowsPerGroup }).map((__, r) => (
            <SkeletonBlock key={r} width="100%" height="38px" borderRadius="var(--radius-md, 10px)" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({
  onToggle,
  onNavigate,
  isCondensed = false,
  isCollapsed = false,
  extraSections = [],
  visibleRoles = null,
  allowedRoutes = null,
  presentationRoleKey = null,
  inPresentationMode = false,
  pendingHref = null,
  isAuthLoading = false,
}) {
  const router = useRouter();
  const pathname = (router.asPath || router.pathname || "").split("?")[0];
  // Optimistic active state: in the Pages Router router.asPath does not update
  // until a navigation completes, so the clicked item would otherwise stay
  // un-highlighted for the whole load. pendingHref (set on routeChangeStart by
  // StaffLayout) lets the clicked item light up immediately. Real asPath still
  // wins as the fallback once navigation completes.
  const isItemActive = useCallback(
    (href) => {
      if (!href) return false;
      const base = String(href).split("?")[0].split("#")[0];
      if (pendingHref) return pendingHref === base;
      return pathname === base;
    },
    [pathname, pendingHref]
  );
  const { user, dbUserId } = useUser();
  // Full name for the Profile nav button (replaces the generic "Profile" label).
  // user.username resolves to the signed-in user's display name (see UserContext).
  const fullName = (user?.username || "").trim();
  const { canAccess: canUseDevOverlay, enabled: devOverlayEnabled, toggleEnabled: toggleDevOverlay } =
    useDevLayoutOverlay();
  const canShowDevItems = !inPresentationMode && canShowDevSidebarItems(user);
  const canShowDevPagesLink = !inPresentationMode && canShowDevPages();
  // In presentation mode the sidebar belongs to the demo role, not the real
  // signed-in user — pass null to skip the unread-messages query so the badge
  // doesn't surface the presenter's actual inbox count.
  const { unreadCount } = useMessagesBadge(inPresentationMode ? null : dbUserId);

  // Mirror PresentationProvider's "Hide" state so we can show a "Show overlay"
  // sidebar button when the user has dismissed the popup. The state lives in
  // a module-scope pub/sub (src/features/presentation/runtime/overlayVisibility.js)
  // because PresentationProvider mounts inside the page, below this sidebar.
  const [overlayHidden, setOverlayHiddenLocal] = useState(false);
  useEffect(() => {
    setOverlayHiddenLocal(readOverlayHidden());
    const unsubscribe = subscribeOverlayVisibility((value) => setOverlayHiddenLocal(value));
    return unsubscribe;
  }, []);
  const inPresentationRoute = pathname.startsWith("/presentation");
  const inVisionRoute = pathname === "/vision" || pathname.startsWith("/vision/");
  const workspaceNavEnabled = !inPresentationMode && isWorkspaceNavEnabled();
  const ghostControlStyle = {
    background: "var(--theme)",
    backgroundImage: "none",
    color: "var(--accentText)",
    border: "none",
  };
  const successGhostControlStyle = {
    background: "var(--theme-hover)",
    backgroundImage: "none",
    color: "var(--success-text)",
    border: "none",
  };
  const successControlStyle = {
    background: "var(--success-surface)",
    color: "var(--success-text)",
    border: "none",
  };
  const dangerControlStyle = {
    background: "var(--danger-surface)",
    color: "var(--danger-text)",
    border: "none",
  };
  const handleShowOverlay = useCallback(() => {
    writeOverlayHidden(false);
  }, []);

  const derivedRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const userRoles =
    Array.isArray(visibleRoles) && visibleRoles.length > 0
      ? visibleRoles.map((role) => role.toLowerCase())
      : derivedRoles;
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const previousWorkspacePathRef = useRef(pathname);
  const isRouteAllowed = useMemo(() => buildRouteAllowedChecker(allowedRoutes), [allowedRoutes]);
  const getNavHref = useCallback((href) => {
    if (!inPresentationMode) return href;
    return buildPresentationHref(href, allowedRoutes, presentationRoleKey);
  }, [allowedRoutes, inPresentationMode, presentationRoleKey]);
  const presentationPageLinks = useMemo(() => {
    if (!inPresentationMode || !presentationRoleKey || !Array.isArray(allowedRoutes)) return [];
    return allowedRoutes.map((route, index) => ({
      route,
      href: `/presentation/${presentationRoleKey}/${routeToSlug(route)}/${index}`,
      label: routeToLabel(route),
    }));
  }, [allowedRoutes, inPresentationMode, presentationRoleKey]);
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) => {
    if (isRouteAllowed && shortcut.href && !isRouteAllowed(shortcut.href)) return false;
    if (inPresentationMode && isRouteAllowed && shortcut.href) return true;
    if (!shortcut.roles || shortcut.roles.length === 0) return true;
    return shortcut.roles.some((role) => userRoles.includes(role));
  });
  const headerLogoStyle = {
    width: "100%",
    height: "auto",
    maxHeight: isCondensed ? 180 : 210,
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
  }; // oversized logo spans nearly the full header width while keeping proportions intact

  const groupedSections = useMemo(() => {
    const groups = { general: [], departments: [], account: [] };
    [...sidebarSections, ...extraSections].forEach((section) => {
      const category = section.category || "departments";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(section);
    });
    return groups;
  }, [extraSections]);

  const hasAccess = (item) => {
    // In presentation mode, the doc-driven allowed-routes list is the
    // authoritative filter — items outside the active role's list are hidden
    // even if their `roles` would otherwise grant access.
    if (isRouteAllowed && item?.href) {
      if (!isRouteAllowed(item.href)) return false;
      if (inPresentationMode) return true;
    }
    if (!item.roles || item.roles.length === 0) return true;
    // Check if any of the item's required roles match the user's roles (case-insensitive)
    const access = item.roles.some((requiredRole) =>
      userRoles.some((userRole) => userRole.toLowerCase() === requiredRole.toLowerCase())
    );

    return access;
  };
  const hasRestrictedJobSectionRole = userRoles.some(
    (role) => role === "techs" || role === "mot tester" || role === "valet service"
  );

  const filterAccessibleSections = (sections = []) =>
    sections
      .map((section) => ({
        ...section,
        items: (section.items || []).filter(
          (item) =>
            hasAccess(item) &&
            (inPresentationMode || !item.href || !hiddenHrRoutes.has(item.href)) &&
            (inPresentationMode || !(hasRestrictedJobSectionRole && item.href === "/archive"))
        ),
      }))
      .filter((section) => section.items.length > 0);

  const generalSections = filterAccessibleSections(groupedSections.general);
  const departmentSections = filterAccessibleSections(groupedSections.departments);
  const accountSections = filterAccessibleSections(groupedSections.account);
  // Group Sidebar Flow (Phase 7). The workspace sidebar has two states:
  //   1. GROUPS view — the flat list of top-level groups (General + departments)
  //      the user can access (workspaceGroups).
  //   2. GROUP view — clicking a group replaces the whole sidebar with that
  //      group's context nav (activeWorkspace) plus a "Back to Groups" control.
  // There is no always-visible General section; General is itself a group.
  const workspaceGroups = useMemo(
    () => (workspaceNavEnabled ? getWorkspaceGroups(userRoles) : []),
    [userRoles, workspaceNavEnabled]
  );
  const workspaceGroupKeys = useMemo(
    () => new Set(workspaceGroups.map((group) => group.key)),
    [workspaceGroups]
  );
  const routeWorkspaceKey = useMemo(
    () => (workspaceNavEnabled ? getActiveWorkspaceDepartment(pathname, userRoles) : null),
    [pathname, userRoles, workspaceNavEnabled]
  );
  // Which group is open. An explicit selection wins; the GROUPS_VIEW sentinel
  // forces the flat list even on a route that would otherwise resolve a group;
  // otherwise the current route drives the group (so feature pages open in their
  // group with the active link highlighted, while hub/dashboard pages — not in
  // the nav manifest — fall back to the clean groups list).
  const activeGroupKey =
    selectedGroupKey === WORKSPACE_GROUPS_VIEW
      ? null
      : selectedGroupKey && workspaceGroupKeys.has(selectedGroupKey)
      ? selectedGroupKey
      : routeWorkspaceKey;
  const activeWorkspace = useMemo(
    () => (activeGroupKey ? getDepartmentWorkspaceNav(activeGroupKey, userRoles) : null),
    [activeGroupKey, userRoles]
  );

  useEffect(() => {
    if (!selectedGroupKey) return;
    if (selectedGroupKey === WORKSPACE_GROUPS_VIEW) return;
    if (!workspaceGroupKeys.has(selectedGroupKey)) {
      setSelectedGroupKey(null);
    }
  }, [selectedGroupKey, workspaceGroupKeys]);

  useEffect(() => {
    if (previousWorkspacePathRef.current === pathname) return;
    previousWorkspacePathRef.current = pathname;
    // Keep the currently-open group when navigating between its OWN pages, so
    // moving from (e.g.) News Feed to Tracker inside the General group doesn't
    // kick the user back out to the Groups list. Only fall back to the route-
    // driven group (by clearing the explicit selection) when the destination
    // leaves the open group.
    if (
      selectedGroupKey &&
      selectedGroupKey !== WORKSPACE_GROUPS_VIEW &&
      workspaceGroupKeys.has(selectedGroupKey)
    ) {
      const nav = getDepartmentWorkspaceNav(selectedGroupKey, userRoles);
      const navItems = [
        ...(nav.home ? [{ href: nav.home }] : []),
        ...(nav.dashboards || []),
        ...(nav.items || []),
      ];
      const stillInGroup = navItems.some((item) =>
        isContextNavItemActive(item, pathname)
      );
      if (stillInGroup) return;
    }
    setSelectedGroupKey(null);
  }, [pathname, selectedGroupKey, workspaceGroupKeys, userRoles]);

  const handleNavigationPress = useCallback(() => {
    if (typeof onNavigate === "function") {
      onNavigate();
    }
  }, [onNavigate]);

  const handleLogout = () => {
    // In presentation mode the "logout" action returns to the role picker
    // instead of clearing the real session — the demo user has no session to
    // tear down.
    if (inPresentationMode) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRESENTATION_ROLE_STORAGE_KEY);
        window.location.replace(PRESENTATION_LOGOUT_DESTINATION);
        return;
      }
      router.replace(PRESENTATION_LOGOUT_DESTINATION);
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        LOGOUT_BARRIER_STORAGE_KEY,
        String(Date.now() + LOGOUT_BARRIER_MS)
      );
      window.sessionStorage.setItem(PENDING_LOGOUT_STORAGE_KEY, "1");
      window.location.replace("/login");
      return;
    }
    router.replace("/login");
  };

  // Clock in/out state for sidebar button
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchClockStatus = async () => {
      try {
        const url = dbUserId ? `/api/profile/clock?userId=${dbUserId}` : "/api/profile/clock";
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload?.success) {
          setIsClockedIn(payload.data.isClockedIn);
        }
      } catch (err) {
        console.error("Failed to fetch clock status:", err);
      }
    };
    fetchClockStatus();
  }, [user, dbUserId]);

  const handleClockToggle = useCallback(async () => {
    setClockLoading(true);
    try {
      const action = isClockedIn ? "clock-out" : "clock-in";
      const url = dbUserId ? `/api/profile/clock?userId=${dbUserId}` : "/api/profile/clock";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        setIsClockedIn(!isClockedIn);
      }
    } catch (err) {
      console.error("Clock toggle error:", err);
    } finally {
      setClockLoading(false);
    }
  }, [isClockedIn, dbUserId]);

  // `truncate` ellipsises the label on a single line — used by the Profile
  // button, which now renders the user's (potentially long) full name inside the
  // fixed-width rail. `title` keeps the full text accessible on hover.
  const renderLinkLabel = (label, href, { truncate = false } = {}) => {
    const isMessagesItem = href === "/messages";
    const labelStyle = truncate
      ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }
      : undefined;
    const labelSpan = (
      <span style={labelStyle} title={truncate ? label : undefined}>
        {label}
      </span>
    );
    if (!href) {
      return labelSpan;
    }
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flex: 1,
          minWidth: 0,
        }}
      >
        {labelSpan}
        {isMessagesItem && unreadCount > 0 && (
          <span
            className="app-badge app-badge--danger-strong app-badge--round-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    );
  };

  // Collapsed (44px) rail helpers. Each nav button becomes a single icon button;
  // the text label moves to title/aria-label so it stays accessible and shows on
  // hover. Icon colour follows the design request (var(--theme)).
  // Idle icons match the normal sidebar button text colour (.app-btn--secondary
  // uses var(--text-accent)).
  const ICON_COLOR = "var(--text-accent)";
  const renderNavContent = (label, href, isActive = false, opts = {}) => {
    if (!isCollapsed) return renderLinkLabel(label, href, opts);
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // Fills the 44px button's content box (44 − 2×8px padding = 28px) so
          // the glyph reads large within the collapsed rail.
          width: 28,
          height: 28,
          // Selected item flips the glyph to the surface colour so it reads
          // against the active (accent) button fill; idle glyphs use --theme.
          color: isActive ? "var(--surface)" : ICON_COLOR,
          background: "transparent",
        }}
      >
        {getSidebarNavIcon(label)}
      </span>
    );
  };
  // Collapsed rail keeps sections separated with a short 2px theme line in place
  // of the section-title text. To preserve the EXACT vertical rhythm of the
  // expanded rail (so buttons line up through the whole transition), the divider
  // reuses the title's className — inheriting its font line-height — and the same
  // per-section margins (passed in as `marginStyle`). An invisible single-line
  // spacer forces the box to the title's line height; the rule is centred over it.
  const renderSectionDivider = (key, marginStyle = {}) => (
    <div
      key={key}
      aria-hidden="true"
      className="app-sidebar__section-title"
      style={{
        position: "relative",
        display: "block",
        alignSelf: "stretch",
        flexShrink: 0,
        ...marginStyle,
      }}
    >
      <span style={{ visibility: "hidden" }}>&nbsp;</span>
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span style={{ width: 24, height: 2, borderRadius: 1, background: "var(--theme)" }} />
      </span>
    </div>
  );
  // Pronounced expand/collapse: every nav link carries this transition in BOTH
  // states, so the button width/padding glides between the full label row and
  // the 40px icon square (the label simply gets clipped by the narrowing shell).
  // Direction-aware motion. A CSS transition animates with the easing declared
  // in the *destination* state, so keying off isCollapsed gives each direction
  // its own feel: closing stays the liked easeInOutCubic; opening gets a longer,
  // softer easeOutExpo reveal (quick to move, very gentle settle) so the rail
  // unfurls smoothly instead of decelerating hard.
  const OPEN_MOTION = "0.52s cubic-bezier(0.16, 1, 0.3, 1)"; // easeOutExpo — reveal
  const CLOSE_MOTION = "0.4s cubic-bezier(0.65, 0, 0.35, 1)"; // easeInOutCubic — close
  const MOTION = isCollapsed ? CLOSE_MOTION : OPEN_MOTION;
  const NAV_LINK_TRANSITION = `width ${MOTION}, min-width ${MOTION}, padding ${MOTION}`;
  // Props applied to every nav link. When collapsed: square icon footprint,
  // centred content, and the label surfaced as a tooltip / a11y name.
  const navLinkProps = (label, extraStyle = {}) =>
    isCollapsed
      ? {
          title: label,
          "aria-label": label,
          style: {
            // Match the expanded button's vertical box exactly (height +
            // margin come from .app-btn / .app-btn--nav) so the list lines up
            // through the whole transition. The 44px button is centred in the
            // 48px rail by the body's 2px horizontal padding. Padding tightens
            // to 8px (from --control-padding's 14px) so the larger icon fills
            // the button; because NAV_LINK_TRANSITION animates padding too, the
            // content still glides rather than snapping when toggling.
            width: 44,
            minWidth: 44,
            height: "var(--control-height)",
            minHeight: "var(--control-height)",
            padding: 8,
            justifyContent: "center",
            transition: NAV_LINK_TRANSITION,
            ...extraStyle,
          },
        }
      : { style: { transition: NAV_LINK_TRANSITION, ...extraStyle } };

  const sidebarSectionKey = isCondensed ? "app-sidebar-shell-mobile" : "app-sidebar-shell";
  const sidebarHeaderKey = isCondensed ? "app-sidebar-header-mobile" : "app-sidebar-header";
  const sidebarBodyKey = isCondensed ? "app-sidebar-body-mobile" : "app-sidebar-body";

  return (
    <DevLayoutSection
      as="aside"
      sectionKey={sidebarSectionKey}
      sectionType="section-shell"
      shell
      backgroundToken="app-sidebar-shell"
      className="app-sidebar"
      style={{
        padding: "0",
        width: isCollapsed ? "48px" : isCondensed ? "100%" : "260px",
        minWidth: isCollapsed ? "48px" : isCondensed ? "auto" : "220px",
        height: isCondensed ? "auto" : "100%",
        minHeight: isCondensed ? "auto" : "100%",
        maxHeight: isCondensed ? "100%" : "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--page-card-radius)",
        boxShadow: "none",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "0",
        overflowX: "hidden",
        overflowY: isCondensed ? "visible" : "auto",
        flexShrink: 0,
        // Smooth the 260px ↔ 44px width change so collapsing/expanding glides
        // rather than snapping. Uses the same direction-aware MOTION as the nav
        // buttons and body padding so every moving part travels in lockstep
        // (and the rail in StaffLayout mirrors it).
        transition: `width ${MOTION}, min-width ${MOTION}`,
        willChange: "width",
        // Solid surface sidebar shell (pre-glass design).
        background: "var(--surface)",
      }}
    >
      {/* Header */}
      {/* Brand logo replaces the old Navigation/Workspace labels while keeping header spacing consistent. Background now follows the sidebar theme for both light/dark modes. */}
      <DevLayoutSection
        className="sidebar-logo-header app-sidebar__header"
        sectionKey={sidebarHeaderKey}
        parentKey={sidebarSectionKey}
        sectionType="content-card"
        backgroundToken="app-sidebar-header"
        style={{
          // Sticky so the brand logo stays pinned to the top of the sidebar's
          // own scroll while the nav list slides up behind it. Solid surface
          // fill hides the scrolling nav passing behind the pinned header.
          position: "sticky",
          top: 0,
          zIndex: 3,
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Collapsed rail is only 44px wide; drop the header's horizontal padding
          // so the (shrunken) logo isn't crushed by it.
          padding: isCollapsed ? "0 2px" : undefined,
          height: isCondensed ? "60px" : "75px", // fix the height so the oversized logo crops vertically
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isCollapsed ? (
            // Collapsed rail uses the square desktop-app icon (the same image
            // offered on the desktop-download card) rather than the wide wordmark.
            // Routed through BrandLogo so the icon recolours to the active theme
            // accent, matching the expanded wordmark instead of staying a fixed red.
            <BrandLogo
              src="/images/logo/desktop.png"
              alt="H&P"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <BrandLogo
              alt="H&P logo"
              width={800}
              height={240}
              style={headerLogoStyle}
            />
          )}
        </div>
      </DevLayoutSection>

      <div
        aria-hidden="true"
        style={{
          // Stick the hairline directly beneath the pinned logo header so the
          // separator stays with the logo as the nav list scrolls behind it.
          position: "sticky",
          top: isCondensed ? "60px" : "75px",
          zIndex: 3,
          height: "1px",
          background: "var(--theme)",
          flexShrink: 0,
        }}
      />

      {/* Navigation Content */}
      <DevLayoutSection
        className="app-sidebar__body"
        sectionKey={sidebarBodyKey}
        parentKey={sidebarSectionKey}
        sectionType="content-card"
        backgroundToken="app-sidebar-body"
        style={{
          background: "var(--surface)",
          flex: 1,
          minHeight: 0,
          // Vertical padding stays var(--space-5) in both states so the button
          // column starts at the same Y; only the horizontal padding collapses
          // (0 when collapsed) to fit the 44px rail. Setting it inline in BOTH
          // states + transitioning it lets the button's left edge glide instead
          // of snapping the instant the rail collapses.
          padding: isCollapsed ? "var(--space-5) 2px" : "var(--space-5)",
          transition: `padding ${MOTION}`,
          // IMPORTANT: keep this a BLOCK container in the collapsed state too.
          // The expanded body is block, so its vertical margins collapse (e.g. a
          // department title's margin-top:16 collapses against the preceding
          // button's margin-bottom:8 → 16px gap). A flex column would NOT collapse
          // them (→ 24px), which drifts every section break out of alignment.
          // The 44px buttons already fill the rail's content width, so no flex
          // centring is needed.
        }}
      >
        {presentationPageLinks.length > 0 && (
          <>
            {isCollapsed ? (
              renderSectionDivider("divider-presentation", { marginBottom: "10px" })
            ) : (
              <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
                Presentation Pages
              </div>
            )}
            {presentationPageLinks.map((item) => {
              const isActive = isItemActive(item.href);
              return (
                // presentation deck links — keep prefetch off (live-route blocking)
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={`${item.route}-${item.href}`}
                  href={item.href}
                  prefetch={false}
                  onClick={handleNavigationPress}
                  data-presentation-allow-interaction="true"
                  {...navLinkProps(item.label)}
                >
                  {renderNavContent(item.label, item.href, isActive)}
                </Link>
              );
            })}
          </>
        )}

        {workspaceNavEnabled && (
          (activeWorkspace?.items?.length > 0 || activeWorkspace?.dashboards?.length > 0) ? (
            // GROUP view — the whole sidebar becomes the selected group's nav.
            <ContextSidebar
              workspace={activeWorkspace}
              pathname={pathname}
              pendingHref={pendingHref}
              isCollapsed={isCollapsed}
              getNavHref={getNavHref}
              onNavigate={(href) => {
                recordWorkspaceRecentHref(href);
                handleNavigationPress();
              }}
              onBack={() => setSelectedGroupKey(WORKSPACE_GROUPS_VIEW)}
              navLinkProps={navLinkProps}
              renderNavContent={renderNavContent}
              renderSectionDivider={renderSectionDivider}
            />
          ) : (
            // GROUPS view — the clean list of top-level groups (General first).
            <>
              {isCollapsed ? (
                renderSectionDivider("divider-workspace-groups", { marginBottom: "10px" })
              ) : (
                <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
                  Workspace
                </div>
              )}
              {workspaceGroups.map((group) => {
                const isActive = routeWorkspaceKey === group.key;
                return (
                  <button
                    className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                    {...navLinkProps(group.label)}
                  >
                    {renderNavContent(group.label, null, isActive)}
                  </button>
                );
              })}
            </>
          )
        )}

        {!workspaceNavEnabled && !inPresentationMode && dashboardShortcuts.length > 0 && (
          <>
            {isCollapsed ? (
              renderSectionDivider("divider-dashboard", { marginBottom: "10px" })
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <div className="app-sidebar__section-title">
                  Dashboard
                </div>
                {onToggle && (
                  <button
                    className="app-btn app-btn--secondary app-btn--xs"
                    type="button"
                    onClick={onToggle}
                    aria-label="Close sidebar"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
            {dashboardShortcuts.map((shortcut) => {
              const isActive =
                isItemActive(shortcut.href) ||
                (!pendingHref && pathname && pathname.startsWith(`${shortcut.href}/`));
              return (
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={shortcut.href}
                  href={getNavHref(shortcut.href)}
                  prefetch={inPresentationMode ? false : undefined}
                  title={shortcut.description}
                  onClick={handleNavigationPress}
                  data-presentation-allow-interaction={inPresentationMode ? "true" : undefined}
                  {...navLinkProps(shortcut.label)}
                >
                  {renderNavContent(shortcut.label, shortcut.href, isActive)}
                </Link>
              );
            })}
          </>
        )}

        {/* General Section */}
        {!workspaceNavEnabled && !inPresentationMode && generalSections.length > 0 && (
          <>
            {isCollapsed ? (
              renderSectionDivider("divider-general", { marginBottom: "10px" })
            ) : (
              <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
                General
              </div>
            )}
            {generalSections.flatMap((section) => section.items).map((item) => {
              if (!item.href) return null;
              const isActive = isItemActive(item.href);
              return (
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={getNavHref(item.href)}
                  prefetch={inPresentationMode ? false : undefined}
                  onClick={handleNavigationPress}
                  data-presentation-allow-interaction={inPresentationMode ? "true" : undefined}
                  {...navLinkProps(item.label)}
                >
                  {renderNavContent(item.label, item.href, isActive)}
                </Link>
              );
            })}
          </>
        )}

        {/* While auth/roles resolve, show shimmer scaffolding (no real links)
            so the department area looks alive rather than empty on hard load. */}
        {!workspaceNavEnabled && !inPresentationMode && isAuthLoading && departmentSections.length === 0 && (
          <div style={{ marginTop: "16px" }}>
            <SidebarNavSkeleton />
          </div>
        )}

        {/* Department Sections - NO COLLAPSE, just headers */}
        {!workspaceNavEnabled && !inPresentationMode && departmentSections.map((section) => (
          <Fragment key={section.label}>
            {isCollapsed ? (
              renderSectionDivider(`divider-${section.label}`, { marginTop: "16px", marginBottom: "10px" })
            ) : (
              <div className="app-sidebar__section-title" style={{ marginTop: "16px", marginBottom: "10px" }}>
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              if (!item.href) return null;
              const isActive = isItemActive(item.href);
              return (
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={getNavHref(item.href)}
                  prefetch={inPresentationMode ? false : undefined}
                  onClick={handleNavigationPress}
                  data-presentation-allow-interaction={inPresentationMode ? "true" : undefined}
                  {...navLinkProps(item.label)}
                >
                  {renderNavContent(item.label, item.href, isActive)}
                </Link>
              );
            })}
          </Fragment>
        ))}

        {/* Account Section */}
        {accountSections.length > 0 && (
          <>
            {isCollapsed ? (
              renderSectionDivider("divider-account", { marginTop: "16px", marginBottom: "10px" })
            ) : (
              <div className="app-sidebar__section-title" style={{ marginTop: "16px", marginBottom: "10px" }}>
                Account
              </div>
            )}
            {accountSections.flatMap((section) => section.items).map((item) => {
              if (item.action === "logout") {
                // Collapsed rail shows only nav icons down to Profile — the
                // clock / logout / vision / dev controls are hidden here.
                if (isCollapsed) return null;
                return (
                  <Fragment key="clock-logout-row">
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button
                        className="app-btn"
                        type="button"
                        onClick={handleClockToggle}
                        disabled={clockLoading}
                        style={
                          isClockedIn
                            ? { flex: 1, opacity: clockLoading ? 0.6 : 1, ...dangerControlStyle }
                            : {
                                flex: 1,
                                opacity: clockLoading ? 0.6 : 1,
                                ...successControlStyle,
                              }
                        }
                      >
                        {clockLoading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
                      </button>
                      <button
                        className="app-btn app-tone-danger"
                        type="button"
                        onClick={handleLogout}
                        data-presentation-allow-interaction="true"
                        style={{ flex: 1 }}
                      >
                        Logout
                      </button>
                    </div>
                    {(canShowDevItems || canShowDevPagesLink) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          width: "100%",
                          marginTop: "8px",
                        }}
                      >
                        {canShowDevPagesLink && (
                          <Link
                            className="app-btn app-btn--ghost"
                            href="/dev/user-diagnostic"
                            prefetch={inPresentationMode ? false : undefined}
                            style={{ flex: 1 }}
                            onClick={handleNavigationPress}
                          >
                            Diagnostics
                          </Link>
                        )}
                        {canUseDevOverlay && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={devOverlayEnabled}
                            aria-label="Toggle dev layout overlay"
                            className="app-btn"
                            onClick={toggleDevOverlay}
                            style={{ flex: 1, ...(devOverlayEnabled ? successGhostControlStyle : ghostControlStyle) }}
                          >
                            Overlay
                          </button>
                        )}
                      </div>
                    )}
                    {!inPresentationMode && (
                      <Link
                        className="app-btn"
                        style={{
                          display: "flex",
                          width: "100%",
                          marginTop: "8px",
                          ...(inVisionRoute ? successGhostControlStyle : ghostControlStyle),
                        }}
                        href="/vision"
                        prefetch={inPresentationMode ? false : undefined}
                        aria-current={inVisionRoute ? "page" : undefined}
                        onClick={handleNavigationPress}
                      >
                        Vision
                      </Link>
                    )}
                    {inPresentationRoute && overlayHidden && (
                      <button
                        type="button"
                        className="app-btn app-btn--nav"
                        style={{
                          width: "100%",
                          marginTop: "8px",
                          marginBottom: 0,
                          textAlign: "left",
                          ...successGhostControlStyle,
                        }}
                        onClick={handleShowOverlay}
                        title="Bring the slide highlight ring and callout popup back"
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "currentColor",
                            flexShrink: 0,
                          }}
                        />
                        <span>Show overlay</span>
                      </button>
                    )}
                  </Fragment>
                );
              }

              if (item.href) {
                if (inPresentationMode) return null;
                const isActive = isItemActive(item.href);
                // Profile button shows the user's full name in place of the
                // generic "Profile" label. When the rail is collapsed the icon
                // stays keyed on the original label ("Profile") so
                // getSidebarNavIcon still resolves; the full name surfaces as the
                // hover/aria label instead.
                const isProfileItem = item.href === "/profile";
                const displayLabel = isProfileItem && fullName ? fullName : item.label;
                const contentLabel = isCollapsed ? item.label : displayLabel;
                return (
                  <Link
                    className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                    key={item.href}
                    href={getNavHref(item.href)}
                    prefetch={inPresentationMode ? false : undefined}
                    onClick={handleNavigationPress}
                    data-presentation-allow-interaction={inPresentationMode ? "true" : undefined}
                    style={{
                      marginBottom: "10px",
                    }}
                    {...navLinkProps(displayLabel)}
                  >
                    {renderNavContent(contentLabel, item.href, isActive, {
                      truncate: isProfileItem,
                    })}
                  </Link>
                );
              }

              return null;
            })}
          </>
        )}

        {/* Bottom scroll spacer: gives the last nav control (e.g. Vision) a 10px
            gap to the sidebar's bottom edge so it isn't flush, and lets the list
            scroll up slightly further. */}
        <div aria-hidden="true" style={{ height: "10px", flexShrink: 0 }} />
      </DevLayoutSection>
    </DevLayoutSection>
  );
}
