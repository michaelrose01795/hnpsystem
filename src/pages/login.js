// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import Section from "@/components/Section";
import LoginDropdown from "@/components/LoginDropdown";
import CustomerViewPreview from "@/components/CustomerViewPreview";
import { supabase } from "@/lib/supabaseClient"; // Database connection
import { roleCategories } from "@/config/users"; // Dev users config

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
      <div className="min-h-screen w-full bg-gradient-to-b from-white via-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-12 space-y-10">
        <div className="w-full max-w-xl">
          <Section
            title="Access your workspace"
            bgColor="#ffffff"
            textColor="#0f172a"
            className="border border-slate-200/70 shadow-xl ring-1 ring-black/5"
          >
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  Secure Login
                </p>
                <p className="text-base text-slate-500">
                  Use the credentials saved in the DMS to get back to your tools.
                </p>
              </div>

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
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    required
                  />
                </div>

                {errorMessage && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-500 py-3 text-base font-semibold text-white shadow-lg shadow-red-500/30 transition hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  Login
                </button>
              </form>
            </div>
          </Section>
        </div>

        <div className="w-full max-w-4xl">
          <Section
            title="Developer Login"
            bgColor="#ffffff"
            textColor="#0f172a"
            className="border border-slate-200/70 shadow-lg ring-1 ring-black/5"
          >
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                Quickly mirror the experience for Retail, Sales, Customers, or internal departments to
                verify permissions and scoped dashboards.
              </p>

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
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <CustomerViewPreview
                    portalUrl={CUSTOMER_PORTAL_URL}
                    selectedPersona={selectedUser?.name || ""}
                    selectedDepartment={selectedDepartment}
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  Choose an area, department, and user to impersonate.
                </div>
                <button
                  onClick={handleDevLogin}
                  className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 sm:w-auto sm:px-6"
                >
                  Dev Login
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
