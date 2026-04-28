// file location: src/components/page-ui/dev/dev-user-diagnostic-ui.js

import PopupModal from "@/components/popups/popupStyleApi";

const developingSections = [
  {
    title: "Product Direction",
    items: [
      "Create a single H&P operations platform covering service, workshop, parts, accounts, customer updates, HR, and management reporting.",
      "Replace scattered spreadsheets, message threads, and manual status chasing with one controlled workflow.",
      "Keep the product built around real dealership processes so each screen supports daily work, not just reporting.",
    ],
  },
  {
    title: "Delivery Plan",
    items: [
      "Deliver in phases so management can review working software every 2 to 4 weeks instead of waiting for one large handover.",
      "Prioritise the highest-value flows first: job cards, VHC, vehicle tracking, parts requests, customer communication, and management dashboards.",
      "Use the diagnostics page before reviews and demos to confirm key workflows, APIs, and data links are healthy.",
    ],
  },
  {
    title: "Time Commitment",
    items: [
      "Expected build time: 18 to 28 focused hours per week alongside a full-time job.",
      "Typical pattern: 3 to 5 hours per evening, with weekend blocks used for testing, demos, and larger releases where needed.",
      "Weekly progress should be summarised as delivered work, active risks, next priorities, and any decisions needed from management.",
    ],
  },
  {
    title: "Milestones",
    items: [
      "MVP, 3 to 4 weeks: core navigation, job cards, workshop status tracking, basic VHC flow, and management visibility.",
      "Phase 1, 4 to 6 weeks: parts workflow, customer updates, stronger dashboards, accounts links, and role-based access.",
      "Phase 2, 6 to 8 weeks: customer portal, HR/admin tools, reporting packs, workflow automation, and presentation-ready polish.",
      "Stabilisation, 2 weeks per release: bug fixing, user feedback, training notes, and handover material.",
    ],
  },
  {
    title: "Support & Handover",
    items: [
      "Include guided walkthroughs for each department so managers can see exactly how the system fits daily operations.",
      "Provide short workflow notes for major areas: job cards, VHC, parts, tracking, customer updates, accounts, and admin.",
      "Separate bugs, agreed improvements, and new feature requests so support remains clear and commercially fair.",
      "Keep documentation practical enough for future staff training and internal continuity.",
    ],
  },
  {
    title: "Commercials",
    items: [
      "Use staged payments tied to visible delivery: small start payment, MVP delivery payment, then phase payments as each area goes live.",
      "Example structure: 20% start, 30% on MVP, 25% on Phase 1, 25% on Phase 2 or final handover.",
      "Ongoing support can be a modest monthly retainer covering hosting checks, small fixes, training help, and priority updates.",
      "Larger new modules or urgent out-of-scope requests should be quoted separately before work begins.",
    ],
  },
];

export default function UserDiagnosticDevPageUi(props) {
  const {
    DevLayoutSection,
    developingOpen,
    GlobalUiShowcase,
    onCloseDeveloping,
    onOpenDeveloping,
    SECTION_ORDER,
    expanded,
    groupedResults,
    passCount,
    promptCopied,
    results,
    router,
    runAllTests,
    running,
    setExpanded,
    setPromptCopied,
    setTimeout,
    totalCount,
    userLoading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "32px"
}}>
        <h1>User System Diagnostic</h1>
        <p>This page is only available in development mode.</p>
      </div>; // render extracted page section.

    case "section2":
      return <DevLayoutSection sectionKey="user-diagnostic" sectionType="page-shell" backgroundToken="surface" widthMode="constrained" shell style={{
  padding: "32px",
  display: "flex",
  gap: "24px",
  alignItems: "flex-start",
  maxWidth: "1500px",
  height: "100vh",
  maxHeight: "100vh",
  overflow: "hidden",
  boxSizing: "border-box"
}}>
      <DevLayoutSection sectionKey="user-diagnostic/diagnostics-panel" sectionType="section-shell" parentKey="user-diagnostic" backgroundToken="" style={{
    flex: 1,
    minWidth: 0,
    maxWidth: "900px",
    height: "100%",
    overflowY: "auto",
    paddingRight: "8px"
      }}>
      <DevLayoutSection sectionKey="user-diagnostic/toolbar" sectionType="toolbar" parentKey="user-diagnostic/diagnostics-panel" backgroundToken="">
      <div style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap"
      }}>
        <button type="button" onClick={() => router.back()} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          borderRadius: "var(--radius-xs)",
          border: "none",
          background: "transparent",
          color: "var(--text-secondary)",
          fontWeight: 600,
          fontSize: "13px",
          cursor: "pointer"
        }}>
          &larr; Back
        </button>
        <button type="button" onClick={onOpenDeveloping} style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "7px 14px",
          borderRadius: "var(--radius-xs)",
          border: "1px solid var(--accentBorder)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontWeight: 700,
          fontSize: "13px",
          cursor: "pointer",
          textTransform: "lowercase"
        }}>
          developing
        </button>
        <button type="button" onClick={runAllTests} disabled={running || userLoading} style={{
          padding: "10px 20px",
          borderRadius: "var(--radius-xs)",
          border: "none",
          background: running ? "var(--text-secondary)" : "var(--primary)",
          color: "var(--text-inverse)",
          fontWeight: 600,
          cursor: running || userLoading ? "not-allowed" : "pointer",
          fontSize: "14px"
        }}>
          {userLoading ? "Waiting for user context..." : running ? "Running deep diagnostic…" : "Run Deep Diagnostic"}
        </button>
        {results && results.some(r => !r.pass) && <button type="button" onClick={() => {
          const failed = results.filter(r => !r.pass);
          const sections = [...new Set(failed.map(r => r.section))];
          const lines = ["# HNP System — Deep Diagnostic Failures", "", `${failed.length} of ${results.length} tests failed across ${sections.length} section${sections.length === 1 ? "" : "s"}.`, "Review each failure below, identify the root cause in the codebase, and apply fixes.", ""];
          for (const section of SECTION_ORDER) {
            const sectionFails = failed.filter(r => r.section === section);
            if (sectionFails.length === 0) continue;
            lines.push(`## ${section}`);
            lines.push("");
            for (const f of sectionFails) {
              lines.push(`### ✗ ${f.label}`);
              lines.push(`- **Detail:** ${f.detail}`);
              if (f.data) {
                lines.push("- **Data:**");
                lines.push("```json");
                lines.push(JSON.stringify(f.data, null, 2));
                lines.push("```");
              }
              lines.push("");
            }
          }
          lines.push("---");
          lines.push("Fix each failing test. The diagnostic page is at `src/pages/dev/user-diagnostic.js`.");
          lines.push("Test functions are defined at the top of that file — each returns `{ pass, label, detail, data, section }`.");
          lines.push("Focus on the underlying API or data issue each test checks, not the test function itself.");
          navigator.clipboard.writeText(lines.join("\n")).then(() => {
            setPromptCopied(true);
            setTimeout(() => setPromptCopied(false), 2000);
          });
        }} style={{
          padding: "10px 16px",
          borderRadius: "var(--radius-xs)",
          border: "none",
          background: promptCopied ? "var(--success)" : "var(--surface)",
          color: promptCopied ? "var(--text-inverse)" : "var(--danger)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "13px",
          transition: "background 0.2s, color 0.2s"
        }}>
            {promptCopied ? "Copied!" : `Copy Fix Prompt (${results.filter(r => !r.pass).length} failed)`}
          </button>}
      </div>
      </DevLayoutSection>

      <DevLayoutSection sectionKey="user-diagnostic/results" sectionType="content-card" parentKey="user-diagnostic/diagnostics-panel" backgroundToken="">
      {groupedResults.map(group => <div key={group.section} style={{
        marginBottom: "24px"
      }}>
          <h3 style={{
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-secondary)",
          marginBottom: "10px",
          borderBottom: "1px solid var(--surface-light)",
          paddingBottom: "6px"
        }}>
            {group.section}
          </h3>
          <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
            {group.items.map(result => <div key={result._index} style={{
            background: "var(--surface)",
            border: "none",
            borderRadius: "var(--radius-xs)",
            padding: "14px 16px"
          }}>
                <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
                  <span style={{
                fontSize: "18px",
                fontWeight: 700,
                color: result.pass ? "var(--success)" : "var(--danger)",
                minWidth: "24px"
              }}>
                    {result.pass ? "\u2713" : "\u2717"}
                  </span>
                  <span style={{
                fontWeight: 600,
                flex: 1
              }}>{result.label}</span>
                  {result.data && <button type="button" onClick={() => setExpanded(prev => ({
                ...prev,
                [result._index]: !prev[result._index]
              }))} style={{
                background: "none",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text-secondary)"
              }}>
                      {expanded[result._index] ? "Hide" : "Details"}
                    </button>}
                </div>
                <p style={{
              margin: "6px 0 0 34px",
              fontSize: "14px",
              color: "var(--text-secondary)"
            }}>
                  {result.detail}
                </p>
                {expanded[result._index] && result.data && <pre style={{
              marginTop: "10px",
              marginLeft: "34px",
              background: "var(--surface-light)",
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              overflowX: "auto",
              fontSize: "12px",
              maxHeight: "300px",
              overflowY: "auto"
            }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>}
              </div>)}
          </div>
        </div>)}
      </DevLayoutSection>

      {results && <DevLayoutSection sectionKey="user-diagnostic/summary" sectionType="stat-card" parentKey="user-diagnostic/diagnostics-panel" backgroundToken="">
        <div style={{
        marginTop: "24px",
        padding: "16px",
        background: passCount === totalCount ? "var(--success)" : "var(--danger)",
        color: "var(--text-inverse)",
        borderRadius: "var(--radius-xs)",
        fontWeight: 600,
        fontSize: "16px"
      }}>
          {passCount}/{totalCount} tests passed
        </div>
        </DevLayoutSection>}
      </DevLayoutSection>
      {developingOpen && <PopupModal onClose={onCloseDeveloping} ariaLabel="Developing sales details" cardStyle={{
        width: "min(100%, 880px)",
        padding: "24px",
        borderRadius: "var(--radius-sm)"
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px"
        }}>
          <div>
            <div style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
              marginBottom: "6px"
            }}>
              Sales planning
            </div>
            <h2 style={{
              margin: 0,
              fontSize: "24px",
              lineHeight: 1.2,
              color: "var(--text-primary)"
            }}>
              Development Proposal
            </h2>
            <p style={{
              margin: "8px 0 0",
              color: "var(--text-secondary)",
              fontSize: "14px",
              lineHeight: 1.55,
              maxWidth: "660px"
            }}>
              A practical phased proposal for building H&P's internal operations platform, focused on measurable workflow improvements, controlled delivery, and a clear commercial structure.
            </p>
          </div>
          <button type="button" onClick={onCloseDeveloping} aria-label="Close developing details" style={{
            width: "34px",
            height: "34px",
            flex: "0 0 auto",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accentBorder)",
            background: "var(--surface-light)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "20px",
            lineHeight: 1
          }}>
            &times;
          </button>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px"
        }}>
          {developingSections.map(section => <section key={section.title} style={{
            border: "1px solid var(--accentBorder)",
            borderRadius: "var(--radius-xs)",
            background: "var(--surface-light)",
            padding: "16px",
            minWidth: 0
          }}>
            <h3 style={{
              margin: "0 0 10px",
              fontSize: "14px",
              color: "var(--text-primary)"
            }}>
              {section.title}
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              color: "var(--text-secondary)",
              fontSize: "13px",
              lineHeight: 1.45
            }}>
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>)}
        </div>
        <div style={{
          marginTop: "16px",
          padding: "14px 16px",
          borderRadius: "var(--radius-xs)",
          background: "var(--surface)",
          color: "var(--text-secondary)",
          fontSize: "13px",
          lineHeight: 1.5
        }}>
          <strong style={{
            color: "var(--text-primary)"
          }}>Why this works for H&amp;P:</strong> the system reduces the cost and friction of separate tools, gives managers clearer control of live work, improves communication between departments, and creates a platform that can keep growing around the way H&amp;P actually operates.
        </div>
      </PopupModal>}
      <GlobalUiShowcase />
    </DevLayoutSection>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
