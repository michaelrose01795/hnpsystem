import { useCallback, useState } from "react";
import { usePresentation } from "./PresentationProvider";

const KIND_LABEL = {
  main: "Overview",
  tooltip: "UI detail",
  feature: "Business value",
};

function wrapLines(doc, text, maxWidth) {
  return doc.splitTextToSize(String(text || ""), maxWidth);
}

export default function usePdfExport() {
  const { slides, userRoles } = usePresentation();
  const [busy, setBusy] = useState(false);

  const exportPdf = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 46;
      const maxText = pageW - margin * 2;
      const roleLabel = userRoles?.length ? userRoles.join(", ") : "all roles";
      const exportedAt = new Date().toLocaleDateString("en-GB");

      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(32);
      doc.text("HNPSystem Presentation", margin, 150);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(15);
      doc.text("Role-aware guided demo deck", margin, 184);
      doc.text(`Roles: ${roleLabel}`, margin, 212);
      doc.text(`Exported: ${exportedAt}`, margin, 240);

      slides.forEach((slide, slideNumber) => {
        doc.addPage();

        doc.setFillColor(220, 38, 38);
        doc.rect(0, 0, pageW, 56, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        doc.text(slide.title || slide.id, margin, 35);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Slide ${slideNumber + 1} of ${slides.length} | ${slide.route}`, pageW - margin, 35, { align: "right" });

        let y = 94;
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("Management talking points", margin, y);
        y += 24;

        slide.steps.forEach((step, stepIndex) => {
          const titleLines = wrapLines(doc, `${stepIndex + 1}. ${step.title || "Step"}`, maxText);
          const bodyLines = wrapLines(doc, step.body || "", maxText - 24);

          if (y + titleLines.length * 16 + bodyLines.length * 14 + 34 > pageH - 52) {
            doc.addPage();
            y = 74;
          }

          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text((KIND_LABEL[step.kind] || "Note").toUpperCase(), margin, y);
          y += 16;

          doc.setTextColor(30, 30, 30);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(titleLines, margin, y);
          y += titleLines.length * 17;

          doc.setTextColor(72, 72, 72);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11.5);
          doc.text(bodyLines, margin + 16, y);
          y += bodyLines.length * 14 + 18;
        });

        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("HNPSystem | Presentation Mode", margin, pageH - 24);
        doc.text(exportedAt, pageW - margin, pageH - 24, { align: "right" });
      });

      const role = (userRoles?.[0] || "all").toLowerCase().replace(/\s+/g, "-");
      const date = new Date().toISOString().slice(0, 10);
      doc.save(`hnpsystem-presentation-${role}-${date}.pdf`);
    } catch (err) {
      console.error("[presentation] PDF export failed", err);
      if (typeof window !== "undefined") {
        window.alert("PDF export failed. Please make sure jsPDF is installed.");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, slides, userRoles]);

  return { exportPdf, busy };
}
