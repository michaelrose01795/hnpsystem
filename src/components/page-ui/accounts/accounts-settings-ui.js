// file location: src/components/page-ui/accounts/accounts-settings-ui.js

export default function AccountsSettingsRedirectPageUi(props) {
  const {
    ProtectedRoute,
    SETTINGS_ROLES,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={SETTINGS_ROLES}>
      <p style={{
    color: "var(--text-secondary)"
  }}>Redirecting to account settings…</p>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
