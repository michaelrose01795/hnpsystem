// file location: src/components/page-ui/mobile/delivery/mobile-delivery-job-number-ui.js

export default function PageUi(props) {
  const {
    DeliveryInner,
    ProtectedRoute,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={["MOBILE TECHNICIAN", "ADMIN", "ADMIN MANAGER", "OWNER", "SERVICE MANAGER", "WORKSHOP MANAGER"]}>
      <DeliveryInner />
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
