// file location: src/features/stockControl/StockQrModal.js
//
// A printable QR label for a tank, shelf or stock item. Scanning it with any
// phone camera opens /tracking/Oil-Stock?stock=<id>&stockAction=<action>,
// which the panel turns straight into the chosen quick workflow (level check,
// book out or receive). The stock ID and barcode print under the code so the
// same label also works with a handheld barcode scanner in the search box.

import React, { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import PopupModal from "@/components/popups/popupStyleApi";
import { Button } from "@/components/ui";
import { buildStockQrUrl } from "@/features/stockControl/stockModel";
import { ChoiceButtons } from "@/features/stockControl/StockFields";

const QUIET_ZONE = 4;

/** Module path + size for a QR code, drawn as one SVG path. */
function buildQrPath(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + QUIET_ZONE},${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { path, size: count + QUIET_ZONE * 2 };
}

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export default function StockQrModal({ row, onClose }) {
  const { item } = row;
  const [action, setAction] = useState("check");
  const url = useMemo(
    () => buildStockQrUrl(typeof window !== "undefined" ? window.location.origin : "", item.id, action),
    [action, item.id]
  );
  const qr = useMemo(() => buildQrPath(url), [url]);
  const caption = [row.location?.name, item.oilGrade, item.stockCode].filter(Boolean).join(" · ");

  // Labels print black on white whatever the app theme is, so they open in a
  // bare window with no app stylesheet.
  const printLabel = () => {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(item.title)} label</title>
      <style>body{font-family:sans-serif;text-align:center;margin:24px}svg{width:60mm;height:60mm}h1{font-size:16pt;margin:8px 0 4px}p{font-size:10pt;margin:2px 0}</style>
      </head><body>
      <svg viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><path d="${qr.path}" fill="black"/></svg>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(caption)}</p>
      ${item.barcode ? `<p>${escapeHtml(item.barcode)}</p>` : ""}
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  const copyLink = () => {
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={`QR label for ${item.title}`} cardClassName="app-settings-popup-card stock-popup">
      <div className="app-settings-popup stock-form">
        <header className="app-popup-compact-header">
          <h2>QR Label</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="primary" size="sm" symbol={false} onClick={printLabel}>
              Print Label
            </Button>
            <Button type="button" variant="secondary" size="sm" symbol={false} onClick={copyLink}>
              Copy Link
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        <ChoiceButtons
          label="Scanning opens"
          options={[
            { value: "check", label: "Level check" },
            { value: "use", label: "Book out" },
            { value: "receive", label: "Stock in" },
          ]}
          value={action}
          onChange={(value) => setAction(value || "check")}
        />
        <div className="stock-qr">
          <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${item.title}`}>
            <path d={qr.path} fill="currentColor" />
          </svg>
          <strong>{item.title}</strong>
          {caption && <span>{caption}</span>}
          <span className="stock-qr__code">{url}</span>
        </div>
        <p className="stock-hint">Stick the label on the tank or shelf. Staff who scan it are taken straight to this item after signing in, and can only do what their role allows.</p>
      </div>
    </PopupModal>
  );
}
