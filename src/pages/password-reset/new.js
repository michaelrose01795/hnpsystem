// file location: src/pages/password-reset/new.js
// Set-a-new-password page reached from the email link sent by
// /api/auth/password-reset (action: "request"). The token is verified and
// consumed by /api/auth/password-reset (action: "confirm").
//
// This page replaces the old /password-reset/reverted flow, which leaked
// the user's previous plaintext password back to them.
//
// Layout: chrome-free public page (PublicLayout — the reset link is followed
// by a signed-OUT user, so the gated StaffLayout shell must not wrap it).
// Surfaces follow the layer ladder: LayerSurface (page card) > LayerTheme
// (form section). All appearance comes from staffglobal.css / families:
// .app-page-shell, .app-page-header*, .app-input (via InputField),
// .app-toggle-field + .app-toggle--checkbox, .app-status-message, .app-btn.

import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { publicGetLayout } from "@/components/layout/PublicLayout";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import InputField from "@/components/ui/InputField";
import StatusMessage from "@/components/ui/StatusMessage";
import Button from "@/components/ui/Button";

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

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword
      ? "The two passwords do not match."
      : undefined;

  return (
    <>
      <Head>
        <title>Set a new password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Shell background, colour and font come from html.staff-scope body. */}
      <main
        className="app-page-shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          width: "100%",
        }}
      >
        {/* Margin (not padding) keeps the gutter on a flex item without
            overflowing the 100% width on narrow phones. */}
        <LayerSurface
          as="section"
          padding="var(--page-card-padding)"
          gap="var(--page-stack-gap)"
          style={{ flex: "1 1 auto", maxWidth: 440, margin: "var(--space-md)" }}
        >
          <header className="app-page-header">
            <div className="app-page-header__text">
              <h1 className="app-page-header__title">
                {done ? "Password updated" : "Set a new password"}
              </h1>
              <p className="app-page-header__subtitle">
                {done
                  ? "You can now sign in with your new password."
                  : "Choose a new password for your account."}
              </p>
            </div>
          </header>

          {done ? (
            <LayerTheme>
              <StatusMessage tone="success">
                Your password has been updated.
              </StatusMessage>
              <Link
                href="/login"
                className="app-btn app-btn--primary"
                style={{ width: "100%" }}
              >
                Continue to sign in
              </Link>
            </LayerTheme>
          ) : (
            <LayerTheme as="form" onSubmit={handleSubmit} noValidate>
              <InputField
                label="New password"
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                hint={`Use at least ${MIN_PASSWORD_LENGTH} characters. Avoid passwords you use on other sites.`}
              />

              <InputField
                label="Confirm new password"
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                error={mismatch}
              />

              <label className="app-toggle-field" htmlFor="show-passwords">
                <input
                  id="show-passwords"
                  className="app-toggle--checkbox"
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show passwords</span>
              </label>

              {/* Live region stays mounted so the message is announced; hidden
                  when empty so it does not add an extra gap to the stack. */}
              <div role="alert" style={{ display: errorMessage ? "block" : "none" }}>
                {errorMessage && (
                  <StatusMessage tone="danger">{errorMessage}</StatusMessage>
                )}
              </div>

              <Button
                type="submit"
                busy={submitting}
                disabled={!token}
                style={{ width: "100%" }}
              >
                {submitting ? "Saving…" : "Save new password"}
              </Button>
            </LayerTheme>
          )}
        </LayerSurface>
      </main>
    </>
  );
}

PasswordResetNewPage.getLayout = publicGetLayout;
