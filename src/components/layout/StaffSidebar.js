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
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useClockingContext } from "@/context/ClockingContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { useNewsAckBadge } from "@/hooks/useNewsAckBadge";
import { formatOutstandingAckLabel } from "@/lib/news/format";
import { sidebarSections } from "@/config/navigation";
import {
  getKnownSidebarHrefs,
  getRoleWorkspaceModules,
  getActiveRoleWorkspaceModule,
  isWorkspaceNavEnabled,
  resolveAccessiblePaths,
} from "@/config/workspace/manifest";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import ContextSidebar from "@/components/layout/ContextSidebar";
import { recordWorkspaceRecentHref } from "@/hooks/useWorkspaceShortcuts";
import { getSidebarNavIcon } from "@/components/layout/sidebarNavIcons";
import BrandLogo from "@/components/BrandLogo";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { clearRememberedStaffRoute } from "@/lib/auth/returnRoute";
import { DEV_PLATFORM_ROLE, hasAllAccessRole } from "@/lib/auth/roles";
import {
  isOverlayHidden as readOverlayHidden,
  setOverlayHidden as writeOverlayHidden,
  subscribeOverlayVisibility,
} from "@/features/presentation/runtime/overlayVisibility";
import { logFailure } from "@/lib/utils/logFailure";

const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const PRESENTATION_LOGOUT_DESTINATION = "/loginPresentation";
const PRESENTATION_ROLE_STORAGE_KEY = "presentation:activeRoleKey";

// ---------------------------------------------------------------------------
// Brand mark geometry — the collapse/expand animation of the sidebar logo.
//
// There are two source images and both of them contain the same car:
//   Logo.png      881x270  "Humphries &" + the car with "Parks" inside it
//   icon-256.png  256x256  the car alone, on a filled disc
//
// THE CAR IS THE ANCHOR. It is the object that travels and scales between the
// two resting states, so it is never clipped and never disappears; the
// wordmark's text is simply dragged out of view behind the rail's left edge as
// the car moves in. (The text sits to the LEFT of the car in the artwork, so
// moving the car left is the only path that keeps the car fully visible — a
// car left where it is would be the first thing the closing edge cut off.)
//
// Neither resting state changes. The boxes below reproduce exactly what the
// header renders today:
//   expanded  — wordmark in the header's content box: 260px rail - 2x18px
//               padding = 224px wide, its 68.6px height centred in 75px.
//   collapsed — icon 44px square (48px rail - 2x2px padding), centred in 75px.
const BRAND_HEADER_HEIGHT = 75;
const BRAND_WORDMARK_SIZE = { width: 881, height: 270 }; // Logo.png, natural size
const BRAND_WORDMARK_WIDTH = 224; // 260px rail - 2x18px of header padding
// Derived, not rounded: the old layout sized the wordmark `width:100%,
// height:auto` and centred it, so rounding here would shift it by a fraction of
// a pixel and change how the artwork antialiases.
const BRAND_WORDMARK_HEIGHT =
  (BRAND_WORDMARK_WIDTH * BRAND_WORDMARK_SIZE.height) / BRAND_WORDMARK_SIZE.width;
const BRAND_WORDMARK_BOX = {
  left: 18,
  width: BRAND_WORDMARK_WIDTH,
  height: BRAND_WORDMARK_HEIGHT,
  top: (BRAND_HEADER_HEIGHT - BRAND_WORDMARK_HEIGHT) / 2,
};
const BRAND_ICON_BOX = { left: 2, size: 44, top: (BRAND_HEADER_HEIGHT - 44) / 2 };
// Car bounding boxes measured off the source PNGs, as fractions of each image:
// Logo.png     — the red car (with "Parks" inside it) spans x 512-870, y 13-259.
// icon-256.png — the car glyph spans x 28-233, y 52-198 of the 256px disc.
const BRAND_WORDMARK_CAR = { x0: 512 / 881, x1: 870 / 881, y0: 13 / 270, y1: 259 / 270 };
const BRAND_ICON_CAR = { x0: 28 / 256, x1: 233 / 256, y0: 52 / 256, y1: 198 / 256 };

const brandCarRect = (left, top, width, height, car) => {
  const w = width * (car.x1 - car.x0);
  const h = height * (car.y1 - car.y0);
  return { cx: left + width * car.x0 + w / 2, cy: top + height * car.y0 + h / 2, w, h };
};
const brandCarOrigin = (car) =>
  `${((car.x0 + car.x1) / 2) * 100}% ${((car.y0 + car.y1) / 2) * 100}%`;

const BRAND_CAR_OPEN = brandCarRect(
  BRAND_WORDMARK_BOX.left,
  BRAND_WORDMARK_BOX.top,
  BRAND_WORDMARK_BOX.width,
  BRAND_WORDMARK_BOX.height,
  BRAND_WORDMARK_CAR
);
const BRAND_CAR_CLOSED = brandCarRect(
  BRAND_ICON_BOX.left,
  BRAND_ICON_BOX.top,
  BRAND_ICON_BOX.size,
  BRAND_ICON_BOX.size,
  BRAND_ICON_CAR
);
// One journey, expressed twice: the wordmark travels open -> collapsed, the icon
// travels collapsed -> open. Because both pivot on their own car centre and use
// the same numbers, the two cars stay exactly superimposed for the whole
// transition — the artwork crossfades, the car never moves out from under it.
const BRAND_SHRINK = BRAND_CAR_CLOSED.w / BRAND_CAR_OPEN.w; // ~0.39
const BRAND_DX = BRAND_CAR_CLOSED.cx - BRAND_CAR_OPEN.cx;   // ~-169px
const BRAND_DY = BRAND_CAR_CLOSED.cy - BRAND_CAR_OPEN.cy;   // ~-1px
const BRAND_WORDMARK_ORIGIN = brandCarOrigin(BRAND_WORDMARK_CAR);
const BRAND_ICON_ORIGIN = brandCarOrigin(BRAND_ICON_CAR);
const BRAND_WORDMARK_COLLAPSED_TRANSFORM = `translate(${BRAND_DX}px, ${BRAND_DY}px) scale(${BRAND_SHRINK})`;
const BRAND_ICON_EXPANDED_TRANSFORM = `translate(${-BRAND_DX}px, ${-BRAND_DY}px) scale(${1 / BRAND_SHRINK})`;
// Handing the car over from one artwork to the other is a WIPE, not a crossfade.
// Fading two different cars through each other leaves both half-transparent for
// the length of the fade — the car goes pale for ~150ms, which is exactly what
// "keep the car 100% visible" rules out. Instead the disc is clipped to a circle
// that grows from nothing at the car's centre: outside it you still see the
// wordmark's car at full strength, inside it the badge's, and the two are the
// same car at the same size and place, so it reads as the badge filling in.
// Nothing is ever translucent.
//
// The window sits at the end of the close (and the very start of the open, where
// easeOutExpo covers most of the distance in the first fraction of a second),
// for a second reason: the disc is much bigger than the car inside it, so while
// the icon is scaled up to meet the wordmark it is taller than the 75px header
// and would be cut off top and bottom if it were painted that early.
const BRAND_ICON_CLIP_HIDDEN = "circle(0% at 50% 50%)";
const BRAND_ICON_CLIP_SHOWN = "circle(80% at 50% 50%)"; // 80% of 44px clears the disc's corners
const BRAND_WIPE_CLOSE = "clip-path 0.14s linear 0.2s";
const BRAND_WIPE_OPEN = "clip-path 0.08s linear";
// The wordmark is switched off, not faded: by 0.34s the disc covers its car
// completely (the wipe finishes at 0.34s, this fires at 0.37s), so the only
// thing left to hide is the tail of the text at the
// rail's left edge — and a step change there is invisible. On the way open it is
// switched straight back on underneath the disc, before the wipe uncovers it.
const BRAND_WORDMARK_HIDE_CLOSE = "opacity 0s linear 0.37s";
const BRAND_WORDMARK_SHOW_OPEN = "opacity 0s linear";

// Nav rows and section headings hand over the same way, and the two halves
// OVERLAP: the label is already on its way out when the icon starts coming in,
// so a row never reads as empty, and the handover happens inside the rail's own
// travel rather than before or after it.
const NAV_FADE_CLOSE_LABEL = "opacity 0.22s linear";
const NAV_FADE_CLOSE_ICON = "opacity 0.24s linear 0.06s";
const NAV_FADE_OPEN_ICON = "opacity 0.14s linear";
const NAV_FADE_OPEN_LABEL = "opacity 0.24s linear 0.04s";

// The collapsed rail marks a section break with a short rule where the title
// text sits when the rail is open. One element, shared by both renderers.
const SECTION_RULE = (
  <span style={{ width: 24, height: 2, borderRadius: 1, background: "var(--theme)" }} />
);

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
  isVerticalPhone = false,
  isCollapsed = false,
  extraSections = [],
  visibleRoles = null,
  allowedRoutes = null,
  presentationRoleKey = null,
  inPresentationMode = false,
  pendingHref = null,
  isAuthLoading = false,
}) {
  // Collapse/expand is ONE movement. Every part of it — the shell's width, the
  // body padding, each row's padding, the label/icon handover, the section
  // headings and the brand mark — is a CSS transition on the same clock (MOTION
  // below), started by the same commit. Nothing waits for anything else, and
  // nothing swaps out of the DOM mid-animation: both states of every element are
  // mounted and only their opacity/transform change, so React's work on the
  // toggling frame is a style diff rather than a rebuild of the nav tree.
  //
  // The rail's own geometry and the brand mark key off `isCollapsed` and move on
  // the frame you click. The nav rows key off the deferred copy, which React is
  // free to render at transition priority — it lands a frame or so later, which
  // is invisible against a 0.4s travel, and it keeps the one big render off the
  // frame that has to start the animation.
  const rowsCollapsed = useDeferredValue(isCollapsed);
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
  const { user, dbUserId, sidebarAccessLoading, sidebarAccessReady } = useUser();
  // Full name for the Profile nav button (replaces the generic "Profile" label).
  // user.username resolves to the signed-in user's display name (see UserContext).
  const fullName = (user?.username || "").trim();
  const { canAccess: canUseDevOverlay, enabled: devOverlayEnabled, toggleEnabled: toggleDevOverlay } =
    useDevLayoutOverlay();
  // In presentation mode the sidebar belongs to the demo role, not the real
  // signed-in user — pass null to skip the unread-messages query so the badge
  // doesn't surface the presenter's actual inbox count.
  const { unreadCount } = useMessagesBadge(inPresentationMode ? null : dbUserId);
  // Same treatment for the News Feed item: the count is how many published
  // updates this user still owes an acknowledgement on, and the badge's title
  // spells out why ("This update needs your acknowledgement. 6 days overdue.").
  const { count: outstandingAckCount, dueAt: ackDueAt } = useNewsAckBadge(
    inPresentationMode ? null : dbUserId
  );
  const outstandingAckLabel = useMemo(
    () => formatOutstandingAckLabel({ count: outstandingAckCount, dueAt: ackDueAt }),
    [outstandingAckCount, ackDueAt]
  );

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
  const isSidebarNavigationLoading =
    !inPresentationMode &&
    (isAuthLoading ||
      !user ||
      sidebarAccessLoading ||
      !sidebarAccessReady);
  const ghostControlStyle = {
    backgroundColor: "var(--theme)",
    backgroundImage: "none",
    color: "var(--accentText)",
    border: "none",
  };
  const successGhostControlStyle = {
    backgroundColor: "var(--theme-hover)",
    backgroundImage: "none",
    color: "var(--success-text)",
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
  const isDevRole = userRoles.includes(DEV_PLATFORM_ROLE);
  const hasFullAccess = hasAllAccessRole(userRoles); // All Access demo login
  const canShowDevPagesLink =
    Boolean(user) && !inPresentationMode && canShowDevPages();
  const canShowDevOverlayControl =
    Boolean(user) && !inPresentationMode && canUseDevOverlay;
  // Per-user sidebar-access override (admin-set snapshot). Skipped in
  // presentation mode (the rail belongs to the demo role, not the real user).
  // When no snapshot exists, snapshotAllowed is null and every filter below is
  // a no-op, so role-based behaviour is byte-for-byte unchanged. The snapshot
  // only governs the classic sidebar item universe (getKnownSidebarHrefs) —
  // dashboards/quick actions outside it are always allowed.
  const editorUniverse = useMemo(() => getKnownSidebarHrefs(), []);
  const snapshotAllowed = useMemo(() => {
    if (inPresentationMode) return null;
    const snap = user?.sidebarAccess;
    if (!snap || !Array.isArray(snap.items)) return null;
    return resolveAccessiblePaths(userRoles, snap);
  }, [inPresentationMode, user?.sidebarAccess, userRoles]);
  const isHrefAllowed = useCallback(
    (href) => {
      if (!snapshotAllowed || !href) return true;
      if (!editorUniverse.has(href)) return true; // outside the snapshot's scope
      return snapshotAllowed.has(href);
    },
    [snapshotAllowed, editorUniverse]
  );
  // `undefined` means "follow the module for the current route"; `null` means
  // the user explicitly closed every module. Keeping those states distinct is
  // important: otherwise the route-derived module continually overrides a
  // click, which makes the accordion appear unable to open or close.
  const [selectedModuleKey, setSelectedModuleKey] = useState(undefined);
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
    if (hasFullAccess) return true; // All Access demo login
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
    if (hasFullAccess) return true; // All Access demo login
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
            isHrefAllowed(item.href) &&
            (inPresentationMode || !item.href || !hiddenHrRoutes.has(item.href)) &&
            (inPresentationMode || !(hasRestrictedJobSectionRole && item.href === "/archive"))
        ),
      }))
      .filter((section) => section.items.length > 0);

  const generalSections = filterAccessibleSections(groupedSections.general);
  const departmentSections = filterAccessibleSections(groupedSections.departments);
  const accountSections = filterAccessibleSections(groupedSections.account);
  const roleWorkspaceModules = useMemo(
    () => (workspaceNavEnabled ? getRoleWorkspaceModules(userRoles, user?.sidebarAccess) : []),
    [userRoles, user?.sidebarAccess, workspaceNavEnabled]
  );
  const roleWorkspace = useMemo(
    () => ({
      department: "role-default",
      label: "Workspace",
      dashboards: [],
      items: roleWorkspaceModules.flatMap((module) => module.items),
    }),
    [roleWorkspaceModules]
  );
  const routeRoleModuleKey = useMemo(
    () => (workspaceNavEnabled
      ? getActiveRoleWorkspaceModule(pathname, userRoles, user?.sidebarAccess, pendingHref)
      : null),
    [pathname, pendingHref, userRoles, user?.sidebarAccess, workspaceNavEnabled]
  );
  const activeRoleModuleKey =
    selectedModuleKey === undefined ? routeRoleModuleKey : selectedModuleKey;

  useEffect(() => {
    if (selectedModuleKey == null) return;
    if (!roleWorkspaceModules.some((module) => module.key === selectedModuleKey)) {
      setSelectedModuleKey(undefined);
    }
  }, [roleWorkspaceModules, selectedModuleKey]);

  useEffect(() => {
    if (previousWorkspacePathRef.current === pathname) return;
    previousWorkspacePathRef.current = pathname;
    // A genuine route change starts a fresh sidebar context. The active route's
    // module opens automatically, while later clicks remain fully user-driven.
    setSelectedModuleKey(undefined);
  }, [pathname]);

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
      // Signing out deliberately ends the session's "place": the next sign-in
      // should start at the role default rather than being thrown back into the
      // page this user chose to leave. This path hard-replaces the location and
      // never reaches UserContext.logout, so it has to clear it itself.
      clearRememberedStaffRoute();
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

  // Clock in/out state for the sidebar button.
  //
  // This used to keep its own `isClockedIn` and fetch `/api/profile/clock`
  // itself — the exact same request ClockingProvider (which already wraps this
  // component, see components/App/StaffProviders.js) makes for the same user.
  // Reading the shared state removes the duplicate GET and the duplicate POST
  // path; `clockLoading` stays local so the button's own pending label is
  // unchanged and is not driven by the provider's shared `loading` flag.
  const { clockedIn: isClockedIn, clockIn, clockOut } = useClockingContext();
  const [clockLoading, setClockLoading] = useState(false);
  const employeeUserId = Number(dbUserId);
  const canUseEmployeeClock = Number.isInteger(employeeUserId) && employeeUserId > 0;

  const handleClockToggle = useCallback(async () => {
    if (!canUseEmployeeClock) return;
    setClockLoading(true);
    try {
      if (isClockedIn) await clockOut();
      else await clockIn();
    } catch (err) {
      logFailure("Clock toggle error:", err);
    } finally {
      setClockLoading(false);
    }
  }, [isClockedIn, canUseEmployeeClock, clockIn, clockOut]);

  // `truncate` ellipsises the label on a single line — used by the Profile
  // button, which now renders the user's (potentially long) full name inside the
  // fixed-width rail. `title` keeps the full text accessible on hover.
  //
  // Two nav items carry a count badge: Messages (unread threads) and News Feed
  // (updates still awaiting this user's acknowledgement). They share one badge
  // treatment so the rail reads consistently — only the number and the title
  // text differ.
  const renderLinkLabel = (label, href, { truncate = false } = {}) => {
    const badgeCount =
      href === "/messages" ? unreadCount : href === "/newsfeed" ? outstandingAckCount : 0;
    const badgeTitle =
      href === "/messages"
        ? `${unreadCount} unread ${unreadCount === 1 ? "conversation" : "conversations"}`
        : outstandingAckLabel;
    const showUnreadBadge = badgeCount > 0;
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
        className={
          showUnreadBadge ? "app-badge-slot app-badge-slot--counted" : "app-badge-slot"
        }
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
        {showUnreadBadge && (
          <span
            className="app-badge app-badge--danger-strong app-badge--count"
            style={{ position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)" }}
            title={badgeTitle || undefined}
            aria-label={badgeTitle || undefined}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
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
  // Both halves of a nav row are ALWAYS in the DOM — the label in flow, the icon
  // as a centred overlay — and collapsing only changes their opacity. Swapping
  // the two out of the DOM instead (what this used to do) meant the row's
  // contents changed in one jump at one instant, which no amount of easing can
  // link to a 0.4s width animation; it also rebuilt the whole nav tree on the
  // frame the animation started. Now the label is squeezed out by the rail while
  // the icon fades up in its place, all on the same clock.
  const renderNavContent = (label, href, isActive = false, opts = {}) => (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          // Selected item flips the glyph to the surface colour so it reads
          // against the active (accent) button fill; idle glyphs use --theme.
          color: isActive ? "var(--surface)" : ICON_COLOR,
          opacity: rowsCollapsed ? 1 : 0,
          transition: rowsCollapsed ? NAV_FADE_CLOSE_ICON : NAV_FADE_OPEN_ICON,
        }}
      >
        <span
          style={{
            // Fills the 44px button's content box (44 − 2×8px padding = 28px) so
            // the glyph reads large within the collapsed rail.
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
          }}
        >
          {getSidebarNavIcon(label)}
        </span>
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          opacity: rowsCollapsed ? 0 : 1,
          transition: rowsCollapsed ? NAV_FADE_CLOSE_LABEL : NAV_FADE_OPEN_LABEL,
        }}
      >
        {renderLinkLabel(label, href, opts)}
      </span>
    </>
  );
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
        {SECTION_RULE}
      </span>
    </div>
  );
  // A section heading holds BOTH of its states at once — the title text and the
  // collapsed rule — and crossfades between them on the rail's clock, for the
  // same reason the nav rows do (see renderNavContent). The box keeps the
  // title's line height in both states so nothing below it ever shifts.
  const renderSectionHeading = (key, title, marginStyle = {}, className = "") => (
    <div
      key={key}
      className={`app-sidebar__section-title${className ? ` ${className}` : ""}`}
      style={{
        position: "relative",
        display: "block",
        alignSelf: "stretch",
        flexShrink: 0,
        ...marginStyle,
      }}
    >
      <span
        style={{
          display: "block",
          whiteSpace: "nowrap",
          opacity: rowsCollapsed ? 0 : 1,
          transition: rowsCollapsed ? NAV_FADE_CLOSE_LABEL : NAV_FADE_OPEN_LABEL,
        }}
      >
        {title}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          justifyContent: "center",
          opacity: rowsCollapsed ? 1 : 0,
          transition: rowsCollapsed ? NAV_FADE_CLOSE_ICON : NAV_FADE_OPEN_ICON,
        }}
      >
        {SECTION_RULE}
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
  // Only padding is animated per link. The links are `.app-btn--nav`, i.e.
  // width:100% of the rail, so their width already follows the shell's animated
  // width for free — declaring a width transition on every one of them made the
  // browser run a separate interpolation, style recalc and paint chunk per link
  // per frame (a measured ~1,400 paint records for one collapse) for motion the
  // parent was producing anyway.
  const NAV_LINK_TRANSITION = `padding ${MOTION}`;
  // Props applied to every nav link. When collapsed: square icon footprint,
  // centred content, and the label surfaced as a tooltip / a11y name.
  // The icon overlay inside every row is absolutely positioned, so the row is the
  // containing block; the row also clips, because the label stays mounted (at
  // opacity 0) while the rail squeezes it down to 44px.
  const NAV_LINK_BOX = { position: "relative", overflow: "hidden" };
  const navLinkProps = (label, extraStyle = {}) =>
    rowsCollapsed
      ? {
          title: label,
          "aria-label": label,
          style: {
            ...NAV_LINK_BOX,
            // Match the expanded button's vertical box exactly (height +
            // margin come from .app-btn / .app-btn--nav) so the list lines up
            // through the whole transition. Width is left to .app-btn--nav's
            // 100% — that resolves to exactly 44px once the rail is collapsed
            // (48px rail − the body's 2px side padding), and tracks the shell
            // while it animates. Padding tightens to 8px (from
            // --control-padding's 14px) so the larger icon fills the button;
            // NAV_LINK_TRANSITION animates that, so the content glides rather
            // than snapping when toggling.
            height: "var(--control-height)",
            minHeight: "var(--control-height)",
            padding: 8,
            justifyContent: "center",
            transition: NAV_LINK_TRANSITION,
            ...extraStyle,
          },
        }
      : { style: { ...NAV_LINK_BOX, transition: NAV_LINK_TRANSITION, ...extraStyle } };

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
      className={`app-sidebar${isCollapsed ? " app-sidebar--collapsed" : ""}${isVerticalPhone ? " app-sidebar--vertical-phone" : ""}`}
      style={{
        padding: "0",
        width: isCollapsed ? "48px" : isCondensed ? "100%" : "260px",
        minWidth: isCollapsed ? "48px" : isCondensed ? "auto" : "220px",
        height: isVerticalPhone ? "100%" : isCondensed ? "auto" : "100%",
        minHeight: isVerticalPhone ? 0 : isCondensed ? "auto" : "100%",
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: "none",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "0",
        overflowX: "hidden",
        overflowY: isVerticalPhone ? "auto" : isCondensed ? "visible" : "auto",
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
      {/* Desktop header. Compact top-drop sidebars begin directly with navigation. */}
      {!isVerticalPhone && (
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
          // Desktop rail: the brand stage below positions both logos itself, in
          // header coordinates, so the header must not add padding of its own —
          // an animating padding would move the car's anchor out from under it.
          // The compact top-drop sidebar keeps the original padded layout.
          padding: isCondensed ? undefined : 0,
          height: isCondensed ? "60px" : `${BRAND_HEADER_HEIGHT}px`, // fix the height so the oversized logo crops vertically
          overflow: "hidden",
          }}
        >
          {isCondensed ? (
            // Compact top-drop sidebar: no collapsed state, so it keeps the
            // simple centred wordmark it has always had.
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
              <BrandLogo alt="H&P logo" width={800} height={240} style={headerLogoStyle} />
            </div>
          ) : (
            // Brand stage. Both logos live here permanently, each pinned by its
            // own car: the wordmark rests in the expanded position, the icon in
            // the collapsed one, and each carries the transform that takes its
            // car onto the other's. Toggling swaps which transform is applied,
            // so the car glides and scales between the two resting states on the
            // same clock as the rail itself — see the geometry block at the top
            // of this file.
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <BrandLogo
                alt="H&P logo"
                width={881}
                height={270}
                style={{
                  position: "absolute",
                  left: `${BRAND_WORDMARK_BOX.left}px`,
                  top: `${BRAND_WORDMARK_BOX.top}px`,
                  width: `${BRAND_WORDMARK_BOX.width}px`,
                  height: `${BRAND_WORDMARK_BOX.height}px`,
                  // The stage clips this, not the rail. Without opting out of
                  // staffglobal's `img { max-width: 100% }` the wordmark gets
                  // squashed to the rail's width the moment it starts closing,
                  // which drags its car away from the icon's.
                  maxWidth: "none",
                  display: "block",
                  transformOrigin: BRAND_WORDMARK_ORIGIN,
                  transform: isCollapsed ? BRAND_WORDMARK_COLLAPSED_TRANSFORM : "none",
                  opacity: isCollapsed ? 0 : 1,
                  transition: `transform ${MOTION}, ${
                    isCollapsed ? BRAND_WORDMARK_HIDE_CLOSE : BRAND_WORDMARK_SHOW_OPEN
                  }`,
                }}
              />
              {/* The car on its disc. Sits above the wordmark so that, once it
                  has faded in, its opaque disc covers whatever is left of the
                  wordmark underneath. icon-256 rather than the 1254x1254
                  desktop.png: this rail renders at 75px, and BrandLogo fetches
                  the raw file at full size to recolour it on a canvas. */}
              <BrandLogo
                src="/images/logo/icon-256.png"
                alt=""
                aria-hidden="true"
                width={256}
                height={256}
                style={{
                  position: "absolute",
                  left: `${BRAND_ICON_BOX.left}px`,
                  top: `${BRAND_ICON_BOX.top}px`,
                  width: `${BRAND_ICON_BOX.size}px`,
                  height: `${BRAND_ICON_BOX.size}px`,
                  maxWidth: "none", // as above — the disc is scaled up past the rail's width
                  display: "block",
                  transformOrigin: BRAND_ICON_ORIGIN,
                  transform: isCollapsed ? "none" : BRAND_ICON_EXPANDED_TRANSFORM,
                  clipPath: isCollapsed ? BRAND_ICON_CLIP_SHOWN : BRAND_ICON_CLIP_HIDDEN,
                  transition: `transform ${MOTION}, ${
                    isCollapsed ? BRAND_WIPE_CLOSE : BRAND_WIPE_OPEN
                  }`,
                }}
              />
            </div>
          )}
        </DevLayoutSection>
      )}

      {!isVerticalPhone && (
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
      )}

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
            {renderSectionHeading("heading-presentation", "Presentation Pages", {
              marginBottom: "10px",
            })}
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

        {isSidebarNavigationLoading && <SidebarNavSkeleton />}

        {!isSidebarNavigationLoading && workspaceNavEnabled && roleWorkspaceModules.length > 0 && (
          <>
            {renderSectionHeading(
              "heading-workspace",
              <span>Workspace</span>,
              { marginBottom: "10px" },
              "app-sidebar__workspace-heading"
            )}
            <ContextSidebar
              workspace={roleWorkspace}
              modules={roleWorkspaceModules}
              activeModuleKey={activeRoleModuleKey}
              onModuleToggle={(key) => {
                setSelectedModuleKey((current) => {
                  const currentActiveKey =
                    current === undefined ? routeRoleModuleKey : current;
                  return currentActiveKey === key ? null : key;
                });
              }}
              pathname={pathname}
              pendingHref={pendingHref}
              isCollapsed={rowsCollapsed}
              getNavHref={getNavHref}
              onNavigate={(href) => {
                recordWorkspaceRecentHref(href);
                handleNavigationPress();
              }}
              showBack={false}
              navLinkProps={navLinkProps}
              renderNavContent={renderNavContent}
              renderSectionDivider={renderSectionDivider}
              renderSectionHeading={renderSectionHeading}
            />
          </>
        )}


        {!isSidebarNavigationLoading && !workspaceNavEnabled && !inPresentationMode && dashboardShortcuts.length > 0 && (
          <>
            {renderSectionHeading(
              "heading-dashboard",
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Dashboard</span>
                {onToggle && !isVerticalPhone && (
                  <button
                    className="app-btn app-btn--secondary app-btn--xs"
                    type="button"
                    onClick={onToggle}
                    aria-label="Close sidebar"
                  >
                    Close
                  </button>
                )}
              </span>,
              { marginBottom: "10px" }
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
        {!isSidebarNavigationLoading && !workspaceNavEnabled && !inPresentationMode && generalSections.length > 0 && (
          <>
            {renderSectionHeading("heading-general", "General", { marginBottom: "10px" })}
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

        {/* Department Sections - NO COLLAPSE, just headers */}
        {!isSidebarNavigationLoading && !workspaceNavEnabled && !inPresentationMode && departmentSections.map((section) => (
          <Fragment key={section.label}>
            {renderSectionHeading(`heading-${section.label}`, section.label, {
              marginTop: "16px",
              marginBottom: "10px",
            })}
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
        {!isSidebarNavigationLoading && accountSections.length > 0 && (
          <>
            {renderSectionHeading("heading-account", "Account", {
              marginTop: "16px",
              marginBottom: "10px",
            })}
            {accountSections.flatMap((section) => section.items).map((item) => {
              if (item.action === "logout") {
                // Collapsed rail shows only nav icons down to Profile — the
                // clock / logout / vision controls are hidden here.
                if (rowsCollapsed) {
                  return (
                    <Fragment key="collapsed-dev-controls">
                      {canShowDevPagesLink && (
                        <Link
                          className="app-btn app-btn--nav"
                          href="/dev/user-diagnostic"
                          prefetch={inPresentationMode ? false : undefined}
                          onClick={handleNavigationPress}
                          {...navLinkProps("Dev")}
                        >
                          {renderNavContent(
                            "Dev",
                            "/dev/user-diagnostic",
                            isItemActive("/dev/user-diagnostic")
                          )}
                        </Link>
                      )}
                      {canShowDevOverlayControl && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={devOverlayEnabled}
                          className="app-btn app-btn--nav"
                          onClick={toggleDevOverlay}
                          {...navLinkProps("Overlay", {
                            ...(devOverlayEnabled ? successGhostControlStyle : ghostControlStyle),
                          })}
                        >
                          {renderNavContent("Overlay", "", devOverlayEnabled)}
                        </button>
                      )}
                    </Fragment>
                  );
                }
                return (
                  <Fragment key="clock-logout-row">
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      {canUseEmployeeClock && (
                        <button
                          className={`app-btn ${
                            isClockedIn ? "app-btn--secondary" : "app-btn--primary"
                          }`}
                          type="button"
                          onClick={handleClockToggle}
                          disabled={clockLoading}
                          style={{ flex: 1 }}
                        >
                          {clockLoading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
                        </button>
                      )}
                      <button
                        className="app-btn app-btn--secondary"
                        type="button"
                        onClick={handleLogout}
                        data-presentation-allow-interaction="true"
                        style={{ flex: 1 }}
                      >
                        Logout
                      </button>
                    </div>
                    {(canShowDevPagesLink || canShowDevOverlayControl) && (
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
                            className="app-btn app-btn--secondary"
                            href="/dev/user-diagnostic"
                            prefetch={inPresentationMode ? false : undefined}
                            style={{ flex: 1 }}
                            onClick={handleNavigationPress}
                          >
                            Dev
                          </Link>
                        )}
                        {canShowDevOverlayControl && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={devOverlayEnabled}
                            aria-label="Toggle dev layout overlay"
                            className={`app-btn ${
                              devOverlayEnabled ? "app-btn--primary" : "app-btn--secondary"
                            }`}
                            onClick={toggleDevOverlay}
                            style={{ flex: 1 }}
                          >
                            Overlay
                          </button>
                        )}
                      </div>
                    )}
                    {isDevRole && !inPresentationMode && (
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
                const contentLabel = rowsCollapsed ? item.label : displayLabel;
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
