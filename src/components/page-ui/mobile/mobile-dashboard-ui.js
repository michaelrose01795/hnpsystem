// file location: src/components/page-ui/mobile/mobile-dashboard-ui.js

export default function MobileDashboardPageUi(props) {
  const {
    MobileDashboardInner,
    ProtectedRoute,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <MobileDashboardInner />
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
