// No page-ui file exists for /password-reset/reverted yet — this stub renders
// a placeholder so the slide is still walkable. Replace with a real page-ui
// import once the page is extracted.
import { MockPage } from "./_helpers";

function PasswordResetRevertedPlaceholder() {
  return (
    <div className="app-page-shell" style={{ padding: 16 }}>
      <div className="app-page-card">
        <div className="app-page-stack">
          <div className="app-section-card" style={{ padding: 24 }}>
            <h1 style={{ marginTop: 0, color: "var(--primary)" }}>Password Reset Reverted</h1>
            <p style={{ color: "var(--text-1)" }}>
              Page UI not extracted yet — see src/pages/password-reset/reverted.js
              for the live implementation. The presentation will pick up the
              extracted UI automatically once src/components/page-ui/password-reset/
              reverted-ui.js exists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PasswordResetRevertedMock() {
  return <MockPage Ui={PasswordResetRevertedPlaceholder} />;
}
