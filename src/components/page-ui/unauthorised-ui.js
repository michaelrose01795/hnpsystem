// file location: src/components/page-ui/unauthorised-ui.js
//
// Presentation layer for /unauthorised — the screen a signed-in user lands on
// when they follow a link into an area their role does not cover.
//
// Deliberately NOT the SupportErrorRecovery screen (src/pages/404.js and
// friends): a permission refusal is not a fault. Nothing broke, nothing was
// lost, and there is no reference code to quote — so it must not borrow the
// alert styling, and it must not auto-file an error event the way
// PageErrorScreen does. What it shares with that screen is the family: it is
// the same "you have landed somewhere you cannot continue from" moment, so its
// classes live in src/styles/families/error-recovery.css.
//
// Layer ladder (CLAUDE.md §3.0a-2): the page card supplied by Layout is
// --surface, this section is <LayerTheme>, and the facts block inside it flips
// back to <LayerSurface>. All appearance comes from the error-recovery family
// (the .app-access-denied wrapper plus the shared .app-recovery* /
// .app-recovery-facts* classes it borrows from the recovery screen) and
// .app-btn — no one-off visual inline styles (§3.0b rule 3).

import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import SupportReportLauncher from "@/components/support/SupportReportLauncher";

const PAGE_KEY = "unauthorised-page";

// One <dt>/<dd> pair. Kept local because the grid pairing only makes sense
// against .app-recovery-facts.
function Fact({ label, value, mono = false }) {
  return (
    <>
      <dt className="app-recovery-facts__label">{label}</dt>
      <dd
        className={
          mono
            ? "app-recovery-facts__value app-recovery-facts__value--mono"
            : "app-recovery-facts__value"
        }
      >
        {value}
      </dd>
    </>
  );
}

export default function UnauthorisedPageUi(props) {
  const {
    attemptedPath, // sanitised in the page — never rendered as a link
    signedInAs,
    accessSummary,
    reportPrefill,
    onGoBack,
    onGoHome,
    homeLabel,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return (
        <div
          className="app-page-shell"
          // Centre this standalone screen in the viewport; it has no page chrome
          // of its own to align against.
          style={{ display: "grid", placeItems: "center", minHeight: "70svh" }}
        >
          <div
            className="app-page-stack"
            // Cap the measure so the message stays readable on wide screens.
            style={{ width: "100%", maxWidth: "38rem", marginInline: "auto" }}
          >
            <LayerTheme
              as="section"
              sectionKey={PAGE_KEY}
              sectionType="content-card"
              gap="16px"
              aria-labelledby="unauthorised-title"
            >
              <div className="app-access-denied">
                <span className="app-recovery__badge app-recovery__badge--warning" aria-hidden="true">
                  🔒
                </span>

                <h1 id="unauthorised-title" className="app-recovery__title">
                  Access denied
                </h1>

                <p className="app-recovery__message">
                  You are signed in, but your account does not have permission to open
                  this page. If you think it should, ask your manager or send us a
                  request and we will check your role.
                </p>

                <LayerSurface
                  sectionKey="unauthorised-facts"
                  parentKey={PAGE_KEY}
                  padding="4px 16px"
                  gap="0"
                  style={{ width: "100%" }}
                >
                  <dl className="app-recovery-facts">
                    {attemptedPath && (
                      <Fact label="Page requested" value={attemptedPath} mono />
                    )}
                    <Fact label="Signed in as" value={signedInAs} />
                    <Fact label="Your access" value={accessSummary} />
                  </dl>
                </LayerSurface>

                <div className="app-recovery__actions">
                  <button type="button" className="app-btn app-btn--primary" onClick={onGoHome}>
                    {homeLabel}
                  </button>
                  <button type="button" className="app-btn app-btn--secondary" onClick={onGoBack}>
                    Go back
                  </button>
                  {/* Self-hosting launcher: works whether or not the staff topbar
                      (the usual modal host) is on screen. */}
                  <SupportReportLauncher label="Request access" prefill={reportPrefill} />
                </div>

                <p className="app-recovery__hint">
                  Nothing has gone wrong and no work has been lost — everything you can
                  reach is still in the sidebar.
                </p>
              </div>
            </LayerTheme>
          </div>
        </div>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
