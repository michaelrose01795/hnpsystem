// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";
import Section from "../components/Section";
import { useRouter } from "next/router";
import LoginDropdown from "../components/LoginDropdown";
import { supabase } from "../lib/supabaseClient"; // Database connection
import { usersByRole } from "../config/users"; // Dev users config

export default function LoginPage() {
  const { devLogin, user, setUser } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Developer login handler
  const handleDevLogin = () => {
    if (!selectedRole || !selectedUser) {
      alert("Please select a role and a user.");
      return;
    }
    devLogin(selectedUser, selectedRole);
  };

  // Supabase email/password login
  const handleDbLogin = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !data) {
        setErrorMessage("User not found.");
        return;
      }

      // Simple password check (replace with hashed in production)
      if (data.password !== password) {
        setErrorMessage("Incorrect password.");
        return;
      }

      // Set user in context and redirect
      setUser({
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
              <LoginDropdown
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                usersByRole={usersByRole}
              />
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