// file location: src/pages/login.js
// Login page updated to offer Keycloak SSO and a dev fallback login (dev only).
// Place this file at src/pages/login.js (overwrite previous version).

import React, { useState } from "react"; // React + state hook
import { useUser } from "../context/UserContext"; // our user hook
import { useRouter } from "next/router"; // router for redirects

export default function LoginPage() {
  const router = useRouter(); // router
  const { user, loginWithKeycloak, devLogin, status } = useUser(); // get helpers
  const [username, setUsername] = useState(""); // dev username input
  const [role, setRole] = useState("WORKSHOP"); // dev role input

  // if logged in (either SSO or dev) redirect to dashboard
  if (typeof window !== "undefined" && user) {
    // avoid infinite loop on initial render
    if (router.pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 20 }}>
      <h1>H&P — Login (Phase 1.2 SSO)</h1>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => loginWithKeycloak()} // trigger NextAuth signIn for Keycloak
          style={{ padding: "10px 14px", display: "block", marginBottom: 10 }}
        >
          Sign in with H&P SSO (Keycloak)
        </button>
        <div style={{ color: "#666" }}>
          {status === "loading" ? "Checking session..." : "Use SSO to sign in (Keycloak)."}
        </div>
      </div>

      {/* Development-only local login: visible in development mode */}
      {process.env.NODE_ENV === "development" && (
        <section style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <h3>Developer / Local login (dev only)</h3>
          <label style={{ display: "block", marginBottom: 8 }}>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="dev.user"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
            />
          </label>

          <label style={{ display: "block", margin: "12px 0" }}>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}>
              <option>ADMIN</option>
              <option>MANAGER</option>
              <option>WORKSHOP</option>
              <option>SALES</option>
              <option>PARTS</option>
              <option>MOT</option>
              <option>VALET</option>
              <option>PAINT</option>
            </select>
          </label>

          <button
            onClick={() => {
              // simple validation
              if (!username || username.trim().length < 2) return alert("Enter a username (min 2 chars)");
              devLogin({ username: username.trim(), role }); // perform dev login
            }}
            style={{ padding: "10px 14px", marginTop: 8 }}
          >
            Dev login
          </button>
          <div style={{ marginTop: 8, color: "#666" }}>
            This local login only exists in development to help building features before SSO is available.
          </div>
        </section>
      )}
    </div>
  );
}