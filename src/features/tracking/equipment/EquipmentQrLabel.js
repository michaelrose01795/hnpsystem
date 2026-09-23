// file location: src/features/tracking/equipment/EquipmentQrLabel.js
//
// The QR label for one asset. The code encodes the short record URL
// (/tracking/equipment/EQ-0001), which any phone camera opens; the redirect
// lands on this asset's record, ready to log a check or report a fault.
//
// The encoder (qrcode-generator, no dependencies) is loaded only when a label
// is opened, so it never weighs on the tab. Modules are drawn as one SVG path.
// A QR code is machine-read, so it is always dark on a light quiet zone,
// whatever the theme — the only fixed colours in the tracker, on purpose.

import React, { useEffect, useMemo, useState } from "react";
import { Button, StatusMessage } from "@/components/ui";
import { buildEquipmentRecordPath, getCategoryLabel, getLocationLabel } from "@/features/tracking/equipment/equipmentModel";
import { reportSuccess } from "@/lib/notifications/report";

const QUIET_ZONE = 4; // modules, per the QR specification

function buildModulePath(qr) {
  const count = qr.getModuleCount();
  const parts = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) parts.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { path: parts.join(""), size: count + QUIET_ZONE * 2 };
}

function useQrCode(text) {
  const [state, setState] = useState({ path: "", size: 0, error: "" });
  useEffect(() => {
    let cancelled = false;
    import("qrcode-generator")
      .then((module) => {
        const factory = module.default || module;
        const qr = factory(0, "M");
        qr.addData(text);
        qr.make();
        if (!cancelled) setState({ ...buildModulePath(qr), error: "" });
      })
      .catch(() => {
        if (!cancelled) setState({ path: "", size: 0, error: "The QR code could not be generated." });
      });
    return () => {
      cancelled = true;
    };
  }, [text]);
  return state;
}

const svgMarkup = ({ path, size }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
  `<rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`;

// Opens a bare window with just the label and prints it. The label is built
// with DOM calls (text nodes only), so no asset field is ever parsed as HTML.
function printLabel({ qr, asset, url }) {
  const win = window.open("", "_blank", "width=420,height=560");
  if (!win) return false;
  const doc = win.document;
  doc.title = `${asset.assetCode} label`;
  const style = doc.createElement("style");
  style.textContent =
    "@page{size:62mm 90mm;margin:4mm}body{font-family:system-ui,sans-serif;margin:0;text-align:center;color:black;background:white}" +
    "svg{width:52mm;height:52mm}h1{font-size:16pt;margin:2mm 0 0;letter-spacing:.06em}p{margin:1mm 0;font-size:9pt}";
  doc.head.appendChild(style);
  const holder = doc.createElement("div");
  const parsed = new DOMParser().parseFromString(svgMarkup(qr), "image/svg+xml").documentElement;
  holder.appendChild(doc.importNode(parsed, true));
  const code = doc.createElement("h1");
  code.textContent = asset.assetCode;
  const name = doc.createElement("p");
  name.textContent = asset.name;
  const place = doc.createElement("p");
  place.textContent = [getCategoryLabel(asset), getLocationLabel(asset)].filter(Boolean).join(" · ");
  const hint = doc.createElement("p");
  hint.textContent = `Scan to check or report a fault · ${url}`;
  doc.body.append(holder, code, name, place, hint);
  win.focus();
  win.print();
  return true;
}

export default function EquipmentQrLabel({ asset }) {
  const url = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${buildEquipmentRecordPath(asset.assetCode)}`;
  }, [asset.assetCode]);
  const qr = useQrCode(url);
  const [notice, setNotice] = useState("");

  if (qr.error) return <StatusMessage tone="danger">{qr.error}</StatusMessage>;

  return (
    <div className="equipment-qr">
      {qr.path ? (
        <svg
          className="equipment-qr__code"
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR code for ${asset.assetCode}`}
        >
          <rect width={qr.size} height={qr.size} fill="white" />
          <path d={qr.path} fill="black" />
        </svg>
      ) : (
        <p className="equipment-form__hint">Generating QR code…</p>
      )}
      <span className="equipment-qr__code-text">{asset.assetCode}</span>
      <span className="equipment-qr__url">{url}</span>
      <div className="app-record-actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!qr.path}
          onClick={() => {
            if (!printLabel({ qr, asset, url })) setNotice("Allow pop-ups for this site to print labels.");
          }}
        >
          Print label
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              reportSuccess("Link copied");
            } catch {
              setNotice(url);
            }
          }}
        >
          Copy link
        </Button>
      </div>
      {notice && <StatusMessage tone="info">{notice}</StatusMessage>}
    </div>
  );
}
