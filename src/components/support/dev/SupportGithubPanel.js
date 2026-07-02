// file location: src/components/support/dev/SupportGithubPanel.js
//
// Phase 10 — the two-way GitHub panel on a report. Lists linked artifacts
// (issues / PRs / commits), creates a GitHub issue from the report, links an
// existing artifact by URL, and syncs a link's live state — all through the
// dev-gated, server-side /api/support/reports/[id]/github route (the token never
// reaches the client). Also renders source deep-links pinned to the captured
// commit via the pure githubCorrelation helper. CLAUDE.md-compliant primitives.

import React, { useEffect, useState, useMemo } from "react";
import { Panel, Pill, DevButton, EmptyState, LoadingBlock } from "@/components/support/dev/supportDevUi";
import { correlateReport } from "@/lib/dev-platform/githubCorrelation";
import { postJson } from "@/components/dev-platform/usePlatformResource";
import { useAlerts } from "@/context/AlertContext";

const KIND_LABEL = { issue: "Issue", pull_request: "PR", commit: "Commit", deployment: "Deploy" };
const STATE_TONE = { open: "success-base", closed: "danger-base", merged: "accentText", success: "success-base" };

export default function SupportGithubPanel({ reportId, report }) {
  const { pushAlert } = useAlerts();
  const [links, setLinks] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");

  const api = `/api/support/reports/${reportId}/github`;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(api, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setLinks(body.data || []);
        setConfigured(Boolean(body.configured));
        setRepo(body.repo || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const sourceLinks = useMemo(() => correlateReport(report || {}, { repo }).links, [report, repo]);

  const act = async (body, okMsg) => {
    setBusy(true);
    const res = await postJson(api, body);
    setBusy(false);
    if (res.ok) {
      pushAlert(okMsg, "success");
      load();
    } else {
      pushAlert(res.error || "GitHub action failed.", "error");
    }
  };

  const onCreate = () => act({ action: "create" }, "GitHub issue created and linked.");
  const onLink = () => {
    if (!url.trim()) return;
    act({ action: "link", url: url.trim() }, "Linked GitHub artifact.").then(() => setUrl(""));
  };
  const onSync = (linkId) => act({ action: "sync", linkId }, "Synced live state from GitHub.");
  const onUnlink = async (linkId) => {
    setBusy(true);
    const res = await postJson(`${api}?linkId=${encodeURIComponent(linkId)}`, null, "DELETE");
    setBusy(false);
    if (res.ok) {
      pushAlert("Unlinked.", "success");
      load();
    } else {
      pushAlert(res.error || "Could not unlink.", "error");
    }
  };

  return (
    <Panel
      title="GitHub"
      subtitle={configured ? `Connected to ${repo}` : "Not configured — linking by URL still works; issue creation needs SUPPORT_GITHUB_TOKEN."}
      actions={
        <>
          <DevButton small onClick={onCreate} disabled={busy || !configured} title={configured ? "Create a GitHub issue from this report" : "Set SUPPORT_GITHUB_TOKEN to enable"}>
            Create issue
          </DevButton>
          <DevButton small onClick={load} disabled={busy}>Refresh</DevButton>
        </>
      }
    >
      {/* Source deep-links pinned to the captured commit */}
      {sourceLinks.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {sourceLinks.map((s) => (
            <a
              key={s.type}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "var(--text-body-xs)",
                color: "var(--accentText)",
                background: "color-mix(in srgb, var(--accentText) 10%, transparent)",
                borderRadius: "var(--radius-sm, 6px)",
                padding: "4px 10px",
                textDecoration: "none",
                minHeight: 32,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      {/* Link by URL */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a github.com issue / PR / commit URL to link"
          aria-label="GitHub URL to link"
          className="app-input"
          style={{ flex: 1, minWidth: "220px", minHeight: 44, padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}
        />
        <DevButton small onClick={onLink} disabled={busy || !url.trim()}>Link</DevButton>
      </div>

      {/* Linked artifacts */}
      {loading ? (
        <LoadingBlock rows={2} />
      ) : links.length === 0 ? (
        <EmptyState title="No linked artifacts" message="Create an issue from this report, or paste a GitHub URL above to link an existing issue, PR or commit." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {links.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                background: "color-mix(in srgb, var(--text-1) 6%, transparent)",
                flexWrap: "wrap",
              }}
            >
              <Pill label={KIND_LABEL[l.kind] || l.kind || "Link"} tone="text-1" />
              <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accentText)", fontSize: "var(--text-body-sm)", textDecoration: "none", minWidth: 0, flex: 1, wordBreak: "break-word" }}>
                {l.title || `${l.kind} ${l.number ? `#${l.number}` : l.sha ? l.sha.slice(0, 7) : ""}`}
              </a>
              {l.state ? <Pill label={l.state} tone={STATE_TONE[l.state] || "text-1"} strong /> : null}
              <DevButton small onClick={() => onSync(l.id)} disabled={busy || !configured} title="Refresh live state from GitHub">Sync</DevButton>
              <DevButton small tone="danger-base" onClick={() => onUnlink(l.id)} disabled={busy}>Unlink</DevButton>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
