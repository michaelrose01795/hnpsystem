// file location: src/pages/profile/privacy.js
//
// Privacy hub for the signed-in user. Self-serve access to the data we
// hold, consent management, and subject-request filing.

import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const REQUEST_TYPE_LABELS = {
  access: "Access (copy of all my data)",
  erasure: "Erasure (delete my data)",
  rectification: "Rectification (fix incorrect data)",
  portability: "Portability (machine-readable export)",
  objection: "Objection (stop a specific use of my data)",
  restriction: "Restriction (pause processing of my data)"
};

const STATUS_LABELS = {
  received: "Received",
  identity_verified: "Identity verified",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  rejected: "Rejected"
};

const PRIVACY_PAGE_KEY = "profile-privacy-page-card";

const formatDate = (iso) => {
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
};

function PrivacySection({ title, sectionKey, children }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      sectionType="content-card"
      parentKey={PRIVACY_PAGE_KEY}
      gap="12px"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2>
      </div>
      {children}
    </LayerTheme>
  );
}

function ProfileSummary({ profile }) {
  if (!profile) return null;
  const fields = [
    ["First name", profile.first_name],
    ["Last name", profile.last_name],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["Role", profile.role],
    ["Job title", profile.job_title],
    ["Department", profile.department],
    ["Employment type", profile.employment_type],
    ["Start date", profile.start_date],
    ["Home address", profile.home_address],
    ["Account created", formatDate(profile.created_at)],
    ["Password last changed", formatDate(profile.password_updated_at)]
  ].filter(([, value]) => value);

  return (
    <div
      style={{ display: "grid", gap: 8 }}
      data-dev-section="1"
      data-dev-section-key="profile-privacy-profile-fields"
      data-dev-section-type="content-card"
      data-dev-section-parent="profile-privacy-profile-data"
      data-dev-shell="0"
    >
      {fields.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px, 1fr) minmax(0, 2fr)",
            gap: 12,
            padding: "8px 0",
            borderBottom: "1px solid var(--separating-line)"
          }}
        >
          <span style={{ color: "var(--surfaceTextMuted)" }}>{label}</span>
          <span style={{ color: "var(--surfaceText)" }}>{value}</span>
        </div>
      ))}
      <p style={{ margin: "12px 0 0", fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        Need to correct anything? Use <strong>Rectification</strong> below to file a request, or
        contact your manager.
      </p>
    </div>
  );
}

function ConsentManager({ initial, onUpdated }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const purposes = initial?.purposes || {};
  const effective = initial?.effective || {};

  const isGranted = (purpose) => {
    const key = `${purpose}:`;
    for (const k of Object.keys(effective)) {
      if (k.startsWith(`${purpose}:`) && effective[k]?.status === "granted") return true;
    }
    return Boolean(effective[key] && effective[key].status === "granted");
  };

  const toggle = async (purpose, granted) => {
    setBusy(purpose);
    setError("");
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          purpose,
          status: granted ? "granted" : "withdrawn",
          source: "profile_privacy_page"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        setError(payload?.message || "Could not update consent.");
        return;
      }
      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Could not update consent.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{ display: "grid", gap: "var(--space-3)" }}
      data-dev-section="1"
      data-dev-section-key="profile-privacy-consent-list"
      data-dev-section-type="content-card"
      data-dev-section-parent="profile-privacy-consents"
      data-dev-shell="0"
    >
      {Object.entries(purposes).map(([purpose, label]) => {
        const granted = isGranted(purpose);
        return (
          <div
            key={purpose}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 12,
              minHeight: 44
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "var(--surfaceText)" }}>{label}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>
                {granted ? "You have given consent." : "No consent on record."}
              </div>
            </div>
            <Button
              type="button"
              variant={granted ? "secondary" : "primary"}
              size="sm"
              disabled={busy === purpose}
              onClick={() => toggle(purpose, !granted)}
            >
              {busy === purpose ? "Saving..." : granted ? "Withdraw" : "Grant"}
            </Button>
          </div>
        );
      })}
      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--danger-base)", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function SubjectRequestForm({ onCreated }) {
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/privacy/sar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestType, details })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        setStatusMessage(payload?.message || "Could not file request.");
        setStatusType("error");
        return;
      }
      setStatusMessage("Request filed. Compliance staff will respond within 30 days.");
      setStatusType("success");
      setDetails("");
      onCreated?.();
    } catch (err) {
      setStatusMessage(err?.message || "Could not file request.");
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
      style={{ display: "grid", gap: 10, maxWidth: 520 }}
      data-dev-section="1"
      data-dev-section-key="profile-privacy-subject-request-form"
      data-dev-section-type="content-card"
      data-dev-section-parent="profile-privacy-subject-request"
      data-dev-shell="0"
    >
      <label style={{ fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        Request type
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 44 }}
        >
          {Object.entries(REQUEST_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>
        Details (optional)
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={2000}
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
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
          {submitting ? "Filing..." : "File Request"}
        </Button>
      </div>
    </form>
  );
}

function RequestsList({ requests }) {
  if (!requests || requests.length === 0) {
    return <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>You have not filed any subject requests.</p>;
  }
  return (
    <div
      style={{ overflowX: "auto" }}
      data-dev-section="1"
      data-dev-section-key="profile-privacy-requests-table-wrap"
      data-dev-section-type="data-table"
      data-dev-section-parent="profile-privacy-open-requests"
      data-dev-shell="0"
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
        data-dev-section="1"
        data-dev-section-key="profile-privacy-requests-table"
        data-dev-section-type="data-table"
        data-dev-section-parent="profile-privacy-requests-table-wrap"
      >
        <thead
          data-dev-section="1"
          data-dev-section-key="profile-privacy-requests-headings"
          data-dev-section-type="table-headings"
          data-dev-section-parent="profile-privacy-requests-table"
        >
          <tr style={{ textAlign: "left", color: "var(--surfaceTextMuted)" }}>
            <th style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--separating-line)" }}>Type</th>
            <th style={{ padding: 8, borderBottom: "1px solid var(--separating-line)" }}>Status</th>
            <th style={{ padding: 8, borderBottom: "1px solid var(--separating-line)" }}>Filed</th>
            <th style={{ padding: "8px 0 8px 8px", borderBottom: "1px solid var(--separating-line)" }}>Due by</th>
          </tr>
        </thead>
        <tbody
          data-dev-section="1"
          data-dev-section-key="profile-privacy-requests-rows"
          data-dev-section-type="table-rows"
          data-dev-section-parent="profile-privacy-requests-table"
        >
          {requests.map((row) => (
            <tr key={row.id}>
              <td style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--separating-line)" }}>
                {REQUEST_TYPE_LABELS[row.request_type] || row.request_type}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid var(--separating-line)" }}>
                {STATUS_LABELS[row.status] || row.status}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid var(--separating-line)" }}>
                {formatDate(row.received_at)}
              </td>
              <td style={{ padding: "8px 0 8px 8px", borderBottom: "1px solid var(--separating-line)" }}>
                {formatDate(row.due_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrivacyPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/privacy/me", { credentials: "include" });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload?.success) {
          setError(payload?.message || "Could not load privacy data.");
          return;
        }
        setData(payload);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not load privacy data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <LayerSurface
      as="div"
      sectionKey={PRIVACY_PAGE_KEY}
      sectionType="page-shell"
      backgroundToken="surface"
      widthMode="full"
      shell
      padding="var(--page-card-padding)"
      gap="var(--page-stack-gap)"
    >
      <div className="app-page-stack">
        <PrivacySection title="Privacy" sectionKey="profile-privacy-summary">
          <p style={{ margin: 0, color: "var(--surfaceTextMuted)", lineHeight: 1.5 }}>
            This page summarises the personal data we hold about you and lets you manage your consents or
            file a request under UK GDPR. Account security controls (password change, recent sign-in
            activity) are on <Link href="/account/security">/account/security</Link>.
          </p>
          {error && (
            <p role="alert" style={{ margin: "10px 0 0", color: "var(--danger-base)" }}>
              {error}
            </p>
          )}
        </PrivacySection>

        <PrivacySection title="Your Profile Data" sectionKey="profile-privacy-profile-data">
          {data ? (
            <ProfileSummary profile={data.profile} />
          ) : (
            <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>Loading...</p>
          )}
        </PrivacySection>

        <PrivacySection title="Download a Copy" sectionKey="profile-privacy-download">
          <p style={{ margin: "0 0 12px", color: "var(--surfaceTextMuted)" }}>
            Get a JSON file containing the data we hold against your account (profile, consents, subject
            requests, recent sign-in events).
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/privacy/export" className="app-btn app-btn--primary">
            Download my data (JSON)
          </a>
          <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "var(--surfaceTextMuted)" }}>
            For a full subject access request including all linked records, file an Access request below;
            staff will fulfil within 30 days.
          </p>
        </PrivacySection>

        <PrivacySection title="Marketing &amp; Communication Consents" sectionKey="profile-privacy-consents">
          {data ? (
            <ConsentManager initial={data.consents} onUpdated={() => setTick((n) => n + 1)} />
          ) : (
            <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>Loading...</p>
          )}
        </PrivacySection>

        <PrivacySection title="File a Subject Request" sectionKey="profile-privacy-subject-request">
          <SubjectRequestForm onCreated={() => setTick((n) => n + 1)} />
        </PrivacySection>

        <PrivacySection title="Your Open Requests" sectionKey="profile-privacy-open-requests">
          <RequestsList requests={data?.requests || []} />
        </PrivacySection>
      </div>
    </LayerSurface>
  );
}

export default function PrivacyHubPage() {
  return (
    <ProtectedRoute>
      <Head>
        <title>Privacy - HNP System</title>
      </Head>
      <div className="app-page-shell">
        <PrivacyPanel />
      </div>
    </ProtectedRoute>
  );
}
