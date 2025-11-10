// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import Section from "@/components/Section";
import LoginDropdown from "@/components/LoginDropdown";
import CustomerViewPreview from "@/components/CustomerViewPreview";
import { supabase } from "@/lib/supabaseClient"; // Database connection
import { usersByRole, roleCategories } from "@/config/users"; // Dev users config
import { getUsersGroupedByRole } from "@/lib/database/users";

export default function LoginPage() {
  const CUSTOMER_PORTAL_URL =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";
  // Safe destructuring from context
  const userContext = useUser();
  const devLogin = userContext?.devLogin;
  const user = userContext?.user;
  const setUser = userContext?.setUser;

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [devUsersByRole, setDevUsersByRole] = useState(usersByRole);
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
    let mounted = true;
    const loadUsers = async () => {
      setLoadingDevUsers(true);
      try {
        const grouped = await getUsersGroupedByRole();
        if (!mounted) return;
        if (grouped && Object.keys(grouped).length > 0) {
          setDevUsersByRole({ ...usersByRole, ...grouped });
        } else {
          setDevUsersByRole(usersByRole);
        }
      } catch (error) {
        console.error("❌ Failed to load developer users:", error);
        if (mounted) {
          setDevUsersByRole(usersByRole);
        }
      } finally {
        if (mounted) {
          setLoadingDevUsers(false);
        }
      }
    };
    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Layout>
      <div className="flex justify-center items-center h-full">
        <div className="w-full max-w-md">
          <Section
            title="Login to H&P System"
            bgColor="#ffffff"
            borderColor="#d10000"
            textColor="#222222"
          >
            <div className="flex flex-col space-y-4">
              {/* Keycloak login */}
              <button
                onClick={() => signIn("keycloak")}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Login with SSO
              </button>

              <hr className="border-gray-300" />

              {/* Database email/password login */}
              <form onSubmit={handleDbLogin} className="flex flex-col space-y-2">
                <h3 className="text-lg font-semibold">Database Login</h3>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border p-2 rounded"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border p-2 rounded"
                  required
                />
                {errorMessage && <p className="text-red-600">{errorMessage}</p>}
                <button
                  type="submit"
                  className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                  Login
                </button>
              </form>

              <hr className="border-gray-300" />

              {/* Developer login */}
              <h3 className="text-lg font-semibold">Developer Login</h3>
              <p className="text-sm text-gray-600">
                Switch between Retail, Sales, and the new Customer view to mirror what each user group
                sees inside the platform.
              </p>
              <LoginDropdown
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectedDepartment={selectedDepartment}
                setSelectedDepartment={setSelectedDepartment}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                usersByRole={devUsersByRole}
                roleCategories={roleCategories}
              />
              {loadingDevUsers && (
                <p className="text-xs text-gray-500">
                  Loading database users for dev login...
                </p>
              )}
              {selectedCategory === "Customers" && (
                <CustomerViewPreview
                  portalUrl={CUSTOMER_PORTAL_URL}
                  selectedPersona={selectedUser?.name || ""}
                  selectedDepartment={selectedDepartment}
                />
              )}
              <button
                onClick={handleDevLogin}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Dev Login
              </button>
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
