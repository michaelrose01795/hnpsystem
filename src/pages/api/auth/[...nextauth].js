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
import { supabase } from "@/lib/database/supabaseClient";
import { isDevAuthAllowed, isCiTestAuthAllowed } from "@/lib/auth/devAuth";
import {
  checkRateLimit,
  recordAttempt,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/rateLimit";
import {
  verifyPassword,
  rehashAndPersist,
  ALGO_BCRYPT,
} from "@/lib/auth/passwords";
import { writeAuditLog } from "@/lib/audit/auditLog";

const isLocalhostUrl = (value = "") => /localhost|127\.0\.0\.1/i.test(String(value));

const applyRuntimeNextAuthUrl = (req) => {
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "";
  const proto =
    req?.headers?.["x-forwarded-proto"] ||
    (host && !isLocalhostUrl(host) ? "https" : "http");

  if (!host) return;

  if (!isLocalhostUrl(host) && (!process.env.NEXTAUTH_URL || isLocalhostUrl(process.env.NEXTAUTH_URL))) {
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
      },
      async authorize(credentials) {
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
                isDevLogin: true,
              };
            }
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
              .select("user_id, first_name, last_name, email, role")
              .eq("user_id", parseInt(credentials.userId, 10))
              .single();

            if (error || !data) return null;

            return {
              id: String(data.user_id),
              name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "User",
              email: data.email,
              role: data.role,
              roles: data.role ? [data.role] : [],
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
            .select("user_id, first_name, last_name, email, password_hash, password_algo, role, is_active")
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
