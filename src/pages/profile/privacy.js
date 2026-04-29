// file location: src/pages/profile/privacy.js
//
// Privacy hub for the signed-in user. Self-serve access to the data we
// hold, consent management, and subject-request filing.

import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";

const REQUEST_TYPE_LABELS = {
  access: "Access (copy of all my data)",
  erasure: "Erasure (delete my data)",
  rectification: "Rectification (fix incorrect data)",
  portability: "Portability (machine-readable export)",
  objection: "Objection (stop a specific use of my data)",
  restriction: "Restriction (pause processing of my data)",
};

const STATUS_LABELS = {
  received: "Received",
  identity_verified: "Identity verified",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

const formatDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

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
    ["Password last changed", formatDate(profile.password_updated_at)],
  ].filter(([, value]) => value);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {fields.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 1fr) 2fr",
            gap: 12,
            padding: "8px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <p style={{ margin: "12px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Need to correct anything? Use{" "}
        <strong>Rectification</strong> below to file a request, or contact your manager.
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
    // Channel-less consent record (or any granted record for the purpose).
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
          source: "profile_privacy_page",
        }),
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
    <div style={{ display: "grid", gap: 10 }}>
      {Object.entries(purposes).map(([purpose, label]) => {
        const granted = isGranted(purpose);
        return (
          <div
            key={purpose}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xs, 6px)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
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
        <p role="alert" style={{ margin: 0, color: "var(--danger-base, #ef4444)", fontSize: "0.85rem" }}>
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
        body: JSON.stringify({ requestType, details }),
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
      ? "var(--danger-base, #ef4444)"
      : statusType === "success"
      ? "var(--success-base, #16a34a)"
      : "var(--text-secondary)";

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Request type
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        >
          {Object.entries(REQUEST_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
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
        <p role={statusType === "error" ? "alert" : undefined} style={{ margin: 0, color: statusColour, fontSize: "0.85rem" }}>
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
    return (
      <p style={{ margin: 0, color: "var(--text-secondary)" }}>
        You have not filed any subject requests.
      </p>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
            <th style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--border)" }}>Type</th>
            <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Status</th>
            <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Filed</th>
            <th style={{ padding: "8px 0 8px 8px", borderBottom: "1px solid var(--border)" }}>Due by</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((row) => (
            <tr key={row.id}>
              <td style={{ padding: "8px 8px 8px 0", borderBottom: "1px solid var(--border)" }}>
                {REQUEST_TYPE_LABELS[row.request_type] || row.request_type}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                {STATUS_LABELS[row.status] || row.status}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                {formatDate(row.received_at)}
              </td>
              <td style={{ padding: "8px 0 8px 8px", borderBottom: "1px solid var(--border)" }}>
                {formatDate(row.due_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyHubPage() {
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
    <ProtectedRoute>
      <Head>
        <title>Privacy · HNP System</title>
      </Head>
      <Layout>
        <div className="app-page-shell">
          <div className="app-page-card" style={{ padding: "8px 8px 32px" }}>
            <div className="app-page-stack">
              <Section title="Privacy">
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  This page summarises the personal data we hold about you and lets you
                  manage your consents or file a request under UK GDPR. Account security
                  controls (password change, recent sign-in activity) are on{" "}
                  <Link href="/account/security">/account/security</Link>.
                </p>
                {error && (
                  <p role="alert" style={{ margin: "10px 0 0", color: "var(--danger-base, #ef4444)" }}>
                    {error}
                  </p>
                )}
              </Section>

              <Section title="Your Profile Data">
                {data ? (
                  <ProfileSummary profile={data.profile} />
                ) : (
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading...</p>
                )}
              </Section>

              <Section title="Download a Copy">
                <p style={{ margin: "0 0 12px", color: "var(--text-secondary)" }}>
                  Get a JSON file containing the data we hold against your account
                  (profile, consents, subject requests, recent sign-in events).
                </p>
                <a
                  href="/api/privacy/export"
                  style={{
                    display: "inline-block",
                    padding: "10px 14px",
                    minHeight: 40,
                    borderRadius: "var(--radius-xs, 6px)",
                    background: "var(--accentMain)",
                    color: "var(--onAccentText)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Download my data (JSON)
                </a>
                <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  For a full subject access request including all linked records, file an
                  Access request below — staff will fulfil within 30 days.
                </p>
              </Section>

              <Section title="Marketing &amp; Communication Consents">
                {data ? (
                  <ConsentManager
                    initial={data.consents}
                    onUpdated={() => setTick((n) => n + 1)}
                  />
                ) : (
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading...</p>
                )}
              </Section>

              <Section title="File a Subject Request">
                <SubjectRequestForm onCreated={() => setTick((n) => n + 1)} />
              </Section>

              <Section title="Your Open Requests">
                <RequestsList requests={data?.requests || []} />
              </Section>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
