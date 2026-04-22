// file location: src/components/page-ui/dev/dev-user-diagnostic-ui.js

export default function UserDiagnosticDevPageUi(props) {
  const {
    DevLayoutSection,
    GlobalUiShowcase,
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
      <button type="button" onClick={() => router.back()} style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        marginBottom: "16px",
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
      <div style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap"
      }}>
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
          border: "1px solid var(--danger)",
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
            border: `1px solid ${result.pass ? "var(--success)" : "var(--danger)"}`,
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
      <GlobalUiShowcase />
    </DevLayoutSection>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
