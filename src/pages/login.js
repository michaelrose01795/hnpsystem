// file location: /src/pages/login.js
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";
import Section from "../components/Section";

export default function LoginPage() {
  const { devLogin } = useUser();
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  // Users grouped by role
  const usersByRole = {
    Admin: ["Julie (manager)", "Alisha", "Zedenca"],
    Accounts: ["Paul (manager)", "Ally"],
    Owner: ["Marcus"],
    "General Manager": ["Owen"],
    "Sales Director": ["Sam"],
    Sales: ["Josh", "Brad", "Richard", "Rob"],
    Service: ["Nicola", "Sharna", "Darrell (workshop controller & service manager)"],
    "After Sales Director": ["Soren"],
    Techs: ["Glen", "Michael", "Jake", "Scott", "Paul", "Cheryl"],
    Parts: ["Scott (manager)", "Alister"],
    "MOT Tester": ["Russle", "Jake (tech) - when Russle off"],
    "Valet Service": ["Paul"],
    "Valet Sales": ["Alex", "Harvey", "Peter"],
    "Buying Director": ["Bruno"],
    "Second Hand Buying": ["Sophie"],
    "Vehicle Processor & Photographer": ["Grace"],
    Receptionist: ["Carol"],
    Painters: ["Guy 1", "Guy 2"],
    Contractors: ["Smart Repair", "Paints (grey van)", "Dent Man", "Wheel Men", "Windscreen Guy", "Key Guy"],
  };

  const handleDevLogin = () => {
    if (!selectedRole || !selectedUser) {
      alert("Please select a role and a user.");
      return;
    }
    devLogin(selectedUser, selectedRole);
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

              {/* Role selector */}
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setSelectedUser(""); // reset user when role changes
                }}
                className="p-2 border border-gray-300 rounded"
              >
                <option value="">Select Role</option>
                {Object.keys(usersByRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              {/* User selector */}
              {selectedRole && (
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="p-2 border border-gray-300 rounded"
                >
                  <option value="">Select User</option>
                  {usersByRole[selectedRole].map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              )}

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
