// src/pages/auth/Login.js
// ========================
// This is the login page for the DMS system.
// TODO previously: "Implement real Keycloak integration"
// For now: placeholder form that redirects to dashboard on submit.

import React, { useState } from "react";
import { useRouter } from "next/router"; // for navigation

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // ===== Placeholder authentication logic =====
    // Later: Replace this with Keycloak / backend validation
    if (username && password) {
      console.log("Logging in:", username);
      router.push("/dashboard"); // redirect after "login"
    } else {
      alert("Please enter username and password");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">H&P DMS Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block mb-1 font-medium">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              placeholder="Enter username"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              placeholder="Enter password"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Login
          </button>
        </form>

        {/* Later: Add "Forgot password?" and SSO buttons here */}
        <p className="mt-4 text-center text-gray-500 text-sm">
          Powered by Humphries & Parks DMS
        </p>
      </div>
    </div>
  );
}