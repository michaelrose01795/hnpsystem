import ProfilePageWrapperUi from "@/components/page-ui/profile/profile-ui";
import { MockPage } from "./_helpers";

function ProfilePagePlaceholder() {
  return (
    <div className="app-page-shell" style={{ padding: 16 }}>
      <div className="app-page-card">
        <div className="app-page-stack">
          <div className="app-section-card" style={{ padding: 20 }}>
            <h1 style={{ marginTop: 0, color: "var(--primary)" }}>My Profile</h1>
            <p style={{ color: "var(--text-1)" }}>
              Personal details, payslips, clocking history and stored documents
              for the signed-in user.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileMock() {
  return (
    <MockPage
      Ui={ProfilePageWrapperUi}
      overrides={{
        view: "section1",
        ProfilePage: ProfilePagePlaceholder,
        props: {},
      }}
    />
  );
}
