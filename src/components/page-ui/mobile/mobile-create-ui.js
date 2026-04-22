// file location: src/components/page-ui/mobile/mobile-create-ui.js

export default function PageUi(props) {
  const {
    MobileCreateInner,
    ProtectedRoute,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "SERVICE", "SERVICE MANAGER", "WORKSHOP MANAGER", "ADMIN", "ADMIN MANAGER", "OWNER", "GENERAL MANAGER"]}>
      <MobileCreateInner />
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
