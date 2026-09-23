// file location: src/features/tracking/equipment/EquipmentChecklistDrawer.js
//
// Manage the reusable inspection checklists (managers). A checklist applies to
// every asset of its category unless an asset names a different one; a
// checklist with no category is the general fallback. Checklists are switched
// off rather than deleted — past checks keep a copy of what they were done
// against.

import React, { useState } from "react";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import LayerTheme from "@/components/ui/LayerTheme";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_BY_KEY } from "@/config/equipmentTracking";
import {
  CheckboxField,
  ChoiceGroup,
  EquipmentDrawer,
  TextAreaField,
  toOptions,
} from "@/features/tracking/equipment/EquipmentFormControls";
import { saveEquipmentChecklist } from "@/features/tracking/equipment/equipmentClient";

const KIND_OPTIONS = [
  { key: "check", label: "Pass / fail" },
  { key: "reading", label: "Reading" },
];

const blankItem = () => ({ id: "", label: "", kind: "check", required: true, unit: "", min: "", max: "" });

const toForm = (checklist) => ({
  id: checklist?.id || null,
  name: checklist?.name || "",
  category: checklist?.category || "",
  description: checklist?.description || "",
  isActive: checklist ? checklist.isActive : true,
  items: checklist?.items?.length
    ? checklist.items.map((item) => ({ ...blankItem(), ...item, min: item.min ?? "", max: item.max ?? "" }))
    : [blankItem()],
});

function ChecklistEditor({ checklist, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(checklist));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setItem = (index, patch) =>
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  const moveItem = (index, delta) =>
    setForm((previous) => {
      const items = [...previous.items];
      const target = index + delta;
      if (target < 0 || target >= items.length) return previous;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...previous, items };
    });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(await saveEquipmentChecklist({ ...form, category: form.category || null }));
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <LayerTheme radius="var(--radius-sm)" padding="12px" gap="12px">
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      <div className="equipment-form__grid">
        <InputField label="Checklist name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <DropdownField
          label="Applies to"
          options={[{ key: "general", value: "", label: "Any equipment (general)" }, ...toOptions(EQUIPMENT_CATEGORIES)]}
          value={form.category}
          onValueChange={(value) => setForm({ ...form, category: value })}
          size="md"
        />
      </div>
      <TextAreaField label="Description" rows={2} value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
      <CheckboxField label="In use" checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />

      <h3 className="app-record-heading">Items</h3>
      <ol className="equipment-checklist">
        {form.items.map((item, index) => (
          <li key={index} className="equipment-checklist__item">
            <div className="equipment-form">
              <InputField
                label={`Item ${index + 1}`}
                value={item.label}
                onChange={(event) => setItem(index, { label: event.target.value })}
                placeholder="What to check"
              />
              <ChoiceGroup label="Type" options={KIND_OPTIONS} value={item.kind} onChange={(value) => setItem(index, { kind: value })} size="xs" />
              {item.kind === "reading" && (
                <div className="equipment-checklist__editor-row">
                  <InputField label="Unit" value={item.unit} onChange={(event) => setItem(index, { unit: event.target.value })} placeholder="e.g. bar" />
                  <InputField label="Min" type="number" step="any" value={item.min} onChange={(event) => setItem(index, { min: event.target.value })} />
                  <InputField label="Max" type="number" step="any" value={item.max} onChange={(event) => setItem(index, { max: event.target.value })} />
                </div>
              )}
              <CheckboxField label="Required" checked={item.required} onChange={(value) => setItem(index, { required: value })} />
            </div>
            <div className="app-record-actions">
              <Button type="button" variant="secondary" size="xs" disabled={index === 0} onClick={() => moveItem(index, -1)}>
                Up
              </Button>
              <Button type="button" variant="secondary" size="xs" disabled={index === form.items.length - 1} onClick={() => moveItem(index, 1)}>
                Down
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={form.items.length === 1}
                onClick={() => setForm((previous) => ({ ...previous, items: previous.items.filter((_, itemIndex) => itemIndex !== index) }))}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="app-record-actions">
        <Button type="button" variant="secondary" size="sm" onClick={() => setForm((previous) => ({ ...previous, items: [...previous.items, blankItem()] }))}>
          Add item
        </Button>
        <Button type="button" variant="primary" size="sm" busy={saving} disabled={saving} onClick={save}>
          Save checklist
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </LayerTheme>
  );
}

export default function EquipmentChecklistDrawer({ checklists, onChecklistSaved, onClose }) {
  const [editing, setEditing] = useState(null); // checklist object, "new", or null

  return (
    <EquipmentDrawer
      title="Inspection checklists"
      description="Reusable checklists by equipment type. An asset uses its own, then its category's, then the general one."
      onClose={onClose}
      headerActions={
        !editing && (
          <Button type="button" variant="primary" size="sm" onClick={() => setEditing("new")}>
            New checklist
          </Button>
        )
      }
    >
      {editing && (
        <ChecklistEditor
          key={editing === "new" ? "new" : editing.id}
          checklist={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            onChecklistSaved(saved);
            setEditing(null);
          }}
        />
      )}
      {!editing && checklists.length === 0 && <p className="app-record-note">No checklists yet.</p>}
      {!editing &&
        checklists.map((checklist) => (
          <LayerTheme key={checklist.id} radius="var(--radius-sm)" padding="12px" gap="6px">
            <div className="equipment-drawer__list-item">
              <div className="equipment-table__name">
                <span className="equipment-table__primary">{checklist.name}</span>
                <span className="equipment-table__secondary">
                  {checklist.category ? EQUIPMENT_CATEGORY_BY_KEY[checklist.category]?.label || checklist.category : "General"} ·{" "}
                  {checklist.items.length} item{checklist.items.length === 1 ? "" : "s"}
                  {checklist.isActive ? "" : " · switched off"}
                </span>
              </div>
              <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(checklist)}>
                Edit
              </Button>
            </div>
            {checklist.description && <p className="app-record-note">{checklist.description}</p>}
          </LayerTheme>
        ))}
    </EquipmentDrawer>
  );
}
