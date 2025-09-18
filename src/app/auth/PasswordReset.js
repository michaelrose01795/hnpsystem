// src/pages/auth/PasswordReset.js
// =================================
// This is the password reset page for the DMS system.
// TODO previously: "Integrate with Keycloak reset flow"
// For now: placeholder form that shows confirmation message.

import React, { useState } from "react";

export default function PasswordReset() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleReset = (e) => {
    e.preventDefault();

    if (!email) {
      alert("Please enter your email address");
      return;
    }

    console.log("Password reset requested for:", email);

    // Later: Replace with API call to Keycloak reset flow
    setSubmitted(true);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded shadow-md p-8">
        {!submitted ? (
          <>
            <h1 className="text-2xl font-bold mb-6 text-center">
              Reset Password
            </h1>
            <form onSubmit={handleReset} className="space-y-4">
              {/* Email field */}
              <div>
                <label className="block mb-1 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
                  placeholder="Enter your account email"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
              >
                Send Reset Link
              </button>
            </form>

            <p className="mt-4 text-center text-gray-500 text-sm">
              Remembered your password?{" "}
              <a href="/auth/login" className="text-blue-600 hover:underline">
                Login
              </a>
            </p>
          </>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
            <p className="text-gray-600">
              If an account exists for <strong>{email}</strong>, you will receive
              a password reset link shortly.
            </p>
            <a
              href="/auth/login"
              className="inline-block mt-6 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
            >
              Return to Login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}