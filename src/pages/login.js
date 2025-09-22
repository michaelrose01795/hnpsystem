// file location: /src/pages/login.js
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";
import Section from "../components/Section";

export default function LoginPage() {
  const { devLogin } = useUser();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("WORKSHOP");

  const handleDevLogin = () => {
    devLogin(username, role);
    window.location.href = "/dashboard"; // redirect after login
  };

  return (
    <Layout>
      {/* Center the login section */}
      <div className="flex justify-center items-center h-full">
        <div className="w-full max-w-md">
          {/* Login form section */}
          <Section
            title="Login to H&P System"
            bgColor="#ffffff"
            borderColor="#d10000"
            textColor="#222222"
          >
            {/* Keycloak login */}
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => signIn("keycloak")}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Login with SSO
              </button>

              <hr className="border-gray-300" />

              {/* Dev login for testing */}
              <h3 className="text-lg font-semibold">Developer Login</h3>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="p-2 border border-gray-300 rounded"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="p-2 border border-gray-300 rounded"
              >
                <option value="ADMIN">Admin</option>
                <option value="SALES">Sales</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="PARTS">Parts</option>
                <option value="MANAGERS">Managers</option>
              </select>
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
