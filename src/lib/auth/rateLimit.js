// DB-backed rate limiter + soft lockout for auth endpoints. Uses the
// auth_login_attempts table (see migrations/0001_phase1a_auth.sql).
//
// Why DB-backed: Vercel serverless functions don't share memory across
// invocations, so an in-memory counter would not stop a credential-stuffing
// attack distributed across cold-starts.
//
// Policy (Phase 1A defaults):
//   per email   — 5 fails in 15 min  → soft-lock for 15 min
//   per IP      — 20 fails in 15 min → reject
//   reset request — 5 per email per hour, 30 per IP per hour

import { supabaseService } from "@/lib/database/supabaseClient";

const WINDOW_LOGIN_MS = 15 * 60 * 1000;
const WINDOW_RESET_MS = 60 * 60 * 1000;

const POLICY = {
  login: {
    windowMs: WINDOW_LOGIN_MS,
    perEmailMax: 5,
    perIpMax: 20,
  },
  password_reset_request: {
    windowMs: WINDOW_RESET_MS,
    perEmailMax: 5,
    perIpMax: 30,
  },
  password_reset_confirm: {
    windowMs: WINDOW_LOGIN_MS,
    perEmailMax: 10,
    perIpMax: 30,
  },
};

const normaliseEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

export function getClientIp(req) {
  const fwd = req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) {
    return fwd.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || null;
}

export function getUserAgent(req) {
  const ua = req?.headers?.["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : null;
}

async function countFailures({ endpoint, email, ip, sinceIso }) {
  if (!supabaseService) return { emailFails: 0, ipFails: 0 };

  const queries = [];
  if (email) {
    queries.push(
      supabaseService
        .from("auth_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("endpoint", endpoint)
        .eq("succeeded", false)
        .eq("email", email)
        .gte("attempted_at", sinceIso)
    );
  } else {
    queries.push(Promise.resolve({ count: 0 }));
  }
  if (ip) {
    queries.push(
      supabaseService
        .from("auth_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("endpoint", endpoint)
        .eq("succeeded", false)
        .eq("ip_address", ip)
        .gte("attempted_at", sinceIso)
    );
  } else {
    queries.push(Promise.resolve({ count: 0 }));
  }

  const [emailRes, ipRes] = await Promise.all(queries);
  return {
    emailFails: Number(emailRes?.count || 0),
    ipFails: Number(ipRes?.count || 0),
  };
}

// Returns { allowed: true } or { allowed: false, reason, retryAfterSec }.
// Fail-open if Supabase is unreachable (we'd rather risk a brute-force window
// than lock everyone out on infra blips), but never fail-open on a hard
// rejection that came from real data.
export async function checkRateLimit({ endpoint, email, ip }) {
  const policy = POLICY[endpoint];
  if (!policy) return { allowed: true };

  const sinceIso = new Date(Date.now() - policy.windowMs).toISOString();
  const normEmail = normaliseEmail(email);

  let counts;
  try {
    counts = await countFailures({
      endpoint,
      email: normEmail,
      ip,
      sinceIso,
    });
  } catch (err) {
    console.error("[rateLimit] count failed:", err?.message || err);
    return { allowed: true };
  }

  if (normEmail && counts.emailFails >= policy.perEmailMax) {
    return {
      allowed: false,
      reason: "account_locked",
      retryAfterSec: Math.ceil(policy.windowMs / 1000),
    };
  }
  if (ip && counts.ipFails >= policy.perIpMax) {
    return {
      allowed: false,
      reason: "ip_throttled",
      retryAfterSec: Math.ceil(policy.windowMs / 1000),
    };
  }
  return { allowed: true };
}

export async function recordAttempt({
  endpoint,
  email,
  userId,
  ip,
  userAgent,
  succeeded,
  failureReason,
}) {
  if (!supabaseService) return;
  try {
    await supabaseService.from("auth_login_attempts").insert([
      {
        endpoint,
        email: normaliseEmail(email),
        user_id: typeof userId === "number" ? userId : null,
        ip_address: ip || null,
        user_agent: userAgent || null,
        succeeded: Boolean(succeeded),
        failure_reason: failureReason || null,
      },
    ]);
  } catch (err) {
    console.error("[rateLimit] recordAttempt failed:", err?.message || err);
  }
}
