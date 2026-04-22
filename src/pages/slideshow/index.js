// file location: src/pages/slideshow/index.js
// Entry point for the presentation / walkthrough mode. Uses the default
// persistent Layout (sidebar, topbar, job tracker) so the demo looks exactly
// like what a normal user sees — the only differences are the overlay callouts
// and the isolated demo data feeding the mounted target page.
import ProtectedRoute from "@/components/ProtectedRoute";
import { SlideshowProvider } from "@/features/slideshow/SlideshowProvider";
import SlideshowRunner from "@/features/slideshow/SlideshowRunner";

export default function SlideshowPage() {
  return (
    <ProtectedRoute>
      <SlideshowProvider>
        <SlideshowRunner />
      </SlideshowProvider>
    </ProtectedRoute>
  );
}
