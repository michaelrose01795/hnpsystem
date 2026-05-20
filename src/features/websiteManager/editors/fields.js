// file location: src/features/websiteManager/editors/fields.js
//
// Renders an input for a single schema field. Centralised so each field type
// (text, image_url, string_list, object_list, etc.) has exactly one
// implementation that the SectionEditor calls into.

import React from "react";
import Button from "@/components/ui/Button";

const inputStyle = { width: "100%" };

const smallLabel = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-1)",
  fontWeight: 700,
};

export function renderField({ field, value, onChange, disabled }) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className="app-input"
          rows={3}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...inputStyle, resize: "vertical" }}
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
          style={inputStyle}
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
          style={inputStyle}
        />
      );

    case "image_url":
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            className="app-input"
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="https://…"
            style={{ ...inputStyle, flex: 1 }}
          />
          {value ? (
            <img
              src={value}
              alt=""
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 6,
                background: "var(--theme)",
              }}
            />
          ) : null}
        </div>
      );

    case "select":
      return (
        <select
          className="app-input"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        >
          <option value="" disabled>
            Choose…
          </option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "status":
      return (
        <select
          className="app-input"
          value={value || "draft"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        >
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
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
          style={inputStyle}
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
          style={inputStyle}
        />
      );
  }
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
  const Input = multiline ? "textarea" : "input";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {list.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <Input
            className="app-input"
            type={multiline ? undefined : "text"}
            rows={multiline ? 2 : undefined}
            value={item || ""}
            onChange={(e) => update(i, e.target.value)}
            disabled={disabled}
            style={{ flex: 1, resize: "vertical" }}
          />
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => remove(i)}
            disabled={disabled}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" size="xs" variant="secondary" onClick={add} disabled={disabled}>
        + Add
      </Button>
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
  const add = () => {
    const blank = Object.fromEntries(itemSchema.map((c) => [c.name, ""]));
    onChange([...list, blank]);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((item, i) => (
        <div
          key={i}
          style={{
            padding: 10,
            background: "var(--theme)",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {itemSchema.map((col) => (
            <label key={col.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={smallLabel}>{col.label}</span>
              {renderField({
                field: col,
                value: item?.[col.name],
                onChange: (v) => update(i, { ...item, [col.name]: v }),
                disabled,
              })}
            </label>
          ))}
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => remove(i)}
            disabled={disabled}
            style={{ alignSelf: "flex-end" }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="xs" variant="secondary" onClick={add} disabled={disabled}>
        + Add
      </Button>
    </div>
  );
}
