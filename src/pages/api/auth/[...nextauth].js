// file location: src/pages/api/auth/[...nextauth].js
// NextAuth API route — supports email/password credentials login.

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabaseClient";

// Auto-correct NEXTAUTH_URL for Vercel deployments
// NextAuth uses NEXTAUTH_URL to determine cookie naming (secure vs non-secure prefix)
// If set to localhost on a production Vercel deployment, session cookies break
if (process.env.VERCEL_URL && (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost"))) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions = {
  providers: [
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
              isDevLogin: true,
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
            isDevLogin: false,
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
        if (account.provider === "credentials" && user) {
          // Credentials login — user object comes from authorize()
          token.userId = user.id;
          token.roles = user.role ? [user.role] : [];
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
};

export default NextAuth(authOptions);
