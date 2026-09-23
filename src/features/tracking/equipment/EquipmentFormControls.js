// file location: src/features/tracking/equipment/EquipmentFormControls.js
//
// Small building blocks shared by the tracker's popups. Each wraps a shared
// primitive (TrackingPopup, Button, .app-input, .app-toggle) — nothing here
// defines its own look beyond the classes in equipmentTracker.css.

import React, { useCallback, useId, useRef } from "react";
import { Button } from "@/components/ui";
import TrackingPopup from "@/features/tracking/TrackingPopup";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { EQUIPMENT_UPLOAD_ACCEPT } from "@/config/equipmentTracking";

/* The shared tracking popup, closing on Escape, with the tracker's body class. */
export function EquipmentDrawer({ title, description, onClose, headerActions, footer, children, busy = false }) {
  const close = useCallback(() => {
    if (!busy) onClose?.();
  }, [busy, onClose]);
  useEscapeKey(close, true);
  return (
    <TrackingPopup
      title={title}
      description={description}
      onClose={close}
      headerActions={headerActions}
      footer={footer}
      ariaLabel={title}
    >
      <div className="equipment-drawer">{children}</div>
    </TrackingPopup>
  );
}

export function FormField({ label, hint, htmlFor, children, required = false }) {
  return (
    <div className="equipment-form__field">
      {label && (
        <label className="equipment-form__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="app-field-required" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}
      {children}
      {hint && <p className="equipment-form__hint">{hint}</p>}
    </div>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, hint, required = false, rows = 3 }) {
  const id = useId();
  return (
    <FormField label={label} hint={hint} htmlFor={id} required={required}>
      <textarea
        id={id}
        className="app-input app-input--textarea equipment-form__textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

/* A single-choice segmented control built from the shared Button, joined by
   the tracking page's segmented wrapper (.tracking-viewswitch). */
export function ChoiceGroup({ label, options, value, onChange, hint, ariaLabel, size = "sm" }) {
  return (
    <FormField label={label} hint={hint}>
      <div className="tracking-viewswitch equipment-choice" role="group" aria-label={ariaLabel || label}>
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            size={size}
            variant={value === option.key ? "primary" : "secondary"}
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </FormField>
  );
}

export function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="app-toggle-field">
      <input
        type="checkbox"
        className="app-toggle app-toggle--checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/* Hidden native file input + a staff Button trigger (the staff-controls
   contract). `capture` opens the rear camera on a phone. */
export function FilePickerField({ label, hint, files, onChange, multiple = true, capture = false, buttonLabel = "Add photos" }) {
  const inputRef = useRef(null);
  const addFiles = (list) => {
    const next = [...files, ...Array.from(list || [])];
    onChange(multiple ? next : next.slice(-1));
  };
  return (
    <FormField label={label} hint={hint}>
      <input ref={inputRef} type="file" accept={EQUIPMENT_UPLOAD_ACCEPT} multiple={multiple} capture={capture ? "environment" : undefined} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} style={{ display: "none" }} />
      <div className="app-record-actions">
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          {buttonLabel}
        </Button>
      </div>
      {files.length > 0 && (
        <ul className="equipment-drawer__list">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="equipment-drawer__list-item">
              <span className="app-record-note app-record-note--strong">{file.name}</span>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FormField>
  );
}

// StatusText and toOptions live beside the register views and the model so the
// panel's first-load chunk does not pull in this module (and the popup shell it
// imports) just for them. Re-exported here for the drawers.
export { StatusText } from "@/features/tracking/equipment/EquipmentViews";
export { toOptions } from "@/features/tracking/equipment/equipmentModel";
