export default function PresentationPageUi({
  PresentationProvider,
  PresentationRunner,
}) {
  return (
    <PresentationProvider>
      <PresentationRunner />
    </PresentationProvider>
  );
}
