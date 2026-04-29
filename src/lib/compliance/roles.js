// Who is allowed to read/write compliance registers (SARs, breaches, DPIAs,
// ROPA, retention). Until a dedicated DPO / Privacy Lead role is defined,
// access piggybacks on the existing admin/owner roles.

import { hasAnyRole } from "@/lib/auth/roles";

export const COMPLIANCE_ADMIN_ROLES = ["owner", "admin manager", "admin"];

export function isComplianceAdmin(userRoles) {
  return hasAnyRole(userRoles, COMPLIANCE_ADMIN_ROLES);
}

// Helper for API handlers: returns the session user's id + roles, or
// 401 / 403 to send back. Centralises the gate so every compliance
// endpoint behaves identically.
export async function requireComplianceAdmin({ getServerSession, authOptions, req, res }) {
  const session = await getServerSession(req, res, authOptions);
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isFinite(userId) || userId <= 0) {
    return { error: { status: 401, message: "Not signed in." } };
  }
  const roles = session.user.roles || (session.user.role ? [session.user.role] : []);
  if (!isComplianceAdmin(roles)) {
    return { error: { status: 403, message: "Compliance role required." } };
  }
  return { userId, roles, role: roles[0] || null };
}
