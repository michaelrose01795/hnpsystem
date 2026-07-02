// file location: src/components/support/dev/SupportReportDetail.js
//
// Help & Diagnostics ("support") — Phase 6. The developer report detail view:
// investigation summary, code-state / drift, affected version history, full
// diagnostics explorer, expandable event timeline, screenshots with annotations,
// code ownership with clickable source references, developer notes / comments,
// activity (audit) history, triage, and copy/export tools. CLAUDE.md compliant
// (LayerSurface/LayerTheme alternation, tokens, no surface borders, responsive).

import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { useSupportReport } from "@/components/support/dev/useSupportAdmin";
import SupportTriagePanel from "@/components/support/dev/SupportTriagePanel";
import {
  Panel,
  SubSurface,
  KeyValue,
  KeyValueGrid,
  Pill,
  BadgeRow,
  DevButton,
  CopyButton,
  SourceRef,
  ConfidenceBar,
  EmptyState,
  LoadingBlock,
  DashboardGrid,
} from "@/components/support/dev/supportDevUi";
import { STATUS_META, SEVERITY_META, CATEGORY_META, deriveBadges } from "@/lib/support/adminView";
import { buildGithubIssue, buildDevBundle, buildMarkdownReport, reportDeepLink } from "@/lib/support/supportExport";
import SupportAssistedPanel from "@/components/support/dev/SupportAssistedPanel";
import SupportGithubPanel from "@/components/support/dev/SupportGithubPanel";

const arr = (v) => (Array.isArray(v) ? v : []);
const fmt = (iso) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? new Date(t).toLocaleString("en-GB") : "";
};

// Render an arbitrary (already-sanitised) value: primitives inline, objects as
// compact JSON.
function Value({ value }) {
  if (value === null || value === undefined || value === "") return <span style={{ opacity: 0.5 }}>—</span>;
  if (typeof value === "boolean") return <span>{value ? "yes" : "no"}</span>;
  if (typeof value === "object") {
    return (
      <pre style={{ margin: 0, fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-xs)", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-1)" }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span>{String(value)}</span>;
}

function List({ items, empty = "None", render }) {
  if (!arr(items).length) return <div style={{ opacity: 0.55, fontSize: "var(--text-body-sm)" }}>{empty}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{render ? render(it, i) : String(it)}</div>
      ))}
    </div>
  );
}

// -------------------------- panels --------------------------

function InvestigationPanel({ inv }) {
  if (!inv) return null;
  const rc = arr(inv.rootCauses);
  return (
    <Panel title="Investigation" subtitle="Developer-only · computed server-side at ingest" sectionKey="support-detail-investigation">
      {inv.explanation ? <div style={{ fontSize: "var(--text-body)", color: "var(--text-1)" }}>{inv.explanation}</div> : null}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {inv.severity ? <Pill label={`Severity: ${inv.severity}`} tone={SEVERITY_META[inv.severity]?.tone} strong /> : null}
        {inv.priority ? <Pill label={inv.priority} tone="accentText" strong /> : null}
        {inv.userImpact ? <Pill label={`Impact: ${inv.userImpact}`} tone="warning-base" /> : null}
        {inv.regressionRisk ? <Pill label={`Regression risk: ${inv.regressionRisk}`} tone="danger-base" /> : null}
        {inv.fixComplexity ? <Pill label={`Fix: ${inv.fixComplexity}`} tone="text-1" /> : null}
      </div>
      {Number.isFinite(Number(inv.reproducibleConfidence)) ? (
        <ConfidenceBar value={inv.reproducibleConfidence} label="Reproducible confidence" />
      ) : null}

      {rc.length ? (
        <SubSurface>
          <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Probable root causes</div>
          <List
            items={rc}
            render={(c) => (
              <span>
                <Pill label={`${Math.round((c.confidence || 0) * 100)}%`} tone="accentText" /> {c.cause}
              </span>
            )}
          />
        </SubSurface>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-sm)" }}>
        <SubSurface>
          <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Debugging order</div>
          <List items={inv.debuggingOrder} empty="No steps" render={(s, i) => `${i + 1}. ${s}`} />
        </SubSurface>
        <SubSurface>
          <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Recommended tests</div>
          <List items={inv.regressionTests} empty="None" render={(t) => `• ${t}`} />
          <List items={inv.manualTests} render={(t) => `◦ ${t}`} />
        </SubSurface>
      </div>

      {inv.summary ? (
        <SubSurface>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Issue-tracker summary</div>
            <CopyButton text={inv.summary} label="Copy summary" />
          </div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "var(--text-body-xs)", fontFamily: "var(--font-mono, monospace)", color: "var(--text-1)" }}>{inv.summary}</pre>
        </SubSurface>
      ) : null}
    </Panel>
  );
}

function CodeStatePanel({ inv, build }) {
  const cs = inv?.codeState;
  const vh = inv?.versionHistory;
  if (!cs && !build && !vh) return null;
  const drift = cs?.drift;
  return (
    <Panel title="Code state & drift" sectionKey="support-detail-codestate">
      <KeyValueGrid>
        <KeyValue label="Captured on" value={cs?.capturedLabel || (build ? `${build.version || ""} ${build.commit_short || ""}`.trim() : null)} mono />
        {cs?.deployedBuild && Object.keys(cs.deployedBuild).length ? <KeyValue label="Deployed now" value={cs.deployedLabel} mono /> : null}
        {build?.deploy_env ? <KeyValue label="Environment" value={build.deploy_env} /> : null}
        {build?.deployed_at ? <KeyValue label="Built at" value={fmt(build.deployed_at)} /> : null}
      </KeyValueGrid>
      {drift ? (
        <SubSurface style={{ gap: "4px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <Pill label={drift.drifted ? "Code drift detected" : "No drift"} tone={drift.drifted ? "warning-base" : "success-base"} strong />
            {cs?.sourceMap?.status ? <Pill label={`Section map: ${cs.sourceMap.status}`} tone={cs.sourceMap.status === "match" ? "success-base" : cs.sourceMap.status === "drift" ? "danger-base" : "text-1"} /> : null}
          </div>
          {drift.note ? <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>{drift.note}</div> : null}
        </SubSurface>
      ) : null}
      {vh?.firstSeenVersion ? (
        <SubSurface style={{ gap: "4px" }}>
          <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Affected versions</div>
          <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>
            First seen <strong>{vh.firstSeenVersion}</strong>
            {vh.spansMultipleVersions ? <> → last seen <strong>{vh.lastSeenVersion}</strong></> : null}
            {vh.isRegression ? <> · <Pill label="Recurred across releases" tone="danger-base" /></> : null}
          </div>
          <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>{vh.occurrences} matching occurrence(s)</div>
        </SubSurface>
      ) : null}
    </Panel>
  );
}

function OwnershipPanel({ report, inv, diagnostics }) {
  const own = inv?.ownership || {};
  const co = diagnostics?.code_ownership || {};
  return (
    <Panel title="Code ownership & affected surface" sectionKey="support-detail-ownership">
      <KeyValueGrid>
        <KeyValue label="Route" value={report.route || diagnostics?.route?.asPath} mono />
        <KeyValue label="Section key" value={report.section_key || co.section_key} mono />
        <KeyValue label="Source" value={(report.source_file || co.file) ? <SourceRef file={report.source_file || co.file} line={report.source_line ?? co.line} /> : null} />
        {own.primary ? <KeyValue label="Primary layer" value={<Pill label={own.primary} tone="accentText" />} /> : null}
      </KeyValueGrid>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-sm)" }}>
        <SubSurface><div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>API routes</div><List items={own.api} empty="None" render={(r) => <code>{r}</code>} /></SubSurface>
        <SubSurface><div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>DB tables</div><List items={own.database} empty="None" render={(t) => <code>{t}</code>} /></SubSurface>
        <SubSurface><div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Components</div><List items={own.frontend} empty="None" render={(c) => <code>{c}</code>} /></SubSurface>
      </div>
    </Panel>
  );
}

function ScreenshotsPanel({ screenshots }) {
  if (!arr(screenshots).length) return null;
  return (
    <Panel title={`Screenshots (${screenshots.length})`} sectionKey="support-detail-screenshots">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-sm)" }}>
        {screenshots.map((s) => (
          <SubSurface key={s.order}>
            {s.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt={`Screenshot ${s.order + 1}`} style={{ width: "100%", height: "auto", borderRadius: "var(--radius-md)", display: "block" }} />
            ) : (
              <div style={{ opacity: 0.6, fontSize: "var(--text-body-sm)" }}>Signed URL unavailable</div>
            )}
            {s.annotation ? <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.8 }}>“{s.annotation}”</div> : null}
          </SubSurface>
        ))}
      </div>
      <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.5 }}>Signed URLs expire after ~5 minutes — reload to refresh.</div>
    </Panel>
  );
}

function TimelinePanel({ diagnostics }) {
  const [expanded, setExpanded] = useState(false);
  const timeline = arr(diagnostics?.analysis?.timeline);
  const actions = arr(diagnostics?.recent_actions);
  const events = timeline.length ? timeline : actions.map((a) => ({ text: a.label || a.type, ts: a.ts, kind: a.type }));
  if (!events.length) return null;
  const shown = expanded ? events : events.slice(0, 8);
  return (
    <Panel
      title="Event timeline"
      sectionKey="support-detail-timeline"
      actions={events.length > 8 ? <DevButton small variant="ghost" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : `Show all (${events.length})`}</DevButton> : null}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", padding: "6px 0", borderBottom: "1px solid var(--separating-line)" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.55, minWidth: 66 }}>
              {e.ts ? new Date(e.ts).toLocaleTimeString("en-GB") : ""}
            </span>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", flex: 1 }}>
              {e.text} {e.isTrigger ? <Pill label="trigger" tone="danger-base" /> : null}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DiagnosticsExplorer({ diagnostics }) {
  const size = useMemo(() => {
    try {
      return JSON.stringify(diagnostics || {}).length;
    } catch {
      return 0;
    }
  }, [diagnostics]);
  const providers = diagnostics?.providers && typeof diagnostics.providers === "object" ? diagnostics.providers : {};
  return (
    <Panel title="Diagnostics explorer" sectionKey="support-detail-diagnostics">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-sm)" }}>
        <SubSurface>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Device</div>
          <KeyValueGrid>
            <KeyValue label="Viewport" value={diagnostics?.device?.viewport ? `${diagnostics.device.viewport.w}×${diagnostics.device.viewport.h}` : null} />
            <KeyValue label="Platform" value={diagnostics?.device?.platform} />
            <KeyValue label="Mobile" value={diagnostics?.device?.isMobile} />
            <KeyValue label="Online" value={diagnostics?.device?.online} />
            <KeyValue label="DPR" value={diagnostics?.device?.dpr} />
            <KeyValue label="UA" value={diagnostics?.device?.ua} />
          </KeyValueGrid>
        </SubSurface>
        <SubSurface>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Session & flags</div>
          <KeyValueGrid>
            <KeyValue label="Auth" value={diagnostics?.session?.authStatus} />
            <KeyValue label="Roles" value={arr(diagnostics?.session?.roles).join(", ")} />
            <KeyValue label="DB user" value={diagnostics?.session?.dbUserId} />
            <KeyValue label="Dev login" value={diagnostics?.session?.isDevLogin} />
            {diagnostics?.feature_flags ? <KeyValue label="Flags" value={<Value value={diagnostics.feature_flags} />} /> : null}
          </KeyValueGrid>
        </SubSurface>
      </div>

      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Console errors ({arr(diagnostics?.console_errors).length})</div>
        <List items={diagnostics?.console_errors} empty="None" render={(c) => <span><Pill label={c.level} tone={c.level === "error" ? "danger-base" : "warning-base"} /> {c.msg}</span>} />
      </SubSurface>
      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Failed requests ({arr(diagnostics?.failed_requests).length})</div>
        <List items={diagnostics?.failed_requests} empty="None" render={(r) => <span><Pill label={String(r.status ?? "err")} tone={(r.status || 0) >= 500 || r.status === 0 ? "danger-base" : "warning-base"} /> <code>{r.method} {r.url}</code> {r.ms != null ? `(${r.ms}ms)` : ""}</span>} />
      </SubSurface>
      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Unhandled errors ({arr(diagnostics?.unhandled_errors).length})</div>
        <List
          items={diagnostics?.unhandled_errors}
          empty="None"
          render={(e) => (
            <details>
              <summary style={{ cursor: "pointer" }}>{e.message}</summary>
              {e.componentStack ? <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: "var(--text-body-xs)", fontFamily: "var(--font-mono, monospace)", opacity: 0.8 }}>{e.componentStack}</pre> : null}
            </details>
          )}
        />
      </SubSurface>

      {Object.keys(providers).length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-sm)" }}>
          {Object.entries(providers).map(([id, data]) => (
            <SubSurface key={id}>
              <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Provider · {id}</div>
              <KeyValueGrid>
                {Object.entries(data || {}).map(([k, v]) => (
                  <KeyValue key={k} label={k} value={<Value value={v} />} />
                ))}
              </KeyValueGrid>
            </SubSurface>
          ))}
        </div>
      ) : null}

      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Privacy</div>
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>
          Sanitised client + server (×3). Session limited to the allowlist (roles / dbUserId / authStatus / isDevLogin). Request bodies are never captured.
          Blob size: {(size / 1024).toFixed(1)} KB / 256 KB.
        </div>
      </SubSurface>
    </Panel>
  );
}

function CommentsPanel({ comments, onAdd }) {
  const [text, setText] = useState("");
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const ok = await onAdd(t);
    if (ok) setText("");
  };
  return (
    <Panel title={`Developer notes (${arr(comments).length})`} sectionKey="support-detail-comments">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {arr(comments).length === 0 ? <div style={{ opacity: 0.55, fontSize: "var(--text-body-sm)" }}>No notes yet.</div> : null}
        {arr(comments).map((c) => (
          <SubSurface key={c.id} style={{ gap: "2px", opacity: c._pending ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
              <span>{c.author_username || (c.author_id ? `User #${c.author_id}` : "Unknown")}</span>
              <span>{fmt(c.created_at)}</span>
            </div>
            <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{c.body}</div>
          </SubSurface>
        ))}
      </div>
      <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
        <textarea
          className="app-input"
          placeholder="Add an internal note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          style={{ flex: "1 1 260px", padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-1)", resize: "vertical", minHeight: 44 }}
        />
        <DevButton variant="solid" onClick={submit} disabled={!text.trim()}>Add note</DevButton>
      </div>
    </Panel>
  );
}

function ActivityPanel({ audit }) {
  if (!arr(audit).length) return null;
  const label = (a) => ({
    support_report_create: "Report filed",
    support_report_view: "Diagnostics viewed",
    support_report_update: "Triage changed",
    support_report_comment: "Note added",
  }[a.action] || a.action);
  return (
    <Panel title="Activity & audit history" sectionKey="support-detail-activity">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {audit.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: "10px", padding: "6px 0", borderBottom: "1px solid var(--separating-line)", fontSize: "var(--text-body-sm)" }}>
            <span style={{ color: "var(--text-1)", opacity: 0.55, minWidth: 132, fontSize: "var(--text-body-xs)" }}>{fmt(a.occurred_at)}</span>
            <span style={{ flex: 1, color: "var(--text-1)" }}>
              <Pill label={label(a)} tone="accentText" /> {a.actor_user_id ? `by #${a.actor_user_id}` : ""}
              {a.diff && Object.keys(a.diff).length ? <span style={{ opacity: 0.7 }}> · {Object.entries(a.diff).map(([k, v]) => `${k}=${v}`).join(", ")}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// -------------------------- root --------------------------

export default function SupportReportDetail({ id }) {
  const router = useRouter();
  const { data, screenshots, comments, audit, loading, error, patch, addComment } = useSupportReport(id);

  const diagnostics = data?.diagnostics || {};
  const inv = diagnostics.investigation;
  const badges = useMemo(() => (data ? deriveBadges(data) : []), [data]);

  const github = useMemo(() => {
    if (!data) return null;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return buildGithubIssue(data, { baseUrl });
  }, [data]);

  const openGithub = () => {
    if (!github) return;
    const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;
    if (repo) {
      const url = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(github.title)}&body=${encodeURIComponent(github.body)}&labels=${encodeURIComponent(github.labels.join(","))}`;
      window.open(url, "_blank", "noopener");
    }
  };

  if (loading) {
    return (
      <LayerSurface style={{ gap: "var(--page-stack-gap)" }}>
        <DevButton variant="ghost" onClick={() => router.push("/dev/support-reports")}>Back</DevButton>
        <LoadingBlock rows={6} />
      </LayerSurface>
    );
  }
  if (error || !data) {
    return (
      <LayerSurface>
        <EmptyState title="Report not found" message={error || "This report may have been deleted."} action={<DevButton onClick={() => router.push("/dev/support-reports")}>Back to list</DevButton>} />
      </LayerSurface>
    );
  }

  const status = STATUS_META[data.status] || { label: data.status, tone: "text-1" };
  const sev = SEVERITY_META[data.severity] || SEVERITY_META.unset;
  const cat = CATEGORY_META[data.category] || { label: data.category, tone: "text-1" };
  const bundle = buildDevBundle(data);

  return (
    <LayerSurface sectionKey="support-detail" style={{ gap: "var(--page-stack-gap)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <DevButton variant="ghost" onClick={() => router.push("/dev/support-reports")}>Back to Support Centre</DevButton>
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <CopyButton text={() => bundle.text} label="Copy dev bundle" small={false} />
            <CopyButton text={() => buildMarkdownReport(data, { baseUrl: typeof window !== "undefined" ? window.location.origin : "" })} label="Copy markdown" small={false} />
            {github ? <CopyButton text={() => `${github.title}\n\n${github.body}`} label="Copy issue" small={false} /> : null}
            {process.env.NEXT_PUBLIC_GITHUB_REPO ? <DevButton onClick={openGithub}>Open GitHub issue</DevButton> : null}
          </div>
        </div>
        <div style={{ fontSize: "var(--text-h2, 22px)", fontWeight: 800, color: "var(--accentText)" }}>
          {data.title || (data.description ? data.description.split("\n")[0] : "Support report")}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <Pill label={sev.label} tone={sev.tone} strong />
          <Pill label={status.label} tone={status.tone} />
          <Pill label={cat.label} tone={cat.tone} />
          <BadgeRow badges={badges} />
          <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>
            {data.reporter_username ? `by ${data.reporter_username} · ` : ""}{fmt(data.created_at)} ·{" "}
            <a href={reportDeepLink(data)} style={{ color: "var(--accentText)" }}>#{String(data.id).slice(0, 8)}</a>
          </span>
        </div>
      </div>

      <SupportTriagePanel report={data} patch={patch} />

      {/* Description */}
      <Panel title="Description" sectionKey="support-detail-description">
        <div style={{ whiteSpace: "pre-wrap", fontSize: "var(--text-body)", color: "var(--text-1)" }}>{data.description}</div>
      </Panel>

      <InvestigationPanel inv={inv} />
      <SupportAssistedPanel report={data} />
      <DashboardGrid min={420}>
        <CodeStatePanel inv={inv} build={diagnostics.build} />
        <OwnershipPanel report={data} inv={inv} diagnostics={diagnostics} />
      </DashboardGrid>
      <SupportGithubPanel reportId={id} report={data} />
      <ScreenshotsPanel screenshots={screenshots} />
      <DashboardGrid min={420}>
        <TimelinePanel diagnostics={diagnostics} />
        <ActivityPanel audit={audit} />
      </DashboardGrid>
      <DiagnosticsExplorer diagnostics={diagnostics} />
      <CommentsPanel comments={comments} onAdd={addComment} />
    </LayerSurface>
  );
}
