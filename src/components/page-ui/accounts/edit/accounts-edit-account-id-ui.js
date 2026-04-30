// file location: src/components/page-ui/accounts/edit/accounts-edit-account-id-ui.js

export default function EditAccountRouteShimUi(props) {
  const {
    EDIT_ROLES,
    ProtectedRoute,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={EDIT_ROLES}>
      <div style={{
    minHeight: "40vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-1)"
  }}>
        Opening account form…
      </div>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
