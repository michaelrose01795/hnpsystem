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

const LoginCard = ({ title, subtitle, children, contentMaxWidth = FIELD_MAX_WIDTH }) => (
  <div className="w-full flex justify-center">
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
      <div className="space-y-1 text-center">
        <h2
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-sm text-slate-500"
            style={{ color: "var(--text-secondary, #64748b)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="mt-6 space-y-5" style={{ maxWidth: contentMaxWidth, margin: "0 auto" }}>
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
  const { usersByRole, isLoading: rosterLoading, refreshRoster } = useRoster();

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDevUsers, setLoadingDevUsers] = useState(true);

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
      router.push("/newsfeed");
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
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
          <div className="w-full max-w-lg mx-auto space-y-6">
            <LoginCard title="Login" subtitle="Secure access with your email and password">
              <form onSubmit={handleDbLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@hpautomotive.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 transition focus:-translate-y-0.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-600">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 transition focus:-translate-y-0.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    required
                  />
                </div>

                {errorMessage && (
                  <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl py-3 text-base font-semibold text-white shadow-lg shadow-red-500/30 transition hover:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                  style={{ background: "var(--primary)" }}
                >
                  Login
                </button>
              </form>
            </LoginCard>

            <LoginCard
              title="Developer Login"
              subtitle="Use predefined personas to explore the platform safely"
            >
              <div className="space-y-5">
                <LoginDropdown
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedDepartment={selectedDepartment}
                  setSelectedDepartment={setSelectedDepartment}
                  selectedUser={selectedUser}
                  setSelectedUser={setSelectedUser}
                  usersByRole={usersByRole}
                  roleCategories={roleCategories}
                />

                {(loadingDevUsers || rosterLoading) && (
                  <p className="text-xs text-slate-400">Loading database users for dev login...</p>
                )}

                {selectedCategory === "Customers" && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <CustomerViewPreview
                      portalUrl={CUSTOMER_PORTAL_URL}
                      selectedPersona={selectedUser?.name || ""}
                      selectedDepartment={selectedDepartment}
                    />
                  </div>
                )}

                <button
                  onClick={handleDevLogin}
                  className="w-full rounded-2xl py-3 text-base font-semibold text-white shadow-lg shadow-red-500/30 transition hover:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-200"
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
