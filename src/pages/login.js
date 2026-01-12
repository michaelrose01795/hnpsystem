// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import LoginDropdown from "@/components/LoginDropdown";
import CustomerViewPreview from "@/components/CustomerViewPreview";
import { supabase } from "@/lib/supabaseClient"; // Database connection
import { roleCategories } from "@/config/users"; // Dev users config

const FIELD_MAX_WIDTH = 380;

const LoginCard = ({
  title,
  subtitle,
  children,
  contentMaxWidth = FIELD_MAX_WIDTH,
  className = "",
}) => (
  <div
    className={["login-card", className].filter(Boolean).join(" ")}
    style={{ width: "100%", display: "flex", justifyContent: "center" }}
  >
    <div
      style={{
        borderRadius: "32px",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "var(--surface)",
        boxShadow: "0 30px 70px rgba(15, 23, 42, 0.15)",
        padding: "2.25rem",
        backdropFilter: "blur(18px)",
        width: "100%",
        maxWidth: contentMaxWidth + 72,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            color: "var(--text-primary)",
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              color: "var(--text-secondary, #64748b)",
              fontSize: "0.95rem",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="login-card-inner"
        style={{ maxWidth: contentMaxWidth, margin: "24px auto 0" }}
      >
        {children}
      </div>
    </div>
  </div>
);

export default function LoginPage() {
  const CUSTOMER_PORTAL_URL =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";
  // Safe destructuring from context
  const userContext = useUser();
  const devLogin = userContext?.devLogin;
  const user = userContext?.user;
  const setUser = userContext?.setUser;
  const { usersByRole, usersByRoleDetailed, isLoading: rosterLoading, refreshRoster } = useRoster();

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDevUsers, setLoadingDevUsers] = useState(true);

  const loginRoleCategories = React.useMemo(() => {
    const rosterRoles = Object.keys(usersByRoleDetailed || usersByRole || {}).filter(Boolean);
    const categories = roleCategories || {};
    const seen = new Map();
    const normalizedCategory = {};

    Object.entries(categories).forEach(([category, roles]) => {
      const nextRoles = [];
      (roles || []).forEach((role) => {
        const key = String(role).toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, role);
          nextRoles.push(role);
        }
      });
      if (nextRoles.length) {
        normalizedCategory[category] = nextRoles;
      }
    });

    const missingRoles = [];
    rosterRoles.forEach((role) => {
      const key = String(role).toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, role);
        missingRoles.push(role);
      }
    });

    if (missingRoles.length) {
      normalizedCategory.Other = missingRoles.sort((a, b) => a.localeCompare(b));
    }

    return normalizedCategory;
  }, [usersByRole, usersByRoleDetailed]);

  // Developer login handler
  const handleDevLogin = async () => {
    if (!devLogin) {
      alert("Developer login is not available. User context is missing.");
      return;
    }
    if (!selectedCategory || !selectedDepartment || !selectedUser) {
      alert("Please select an area, department, and user.");
      return;
    }
    const result = await devLogin(selectedUser, selectedDepartment);
    if (result?.success === false) {
      alert("Dev login failed. Please try again.");
    }
  };

  // Supabase email/password login
  const handleDbLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const response = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      const data = response?.data;
      const error = response?.error;

      if (error || !data) {
        setErrorMessage("User not found.");
        return;
      }

      if (data.password !== password) {
        setErrorMessage("Incorrect password.");
        return;
      }

      setUser?.({
        id: data.id,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email,
        role: data.role,
      });
    } catch (err) {
      console.error("❌ Login error:", err);
      setErrorMessage("Login failed, please try again.");
    }
  };

  // Redirect once user is logged in
  useEffect(() => {
    if (user) {
      const roles = []
        .concat(user.roles || [])
        .concat(user.role ? [user.role] : [])
        .map((role) => String(role).toLowerCase());
      const target = roles.some((role) => role.includes("customer"))
        ? "/customer"
        : "/newsfeed";
      router.push(target);
    }
  }, [user, router]);

  useEffect(() => {
    // ⚠️ Mock data found — replacing with Supabase query
    // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
    if (!rosterLoading) {
      setLoadingDevUsers(false);
    }
  }, [rosterLoading]);

  return (
    <Layout>
      <div className="login-page-wrapper">
        <div className="login-stack">
          <div className="login-brand">
            <img
              src="/images/logo/LightLogo.png"
              alt="HP Automotive"
              className="login-logo login-logo-light"
            />
            <img
              src="/images/logo/DarkLogo.png"
              alt="HP Automotive"
              className="login-logo login-logo-dark"
            />
          </div>

          <div className="login-card-stack">
            <LoginCard
              className="login-card--auth"
              title="Login"
            >
              <form onSubmit={handleDbLogin} className="login-form">
                <div className="login-field">
                  <label htmlFor="email" className="login-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="email@humphriesandpark.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password" className="login-label">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    required
                  />
                </div>

                {errorMessage && (
                  <p className="login-error" role="alert">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="login-button"
                  style={{ background: "var(--primary)" }}
                >
                  Login
                </button>
              </form>
            </LoginCard>

            <LoginCard
              className="login-card--dev"
              title="Developer Login"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <LoginDropdown
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedDepartment={selectedDepartment}
                  setSelectedDepartment={setSelectedDepartment}
                  selectedUser={selectedUser}
                  setSelectedUser={setSelectedUser}
                  usersByRole={usersByRole}
                  usersByRoleDetailed={usersByRoleDetailed}
                  roleCategories={loginRoleCategories}
                />

                {(loadingDevUsers || rosterLoading) && (
                  <p className="login-loading-text">Loading database users for dev login...</p>
                )}


                <button
                  onClick={handleDevLogin}
                  className="login-button"
                  style={{ background: "var(--primary)" }}
                >
                  Dev Login
                </button>
              </div>
            </LoginCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}
