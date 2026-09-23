// file location: src/features/stockControl/StockSettingsModal.js
//
// Configure stock categories and locations (capability: configure). Entries
// are renamed or retired — never deleted — so historic items and movements
// keep their category / location for reporting.

import React, { useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { Button, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import { saveStockSetting } from "@/features/stockControl/stockClient";

function EntryRow({ kind, entry, onSaved, setError }) {
  const [name, setName] = useState(entry.name);
  const [department, setDepartment] = useState(entry.department || "");
  const [busy, setBusy] = useState(false);
  const dirty = name !== entry.name || (kind === "location" && department !== (entry.department || ""));

  const save = async (patch) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(kind, await saveStockSetting({ kind, id: entry.id, ...patch }));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stock-calibration__row">
      <InputField aria-label={`${kind} name`} value={name} onChange={(e) => setName(e.target.value)} />
      {kind === "location" ? (
        <InputField aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
      ) : (
        <span className="stock-hint">{entry.isActive ? "Active" : "Retired"}</span>
      )}
      <span className="stock-inline-actions">
        {dirty && (
          <Button type="button" variant="primary" size="sm" symbol={false} busy={busy} onClick={() => save({ name, ...(kind === "location" ? { department } : {}) })}>
            Save
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" symbol={false} busy={busy && !dirty} onClick={() => save({ isActive: !entry.isActive })}>
          {entry.isActive ? "Retire" : "Reactivate"}
        </Button>
      </span>
    </div>
  );
}

export default function StockSettingsModal({ categories, locations, onClose, onSaved }) {
  const [tab, setTab] = useState("category");
  const [newName, setNewName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const entries = tab === "category" ? categories : locations;

  const add = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(tab, await saveStockSetting({ kind: tab, name: newName, ...(tab === "location" ? { department: newDepartment } : {}) }));
      setNewName("");
      setNewDepartment("");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel="Stock settings" cardClassName="app-settings-popup-card stock-popup">
      <div className="app-settings-popup stock-form">
        <header className="app-popup-compact-header">
          <h2>Stock Settings</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        <TabGroup
          items={[
            { label: "Categories", value: "category" },
            { label: "Locations", value: "location" },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Stock settings"
        />
        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          {entries.map((entry) => (
            <EntryRow key={entry.id} kind={tab} entry={entry} onSaved={onSaved} setError={setError} />
          ))}
          {entries.length === 0 && <p className="stock-hint">Nothing set up yet.</p>}
        </LayerTheme>
        <form className="stock-calibration__row" onSubmit={add}>
          <InputField label={`New ${tab}`} value={newName} onChange={(e) => setNewName(e.target.value)} />
          {tab === "location" ? (
            <InputField label="Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. Workshop" />
          ) : (
            <span />
          )}
          <Button type="submit" variant="primary" size="sm" symbol={false} busy={busy} disabled={!newName.trim()}>
            Add
          </Button>
        </form>
        <p className="stock-hint">Retired entries stay on existing items and history but are no longer offered for new items.</p>
      </div>
    </PopupModal>
  );
}
