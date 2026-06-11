// file location: src/pages/security.js
//
// Self-service security settings: change password, see recent auth activity.
// More controls (MFA enrolment, active sessions, recovery codes) will be
// added here in later phases.

import React, { useEffect, useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const PASSWORD_MIN_LENGTH = 12;
const SECURITY_PAGE_KEY = "account-security-page-card";

const ACTION_LABELS = {
  login_success: "Signed in",
  login_fail: "Failed sign-in attempt",
  password_change: "Password changed",
  password_change_fail: "Failed password change",
  password_reset: "Password reset via email"
};

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function SecuritySection({ title, sectionKey, children }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      sectionType="content-card"
      parentKey={SECURITY_PAGE_KEY}
      gap="12px"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2>
      </div>
      {children}
    </LayerTheme>
  );
}

function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setStatusType("info");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setStatusMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      setStatusType("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage("New passwords do not match.");
      setStatusType("error");
      return;
    }
    if (newPassword === currentPassword) {
      setStatusMessage("Pick a password different from your current one.");
      setStatusType("error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        setStatusMessage(payload?.message || "Could not update password.");
        setStatusType("error");
        return;
      }
      setStatusMessage("Password updated.");
      setStatusType("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatusMessage(err?.message || "Could not update password.");
      setStatusType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColour =
    statusType === "error"
      ? "var(--danger-base)"
      : statusType === "success"
      ? "var(--success-base)"
      : "var(--surfaceTextMuted)";

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 12, maxWidth: 420 }}
      data-dev-section="1"
      data-dev-section-key="account-security-password-form"
      data-dev-section-type="content-card"
      data-dev-section-parent="account-security-change-password"
      data-dev-shell="0"
    >
      <label style={{ fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        New password
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--surfaceTextMuted)" }}>
        Use at least {PASSWORD_MIN_LENGTH} characters. Avoid passwords reused on other sites.
      </p>
      {statusMessage && (
        <p
          role={statusType === "error" ? "alert" : undefined}
          aria-live="polite"
          style={{ margin: 0, color: statusColour, fontSize: "0.85rem" }}
        >
          {statusMessage}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving..." : "Update Password"}
        </Button>
      </div>
    </form>
  );
}

function RecentActivity() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/account/recent-activity", { credentials: "include" });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload?.success) {
          setError(payload?.message || "Could not load recent activity.");
          setEvents([]);
          return;
        }
        setEvents(payload.events || []);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not load recent activity.");
        setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (events === null) {
    return <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>Loading recent activity...</p>;
  }
  if (error) {
    return <p style={{ margin: 0, color: "var(--danger-base)" }}>{error}</p>;
  }
  if (events.length === 0) {
    return <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>No recent sign-in activity recorded.</p>;
  }

  return (
    <div
      style={{ overflowX: "auto" }}
      data-dev-section="1"
      data-dev-section-key="account-security-activity-table-wrap"
      data-dev-section-type="data-table"
      data-dev-section-parent="account-security-recent-activity"
      data-dev-shell="0"
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        data-dev-section="1"
        data-dev-section-key="account-security-activity-table"
        data-dev-section-type="data-table"
        data-dev-section-parent="account-security-activity-table-wrap"
      >
        <thead
          data-dev-section="1"
          data-dev-section-key="account-security-activity-headings"
          data-dev-section-type="table-headings"
          data-dev-section-parent="account-security-activity-table"
        >
          <tr style={{ textAlign: "left", color: "var(--surfaceTextMuted)" }}>
            <th style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--separating-line)" }}>When</th>
            <th style={{ padding: "8px 8px", borderBottom: "1px solid var(--separating-line)" }}>Event</th>
            <th style={{ padding: "8px 8px", borderBottom: "1px solid var(--separating-line)" }}>IP</th>
            <th style={{ padding: "8px 0 8px 8px", borderBottom: "1px solid var(--separating-line)" }}>Device</th>
          </tr>
        </thead>
        <tbody
          data-dev-section="1"
          data-dev-section-key="account-security-activity-rows"
          data-dev-section-type="table-rows"
          data-dev-section-parent="account-security-activity-table"
        >
          {events.map((event) => (
            <tr key={event.id}>
              <td style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--separating-line)" }}>
                {formatTimestamp(event.occurredAt)}
              </td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid var(--separating-line)" }}>
                {ACTION_LABELS[event.action] || event.action}
              </td>
              <td
                style={{
                  padding: "8px 8px",
                  borderBottom: "1px solid var(--separating-line)",
                  fontFamily: "var(--font-family-mono, monospace)",
                  fontSize: "0.8rem"
                }}
              >
                {event.ip || "Not recorded"}
              </td>
              <td
                style={{
                  padding: "8px 0 8px 8px",
                  borderBottom: "1px solid var(--separating-line)",
                  fontSize: "0.8rem",
                  color: "var(--surfaceTextMuted)"
                }}
              >
                {event.userAgent ? event.userAgent.slice(0, 80) : "Not recorded"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--surfaceTextMuted)" }}>
        If you see an event you do not recognise, change your password immediately and contact your manager.
      </p>
    </div>
  );
}

export function SecurityPanel() {
  return (
    <LayerSurface
      as="div"
      sectionKey={SECURITY_PAGE_KEY}
      sectionType="page-shell"
      backgroundToken="surface"
      widthMode="full"
      shell
      padding="var(--page-card-padding)"
      gap="var(--page-stack-gap)"
    >
      <div className="app-page-stack">
        <SecuritySection title="Change Password" sectionKey="account-security-change-password">
          <PasswordChangeForm />
        </SecuritySection>
        <SecuritySection title="Recent Sign-In Activity" sectionKey="account-security-recent-activity">
          <RecentActivity />
        </SecuritySection>
      </div>
    </LayerSurface>
  );
}

export default function AccountSecurityPage() {
  return (
    <ProtectedRoute>
      <Head>
        <title>Security - HNP System</title>
      </Head>
      <div className="app-page-shell">
        <SecurityPanel />
      </div>
    </ProtectedRoute>
  );
}
