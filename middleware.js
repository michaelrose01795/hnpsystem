import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  canAccessHrManagerDashboard,
  HR_CORE_ROLES,
  HR_MANAGER_ROLES,
  MANAGER_SCOPED_ROLES,
  normalizeRoles,
} from "./src/lib/auth/roles";

const HR_ALLOWED_PATHS_FOR_MANAGERS = ["/hr/employees", "/hr/leave"];
const RELAX_HR_ACCESS = process.env.NEXT_PUBLIC_RELAX_HR_ACCESS === "true";
const isDevEnv = process.env.NODE_ENV !== "production";
const logMiddlewareCheck = (message, details = {}) => {
  if (!isDevEnv) return;
  console.info(`[middleware] ${message}`, details);
};
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isHrRoute = pathname.startsWith("/hr");
  const isAdminRoute = pathname.startsWith("/admin");
  const canUseDevCookie = isDevEnv;
  const devRolesCookie = canUseDevCookie ? req.cookies.get("hnp-dev-roles")?.value : null;
  const hasDevCookieAuth = Boolean(devRolesCookie);

  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    return NextResponse.next();
  }

  if (RELAX_HR_ACCESS && (isHrRoute || isAdminRoute)) {
    logMiddlewareCheck("Relaxed HR/Admin access", { pathname });
    return NextResponse.next();
  }

  if (!isHrRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token && !hasDevCookieAuth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roles = token?.roles?.length
    ? normalizeRoles(token.roles)
    : hasDevCookieAuth
    ? normalizeRoles(devRolesCookie.split("|"))
    : [];
  logMiddlewareCheck("HR/Admin role evaluation", {
    pathname,
    hasToken: Boolean(token),
    hasDevCookieAuth,
    roles,
  });
  const hasHrCoreAccess = HR_CORE_ROLES.some((role) => roles.includes(role));
  const hasManagerAccess = MANAGER_SCOPED_ROLES.some((role) => roles.includes(role));
  const hasAdminManagerAccess = HR_MANAGER_ROLES.some((role) => roles.includes(role));
  const hasHrManagerDashboardAccess = canAccessHrManagerDashboard(roles);

  if (pathname.startsWith("/admin/users") && !hasAdminManagerAccess) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isHrRoute) {
    if (pathname.startsWith("/hr/manager")) {
      if (hasHrManagerDashboardAccess) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    const managerFriendly = HR_ALLOWED_PATHS_FOR_MANAGERS.some((route) =>
      pathname.startsWith(route)
    );

    if (managerFriendly && (hasHrCoreAccess || hasManagerAccess)) {
      return NextResponse.next();
    }

    if (!hasHrCoreAccess) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/hr/:path*", "/admin/:path*"],
};
