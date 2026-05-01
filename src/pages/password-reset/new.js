// file location: src/pages/password-reset/new.js
// Set-a-new-password page reached from the email link sent by
// /api/auth/password-reset (action: "request"). The token is verified and
// consumed by /api/auth/password-reset (action: "confirm").
//
// This page replaces the old /password-reset/reverted flow, which leaked
// the user's previous plaintext password back to them.

import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

const MIN_PASSWORD_LENGTH = 12;

export default function PasswordResetNewPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);

  const token = useMemo(() => {
    if (!router.isReady) return "";
    const value = router.query?.token;
    return typeof value === "string" ? value : "";
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setErrorMessage("This reset link is missing its token.");
    }
  }, [router.isReady, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!token) {
      setErrorMessage("This reset link is missing its token.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        setErrorMessage(
          payload?.message || "Could not update password. The link may have expired."
        );
        return;
      }
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setErrorMessage(err?.message || "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Set a new password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <main
        style={{
          minHeight: "100dvh",
          background: "var(--page-shell-bg)",
          color: "var(--text-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          fontFamily: "var(--font-family, system-ui, sans-serif)",
          boxSizing: "border-box",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 480,
            background: "var(--page-card-bg)",
            border: "1px solid var(--primary-border)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "var(--radius-md, 12px)",
            padding: 24,
            boxShadow: "var(--shadow-xl, 0 24px 48px rgba(0,0,0,0.18))",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: "1.5rem",
              color: "var(--primary)",
              textAlign: "center",
            }}
          >
            {done ? "Password Updated" : "Set a New Password"}
          </h1>
          <p
            style={{
              margin: "0 0 20px",
              color: "var(--text-1)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {done
              ? "Your password has been updated. You can now sign in with the new password."
              : "Choose a new password for your account."}
          </p>

          {done ? (
            <div style={{ textAlign: "center" }}>
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  padding: "12px 18px",
                  borderRadius: "var(--radius-xs, 6px)",
                  background: "var(--primary)",
                  color: "var(--onAccentText)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Continue to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--text-1)",
                  marginBottom: 6,
                }}
              >
                New password
              </label>
              <input
                className="app-input"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                style={{ marginBottom: 12 }}
              />

              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "var(--text-1)",
                  marginBottom: 6,
                }}
              >
                Confirm new password
              </label>
              <input
                className="app-input"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                style={{ marginBottom: 12 }}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.85rem",
                  color: "var(--text-1)",
                  marginBottom: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show passwords
              </label>

              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: "0.78rem",
                  color: "var(--text-1)",
                  lineHeight: 1.5,
                }}
              >
                Use at least {MIN_PASSWORD_LENGTH} characters. Avoid passwords you use
                on other sites.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-xs, 6px)",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginBottom: 12,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !token}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "12px 14px",
                  border: "none",
                  borderRadius: "var(--radius-xs, 6px)",
                  background: "var(--primary)",
                  color: "var(--onAccentText)",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting || !token ? 0.7 : 1,
                }}
              >
                {submitting ? "Saving..." : "Save New Password"}
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
