// file location: src/pages/slideshow/index.js
// Entry point for the presentation / walkthrough mode. Uses the default
// persistent Layout (sidebar, topbar, job tracker) so the demo looks exactly
// like what a normal user sees — the only differences are the overlay callouts
// and the isolated demo data feeding the mounted target page.
import ProtectedRoute from "@/components/ProtectedRoute";
import { SlideshowProvider } from "@/features/slideshow/SlideshowProvider";
import SlideshowRunner from "@/features/slideshow/SlideshowRunner";
import SlideshowPageUi from "@/components/page-ui/slideshow/slideshow-ui"; // Extracted presentation layer.

export default function SlideshowPage() {
  return <SlideshowPageUi view="section1" ProtectedRoute={ProtectedRoute} SlideshowProvider={SlideshowProvider} SlideshowRunner={SlideshowRunner} />;






}
