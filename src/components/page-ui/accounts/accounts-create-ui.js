// file location: src/components/page-ui/accounts/accounts-create-ui.js
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function CreateAccountRouteShimUi(props) {
  const {
    CREATE_ROLES,
    ProtectedRoute,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute allowedRoles={CREATE_ROLES}>
      <div className="app-page-shell">
        <LayerSurface>
          <div className="app-page-stack">
            <LayerTheme as="section">
              Opening account form…
            </LayerTheme>
          </div>
        </LayerSurface>
      </div>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
