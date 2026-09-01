// file location: src/features/websiteManager/editors/fields.js
//
// Renders an input for a single schema field. Centralised so each field type
// (text, image_url, string_list, object_list, boolean, color, …) has exactly
// one implementation that the SectionEditor calls into.
//
// Every control here is a canonical staff primitive — `.app-input` for text,
// `DropdownField` for every dropdown (CLAUDE.md §3.4a: never a raw <select>),
// `.app-toggle--checkbox` for booleans — so the builder forms look identical
// to the rest of the staff app.

import React from "react";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { design as WEBSITE_DESIGN_DEFAULTS } from "@/features/website/data/siteDesign";

const fullWidth = { width: "100%" };

export function renderField({ field, value, onChange, disabled }) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="app-input website-manager__textarea"
          rows={3}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          style={fullWidth}
        />
      );

    case "number":
      return (
        <input
          className="app-input"
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          style={fullWidth}
        />
      );

    case "url":
      return (
        <input
          className="app-input"
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          style={fullWidth}
        />
      );

    case "image_url":
      return <ImageUrlField value={value} onChange={onChange} disabled={disabled} />;

    case "color":
      return <ColorField value={value} onChange={onChange} disabled={disabled} />;

    case "boolean":
      return <BooleanField value={value} onChange={onChange} disabled={disabled} />;

    case "select":
      return (
        <DropdownField
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Choose…"
          options={field.options || []}
          style={fullWidth}
        />
      );

    case "status":
      return (
        <DropdownField
          value={value || "draft"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={[
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ]}
          style={fullWidth}
        />
      );

    case "string_list":
      return (
        <StringList
          value={value}
          onChange={onChange}
          disabled={disabled}
          multiline={!!field.multiline}
        />
      );

    case "object_list":
      return (
        <ObjectList
          value={value}
          onChange={onChange}
          disabled={disabled}
          itemSchema={field.schema || []}
        />
      );

    case "csv_to_array":
      return (
        <input
          className="app-input"
          type="text"
          value={Array.isArray(value) ? value.join(", ") : (value || "")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          disabled={disabled}
          style={fullWidth}
          placeholder="Comma-separated"
        />
      );

    case "text":
    default:
      return (
        <input
          className="app-input"
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          style={fullWidth}
        />
      );
  }
}

/* ------------------------------ boolean ------------------------------- */
// Rendered as a plain checkbox rather than a switch because these sit in a
// stacked form where every other control is a full-width field — a checkbox
// keeps the label alignment consistent with the rest of the editor.
function BooleanField({ value, onChange, disabled }) {
  return (
    <span className="website-manager__bool">
      <input
        className="app-toggle--checkbox"
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{value ? "On" : "Off"}</span>
    </span>
  );
}

/* ------------------------------- color -------------------------------- */
// Swatch + hex pair: the swatch is the quick pick, the text field lets staff
// paste an exact brand hex. Both write the same value.
function ColorField({ value, onChange, disabled }) {
  const fallback = WEBSITE_DESIGN_DEFAULTS.accentHex;
  const hex =
    typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return (
    <span className="website-manager__color">
      <input
        className="app-input website-manager__color-swatch"
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Pick a colour"
      />
      <input
        className="app-input"
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={fallback}
        spellCheck={false}
      />
    </span>
  );
}

/* ----------------------------- image_url ------------------------------ */
function ImageUrlField({ value, onChange, disabled }) {
  const [media, setMedia] = React.useState([]);

  React.useEffect(() => {
    let active = true;
    fetch("/api/website/media", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setMedia(rows.filter((row) => row.media_type === "image" && row.url));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="website-manager__image-field">
      <div className="website-manager__image-field-controls">
        <input
          className="app-input"
          type="text"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="Paste an image URL or choose from Media"
        />
        {media.length > 0 && (
          <DropdownField
            value={media.some((asset) => asset.url === value) ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder="Choose from Media"
            options={media.map((asset) => ({ value: asset.url, label: asset.name }))}
          />
        )}
      </div>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="website-manager__image-preview" src={value} alt="Selected website media preview" />
      ) : null}
    </div>
  );
}

/* ----------------------- string_list --------------------- */
function StringList({ value, onChange, disabled, multiline }) {
  const list = Array.isArray(value) ? value : [];
  const update = (i, next) => {
    const out = [...list];
    out[i] = next;
    onChange(out);
  };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, ""]);
  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= list.length) return;
    const out = [...list];
    [out[i], out[target]] = [out[target], out[i]];
    onChange(out);
  };
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="website-manager__repeater">
      {list.map((item, i) => (
        <div key={i} className="website-manager__repeater-row">
          <Input
            className="app-input"
            type={multiline ? undefined : "text"}
            rows={multiline ? 2 : undefined}
            value={item || ""}
            onChange={(e) => update(i, e.target.value)}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => move(i, -1)}
            disabled={disabled || i === 0}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => move(i, 1)}
            disabled={disabled || i === list.length - 1}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => remove(i)}
            disabled={disabled}
            aria-label="Remove"
          >
            ×
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="xs" variant="secondary" onClick={add} disabled={disabled}>
          + Add
        </Button>
      </div>
    </div>
  );
}

/* ----------------------- object_list --------------------- */
function ObjectList({ value, onChange, disabled, itemSchema }) {
  const list = Array.isArray(value) ? value : [];
  const update = (i, next) => {
    const out = [...list];
    out[i] = next;
    onChange(out);
  };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const target = i + dir;
    if (target < 0 || target >= list.length) return;
    const out = [...list];
    [out[i], out[target]] = [out[target], out[i]];
    onChange(out);
  };
  const add = () => {
    const blank = Object.fromEntries(itemSchema.map((c) => [c.name, ""]));
    onChange([...list, blank]);
  };
  return (
    <div className="website-manager__repeater">
      {list.map((item, i) => (
        <LayerSurface
          key={i}
          className="website-manager__list-item"
          radius="var(--radius-sm)"
          padding="var(--space-3)"
          gap="var(--space-2)"
        >
          {itemSchema.map((col) => (
            <label key={col.name} className="website-manager__field">
              <span className="website-manager__label website-manager__label--sm">
                {col.label}
              </span>
              {renderField({
                field: col,
                value: item?.[col.name],
                onChange: (v) => update(i, { ...item, [col.name]: v }),
                disabled,
              })}
            </label>
          ))}
          <div className="website-manager__repeater-row website-manager__repeater-row--end">
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => move(i, -1)}
              disabled={disabled || i === 0}
            >
              ↑
            </Button>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => move(i, 1)}
              disabled={disabled || i === list.length - 1}
            >
              ↓
            </Button>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => remove(i)}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>
        </LayerSurface>
      ))}
      <div>
        <Button type="button" size="xs" variant="secondary" onClick={add} disabled={disabled}>
          + Add
        </Button>
      </div>
    </div>
  );
}
