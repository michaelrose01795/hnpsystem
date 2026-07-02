// file location: src/features/tracking/map/TrackingMap.js
// CSS-only dealership site map for the /tracking Key/Parking tab, with a
// built-in layout editor (Edit → drag / resize / add / delete sections →
// Save captures every position as the fixed layout — see trackingMapLayout.js).
// Styles live in ./trackingMap.css, imported globally from src/pages/_app.js
// (the Pages Router only allows plain-CSS imports there).

import React, { useEffect, useRef, useState } from "react";
import {
  createMapItem,
  getDefaultLayout,
  loadTrackingMapLayout,
  saveTrackingMapLayout,
} from "@/features/tracking/map/trackingMapLayout";

// Default pins shown until live positions are wired in. x/y are % offsets
// inside .tracking-map-stage so pins scale with the map.
const DEFAULT_PINS = [
  { id: "pin-1", className: "pin-1", label: "Car on site" },
  { id: "pin-2", className: "pin-2", label: "Key held" },
  { id: "pin-3", className: "pin-3", label: "Awaiting movement" },
];

const TYPE_CLASS = { road: "road", building: "building", grass: "grass-island", parking: "map-parking" };
const TYPE_LABEL = { road: "Road", building: "Building", grass: "Grass", parking: "Parking" };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clampSpaces = (spaces) => clamp(Math.round(Number(spaces) || 1), 1, 200);

export default function TrackingMap({ pins = DEFAULT_PINS, onRefresh, onClose }) {
  const [items, setItems] = useState(() => loadTrackingMapLayout());
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null); // active move/resize gesture

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const updateItem = (id, patch) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  // Delete/Backspace removes the selected section — ignored while typing in
  // the properties inputs so editing a label never deletes the section.
  useEffect(() => {
    if (!editMode || !selectedId) return undefined;
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Delete" || event.key === "Backspace") deleteItem(selectedId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedId]);

  const beginDrag = (event, item, mode) => {
    if (!editMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    const stage = stageRef.current;
    if (!stage) return;
    dragRef.current = {
      id: item.id,
      mode,
      rect: stage.getBoundingClientRect(),
      startX: event.clientX,
      startY: event.clientY,
      orig: { x: item.x, y: item.y, w: item.w, h: item.h },
    };
    // Route the rest of the gesture to this element even when the pointer
    // outruns it mid-drag.
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    if (drag.mode === "resize") {
      updateItem(drag.id, {
        w: clamp(drag.orig.w + dx, 2, 120),
        h: clamp(drag.orig.h + dy, 2, 120),
      });
    } else {
      // Loose clamp — sections may intentionally hang past the clipped boundary.
      updateItem(drag.id, {
        x: clamp(drag.orig.x + dx, -40, 100),
        y: clamp(drag.orig.y + dy, -40, 100),
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const addItem = (type, overrides) => {
    const item = createMapItem(type, overrides);
    setItems((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const handleSaveLayout = () => {
    saveTrackingMapLayout(items);
    setEditMode(false);
    setSelectedId(null);
  };

  const handleCancelEdit = () => {
    setItems(loadTrackingMapLayout()); // discard unsaved edits
    setEditMode(false);
    setSelectedId(null);
  };

  const handleResetLayout = () => {
    if (!window.confirm("Reset the map to the default layout? (Takes effect when you press Save.)")) return;
    setItems(getDefaultLayout());
    setSelectedId(null);
  };

  // Export the layout so it can be pasted over DEFAULT_LAYOUT in
  // trackingMapLayout.js — that bakes it in for every user, not just this browser.
  const handleCopyLayout = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(items, null, 2));
      alert("Layout JSON copied. Paste it over DEFAULT_LAYOUT in trackingMapLayout.js to hardcode it for everyone.");
    } catch {
      alert("Could not copy the layout JSON to the clipboard.");
    }
  };

  const renderItem = (item) => {
    const isSelected = editMode && item.id === selectedId;
    const classes = [
      "map-item",
      TYPE_CLASS[item.type],
      item.variant,
      isSelected ? "map-item--selected" : "",
    ].filter(Boolean).join(" ");

    return (
      <div
        key={item.id}
        className={classes}
        style={{
          left: `${item.x}%`,
          top: `${item.y}%`,
          width: `${item.w}%`,
          height: `${item.h}%`,
          ...(item.rotate ? { transform: `rotate(${item.rotate}deg)` } : null),
          ...(item.radius ? { borderRadius: item.radius } : null),
        }}
        onPointerDown={editMode ? (event) => beginDrag(event, item, "move") : undefined}
        onPointerMove={editMode ? handlePointerMove : undefined}
        onPointerUp={editMode ? endDrag : undefined}>

        {item.type === "parking" && (
          <div className="map-parking-grid">
            {Array.from({ length: clampSpaces(item.spaces) }, (_, index) => (
              <span key={index} className="map-parking-space" />
            ))}
          </div>
        )}
        {item.label ? <span className="map-item-label">{item.label}</span> : null}
        {isSelected && (
          <span
            className="map-resize-handle"
            aria-label="Resize section"
            onPointerDown={(event) => beginDrag(event, item, "resize")}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag} />
        )}
      </div>
    );
  };

  return (
    <div className="tracking-map-shell">
      <div className="tracking-map-toolbar">
        <div>
          <div className="tracking-map-title">Site Map</div>
          <div className="tracking-map-subtitle">
            {editMode
              ? "Edit mode — drag to move, corner handle to resize, Save to lock positions in"
              : "Key and car tracking location overview"}
          </div>
        </div>

        <div className="tracking-map-actions">
          {!editMode && onRefresh && (
            <button type="button" className="tracking-map-button" onClick={onRefresh}>
              Refresh locations
            </button>
          )}
          {!editMode && (
            <button type="button" className="tracking-map-button" onClick={() => setEditMode(true)}>
              Edit map
            </button>
          )}
          {editMode && (
            <button type="button" className="tracking-map-button tracking-map-button--primary" onClick={handleSaveLayout}>
              Save layout
            </button>
          )}
          {editMode && (
            <button type="button" className="tracking-map-button" onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
          {onClose && (
            <button type="button" className="tracking-map-button" onClick={onClose} aria-label="Close site map">
              Close
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="tracking-map-editbar">
          <span className="tracking-map-props-label">Add section:</span>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("building")}>
            + Building
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("road")}>
            + Road
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("grass")}>
            + Grass
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("parking", { spaces: 10, w: 18, h: 5 })}>
            + Parking ×10
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("parking", { spaces: 50, w: 30, h: 12 })}>
            + Parking ×50
          </button>
          <span className="tracking-map-editbar-spacer" />
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={handleCopyLayout}>
            Copy layout
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={handleResetLayout}>
            Reset to default
          </button>
        </div>
      )}

      {editMode && selectedItem && (
        <div className="tracking-map-props">
          <span className="tracking-map-props-label">{TYPE_LABEL[selectedItem.type]} selected</span>
          <label className="tracking-map-field">
            <span className="tracking-map-props-label">Label</span>
            <input
              type="text"
              className="tracking-map-input tracking-map-input--wide"
              value={selectedItem.label || ""}
              onChange={(event) => updateItem(selectedItem.id, { label: event.target.value })}
              placeholder="Optional label" />
          </label>
          {selectedItem.type === "parking" && (
            <label className="tracking-map-field">
              <span className="tracking-map-props-label">Spaces</span>
              <input
                type="number"
                className="tracking-map-input"
                min={1}
                max={200}
                value={clampSpaces(selectedItem.spaces)}
                onChange={(event) => updateItem(selectedItem.id, { spaces: clampSpaces(event.target.value) })} />
            </label>
          )}
          <label className="tracking-map-field">
            <span className="tracking-map-props-label">Rotate°</span>
            <input
              type="number"
              className="tracking-map-input"
              min={-180}
              max={180}
              value={Math.round(selectedItem.rotate || 0)}
              onChange={(event) => updateItem(selectedItem.id, { rotate: clamp(Number(event.target.value) || 0, -180, 180) })} />
          </label>
          <button
            type="button"
            className="tracking-map-button tracking-map-button--sm tracking-map-button--danger"
            onClick={() => deleteItem(selectedItem.id)}>
            Delete section
          </button>
        </div>
      )}

      <div
        ref={stageRef}
        className={`tracking-map-stage${editMode ? " tracking-map-stage--edit" : ""}`}
        // Clicking empty tarmac/yard clears the selection.
        onPointerDown={editMode ? () => setSelectedId(null) : undefined}>

        <div className="site-boundary">
          <div className="map-yard-texture" />

          {items.map(renderItem)}

          {!editMode &&
            pins.map((pin) => (
              <div
                key={pin.id}
                className={`map-vehicle-pin ${pin.className || ""}`.trim()}
                // Custom % coordinates win over the preset pin-N classes.
                style={pin.x != null && pin.y != null ? { left: `${pin.x}%`, top: `${pin.y}%` } : undefined}
                data-label={pin.label} />
            ))}
        </div>
      </div>
    </div>
  );
}
