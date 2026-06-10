// file location: src/components/page-ui/dev/dev-user-diagnostic-ui.js

import { useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ProfileThemeControls from "@/components/profile/ProfileThemeControls";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

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

const realWorldWorkflowIssues = [
  {
    title: "Paper job cards do not show live operational status",
    intro:
      "Staff pick up a job card and still need to ask multiple people or check other systems to understand the actual state of the vehicle.",
    items: [
      "Is the vehicle warranty?",
      "Have parts been ordered?",
      "Are the parts physically here yet?",
      "Has the customer authorised the work?",
      "Is the technician already working on it?",
      "Is the vehicle waiting for parts?",
      "Is there an internal note from another department?",
      "Is the work already completed but not updated?",
    ],
  },
  {
    title: "Information is fragmented across departments",
    intro: "Important information is spread across paper, systems, handovers, and departmental memory.",
    items: [
      "paper job cards",
      "Navigator",
      "parts department",
      "spreadsheets",
      "verbal communication",
      "technician memory",
      "booking notes",
      "VHC systems",
      "emails/messages",
    ],
    outro:
      "This causes delays, duplicated work, and constant interruptions between departments.",
  },
  {
    title: "Staff waste time chasing information",
    intro: "Simple tasks often require extra checking before the work itself can move forward.",
    items: [
      "walking around the workshop",
      "asking technicians",
      "asking parts department",
      "checking multiple systems",
      "opening spreadsheets",
      "searching messages/emails",
    ],
    outro: "The issue is not staff capability, it is fragmented information.",
  },
  {
    title: "No single source of truth",
    intro: "A job should instantly show the status and context needed to make the next decision.",
    items: [
      "warranty status",
      "parts ordered status",
      "parts arrival status",
      "technician assignment",
      "VHC status",
      "customer authorisation",
      "progress stage",
      "courtesy vehicle details",
      "internal communication",
      "outstanding actions",
    ],
    outro:
      "Currently this information exists in multiple places instead of one connected workflow.",
  },
  {
    title: "Operational delays compound throughout the day",
    intro: "Even small delays repeated across departments create wasted time across the business daily.",
    items: [
      "advisors",
      "technicians",
      "parts department",
      "managers",
      "reception",
    ],
  },
];

const dmsGoalBenefits = [
  "reduce duplicated work",
  "reduce department interruptions",
  "improve communication",
  "reduce paperwork dependency",
  "centralise workflow visibility",
  "improve customer update accuracy",
  "reduce wasted labour time",
  "simplify operational processes",
];

const whyThisSystemExistsSpeechGroups = [
  [
    "I just wanted to show you something I’ve been working on over the last several months alongside work and college.",
    "This started because, being an apprentice technician and working from the bottom of the operational side of the company upwards, I’ve experienced the daily workflow directly. Over the last few years I kept noticing the same issues happening repeatedly across different departments, not because people are doing anything wrong, but because the systems and processes are disconnected from each other.",
    "There’s a lot of duplicated work, paper-based processes, information spread across multiple systems, delays between departments, and situations where staff have to manually chase updates or re-enter information that already exists somewhere else. The fact these problems are noticeable even from apprentice level shows they affect everyone throughout the business during the day, from workshop technicians to service advisors, parts, admin, and management.",
  ],
  [
    "Instead of just pointing those issues out, I started building solutions around the way H&P already operates.",
    "The goal of the system isn’t to completely replace everything overnight or force everyone into a massive change. The idea is to gradually centralise workflows into one connected system which improves visibility, communication, efficiency, and productivity while reducing unnecessary admin and duplication.",
    "The system is built around the actual way the dealership functions day to day. Different departments have their own areas and permissions, so workshop staff only see what’s relevant to them, parts can manage parts requests and approvals, service advisors can manage bookings and customer communication, managers can monitor workflow and reporting, and so on.",
  ],
  [
    "For example, instead of paper job cards moving around the building, jobs can be digitally tracked from booking through to completion. Technicians can complete digital check sheets, upload photos and videos, request parts directly through the system, and update job progress live. Service advisors can instantly see job status updates without having to physically walk through the workshop chasing technicians for information. Customers can receive clearer updates with things like VHC videos, progress tracking, and approvals in one place.",
    "Another major area is reducing duplication between systems. Right now, information often gets entered multiple times across different software, spreadsheets, paperwork, and messages. The system is designed to connect those workflows together into one flow instead of multiple disconnected ones.",
    "There’s also a management side to it. The system can provide visibility across the business with dashboards, tracking, reporting, workshop loading, technician efficiency, vehicle tracking, customer communication history, and audit logs, while still keeping role-based permissions so departments only access what they need.",
  ],
  [
    "I know something like this naturally raises concerns around reliability, security, support, rollout, and dependency on one person, which is why my idea has always been to phase it gradually and run sections alongside current systems first, not replace everything immediately. That allows proper testing, feedback, improvements, staff adaptation, and documentation before anything became business critical.",
    "This isn’t something I built from the perspective of a software company trying to sell generic dealership software. It’s been built from inside the business around the real operational issues and workflows H&P deals with every day.",
    "I genuinely think there’s an opportunity to create something that improves how departments work together, reduces wasted time, modernises a lot of the paper-based workflow, and gives the business a system that’s tailored specifically to the way H&P operates rather than trying to force the business around external software limitations.",
  ],
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
  const [whySpeechGroups, setWhySpeechGroups] = useState(whyThisSystemExistsSpeechGroups);
  const [whySpeechEditing, setWhySpeechEditing] = useState(false);
  const [whySpeechDraftGroups, setWhySpeechDraftGroups] = useState(() =>
    whyThisSystemExistsSpeechGroups.map((group) => group.join("\n\n"))
  );
  const [whySpeechSaving, setWhySpeechSaving] = useState(false);
  const [whySpeechStatus, setWhySpeechStatus] = useState("");

  const openWhySpeechEditor = () => {
    setWhySpeechDraftGroups(whySpeechGroups.map((group) => group.join("\n\n")));
    setWhySpeechStatus("");
    setWhySpeechEditing(true);
  };

  const closeWhySpeechEditor = () => {
    setWhySpeechDraftGroups(whySpeechGroups.map((group) => group.join("\n\n")));
    setWhySpeechStatus("");
    setWhySpeechEditing(false);
  };

  const updateWhySpeechDraftGroup = (index, value) => {
    setWhySpeechDraftGroups((current) =>
      current.map((groupText, groupIndex) => groupIndex === index ? value : groupText)
    );
  };

  const saveWhySpeechGroups = async () => {
    const groups = whySpeechDraftGroups
      .map((groupText) =>
        groupText
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
      .filter((group) => group.length > 0);

    if (groups.length === 0) {
      setWhySpeechStatus("Add at least one paragraph before saving.");
      return;
    }

    setWhySpeechSaving(true);
    setWhySpeechStatus("Saving...");
    try {
      const response = await fetch("/api/dev/why-this-system-exists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not save the section text.");
      }
      const savedGroups = payload.data?.groups || groups;
      setWhySpeechGroups(savedGroups);
      setWhySpeechDraftGroups(savedGroups.map((group) => group.join("\n\n")));
      setWhySpeechEditing(false);
      setWhySpeechStatus("Saved to the hardcoded source.");
    } catch (error) {
      setWhySpeechStatus(error?.message || "Could not save the section text.");
    } finally {
      setWhySpeechSaving(false);
    }
  };

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "32px"
}}>
        <h1>User System Diagnostic</h1>
        <p>This page is only available in development mode.</p>
      </div>; // render extracted page section.

    case "section2":
      return <div className="user-diagnostic-page" style={{
  padding: "8px 0",
  display: "flex",
  flexDirection: "column",
  gap: "var(--page-stack-gap)",
  alignItems: "flex-start",
  width: "100%",
  maxWidth: "100%",
  minHeight: "100dvh",
  overflow: "visible",
  boxSizing: "border-box"
}}>
      <DevLayoutSection sectionKey="user-diagnostic/toolbar" sectionType="toolbar" parentKey="" backgroundToken="">
      <div className="user-diagnostic-toolbar" style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap"
      }}>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          &larr; Back
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onOpenDeveloping}>
          developing
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={runAllTests} disabled={running || userLoading}>
          {userLoading ? "Waiting for user context..." : running ? "Running deep diagnostic…" : "Run Deep Diagnostic"}
        </Button>
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
          color: promptCopied ? "var(--text-2)" : "var(--danger)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "13px",
          transition: "background 0.2s, color 0.2s"
        }}>
            {promptCopied ? "Copied!" : `Copy Fix Prompt (${results.filter(r => !r.pass).length} failed)`}
          </button>}
        <ProfileThemeControls style={{ marginLeft: "auto" }} />
      </div>
      </DevLayoutSection>

      <DevLayoutSection className="user-diagnostic-results" sectionKey="user-diagnostic/results" sectionType="content-card" parentKey="" backgroundToken="" style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>
      {groupedResults.map(group => <div key={group.section} style={{
        marginBottom: "24px"
      }}>
          <h3 style={{
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-1)",
          marginBottom: "10px",
          paddingBottom: "6px"
        }}>
            {group.section}
          </h3>
          <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
            {group.items.map(result => <DevLayoutSection key={result._index} sectionKey={`user-diagnostic/result-${result._index}`} sectionType="content-card" parentKey="user-diagnostic/results" backgroundToken="surface" style={{
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
                color: "var(--text-1)"
              }}>
                      {expanded[result._index] ? "Hide" : "Details"}
                    </button>}
                </div>
                <p style={{
              margin: "6px 0 0 34px",
              fontSize: "14px",
              color: "var(--text-1)",
              overflowWrap: "anywhere"
            }}>
                  {result.detail}
                </p>
                {expanded[result._index] && result.data && <pre style={{
              marginTop: "10px",
              marginLeft: "34px",
              background: "var(--surface)",
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              overflowX: "auto",
              fontSize: "12px",
              maxHeight: "300px",
              overflowY: "auto"
            }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>}
              </DevLayoutSection>)}
          </div>
        </div>)}
      </DevLayoutSection>

      {results && <DevLayoutSection sectionKey="user-diagnostic/summary" sectionType="stat-card" parentKey="" backgroundToken="" style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>
        <div style={{
        marginTop: "24px",
        padding: "16px",
        background: passCount === totalCount ? "var(--success)" : "var(--danger)",
        color: "var(--text-2)",
        borderRadius: "var(--radius-xs)",
        fontWeight: 600,
        fontSize: "16px"
      }}>
          {passCount}/{totalCount} tests passed
        </div>
        </DevLayoutSection>}
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
              color: "var(--text-1)"
            }}>
              Development Proposal
            </h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCloseDeveloping}
            aria-label="Close developing details"
            style={{ width: "44px", flex: "0 0 auto" }}>
            &times;
          </Button>
        </div>
        <LayerTheme
          as="section"
          radius="var(--radius-sm)"
          padding="clamp(16px, 2.4vw, 24px)"
          gap="clamp(14px, 2vw, 20px)"
          style={{
            marginBottom: "18px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)"
          }}>
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap"
          }}>
            <div style={{
              minWidth: 0,
              maxWidth: "760px"
            }}>
              <button
                type="button"
                onClick={openWhySpeechEditor}
                title="Edit this section text"
                style={{
                  margin: 0,
                  padding: 0,
                  background: "none",
                  border: "none",
                  color: "var(--text-1)",
                  cursor: "pointer",
                  textAlign: "left"
                }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "clamp(20px, 2.4vw, 28px)",
                  lineHeight: 1.16,
                  color: "inherit"
                }}>
                  Why This System Exists
                </h2>
              </button>
              <p style={{
                margin: "7px 0 0",
                color: "var(--text-1)",
                fontSize: "12px",
                lineHeight: 1.35
              }}>
                Click the heading to edit the saved source text.
              </p>
            </div>
            <LayerSurface
              as="aside"
              radius="var(--radius-xs)"
              padding="14px 16px"
              gap="0"
              style={{
                flex: "1 1 260px",
                minWidth: 0,
                maxWidth: "380px",
                boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)"
              }}>
              <p style={{
                margin: 0,
                color: "var(--accentText)",
                fontSize: "clamp(14px, 1.7vw, 17px)",
                fontWeight: 800,
                lineHeight: 1.35
              }}>
                “Built from inside the dealership, around real operational problems.”
              </p>
            </LayerSurface>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(14px, 2vw, 20px)"
          }}>
            {whySpeechEditing ? <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}>
              {whySpeechDraftGroups.map((groupText, groupIndex) => (
                <label key={`why-system-exists-editor-${groupIndex}`} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  color: "var(--text-1)",
                  fontSize: "13px",
                  fontWeight: 700
                }}>
                  Speech section {groupIndex + 1}
                  <textarea
                    className="app-input"
                    value={groupText}
                    onChange={(event) => updateWhySpeechDraftGroup(groupIndex, event.target.value)}
                    rows={Math.max(5, groupText.split("\n").length + 1)}
                    style={{
                      width: "100%",
                      minHeight: "140px",
                      resize: "vertical",
                      fontSize: "14px",
                      lineHeight: 1.55
                    }}
                  />
                </label>
              ))}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap"
              }}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={saveWhySpeechGroups}
                  disabled={whySpeechSaving}>
                  {whySpeechSaving ? "Saving..." : "Save text"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={closeWhySpeechEditor}
                  disabled={whySpeechSaving}>
                  Cancel
                </Button>
                {whySpeechStatus && <span style={{
                  color: whySpeechStatus.startsWith("Saved") ? "var(--success)" : "var(--text-1)",
                  fontSize: "13px",
                  fontWeight: 700
                }}>
                  {whySpeechStatus}
                </span>}
              </div>
            </div> : whySpeechGroups.map((group, groupIndex) => (
              <div key={`why-system-exists-${groupIndex}`} style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {groupIndex > 0 && <div aria-hidden="true" style={{
                  height: "1px",
                  background: "var(--separating-line)",
                  margin: "2px 0 4px"
                }} />}
                {group.map(paragraph => (
                  <p key={paragraph} style={{
                    margin: 0,
                    color: "var(--text-1)",
                    fontSize: "clamp(14px, 1.45vw, 16px)",
                    lineHeight: 1.65,
                    overflowWrap: "anywhere"
                  }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
            {!whySpeechEditing && whySpeechStatus && <p style={{
              margin: 0,
              color: "var(--success)",
              fontSize: "13px",
              fontWeight: 700
            }}>
              {whySpeechStatus}
            </p>}
          </div>
        </LayerTheme>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "14px",
          alignItems: "stretch"
        }}>
          {mainPitchSections.map(section => <section key={section.title} style={{
            border: "none",
            borderRadius: "var(--radius-xs)",
            background: "var(--secondary)",
            padding: "16px",
            minWidth: 0,
            boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)"
          }}>
            <h3 style={{
              margin: "0 0 10px",
              fontSize: "15px",
              lineHeight: 1.25,
              color: "var(--text-1)"
            }}>
              {section.title}
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: "17px",
              display: "flex",
              flexDirection: "column",
              gap: "7px",
              color: "var(--text-1)",
              fontSize: "13px",
              lineHeight: 1.38
            }}>
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>)}
        </div>
        <section style={{
          marginTop: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: "clamp(17px, 1.8vw, 22px)",
              lineHeight: 1.2,
              color: "var(--text-1)"
            }}>
              Real World Problems
            </h2>
            <h3 style={{
              margin: "8px 0 0",
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-1)"
            }}>
              Current Workflow Issues
            </h3>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "14px",
            alignItems: "stretch"
          }}>
            {realWorldWorkflowIssues.map(issue => <section key={issue.title} style={{
              border: "none",
              borderRadius: "var(--radius-xs)",
              background: "var(--secondary)",
              padding: "16px",
              minWidth: 0,
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)"
            }}>
              <h4 style={{
                margin: "0 0 9px",
                fontSize: "14px",
                lineHeight: 1.25,
                color: "var(--text-1)"
              }}>
                {issue.title}
              </h4>
              <p style={{
                margin: "0 0 10px",
                color: "var(--text-1)",
                fontSize: "13px",
                lineHeight: 1.38
              }}>
                {issue.intro}
              </p>
              <ul style={{
                margin: 0,
                paddingLeft: "17px",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                color: "var(--text-1)",
                fontSize: "13px",
                lineHeight: 1.38
              }}>
                {issue.items.map(item => <li key={item}>{item}</li>)}
              </ul>
              {issue.outro && <p style={{
                margin: "10px 0 0",
                color: "var(--text-1)",
                fontSize: "13px",
                lineHeight: 1.38
              }}>
                {issue.outro}
              </p>}
            </section>)}
          </div>
          <section style={{
            border: "none",
            borderRadius: "var(--radius-xs)",
            background: "var(--primary)",
            color: "var(--text-2)",
            padding: "18px",
            minWidth: 0,
            boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)"
          }}>
            <h3 style={{
              margin: "0 0 10px",
              fontSize: "15px",
              lineHeight: 1.25,
              color: "var(--text-2)"
            }}>
              DMS Goal
            </h3>
            <p style={{
              margin: "0 0 12px",
              fontSize: "15px",
              fontWeight: 700,
              lineHeight: 1.38,
              color: "var(--text-2)"
            }}>
              "The job card should become the single source of truth for the entire vehicle workflow."
            </p>
            <ul style={{
              margin: 0,
              paddingLeft: "17px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
              gap: "7px 18px",
              color: "var(--text-2)",
              fontSize: "13px",
              lineHeight: 1.38
            }}>
              {dmsGoalBenefits.map(benefit => <li key={benefit}>{benefit}</li>)}
            </ul>
          </section>
        </section>
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "18px"
        }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPitchMoreOpen(open => !open)}
            aria-expanded={pitchMoreOpen}>
            {pitchMoreOpen ? "Hide sections" : "More sections"}
          </Button>
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
              background: "var(--secondary)",
              padding: "16px",
              minWidth: 0
            }}>
              <h3 style={{
                margin: "0 0 10px",
                fontSize: "14px",
                lineHeight: 1.25,
                color: "var(--text-1)"
              }}>
                {section.title}
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: "17px",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                color: "var(--text-1)",
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
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
