// file location: src/pages/password-reset/reverted.js
// Customer-facing password revert page. Loads the user's saved theme (accent +
// light/dark mode) and applies it to the page so the experience feels like
// theirs. Not read-only: after the revert succeeds the user can choose a fresh
// new password from this same page.
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { buildThemeRuntime, normalizeAccent, normalizeMode } from "@/styles/themeRuntime";

const SCOPE_CLASS = "password-reverted-scope";

const resolveSystemMode = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const buildScopedThemeCss = ({ accentColor, darkMode }) => {
  const accentName = normalizeAccent(accentColor);
  const requestedMode = normalizeMode(darkMode);
  const resolvedMode = requestedMode === "system" ? resolveSystemMode() : requestedMode;
  const runtime = buildThemeRuntime({ resolvedMode, accentName });
  const declarations = Object.entries(runtime.legacy || {})
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n  ");
  return { css: `.${SCOPE_CLASS} {\n  ${declarations}\n}`, resolvedMode };
};

export default function PasswordRevertedPage() {
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Reverting password...");
  const [originalPassword, setOriginalPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [themePreferences, setThemePreferences] = useState({
    accentColor: "red",
    darkMode: "system",
  });
  const [resolvedMode, setResolvedMode] = useState("light");

  // New-password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingNewPassword, setSavingNewPassword] = useState(false);
  const [newPasswordSaved, setNewPasswordSaved] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");

  const token = useMemo(() => {
    if (!router.isReady) return "";
    const value = router.query?.token;
    return typeof value === "string" ? value : "";
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing reset token.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revert", token }),
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = { success: false, message: `Request failed (${response.status}).` };
        }

        if (cancelled) return;

        if (!response.ok || !payload?.success) {
          setStatus("error");
          setMessage(payload?.message || "Unable to revert password.");
          return;
        }

        setOriginalPassword(String(payload?.revertedPassword || ""));
        setDisplayName(String(payload?.displayName || ""));
        if (payload?.themePreferences) {
          setThemePreferences({
            accentColor: payload.themePreferences.accentColor || "red",
            darkMode: payload.themePreferences.darkMode || "system",
          });
        }
        setStatus("success");
        setMessage(payload?.message || "Password has been reverted.");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error?.message || "Unable to revert password.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, token]);

  // Build a scoped CSS block that injects the user's theme tokens onto this
  // page only (so we don't leak preferences into other tabs / pages).
  const themeCssInfo = useMemo(
    () => buildScopedThemeCss(themePreferences),
    [themePreferences]
  );

  useEffect(() => {
    setResolvedMode(themeCssInfo.resolvedMode);
  }, [themeCssInfo.resolvedMode]);

  const handleSaveNewPassword = async (event) => {
    event.preventDefault();
    setNewPasswordError("");
    if (!newPassword) {
      setNewPasswordError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPasswordError("The passwords do not match.");
      return;
    }
    setSavingNewPassword(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setNewFromToken", token, newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        setNewPasswordError(payload?.message || "Could not save the new password.");
        return;
      }
      setNewPasswordSaved(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setNewPasswordError(err?.message || "Could not save the new password.");
    } finally {
      setSavingNewPassword(false);
    }
  };

  const heading =
    status === "success"
      ? "Password Reverted"
      : status === "error"
      ? "Revert Failed"
      : "Working...";

  const statusAccent =
    status === "success"
      ? "var(--accentMain)"
      : status === "error"
      ? "#ef4444"
      : "var(--accentMain)";

  return (
    <>
      <Head>
        <title>Password Reset</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content={resolvedMode === "dark" ? "dark" : "light"} />
      </Head>
      {/* Inline scoped stylesheet so this page renders in the recipient user's
          theme without polluting the rest of the app. */}
      <style dangerouslySetInnerHTML={{ __html: themeCssInfo.css }} />

      <main
        className={SCOPE_CLASS}
        style={{
          minHeight: "100vh",
          minHeight: "100dvh",
          margin: 0,
          background: "var(--page-shell-bg)",
          color: "var(--text-primary)",
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
            maxWidth: 560,
            background: "var(--page-card-bg)",
            border: "1px solid var(--border)",
            borderTop: `4px solid ${statusAccent}`,
            borderRadius: "var(--radius-md, 12px)",
            padding: 24,
            textAlign: "center",
            boxShadow: "var(--shadow-xl, 0 24px 48px rgba(0,0,0,0.18))",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: "1.5rem",
              color: "var(--accentMain)",
            }}
          >
            {heading}
          </h1>

          {displayName && status === "success" && (
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Hello {displayName},
            </p>
          )}

          <p style={{ margin: "0 0 18px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {message}
          </p>

          <div
            style={{
              width: 72,
              height: 3,
              background: statusAccent,
              margin: "0 auto 20px",
              borderRadius: "var(--radius-pill, 999px)",
            }}
          />

          {status === "success" && (
            <>
              {/* Original password reveal */}
              <div
                style={{
                  margin: "0 auto 20px",
                  textAlign: "center",
                  background: "var(--accentSurfaceSubtle)",
                  border: "1px solid var(--accentBorder)",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Your Restored Password
                </p>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs, 6px)",
                    background: "var(--surfaceMain)",
                    color: "var(--text-primary)",
                    padding: "10px 12px",
                    fontFamily: "var(--font-family-mono, ui-monospace, monospace)",
                    minHeight: 40,
                    boxSizing: "border-box",
                    wordBreak: "break-all",
                  }}
                >
                  {revealed ? originalPassword || "(empty password)" : "••••••••••••"}
                </div>
                <button
                  type="button"
                  onClick={() => setRevealed((prev) => !prev)}
                  style={{
                    marginTop: 10,
                    border: "none",
                    borderRadius: "var(--radius-xs, 6px)",
                    background: "var(--accentMain)",
                    color: "var(--onAccentText)",
                    padding: "10px 14px",
                    minHeight: 40,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {revealed ? "Hide Password" : "Reveal Password"}
                </button>
              </div>

              {/* Set a new password — interactive, not read-only */}
              <form
                onSubmit={handleSaveNewPassword}
                style={{
                  margin: "0 auto",
                  textAlign: "left",
                  background: "var(--surfaceMain)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: 16,
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "center",
                  }}
                >
                  Choose a New Password
                </p>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  For your security, we recommend setting a fresh password now.
                </p>

                {newPasswordSaved ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-xs, 6px)",
                      background: "var(--accentSurfaceSubtle)",
                      border: "1px solid var(--accentBorder)",
                      color: "var(--accentMain)",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Your new password has been saved.
                  </div>
                ) : (
                  <>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      New password
                    </label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        minHeight: 44,
                        borderRadius: "var(--radius-xs, 6px)",
                        border: "1px solid var(--border)",
                        background: "var(--surfaceMain)",
                        color: "var(--text-primary)",
                        fontSize: "0.95rem",
                        marginBottom: 12,
                      }}
                    />

                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      Confirm new password
                    </label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        minHeight: 44,
                        borderRadius: "var(--radius-xs, 6px)",
                        border: "1px solid var(--border)",
                        background: "var(--surfaceMain)",
                        color: "var(--text-primary)",
                        fontSize: "0.95rem",
                        marginBottom: 12,
                      }}
                    />

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        marginBottom: 14,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={showNewPassword}
                        onChange={(e) => setShowNewPassword(e.target.checked)}
                      />
                      Show passwords
                    </label>

                    {newPasswordError && (
                      <div
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
                        {newPasswordError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingNewPassword}
                      style={{
                        width: "100%",
                        minHeight: 44,
                        padding: "12px 14px",
                        border: "none",
                        borderRadius: "var(--radius-xs, 6px)",
                        background: "var(--accentMain)",
                        color: "var(--onAccentText)",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: savingNewPassword ? "not-allowed" : "pointer",
                        opacity: savingNewPassword ? 0.7 : 1,
                      }}
                    >
                      {savingNewPassword ? "Saving..." : "Save New Password"}
                    </button>
                  </>
                )}
              </form>
            </>
          )}
        </section>
      </main>
    </>
  );
}
