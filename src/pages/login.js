// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";
import Section from "../components/Section";
import { useRouter } from "next/router";
import LoginDropdown from "../components/LoginDropdown";

// Import centralized users config
import { usersByRole } from "../config/users";

export default function LoginPage() {
  const { devLogin, user } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  // Developer login handler
  const handleDevLogin = () => {
    if (!selectedRole || !selectedUser) {
      alert("Please select a role and a user.");
      return;
    }
    devLogin(selectedUser, selectedRole);
  };

  // Redirect dev login users once `user` is set
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

              {/* Developer login */}
              <h3 className="text-lg font-semibold">Developer Login</h3>

              {/* LoginDropdown component */}
              <LoginDropdown
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                usersByRole={usersByRole} // use centralized config
              />

              {/* Dev login button */}
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

