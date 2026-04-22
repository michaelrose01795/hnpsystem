// file location: src/components/page-ui/slideshow/slideshow-ui.js

export default function SlideshowPageUi(props) {
  const {
    ProtectedRoute,
    SlideshowProvider,
    SlideshowRunner,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ProtectedRoute>
      <SlideshowProvider>
        <SlideshowRunner />
      </SlideshowProvider>
    </ProtectedRoute>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
