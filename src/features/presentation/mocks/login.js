import LoginPageUi from "@/components/page-ui/login-ui";
import BrandLogo from "@/components/BrandLogo";
import LoginDropdown from "@/components/LoginDropdown";
import { MockPage } from "./_helpers";

function NoopLoginCard({ title, subtitle, children }) {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div className="app-section-card" style={{ padding: 24, width: "100%", maxWidth: 480 }}>
        <h2 style={{ marginTop: 0, color: "var(--primary)" }}>{title}</h2>
        {subtitle && <p style={{ color: "var(--text-1)", marginTop: 4 }}>{subtitle}</p>}
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export default function LoginMock() {
  return (
    <MockPage
      Ui={LoginPageUi}
      overrides={{
        view: "section2",
        BrandLogo,
        LoginDropdown,
        LoginCard: NoopLoginCard,
        allowDevUserSelection: false,
        allUsers: [],
        email: "",
        password: "",
        errorMessage: "",
        isResettingPassword: false,
        loadingDevUsers: false,
        loginRoleCategories: {},
        rosterLoading: false,
        selectedCategory: "",
        selectedDepartment: "",
        selectedUser: null,
        showResetModal: false,
        resetEmail: "",
        resetStatus: "",
        resetStatusType: "info",
        usersByRole: {},
        usersByRoleDetailed: {},
      }}
    />
  );
}
