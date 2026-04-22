export default function PresentationPageUi({
  ProtectedRoute,
  PresentationProvider,
  PresentationRunner,
}) {
  return (
    <ProtectedRoute>
      <PresentationProvider>
        <PresentationRunner />
      </PresentationProvider>
    </ProtectedRoute>
  );
}
