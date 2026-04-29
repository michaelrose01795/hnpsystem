// file location: src/components/page-ui/dev/dev-user-diagnostic-ui.js

import { useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";

const mainPitchSections = [
  {
    title: "Product Direction",
    items: [
      "One H&P operations platform across service, workshop, parts, accounts, HR, and management.",
      "Replace spreadsheets, message chasing, and disconnected tools with controlled workflows.",
      "Build around real H&P processes, including custom workshop and management routines.",
      "Keep the system flexible enough to evolve as the business changes.",
    ],
  },
  {
    title: "Delivery Plan",
    items: [
      "Deliver working software in reviewable phases, not one long invisible build.",
      "Focus first on job cards, VHC, tracking, parts flow, customer updates, and dashboards.",
      "Use diagnostics before demos to check APIs, data links, and key workflows.",
      "Release, gather feedback, tighten the workflow, then move to the next high-value area.",
    ],
  },
  {
    title: "Commercials",
    items: [
      "Staged payments tied to visible delivery and signed-off phases.",
      "Support retainer can cover hosting checks, small fixes, training help, and priority updates.",
      "Larger new modules are quoted separately before work starts.",
      "No per-seat licensing surprises as the team grows.",
    ],
  },
  {
    title: "Features",
    items: [
      "Workshop consumables, technician requests, tools/stock tracking, key tracker, and parking management.",
      "Job card activity tracker, paper-free workflows, dashboards, news feed, and slash-command messaging.",
      "Full user profiles with hours worked, leave requests, payslips, staff vehicles, and part purchases.",
      "Technician performance, accurate clocking, bottleneck visibility, and custom H&P workflows.",
      "In-house build, single source of truth, and no per-seat licensing surprises.",
    ],
  },
  {
    title: "Management Value",
    items: [
      "See workload, delays, approvals, and department pressure without chasing staff.",
      "Give managers cleaner decisions from live data instead of end-of-day updates.",
      "Improve accountability with clear ownership, history, and status movement.",
      "Reduce operational noise so managers can focus on throughput and customer outcomes.",
    ],
  },
  {
    title: "Future Potential",
    items: [
      "Customer portal, automation, reporting packs, and workflow rules can grow from the same base.",
      "Internal integrations can connect service, parts, accounts, HR, and management reporting.",
      "Training and handover can turn the build into a maintainable internal platform.",
      "The system becomes a long-term H&P asset, not another rented tool.",
    ],
  },
];

const supportingPitchSections = [
  {
    title: "Time Saving",
    items: [
      "Less time spent asking where a job, key, vehicle, part, or approval is.",
      "Slash commands like /job, /part, and /note move people straight to context.",
      "Paper-free workflows cut duplicate writing and end-of-day admin.",
      "Dashboards reduce manual status updates for managers.",
    ],
  },
  {
    title: "Error Reduction",
    items: [
      "Single source of truth reduces conflicting notes and version confusion.",
      "Accurate clocking separates login time, job time, and idle time.",
      "Job card activity tracker shows authorisations, parts, VHC updates, and status moves.",
      "Tools/stock tracking keeps workshop data visible instead of relying on memory.",
    ],
  },
  {
    title: "Workshop Control",
    items: [
      "Workshop consumables are requested, approved, logged, and reviewed.",
      "Technician requests create a clear trail for materials and stock needs.",
      "Key tracker and parking management keep vehicles and keys accounted for.",
      "Bottleneck visibility shows where jobs are waiting and why.",
    ],
  },
  {
    title: "Customer Experience",
    items: [
      "Cleaner customer updates because job status and VHC progress are visible.",
      "Fewer missed callbacks when the system highlights approvals and delays.",
      "Paper-free checks and signatures make the process feel more professional.",
      "Messaging keeps customer and internal context closer to the job.",
    ],
  },
  {
    title: "Accountability & Transparency",
    items: [
      "Every key action has a clearer owner, timestamp, and status trail.",
      "Technician performance shows efficiency, time on jobs, and real output.",
      "Full user profiles connect hours worked, leave requests, and payslips.",
      "Managers can review part purchases, staff vehicles, and activity history in one place.",
    ],
  },
  {
    title: "Scalability",
    items: [
      "Custom H&P workflows can expand without forcing the business into generic software.",
      "New departments, dashboards, and modules can be added onto the same foundation.",
      "No per-seat licensing surprises as more staff use the system.",
      "In-house build means priorities stay aligned with H&P operations.",
    ],
  },
  {
    title: "Cost Control",
    items: [
      "Consumables and stock usage become easier to monitor and challenge.",
      "Part purchases and workshop requests are visible before costs drift.",
      "Lower long-term cost than stacking separate tools for every department.",
      "Commercial scope stays clear: support, fixes, and new modules are separated.",
    ],
  },
  {
    title: "Decision Making",
    items: [
      "Live dashboards show targets, efficiency, clocking, and current workload.",
      "Managers can spot bottlenecks before they become customer issues.",
      "Data links service, parts, HR, accounts, and workshop performance.",
      "Weekly reviews can focus on evidence, risks, and the next decision needed.",
    ],
  },
  {
    title: "Internal System Integration",
    items: [
      "Service, parts, HR, accounts, and management share one operational record.",
      "News feed supports company updates and department communication.",
      "Messaging with slash commands keeps job, part, and note references connected.",
      "Dashboards pull from the same activity, clocking, and workflow data.",
    ],
  },
  {
    title: "Staff Adoption",
    items: [
      "Screens are built around the way staff already work, not around generic software rules.",
      "Short workflows reduce training friction for technicians and managers.",
      "Department walkthroughs make live use easier after each release.",
      "Staff see practical benefits: fewer repeats, clearer requests, faster answers.",
    ],
  },
  {
    title: "Risk Reduction",
    items: [
      "Phased delivery keeps management close to progress and priority changes.",
      "Diagnostics support safer demos and quicker fault finding.",
      "Activity tracking reduces reliance on verbal handovers.",
      "Role-based visibility can protect sensitive HR, payroll, and account areas.",
    ],
  },
  {
    title: "Support & Handover",
    items: [
      "Guided walkthroughs for each department as features go live.",
      "Practical notes for job cards, VHC, parts, tracking, accounts, HR, and admin.",
      "Bugs, improvements, and new feature requests stay separated.",
      "Handover material supports future training and internal continuity.",
    ],
  },
  {
    title: "Milestones",
    items: [
      "MVP: navigation, job cards, workshop status, basic VHC, and management visibility.",
      "Phase 1: parts workflow, customer updates, stronger dashboards, accounts links, and access control.",
      "Phase 2: customer portal, HR/admin tools, reporting packs, automation, and polish.",
      "Stabilisation: bug fixing, feedback, training notes, and handover material.",
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
  const [pitchMoreOpen, setPitchMoreOpen] = useState(false);

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "32px"
}}>
        <h1>User System Diagnostic</h1>
        <p>This page is only available in development mode.</p>
      </div>; // render extracted page section.

    case "section2":
      return <DevLayoutSection className="user-diagnostic-page" sectionKey="user-diagnostic" sectionType="page-shell" backgroundToken="surface" widthMode="constrained" shell style={{
  padding: "clamp(14px, 4vw, 32px)",
  display: "flex",
  gap: "24px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  maxWidth: "1500px",
  minHeight: "100dvh",
  overflow: "visible",
  boxSizing: "border-box"
}}>
      <DevLayoutSection className="user-diagnostic-diagnostics" sectionKey="user-diagnostic/diagnostics-panel" sectionType="section-shell" parentKey="user-diagnostic" backgroundToken="" style={{
    flex: "1 1 620px",
    minWidth: 0,
    maxWidth: "min(100%, 900px)"
      }}>
      <DevLayoutSection sectionKey="user-diagnostic/toolbar" sectionType="toolbar" parentKey="user-diagnostic/diagnostics-panel" backgroundToken="">
      <div className="user-diagnostic-toolbar" style={{
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
            padding: "14px 16px",
            minWidth: 0
          }}>
                <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap"
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
                flex: "1 1 180px",
                minWidth: 0
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
              color: "var(--text-secondary)",
              overflowWrap: "anywhere"
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
      <style jsx global>{`
        @media (max-width: 700px) {
          .user-diagnostic-page {
            gap: 16px !important;
            align-items: stretch !important;
          }
          .user-diagnostic-diagnostics {
            flex-basis: 100% !important;
            max-width: 100% !important;
          }
          .user-diagnostic-toolbar > button {
            flex: 1 1 100%;
            min-height: 40px;
          }
          .user-diagnostic-diagnostics pre {
            margin-left: 0 !important;
            max-width: 100%;
          }
          .user-diagnostic-diagnostics p {
            margin-left: 0 !important;
          }
        }
      `}</style>
      {developingOpen && <PopupModal onClose={onCloseDeveloping} ariaLabel="Development proposal pitch notes" cardStyle={{
        width: "min(100%, 1120px)",
        padding: "clamp(16px, 2.4vw, 26px)",
        borderRadius: "var(--radius-sm)",
        overflow: "auto"
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "18px"
        }}>
          <div style={{
            minWidth: 0
          }}>
            <h2 style={{
              margin: 0,
              fontSize: "clamp(18px, 2vw, 24px)",
              lineHeight: 1.2,
              color: "var(--text-primary)"
            }}>
              Development Proposal
            </h2>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "14px",
          alignItems: "stretch"
        }}>
          {mainPitchSections.map(section => <section key={section.title} style={{
            border: "none",
            borderRadius: "var(--radius-xs)",
            background: "var(--accentSurface)",
            padding: "16px",
            minWidth: 0,
            boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)"
          }}>
            <h3 style={{
              margin: "0 0 10px",
              fontSize: "15px",
              lineHeight: 1.25,
              color: "var(--text-primary)"
            }}>
              {section.title}
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: "17px",
              display: "flex",
              flexDirection: "column",
              gap: "7px",
              color: "var(--text-secondary)",
              fontSize: "13px",
              lineHeight: 1.38
            }}>
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>)}
        </div>
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "18px"
        }}>
          <button type="button" onClick={() => setPitchMoreOpen(open => !open)} aria-expanded={pitchMoreOpen} style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            minHeight: "38px",
            padding: "9px 16px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accentBorder)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            transition: "background 0.2s, border-color 0.2s, color 0.2s"
          }}>
            {pitchMoreOpen ? "Hide sections" : "More sections"}
          </button>
        </div>
        <div aria-hidden={!pitchMoreOpen} style={{
          maxHeight: pitchMoreOpen ? "4200px" : 0,
          opacity: pitchMoreOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease, margin-top 0.25s ease",
          marginTop: pitchMoreOpen ? "18px" : 0
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: "14px"
          }}>
            {supportingPitchSections.map(section => <section key={section.title} style={{
              border: "none",
              borderRadius: "var(--radius-xs)",
              background: "var(--accentSurface)",
              padding: "16px",
              minWidth: 0
            }}>
              <h3 style={{
                margin: "0 0 10px",
                fontSize: "14px",
                lineHeight: 1.25,
                color: "var(--text-primary)"
              }}>
                {section.title}
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: "17px",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                color: "var(--text-secondary)",
                fontSize: "13px",
                lineHeight: 1.38
              }}>
                {section.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>)}
          </div>
        </div>
      </PopupModal>}
      <GlobalUiShowcase />
    </DevLayoutSection>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
