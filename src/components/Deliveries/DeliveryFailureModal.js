// file location: src/components/Deliveries/DeliveryFailureModal.js
//
// Records why a stop could not be delivered.
//
// A reason is required — "failed" with no reason is what makes a delivery board
// useless the next morning. The reason list is the shared vocabulary in
// deliveryStatus.js, which is also the database CHECK constraint, so the
// dropdown can never offer a value the column will reject.

import React, { useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { DELIVERY_FAILURE_REASONS } from "@/features/deliveries/deliveryStatus";
import { formatDeliveryAddress } from "@/features/deliveries/deliveryFormatting";
import { deliveryStyles, deliveryText } from "./deliveryStyles";

export default function DeliveryFailureModal({ delivery, saving, error, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setReason(delivery?.failed_reason || "");
    setNotes(delivery?.failed_notes || "");
  }, [delivery?.id, delivery?.failed_reason, delivery?.failed_notes]);

  if (!delivery) return null;

  return (
    <PopupModal
      isOpen
      onClose={saving ? undefined : onCancel}
      closeOnBackdrop={!saving}
      ariaLabel="Record a failed delivery"
    >
      <div style={deliveryStyles.modalBody}>
        <div style={deliveryStyles.modalHeader}>
          <div style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Failed delivery</span>
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

        {error ? (
          <div className="app-status-message app-status-message--danger">{error}</div>
        ) : null}

        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <DropdownField
            label="Reason *"
            name="failed_reason"
            placeholder="Why could it not be delivered?"
            options={DELIVERY_FAILURE_REASONS}
            value={reason}
            onValueChange={(value) => setReason(value)}
          />
          <label style={deliveryStyles.cell}>
            <span style={deliveryText.label}>What happened</span>
            <textarea
              className="app-input app-input--textarea"
              rows={3}
              value={notes}
              placeholder="Anything the desk needs before rebooking this stop."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <span style={deliveryText.caption}>
            The parts stay on the van. Mark the stop as returned once they are back in stores.
          </span>
        </LayerSurface>

        <div style={deliveryStyles.modalActions}>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={saving}
            disabled={!reason || saving}
            onClick={() => onConfirm({ failedReason: reason, failedNotes: notes.trim() })}
          >
            Record failure
          </Button>
        </div>
      </div>
    </PopupModal>
  );
}
