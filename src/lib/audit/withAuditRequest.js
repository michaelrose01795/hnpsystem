// file location: src/lib/audit/withAuditRequest.js
//
// For API routes that are not wrapped by withRoleGuard (which binds the audit
// actor itself). Wrap the default export so every database write the route
// makes is attributed by the audit trigger:
//
//   export default withAuditRequest(handler);                        // staff (NextAuth)
//   export default withAuditRequest(handler, { actor: "customer" }); // /website customer
//   export default withAuditRequest(handler, { actor: "system" });   // cron, webhooks
//
// It never changes the response: the handler still does its own auth checks.
// A route with no signed-in user is recorded as anonymous, never as a person.

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import {
  buildCustomerAuditHeaders,
  buildStaffAuditHeaders,
  buildSystemAuditHeaders,
  runWithAuditHeaders,
} from "@/lib/audit/requestAuditContext";

async function resolveAuditHeaders(req, res, actor) {
  if (actor === "system") return buildSystemAuditHeaders(req);
  if (actor === "customer") {
    let customerSession = null;
    try {
      customerSession = getCustomerSessionFromReq(req);
    } catch {
      customerSession = null;
    }
    return buildCustomerAuditHeaders(req, customerSession);
  }
  let session = null;
  try {
    session = await getServerSession(req, res, authOptions);
  } catch {
    session = null;
  }
  return buildStaffAuditHeaders(req, session);
}

export function withAuditRequest(handler, { actor = "staff" } = {}) {
  return async (req, res) => {
    const headers = await resolveAuditHeaders(req, res, actor);
    return runWithAuditHeaders(headers, () => handler(req, res));
  };
}

export default withAuditRequest;
