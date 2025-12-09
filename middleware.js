import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  HR_CORE_ROLES,
  HR_MANAGER_ROLES,
  MANAGER_SCOPED_ROLES,
  normalizeRoles,
} from "./src/lib/auth/roles";

const HR_ALLOWED_PATHS_FOR_MANAGERS = ["/hr/employees", "/hr/leave"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isHrRoute = pathname.startsWith("/hr");
  const isAdminRoute = pathname.startsWith("/admin");

  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    return NextResponse.next();
  }

  if (!isHrRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roles = normalizeRoles(token.roles || []);
  const hasHrCoreAccess = HR_CORE_ROLES.some((role) => roles.includes(role));
  const hasManagerAccess = MANAGER_SCOPED_ROLES.some((role) => roles.includes(role));
  const hasAdminManagerAccess = HR_MANAGER_ROLES.some((role) => roles.includes(role));
  const hasOwnerAccess = roles.includes("owner");

  if (pathname.startsWith("/admin/users") && !hasAdminManagerAccess) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isHrRoute) {
    // Allow Owner to access /hr/manager
    if (pathname.startsWith("/hr/manager") && hasOwnerAccess) {
      return NextResponse.next();
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
