// file location: src/components/support/dev/SupportReportFacts.js
//
// Support Centre — the "Report at a glance" and "Technical error" panels at the
// top of a report. Everything shown comes from buildReportFacts()
// (src/lib/support/reportDetails.js), the same source the notification email
// uses, so the email and the Support Centre never disagree about a report.
//
// Kept in its own file (rather than inside SupportReportDetail.js) because it is
// a self-contained pair of panels and SupportReportDetail.js carries a baselined
// inline-style count. This file uses only the shared dev UI primitives and the
// registered error-recovery family classes: no inline visual styling.

import React, { useMemo } from "react";
import { Panel, SubSurface, CopyButton } from "@/components/support/dev/supportDevUi";
import { buildReportFacts, factText, technicalErrorText } from "@/lib/support/reportDetails";

// One label/value row of the shared recovery facts list. A missing fact renders
// as "Not available (reason)" in the muted variant, never a guess.
function Fact({ label, fact, mono = false }) {
  const f = fact && typeof fact === "object" ? fact : { value: fact || null, missing: null };
  const classes = ["app-recovery-facts__value"];
  if (mono && f.value) classes.push("app-recovery-facts__value--mono");
  if (!f.value) classes.push("app-recovery-facts__value--missing");
  return (
    <>
      <dt className="app-recovery-facts__label">{label}</dt>
      <dd className={classes.join(" ")}>{factText(f)}</dd>
    </>
  );
}

function Block({ title, text, copyLabel }) {
  if (!text) return null;
  return (
    <SubSurface>
      <div className="app-recovery__panel-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span className="app-recovery__panel-key">{title}</span>
        {copyLabel ? <CopyButton text={text} label={copyLabel} /> : null}
      </div>
      <pre className="app-recovery__panel-block">{text}</pre>
    </SubSurface>
  );
}

/**
 * @param {{ report: object, errorEvents?: object[] }} props
 */
export default function SupportReportFacts({ report, errorEvents = [] }) {
  const facts = useMemo(() => buildReportFacts({ report, errorEvents }), [report, errorEvents]);
  const error = facts.error;
  const ref = facts.referenceCode;

  return (
    <>
      <Panel
        title="Report at a glance"
        sectionKey="support-detail-facts"
        actions={ref.value ? <CopyButton text={ref.value} label="Copy reference" /> : null}
      >
        <p className="app-recovery__panel-row">{facts.errorSummary}</p>
        <dl className="app-recovery-facts">
          <Fact label="Reference" fact={ref} mono />
          <Fact label="Page" fact={facts.page} mono />
          <Fact label="Page title" fact={facts.pageTitle} />
          <Fact label="Action" fact={facts.action} />
          <Fact label="Submitted (UK)" fact={facts.submittedAt} />
          {facts.userLocalTime ? (
            <Fact label={`User's time (${facts.userTimezone.value})`} fact={facts.userLocalTime} />
          ) : (
            <Fact label="User's timezone" fact={facts.userTimezone} />
          )}
          <Fact label="Device model" fact={facts.deviceModel} />
          <Fact label="Device type" fact={facts.deviceType} />
          <Fact label="Operating system" fact={facts.os} />
          <Fact label="Browser" fact={facts.browser} />
          <Fact label="Screen" fact={facts.screen} />
          <Fact label="Language" fact={facts.language} />
          <Fact label="Connection" fact={facts.online} />
        </dl>
      </Panel>

      {error ? (
        <Panel
          title={error.certainty === "possible" ? "Technical details (possibly related)" : "Technical error"}
          sectionKey="support-detail-technical-error"
          actions={<CopyButton text={() => technicalErrorText(error)} label="Copy technical details" />}
        >
          {error.certainty === "possible" ? (
            <p className="app-recovery__panel-row">
              The user did not report from an error. This was recorded in their session shortly before they
              sent the report and may or may not be related.
            </p>
          ) : null}
          <dl className="app-recovery-facts">
            <Fact label="Source" fact={error.source} />
            <Fact label="Kind" fact={{ value: error.kind || null, missing: "not recorded" }} mono />
            <Fact label="Error type" fact={{ value: error.name || null, missing: "not recorded" }} mono />
            <Fact label="Error code" fact={{ value: error.code || null, missing: "no code was given" }} mono />
            <Fact label="HTTP status" fact={{ value: error.statusCode ? String(error.statusCode) : null, missing: "not an HTTP error" }} mono />
            <Fact label="Endpoint" fact={{ value: error.endpoint || null, missing: "not recorded" }} mono />
            <Fact label="Component" fact={{ value: error.component || null, missing: "not recorded" }} mono />
            <Fact label="Occurrences" fact={{ value: error.occurrences ? String(error.occurrences) : null, missing: "not recorded" }} />
            <Fact label="Message" fact={{ value: error.message || null, missing: "no message was recorded" }} mono />
          </dl>
          <Block title="Stack trace" text={error.stack} copyLabel="Copy stack" />
          <Block title="Component stack" text={error.componentStack} />
          {error.context ? <Block title="Context" text={Object.entries(error.context).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n")} /> : null}
          <Block title="Full error report (as logged)" text={error.devInfo} />
        </Panel>
      ) : null}
    </>
  );
}
