import { useCallback, useState } from "react";
import { useSlideshow } from "./SlideshowProvider";

// Exports a simple text-only PDF of the deck. We use jsPDF's built-in text
// rendering rather than html2canvas so the export is fast, deterministic, and
// works reliably for management review. Layout preservation of the live UI
// was considered but rejected because real pages during slideshow render with
// demo data that's often placeholder-heavy — a structured textual deck is
// what managers actually want to skim.
export default function usePdfExport() {
  const { slides, userRoles } = useSlideshow();
  const [busy, setBusy] = useState(false);

  const exportPdf = useCallback(async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;
      const maxText = pageW - margin * 2;

      slides.forEach((slide, si) => {
        slide.steps.forEach((step, ti) => {
          if (!(si === 0 && ti === 0)) doc.addPage();

          // Header bar
          doc.setFillColor(220, 38, 38);
          doc.rect(0, 0, pageW, 56, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.text(slide.title || slide.id, margin, 36);
          doc.setFontSize(10);
          doc.text(`Slide ${si + 1} · Step ${ti + 1} of ${slide.steps.length}`, pageW - margin, 36, { align: "right" });

          // Step kind chip
          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text((step.kind || "note").toUpperCase(), margin, 96);

          // Step title
          doc.setTextColor(30, 30, 30);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          const title = step.title || "";
          const titleLines = doc.splitTextToSize(title, maxText);
          doc.text(titleLines, margin, 132);

          // Step body
          doc.setTextColor(70, 70, 70);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(13);
          const bodyLines = doc.splitTextToSize(step.body || "", maxText);
          doc.text(bodyLines, margin, 132 + titleLines.length * 26 + 14);

          // Footer
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text(`HNPSystem · Presentation Deck · Route: ${slide.route}`, margin, pageH - 24);
          doc.text(new Date().toLocaleDateString("en-GB"), pageW - margin, pageH - 24, { align: "right" });
        });
      });

      const role = (userRoles?.[0] || "all").toLowerCase().replace(/\s+/g, "-");
      const date = new Date().toISOString().slice(0, 10);
      doc.save(`hnpsystem-walkthrough-${role}-${date}.pdf`);
    } catch (err) {
      console.error("[slideshow] PDF export failed", err);
      if (typeof window !== "undefined") {
        window.alert("PDF export failed — make sure 'jspdf' is installed.");
      }
    } finally {
      setBusy(false);
    }
  }, [slides, userRoles]);

  return { exportPdf, busy };
}
