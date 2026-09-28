// file location: src/features/stockAccess/BarcodeScanner.js
//
// Camera scanning for /access, where the browser supports it. Uses the
// built-in BarcodeDetector (Chrome / Edge on Android and desktop) — no extra
// library — and reports the first code it reads. Browsers without it never
// see the Scan button (isCameraScanSupported); a handheld barcode scanner
// still works everywhere because it types into the search box and presses
// Enter, and printed QR labels open /access/<store>?item=<id> from any phone camera.

import React, { useEffect, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { Button, StatusMessage } from "@/components/ui";
import styles from "@/features/stockAccess/stockAccess.module.css";

const FORMATS = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "data_matrix"];
const SCAN_INTERVAL_MS = 250;

export const isCameraScanSupported = () =>
  typeof window !== "undefined" &&
  "BarcodeDetector" in window &&
  Boolean(navigator?.mediaDevices?.getUserMedia);

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;

    const start = async () => {
      try {
        const supported = window.BarcodeDetector.getSupportedFormats
          ? await window.BarcodeDetector.getSupportedFormats().catch(() => null)
          : null;
        const detector = new window.BarcodeDetector({ formats: FORMATS.filter((format) => !supported || supported.includes(format)) });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            const value = codes?.[0]?.rawValue;
            if (value) {
              stopped = true;
              onDetected(value);
              return;
            }
          } catch {
            // A frame that cannot be read is normal; keep scanning.
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch (startError) {
        setError(startError?.name === "NotAllowedError" ? "Camera access was blocked. Allow the camera, or type the code into the search box." : "The camera could not be started on this device.");
      }
    };
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel="Scan a barcode or QR code" cardClassName="app-settings-popup-card">
      <div className={`app-settings-popup ${styles.sheet}`}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>Scan item</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        {error ? (
          <StatusMessage tone="warning">{error}</StatusMessage>
        ) : (
          <>
            <video ref={videoRef} className={styles.video} muted playsInline aria-label="Camera preview" />
            <p className={styles.muted}>Point the camera at the item&apos;s barcode or QR label.</p>
          </>
        )}
      </div>
    </PopupModal>
  );
}
