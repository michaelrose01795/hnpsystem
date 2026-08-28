// file location: src/pages/api/auth/[...nextauth].js
// NextAuth API route — internal email/password credentials login.
//
// Phase 1A hardening (stop-the-bleeding):
//   - The "log in by user ID" shortcut is now gated behind isDevAuthAllowed()
//     (false in production unless ALLOW_DEV_AUTH=1).
//   - Every login attempt is recorded to auth_login_attempts.
//   - Per-email + per-IP rate limit + soft lockout is enforced.
//   - Password compare is still plaintext at this stage; that is fixed in
//     Phase 1B (bcrypt migration). Do not rely on it.

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
// Plain constants only — safe at module scope (no DB / bcrypt / audit imports).
import { ALL_ACCESS_ROLE } from "@/lib/auth/roles";
import { ALL_ACCESS_SESSION_USER } from "@/lib/auth/allAccessSession";
// NOTE: the heavy, login-only dependencies (Supabase client, bcrypt password
// helpers, rate limiting, audit logging) are intentionally NOT imported at
// module scope. They are dynamically imported inside `authorize` instead, so the
// hot `/api/auth/session` path (which only runs the jwt/session callbacks, no
// DB / bcrypt) doesn't pay their import/cold-start cost. The login flow is
// unchanged — `authorize` awaits the same modules before using them.

const isLocalhostUrl = (value = "") => /localhost|127\.0\.0\.1/i.test(String(value));
const isVercelHost = (value = "") => /\.vercel\.app$/i.test(String(value));

const applyRuntimeNextAuthUrl = (req) => {
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "";
  const proto =
    req?.headers?.["x-forwarded-proto"] ||
    (host && !isLocalhostUrl(host) ? "https" : "http");

  if (!host) return;

  const currentAuthUrl = process.env.NEXTAUTH_URL || "";
  const shouldUseRequestHost =
    Boolean(process.env.VERCEL) ||
    isVercelHost(host) ||
    isVercelHost(currentAuthUrl) ||
    (isLocalhostUrl(host) && !isLocalhostUrl(currentAuthUrl)) ||
    (!isLocalhostUrl(host) && (!currentAuthUrl || isLocalhostUrl(currentAuthUrl)));

  if (shouldUseRequestHost) {
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
};

const buildAuthOptions = (req) => ({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userId: { label: "User ID", type: "text" },
        devPlatform: { label: "Developer Platform", type: "text" },
        allAccess: { label: "All Access Demo", type: "text" },
      },
      async authorize(credentials) {
        // Lazy-load login-only dependencies here (see module-top note). These
        // imports run only on an actual credentials login attempt, never on the
        // session GET path.
        const [
          { supabase },
          { isDevAuthAllowed, isCiTestAuthAllowed },
          { checkRateLimit, recordAttempt, getClientIp, getUserAgent },
          { verifyPassword, rehashAndPersist, ALGO_BCRYPT },
          { writeAuditLog },
        ] = await Promise.all([
          import("@/lib/database/supabaseClient"),
          import("@/lib/auth/devAuth"),
          import("@/lib/auth/rateLimit"),
          import("@/lib/auth/passwords"),
          import("@/lib/audit/auditLog"),
        ]);

        const ip = getClientIp(req);
        const userAgent = getUserAgent(req);

        try {
          // CI / Playwright bypass — only when PLAYWRIGHT_TEST_AUTH=1.
          if (isCiTestAuthAllowed() && credentials?.userId) {
            const numericId = parseInt(credentials.userId, 10);
            if (Number.isFinite(numericId) && numericId > 0) {
              return {
                id: String(numericId),
                name: "CI Test User",
                email: "ci-test@example.com",
                role: "Admin",
                roles: ["Admin"],
                department: "Development",
                isDevLogin: true,
              };
            }
          }

          // Developer Platform login (Phase 8) — mints the synthetic `dev`
          // role. Same gate as the dev-by-id login (isDevAuthAllowed(): false
          // in production unless ALLOW_DEV_AUTH=1). The role is created in code
          // here and never comes from a users row, so it can never be assigned
          // to a real staff member. Records a dev_platform_session audit entry.
          if (credentials?.devPlatform === "1") {
            if (!isDevAuthAllowed()) {
              await recordAttempt({
                endpoint: "login",
                email: null,
                ip,
                userAgent,
                succeeded: false,
                failureReason: "dev_platform_disabled",
              });
              return null;
            }
            await writeAuditLog({
              action: "dev_platform_session",
              actorRole: "dev",
              entityType: "dev_platform",
              entityId: null,
              diff: { event: "session_start" },
              ip,
              userAgent,
            }).catch(() => {});
            return {
              id: "dev-platform",
              name: "Developer",
              email: "",
              role: "dev",
              roles: ["dev"],
              department: "Development",
              isDevLogin: true,
            };
          }

          // All Access demo login — mints the synthetic `all access` role.
          // Same gate as the dev-by-id / dev-platform logins (isDevAuthAllowed():
          // false in production unless ALLOW_DEV_AUTH=1). The role is created in
          // code here and never comes from a users row, so it can never be
          // assigned to a real staff member. It exists purely so the app can be
          // demonstrated from one login with every module and page available.
          if (credentials?.allAccess === "1") {
            if (!isDevAuthAllowed()) {
              await recordAttempt({
                endpoint: "login",
                email: null,
                ip,
                userAgent,
                succeeded: false,
                failureReason: "all_access_disabled",
              });
              return null;
            }
            // The demo account has a real `users` row, with made-up details, so
            // every per-user feature (profile, clocking, messages, payslips,
            // personal dashboard) has something to read. The row is created on
            // first use. Its stored password is 'unset', so this row can never
            // be signed into through the email/password form — only here.
            // If the database is unreachable the session still opens, using the
            // fully synthetic identity; only per-user data is missing.
            let demoUser = null;
            try {
              const { ensureAllAccessUser } = await import("@/lib/database/allAccessUser");
              demoUser = await ensureAllAccessUser();
            } catch (demoUserError) {
              console.warn(
                "[auth] All Access demo user unavailable; falling back to the synthetic session:",
                demoUserError?.message || demoUserError
              );
            }
            const demoUserId = Number(demoUser?.user_id);
            const hasDemoRow = Number.isInteger(demoUserId) && demoUserId > 0;
            await writeAuditLog({
              action: "all_access_session",
              actorUserId: hasDemoRow ? demoUserId : null,
              actorRole: ALL_ACCESS_ROLE,
              entityType: "all_access",
              entityId: hasDemoRow ? demoUserId : null,
              diff: { event: "session_start", linked: hasDemoRow },
              ip,
              userAgent,
            }).catch(() => {});
            return {
              ...ALL_ACCESS_SESSION_USER,
              // The ROLE stays the code-minted `all access` marker regardless of
              // what the row says — the row supplies identity, never permissions.
              roles: [...ALL_ACCESS_SESSION_USER.roles],
              ...(hasDemoRow
                ? {
                    id: String(demoUserId),
                    name:
                      demoUser.name ||
                      [demoUser.first_name, demoUser.last_name].filter(Boolean).join(" ") ||
                      ALL_ACCESS_SESSION_USER.name,
                    email: demoUser.email || "",
                    department: demoUser.department || ALL_ACCESS_SESSION_USER.department,
                  }
                : {}),
            };
          }

          // Dev login by user ID — gated. Refuses in production unless
          // ALLOW_DEV_AUTH=1 is explicitly set.
          if (credentials?.userId) {
            if (!isDevAuthAllowed()) {
              await recordAttempt({
                endpoint: "login",
                email: null,
                ip,
                userAgent,
                succeeded: false,
                failureReason: "dev_login_disabled",
              });
              return null;
            }
            const { data, error } = await supabase
              .from("users")
              .select("user_id, first_name, last_name, email, role, department")
              .eq("user_id", parseInt(credentials.userId, 10))
              .single();

            if (error || !data) return null;

            return {
              id: String(data.user_id),
              name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "User",
              email: data.email,
              role: data.role,
              roles: data.role ? [data.role] : [],
              department: data.department || null,
              isDevLogin: true,
            };
          }

          // Email/password login.
          if (!credentials?.email || !credentials?.password) return null;

          const email = String(credentials.email).trim();

          const limit = await checkRateLimit({ endpoint: "login", email, ip });
          if (!limit.allowed) {
            await recordAttempt({
              endpoint: "login",
              email,
              ip,
              userAgent,
              succeeded: false,
              failureReason: limit.reason,
            });
            return null;
          }

          const { data, error } = await supabase
            .from("users")
            .select("user_id, first_name, last_name, email, password_hash, password_algo, role, department, is_active")
            .ilike("email", email)
            .single();

          if (error || !data) {
            await recordAttempt({
              endpoint: "login",
              email,
              ip,
              userAgent,
              succeeded: false,
              failureReason: "no_such_user",
            });
            return null;
          }

          if (data.is_active === false) {
            await recordAttempt({
              endpoint: "login",
              email,
              userId: data.user_id,
              ip,
              userAgent,
              succeeded: false,
              failureReason: "account_disabled",
            });
            return null;
          }

          const algo = data.password_algo || "plaintext";
          const matched = await verifyPassword({
            submitted: credentials.password,
            stored: data.password_hash || "",
            algo,
          });

          if (!matched) {
            await recordAttempt({
              endpoint: "login",
              email,
              userId: data.user_id,
              ip,
              userAgent,
              succeeded: false,
              failureReason: "bad_password",
            });
            await writeAuditLog({
              action: "login_fail",
              actorUserId: data.user_id,
              entityType: "user",
              entityId: data.user_id,
              diff: { reason: "bad_password" },
              ip,
              userAgent,
            });
            return null;
          }

          // Lazy migration: a row that authenticated against a plaintext
          // value gets rehashed to bcrypt before this request returns. Any
          // failure here is logged but does not block the login — the user
          // will be re-rehashed next time.
          if (algo !== ALGO_BCRYPT) {
            try {
              await rehashAndPersist({
                userId: data.user_id,
                plaintext: credentials.password,
              });
            } catch (rehashErr) {
              console.error(
                "[auth] lazy rehash failed for user",
                data.user_id,
                rehashErr?.message || rehashErr
              );
            }
          }

          await recordAttempt({
            endpoint: "login",
            email,
            userId: data.user_id,
            ip,
            userAgent,
            succeeded: true,
          });
          await writeAuditLog({
            action: "login_success",
            actorUserId: data.user_id,
            actorRole: data.role || null,
            entityType: "user",
            entityId: data.user_id,
            diff: algo !== ALGO_BCRYPT ? { rehashed_from: algo } : null,
            ip,
            userAgent,
          });

          return {
            id: String(data.user_id),
            name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "User",
            email: data.email,
            role: data.role,
            department: data.department || null,
            isDevLogin: false,
          };
        } catch (err) {
          console.error("NextAuth credentials authorize error:", err);
          await recordAttempt({
            endpoint: "login",
            email: credentials?.email || null,
            ip,
            userAgent,
            succeeded: false,
            failureReason: "server_error",
          });
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        if (account.provider === "credentials" && user) {
          token.userId = user.id;
          token.roles = Array.isArray(user.roles)
            ? user.roles
            : user.role
            ? [user.role]
            : [];
          token.isDevLogin = Boolean(user.isDevLogin);
          token.department = user.department || null;
          token.accessToken = null;
          token.idToken = null;
        }
      } else if (!token.userId && token.sub) {
        token.userId = token.sub;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.userId || session.user.id || null;
      session.user.roles = token.roles || [];
      session.user.department = token.department || null;
      session.user.isDevLogin = Boolean(token.isDevLogin);
      session.accessToken = token.accessToken || null;
      session.idToken = token.idToken || null;
      return session;
    },
  },
});

// Backwards-compatible export for callers (e.g. getServerSession) that import
// authOptions directly. This shape matches the previous default — request-aware
// fields (IP/UA) are only populated when authOptions is built per-request.
export const authOptions = buildAuthOptions(null);

export default async function auth(req, res) {
  applyRuntimeNextAuthUrl(req);
  return await NextAuth(req, res, buildAuthOptions(req));
}
