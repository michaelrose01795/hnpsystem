// file location: src/components/Deliveries/DeliveryProofModal.js
//
// Records the delivery: who received it, an optional note, an optional drop
// photo and an optional signature.
//
// The recipient name is the only required field, so a delivery can always be
// completed — a van with no signal, a customer who will not sign, or a site
// with no service still gets recorded. Photo and signature go to Supabase
// Storage through /api/parts/delivery-diary/proof, which reuses the existing
// bucket-service pattern; if that upload fails the delivery is still marked
// delivered and the failure is reported, rather than the stop being stuck.
//
// The signature pad is a plain canvas — a functional drawing primitive, the
// same category as the VHC tyre/brake diagrams — exported as a PNG data URL.

import React, { useCallback, useEffect, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import { deliveryStyles, deliveryText } from "./deliveryStyles";
import { formatCurrency, formatDeliveryAddress } from "@/features/deliveries/deliveryFormatting";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default function DeliveryProofModal({
  delivery,
  saving,
  error,
  onCancel,
  onConfirm,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const photoInputRef = useRef(null);

  const [recipientName, setRecipientName] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [coreCollected, setCoreCollected] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [hasSignature, setHasSignature] = useState(false);

  // Seeded from whatever proof already exists, and re-seeded only when a
  // different stop is opened — re-running this while the driver is typing would
  // wipe the name they are halfway through entering.
  const deliveryId = delivery?.id;
  const seededRecipient = delivery?.pod_recipient_name || "";
  const seededNotes = delivery?.pod_notes || "";
  const seededCore = Boolean(delivery?.core_return_collected);

  useEffect(() => {
    setRecipientName(seededRecipient);
    setPodNotes(seededNotes);
    setCoreCollected(seededCore);
    setPhoto(null);
    setPhotoError("");
    setHasSignature(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the stop, not on its fields
  }, [deliveryId]);

  // Size the canvas backing store to its rendered size so strokes are not
  // stretched, and re-clear it whenever the modal opens for a different stop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    // The pad is a drawing surface: the canvas API takes a colour string, so
    // the stroke reads the resolved token off the document rather than
    // hard-coding a hex value.
    const resolved =
      typeof window !== "undefined"
        ? getComputedStyle(document.documentElement).getPropertyValue("--text-1").trim()
        : "";
    context.strokeStyle = resolved || "currentColor";
  }, [delivery?.id]);

  const pointFrom = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startStroke = useCallback((event) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    canvas.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    const point = pointFrom(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }, []);

  const continueStroke = useCallback((event) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = pointFrom(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }, []);

  const endStroke = useCallback(() => {
    drawingRef.current = false;
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    setPhotoError("");
    if (!file) {
      setPhoto(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhoto(null);
      setPhotoError("That photo is larger than 8 MB. Take a smaller one or skip the photo.");
      return;
    }
    setPhoto(file);
  };

  const handleConfirm = () => {
    const signature =
      hasSignature && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
    onConfirm({
      recipientName: recipientName.trim(),
      podNotes: podNotes.trim(),
      coreCollected,
      photo,
      signature,
    });
  };

  if (!delivery) return null;

  const readyToConfirm = recipientName.trim().length > 1 && !saving;

  return (
    <PopupModal
      isOpen
      onClose={saving ? undefined : onCancel}
      closeOnBackdrop={!saving}
      ariaLabel="Record proof of delivery"
    >
      <div style={deliveryStyles.modalBody}>
        <div style={deliveryStyles.modalHeader}>
          <div style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Delivered</span>
            <strong style={deliveryText.valueStrong}>
              {delivery.customerDisplayName || delivery.customer_name || "Customer"}
            </strong>
            <span style={deliveryText.muted}>
              {formatDeliveryAddress(delivery)}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>

        {!delivery.isPaid ? (
          <div className="app-status-message app-status-message--warning">
            Payment of {formatCurrency(delivery.value)} is still due on this delivery — collect it
            before handing the parts over.
          </div>
        ) : null}

        {error ? (
          <div className="app-status-message app-status-message--danger">{error}</div>
        ) : null}

        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <label style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Received by *</span>
            <input
              className="app-input"
              type="text"
              value={recipientName}
              autoComplete="off"
              placeholder="Name of the person who took the delivery"
              onChange={(event) => setRecipientName(event.target.value)}
            />
          </label>
          <label style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Notes</span>
            <textarea
              className="app-input app-input--textarea"
              rows={2}
              value={podNotes}
              placeholder="Left at reception, signed for by the workshop, etc."
              onChange={(event) => setPodNotes(event.target.value)}
            />
          </label>
          {delivery.core_return_expected ? (
            <label style={deliveryStyles.cellInline}>
              <input
                type="checkbox"
                className="app-toggle app-toggle--checkbox"
                checked={coreCollected}
                onChange={(event) => setCoreCollected(event.target.checked)}
              />
              <span style={deliveryText.value}>Exchange core collected from the customer</span>
            </label>
          ) : null}
        </LayerSurface>

        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>Signature</span>
          <canvas
            ref={canvasRef}
            style={deliveryStyles.signaturePad}
            onPointerDown={startStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            aria-label="Signature capture area"
          />
          <div style={deliveryStyles.cellInline}>
            <Button variant="ghost" size="sm" onClick={clearSignature} disabled={!hasSignature}>
              Clear signature
            </Button>
            <span style={deliveryText.caption}>Optional — a name alone is enough.</span>
          </div>
        </LayerSurface>

        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>Drop photo</span>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
          <div style={deliveryStyles.cellInline}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
              disabled={saving}
            >
              {photo ? "Change photo" : "Add photo"}
            </Button>
            <span style={deliveryText.caption}>
              {photo ? photo.name : "Optional — up to 8 MB."}
            </span>
          </div>
          {photoError ? (
            <div className="app-status-message app-status-message--warning">{photoError}</div>
          ) : null}
        </LayerSurface>

        <div style={deliveryStyles.modalActions}>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" busy={saving} disabled={!readyToConfirm} onClick={handleConfirm}>
            Record delivery
          </Button>
        </div>
      </div>
    </PopupModal>
  );
}
