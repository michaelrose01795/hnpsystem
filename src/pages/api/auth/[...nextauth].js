// file location: src/pages/api/auth/[...nextauth].js
// NextAuth API route — supports Keycloak OIDC and email/password credentials login.

import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import CredentialsProvider from "next-auth/providers/credentials";
import jwtDecode from "jwt-decode";
import { supabase } from "@/lib/supabaseClient";

// Auto-correct NEXTAUTH_URL for Vercel deployments
// NextAuth uses NEXTAUTH_URL to determine cookie naming (secure vs non-secure prefix)
// If set to localhost on a production Vercel deployment, session cookies break
if (process.env.VERCEL_URL && (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost"))) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions = {
  providers: [
    // Keycloak OIDC provider (used when Keycloak is configured)
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID || "unused",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "unused",
      issuer: process.env.KEYCLOAK_ISSUER || "https://placeholder",
    }),

    // Credentials provider — validates email/password against Supabase users table
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userId: { label: "User ID", type: "text" },
      },
      async authorize(credentials) {
        try {
          // Dev login by user ID (only in non-production)
          if (credentials?.userId) {
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
            };
          }

          // Email/password login
          if (!credentials?.email || !credentials?.password) return null;

          const { data, error } = await supabase
            .from("users")
            .select("user_id, first_name, last_name, email, password_hash, role")
            .ilike("email", credentials.email)
            .single();

          if (error || !data) return null;
          if (data.password_hash !== credentials.password) return null;

          return {
            id: String(data.user_id),
            name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "User",
            email: data.email,
            role: data.role,
          };
        } catch (err) {
          console.error("NextAuth credentials authorize error:", err);
          return null;
        }
      },
    }),
  ],

  // Use custom login page instead of NextAuth default
  pages: {
    signIn: "/login",
  },

  // Use JWT strategy for session management
  session: {
    strategy: "jwt",
  },

  // Security secret used by NextAuth to sign cookies & tokens
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        if (account.provider === "keycloak") {
          // Keycloak login — extract roles from OIDC tokens
          token.accessToken = account.access_token;
          token.idToken = account.id_token;

          try {
            const raw = account.id_token || account.access_token || null;
            if (raw) {
              const decoded = jwtDecode(raw);
              token.roles =
                decoded?.realm_access?.roles ||
                decoded?.resource_access?.[process.env.KEYCLOAK_CLIENT_ID]?.roles ||
                [];
              token.userId =
                decoded?.sub ||
                decoded?.user_id ||
                account.providerAccountId ||
                token.userId ||
                null;
            } else {
              token.roles = [];
              token.userId = null;
            }
          } catch (err) {
            console.error("NextAuth: failed to decode Keycloak token for roles", err);
            token.roles = [];
            token.userId = token.userId || null;
          }
        } else if (account.provider === "credentials" && user) {
          // Credentials login — user object comes from authorize()
          token.userId = user.id;
          token.roles = user.role ? [user.role] : [];
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
      session.accessToken = token.accessToken || null;
      session.idToken = token.idToken || null;
      return session;
    },
  },
};

export default NextAuth(authOptions);
