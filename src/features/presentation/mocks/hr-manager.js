import HRManagerDashboardUi from "@/components/page-ui/hr/manager/hr-manager-ui";
import { MockPage } from "./_helpers";

const HR_TABS = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Employees" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
];

function HrManagerOverview() {
  return (
    <div className="app-section-card" style={{ padding: 16 }}>
      <h2 style={{ margin: 0, color: "var(--primary)" }}>HR Manager Console</h2>
      <p style={{ color: "var(--text-1)", marginTop: 8 }}>
        Cross-tab manager view for attendance, leave, payroll and disciplinary work.
      </p>
    </div>
  );
}

export default function HrManagerMock() {
  return (
    <MockPage
      Ui={HRManagerDashboardUi}
      overrides={{
        view: "section4",
        HR_TABS,
        activeTab: "overview",
        ActiveTabComponent: HrManagerOverview,
      }}
    />
  );
}
