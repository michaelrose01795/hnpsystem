// file location: src/components/page-ui/admin/users/admin-users-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerTheme from "@/components/ui/LayerTheme";
import { roleCategories } from "@/config/users";

const PAGE_SECTION_KEY = "admin-users-page-shell";

function ThemedSection({ sectionKey, title, subtitle, action, children }) {
  return (
    <LayerTheme
      sectionKey={sectionKey}
      parentKey={PAGE_SECTION_KEY}
      sectionType="content-card"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)"
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--layout-card-gap)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h2 style={{ margin: 0, fontSize: "var(--text-h3)", color: "var(--accentText)" }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <div style={{ margin: "var(--space-xs) 0 0", color: "var(--surfaceTextMuted)" }}>
                {subtitle}
              </div>
            )}
          </div>
          {action && <div style={{ flex: "0 0 auto" }}>{action}</div>}
        </div>
      )}
      {children}
    </LayerTheme>
  );
}

const MOCK_COMPANY_PROFILE = {
  company_name: "Humphries & Parks",
  address_line1: "Mock Service Centre",
  address_line2: "Station Road",
  city: "West Malling",
  postcode: "ME19 6QR",
  phone_service: "01732 000 101",
  phone_parts: "01732 000 202",
  website: "https://www.humphriesandparks.co.uk",
  bank_name: "HNP Business Banking",
  sort_code: "20-00-00",
  account_number: "12345678",
  account_name: "Humphries & Parks Ltd",
  payment_reference_hint: "Use invoice number and vehicle registration as the payment reference.",
};

const MOCK_DB_USERS = [
  {
    id: "mock-admin-manager",
    firstName: "Amelia",
    lastName: "Hart",
    email: "amelia.hart@example.test",
    role: roleCategories.Sales.find((role) => role === "Admin Manager") || roleCategories.Sales[5],
    phone: "01732 000 301",
    createdAt: "2026-05-01T09:00:00.000Z",
    isMock: true,
  },
  {
    id: "mock-service-manager",
    firstName: "Owen",
    lastName: "Reed",
    email: "owen.reed@example.test",
    role: roleCategories.Retail.find((role) => role === "Service Manager") || roleCategories.Retail[1],
    phone: "01732 000 302",
    createdAt: "2026-05-03T10:30:00.000Z",
    isMock: true,
  },
  {
    id: "mock-accounts-manager",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya.shah@example.test",
    role: roleCategories.Sales.find((role) => role === "Accounts Manager") || roleCategories.Sales[6],
    phone: "01732 000 303",
    createdAt: "2026-05-06T08:45:00.000Z",
    isMock: true,
  },
];

const MOCK_DEPARTMENT_LIST = [
  { department: "Accounts", names: ["Priya Shah", "Daniel Brooks"] },
  { department: "Service", names: ["Owen Reed", "Maya Collins"] },
  { department: "Workshop", names: ["Noah Turner", "Ella Morgan"] },
  { department: "Parts", names: ["Samira Khan", "George Miller"] },
];

const MOCK_ROLE_LIST = [
  {
    role: roleCategories.Sales.find((role) => role === "Admin Manager") || roleCategories.Sales[5],
    members: [
      { id: "mock-admin-manager", displayName: "Amelia Hart", key: "amelia-hart", isMock: true },
      { id: "mock-owner", displayName: "James Humphries", key: "james-humphries", isMock: true },
    ],
  },
  {
    role: roleCategories.Retail.find((role) => role === "Service Manager") || roleCategories.Retail[1],
    members: [
      { id: "mock-service-manager", displayName: "Owen Reed", key: "owen-reed", isMock: true },
      { id: "mock-workshop-manager", displayName: "Maya Collins", key: "maya-collins", isMock: true },
    ],
  },
  {
    role: roleCategories.Sales.find((role) => role === "Accounts Manager") || roleCategories.Sales[6],
    members: [{ id: "mock-accounts-manager", displayName: "Priya Shah", key: "priya-shah", isMock: true }],
  },
];

function hasAnyProfileValue(profile = {}) {
  return Object.values(profile || {}).some((value) => String(value || "").trim());
}

function valueOrMock(profile, field) {
  const liveValue = profile?.[field];
  if (String(liveValue || "").trim()) return liveValue;
  return MOCK_COMPANY_PROFILE[field];
}

export default function AdminUserManagementUi(props) {
  const {
    AdminUserForm,
    InlineLoading,
    SkeletonBlock,
    SkeletonKeyframes,
    SkeletonTableRow,
    StatusTag,
    activeUser,
    companyLoading,
    companyMessage,
    companyProfile,
    companySaving,
    dbError,
    dbLoading,
    dbUsers,
    departmentList,
    directoryError,
    directoryLoading,
    fetchDbUsers,
    handleCompanyInputChange,
    handleCompanySave,
    handleProfileView,
    handleUserCreated,
    handleUserDelete,
    modalCloseButtonStyle,
    modalContentStyle,
    modalOverlayStyle,
    previewMember,
    roleList,
    rosterLoading,
    setActiveUser,
    setShowAddForm,
    setShowModal,
    showAddForm,
    showModal,
    userCount,
  } = props;

  const companyHasValues = hasAnyProfileValue(companyProfile);
  const companyPreview = companyHasValues
    ? Object.fromEntries(Object.keys(MOCK_COMPANY_PROFILE).map((field) => [field, valueOrMock(companyProfile, field)]))
    : MOCK_COMPANY_PROFILE;
  const visibleDbUsers = dbUsers.length > 0 ? dbUsers : MOCK_DB_USERS;
  const visibleDepartmentList = departmentList.length > 0 ? departmentList : MOCK_DEPARTMENT_LIST;
  const visibleRoleList = roleList.length > 0 ? roleList : MOCK_ROLE_LIST;
  const visibleUserCount = userCount || MOCK_DB_USERS.length;
  const usingMockDbUsers = dbUsers.length === 0;
  const usingMockDepartments = departmentList.length === 0;
  const usingMockRoles = roleList.length === 0;

  switch (props.view) {
    case "section1":
      return (
        <DevLayoutSection
          sectionKey={PAGE_SECTION_KEY}
          parentKey="app-layout-page-card"
          sectionType="page-shell"
          shell
          backgroundToken="transparent"
          className="app-page-stack"
          style={{ gap: "var(--page-stack-gap)" }}
        >
          <DevLayoutSection
            sectionKey="admin-users-page-header"
            parentKey={PAGE_SECTION_KEY}
            sectionType="toolbar"
          >
            <p style={{ color: "var(--surfaceTextMuted)", margin: 0 }}>
              Provision platform accounts and review department ownership with populated preview data available in every section.
            </p>
          </DevLayoutSection>

          <ThemedSection
            sectionKey="admin-users-company-bank-card"
            title="Company & Bank Details"
            action={
              <button
                type="button"
                onClick={handleCompanySave}
                disabled={companySaving}
                className="app-btn app-btn--primary"
                style={{ opacity: companySaving ? 0.6 : 1 }}
              >
                {companySaving ? "Saving..." : "Save Details"}
              </button>
            }
          >
            {companyMessage && (
              <div
                className={`app-status-message ${companyMessage.includes("saved") ? "app-status-message--success" : "app-status-message--danger"}`}
                style={{ margin: 0 }}
              >
                {companyMessage}
              </div>
            )}
            {companyLoading ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "var(--layout-card-gap)",
                }}
                role="status"
                aria-live="polite"
                aria-label="Loading company profile"
              >
                <SkeletonKeyframes />
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonBlock key={i} width="100%" height="38px" borderRadius="var(--control-radius,10px)" />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "var(--layout-card-gap)",
                  }}
                >
                  <input value={companyProfile.company_name} onChange={(event) => handleCompanyInputChange("company_name", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.company_name} className="app-input" />
                  <input value={companyProfile.address_line1} onChange={(event) => handleCompanyInputChange("address_line1", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.address_line1} className="app-input" />
                  <input value={companyProfile.address_line2} onChange={(event) => handleCompanyInputChange("address_line2", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.address_line2} className="app-input" />
                  <input value={companyProfile.city} onChange={(event) => handleCompanyInputChange("city", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.city} className="app-input" />
                  <input value={companyProfile.postcode} onChange={(event) => handleCompanyInputChange("postcode", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.postcode} className="app-input" />
                  <input value={companyProfile.phone_service} onChange={(event) => handleCompanyInputChange("phone_service", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.phone_service} className="app-input" />
                  <input value={companyProfile.phone_parts} onChange={(event) => handleCompanyInputChange("phone_parts", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.phone_parts} className="app-input" />
                  <input value={companyProfile.website} onChange={(event) => handleCompanyInputChange("website", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.website} className="app-input" />
                  <input value={companyProfile.bank_name} onChange={(event) => handleCompanyInputChange("bank_name", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.bank_name} className="app-input" />
                  <input value={companyProfile.sort_code} onChange={(event) => handleCompanyInputChange("sort_code", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.sort_code} className="app-input" />
                  <input value={companyProfile.account_number} onChange={(event) => handleCompanyInputChange("account_number", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.account_number} className="app-input" />
                  <input value={companyProfile.account_name} onChange={(event) => handleCompanyInputChange("account_name", event.target.value)} placeholder={MOCK_COMPANY_PROFILE.account_name} className="app-input" />
                  <textarea
                    value={companyProfile.payment_reference_hint}
                    onChange={(event) => handleCompanyInputChange("payment_reference_hint", event.target.value)}
                    placeholder={MOCK_COMPANY_PROFILE.payment_reference_hint}
                    rows={3}
                    className="app-input"
                    style={{ gridColumn: "1 / -1", resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--layout-card-gap)" }}>
                  <div>
                    <strong style={{ display: "block", color: "var(--surfaceText)" }}>{companyPreview.company_name}</strong>
                    <span style={{ display: "block", color: "var(--surfaceTextMuted)", marginTop: "4px" }}>
                      {[companyPreview.address_line1, companyPreview.address_line2, companyPreview.city, companyPreview.postcode].filter(Boolean).join(", ")}
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "var(--surfaceText)" }}>{companyPreview.bank_name}</strong>
                    <span style={{ display: "block", color: "var(--surfaceTextMuted)", marginTop: "4px" }}>
                      {companyPreview.sort_code} / {companyPreview.account_number}
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "var(--surfaceText)" }}>Payment note</strong>
                    <span style={{ display: "block", color: "var(--surfaceTextMuted)", marginTop: "4px" }}>
                      {companyPreview.payment_reference_hint}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </ThemedSection>

          {showAddForm && (
            <AdminUserForm
              onCreated={handleUserCreated}
              parentSectionKey={PAGE_SECTION_KEY}
              sectionKey="admin-users-create-user-card"
            />
          )}

          <ThemedSection
            sectionKey="admin-users-live-platform-users-card"
            title="Live Platform Users"
            subtitle={dbLoading ? <InlineLoading width={160} label="Loading user roster" /> : null}
            action={
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setShowAddForm((prev) => !prev)} className="app-btn app-btn--primary">
                  {showAddForm ? "Close Form" : "Add User"}
                </button>
                <button type="button" onClick={fetchDbUsers} className="app-btn app-btn--secondary">
                  Refresh
                </button>
              </div>
            }
          >
            {dbError && (
              <div className="app-status-message app-status-message--danger" style={{ margin: 0 }}>
                {dbError}
              </div>
            )}
            {dbLoading ? (
              <div className="app-status-message app-status-message--info" style={{ margin: 0 }}>
                Reading users...
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDbUsers.map((account) => (
                      <tr key={account.id}>
                        <td style={{ padding: "12px 0", fontWeight: 600, borderBottom: "1px solid var(--separating-line)" }}>
                          {account.firstName} {account.lastName}
                        </td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>{account.email}</td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>{account.role}</td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>{account.phone || "-"}</td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>{new Date(account.createdAt).toLocaleDateString()}</td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>
                          <button
                            type="button"
                            disabled={account.isMock}
                            onClick={() => handleUserDelete(account.id, `${account.firstName} ${account.lastName}`.trim())}
                            className={`app-btn ${account.isMock ? "app-btn--secondary" : "app-btn--danger"}`}
                          >
                            {account.isMock ? "Preview" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usingMockDbUsers && (
                      <tr>
                        <td colSpan={6} style={{ padding: "14px", textAlign: "center", color: "var(--surfaceTextMuted)" }}>
                          Preview users shown while no platform users are available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </ThemedSection>

          <ThemedSection
            sectionKey="admin-users-directory-snapshot-card"
            title="User Directory Snapshot"
            action={<StatusTag label={`${visibleUserCount} people`} tone="default" />}
          >
            {directoryError && (
              <div className="app-status-message app-status-message--danger" style={{ margin: 0 }}>
                {directoryError}
              </div>
            )}
            {directoryLoading ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "var(--layout-card-gap)",
                }}
                role="status"
                aria-live="polite"
                aria-label="Loading employee directory"
              >
                <SkeletonKeyframes />
                {Array.from({ length: 4 }).map((_, deptIdx) => (
                  <div key={deptIdx} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <SkeletonBlock width="60%" height="16px" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "18px" }}>
                      {Array.from({ length: 4 }).map((_, nameIdx) => (
                        <SkeletonBlock key={nameIdx} width={nameIdx % 2 === 0 ? "80%" : "66%"} height="12px" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "var(--layout-card-gap)",
                }}
              >
                {visibleDepartmentList.map(({ department, names }) => (
                  <div key={department} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                      {department}
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--info-dark)" }}>
                      {names.map((name) => (
                        <li key={`${department}-${name}`}>{name}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {usingMockDepartments && <div style={{ color: "var(--surfaceTextMuted)" }}>Preview departments shown while no directory data is available.</div>}
              </div>
            )}
          </ThemedSection>

          <ThemedSection
            sectionKey="admin-users-roles-members-card"
            title="Roles & Members"
          >
            {rosterLoading ? (
              <div style={{ overflowX: "auto" }} role="status" aria-live="polite" aria-label="Loading roster">
                <SkeletonKeyframes />
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonTableRow key={i} cols={2} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--surfaceTextMuted)", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRoleList.map(({ role, members }) => (
                      <tr key={role}>
                        <td style={{ padding: "12px 0", fontWeight: 600, borderBottom: "1px solid var(--separating-line)" }}>{role}</td>
                        <td style={{ borderBottom: "1px solid var(--separating-line)" }}>
                          {members.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {members.map((member) => (
                                <button
                                  key={`${role}-${member.id || member.displayName}`}
                                  type="button"
                                  disabled={member.isMock}
                                  onClick={() => !member.isMock && handleProfileView(member)}
                                  className={`app-btn ${activeUser === member.displayName ? "app-btn--primary" : "app-btn--secondary"}`}
                                >
                                  {member.displayName}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: "var(--surfaceTextMuted)" }}>No members assigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {usingMockRoles && (
                      <tr>
                        <td colSpan={2} style={{ padding: "14px", textAlign: "center", color: "var(--surfaceTextMuted)" }}>
                          Preview role memberships shown while no roster data is available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </ThemedSection>

          {showModal && previewMember && (
            <DevLayoutSection
              sectionKey="admin-users-profile-preview-modal"
              parentKey={PAGE_SECTION_KEY}
              sectionType="modal"
              style={modalOverlayStyle}
            >
              <div style={modalContentStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                    {previewMember.displayName} - Profile Preview
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setActiveUser(null);
                    }}
                    style={modalCloseButtonStyle}
                    aria-label="Close profile preview"
                  >
                    x
                  </button>
                </div>
                <iframe
                  title={`${previewMember.displayName} profile`}
                  src={`/admin/profiles/${encodeURIComponent(previewMember.key || previewMember.displayName)}`}
                  style={{
                    width: "100%",
                    height: "500px",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
                <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                  <button type="button" className="app-btn app-btn--secondary" disabled>
                    Edit profile (coming soon)
                  </button>
                  <button type="button" className="app-btn app-btn--secondary" disabled>
                    Manage documents
                  </button>
                </div>
              </div>
            </DevLayoutSection>
          )}
        </DevLayoutSection>
      );
    default:
      return null;
  }
}
