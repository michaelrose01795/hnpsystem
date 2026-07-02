// file location: src/features/tracking/map/TrackingMap.js
// CSS-only dealership site map for the /tracking Key/Parking tab, with a
// built-in layout editor. Edits are saved as they happen so a reload keeps
// added, deleted, moved, resized, rotated, and relabelled sections.
// Styles live in ./trackingMap.css, imported globally from src/pages/_app.js.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateParkingSpaces,
  createMapItem,
  getDefaultLayout,
  loadTrackingMapLayout,
  saveTrackingMapLayout,
} from "@/features/tracking/map/trackingMapLayout";

const TYPE_CLASS = { road: "road", building: "building", grass: "grass-island", parking: "map-parking", fence: "fence-line" };
const TYPE_LABEL = { road: "Road", building: "Building", grass: "Grass", parking: "Parking", fence: "Fence" };
const RADIUS_ALLOWED_TYPES = new Set(["building", "parking"]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MIN_ITEM_SIZE = 2;

export default function TrackingMap({ pins = [], onRefresh, onClose }) {
  const [items, setItems] = useState(() => loadTrackingMapLayout());
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const didMountRef = useRef(false);

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const persistItems = (nextItems) => {
    const saved = saveTrackingMapLayout(nextItems);
    setSaveState(saved ? "saved" : "error");
  };

  const setAndPersistItems = (updater) => {
    setItems((prev) => (typeof updater === "function" ? updater(prev) : updater));
  };

  const updateItem = (id, patch) =>
    setAndPersistItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const deleteItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    persistItems(items);
  }, [items]);

  useEffect(() => {
    if (!editMode || !selectedId) return undefined;
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Delete" || event.key === "Backspace") deleteItem(selectedId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteItem, editMode, selectedId]);

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
      orig: { x: item.x, y: item.y, w: item.w, h: item.h, rotate: Number(item.rotate) || 0 },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dxPx = event.clientX - drag.startX;
    const dyPx = event.clientY - drag.startY;
    if (drag.mode === "resize") {
      const angle = (drag.orig.rotate * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const localDx = ((dxPx * cos + dyPx * sin) / drag.rect.width) * 100;
      const localDy = ((-dxPx * sin + dyPx * cos) / drag.rect.height) * 100;
      updateItem(drag.id, {
        w: clamp(drag.orig.w + localDx, MIN_ITEM_SIZE, 100 - drag.orig.x),
        h: clamp(drag.orig.h + localDy, MIN_ITEM_SIZE, 100 - drag.orig.y),
      });
      return;
    }
    const dx = (dxPx / drag.rect.width) * 100;
    const dy = (dyPx / drag.rect.height) * 100;
    updateItem(drag.id, {
      x: clamp(drag.orig.x + dx, 0, 100 - drag.orig.w),
      y: clamp(drag.orig.y + dy, 0, 100 - drag.orig.h),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const addItem = (type, overrides) => {
    const item = createMapItem(type, overrides);
    setAndPersistItems((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const handleSaveLayout = () => {
    persistItems(items);
    setEditMode(false);
    setSelectedId(null);
  };

  const handleCloseEditor = () => {
    setItems(loadTrackingMapLayout());
    setEditMode(false);
    setSelectedId(null);
  };

  const handleClearMap = () => {
    if (!window.confirm("Clear the whole map? This saves a blank layout.")) return;
    const blankLayout = getDefaultLayout();
    setAndPersistItems(blankLayout);
    setSelectedId(null);
  };

  const handleCopyLayout = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(items, null, 2));
      alert("Layout JSON copied.");
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
          transformOrigin: "top left",
          ...(item.rotate ? { transform: `rotate(${item.rotate}deg)` } : null),
          ...(item.radius && RADIUS_ALLOWED_TYPES.has(item.type) ? { borderRadius: item.radius } : null),
        }}
        onPointerDown={editMode ? (event) => beginDrag(event, item, "move") : undefined}
        onPointerMove={editMode ? handlePointerMove : undefined}
        onPointerUp={editMode ? endDrag : undefined}
        onPointerCancel={editMode ? endDrag : undefined}
        onLostPointerCapture={editMode ? endDrag : undefined}
      >
        {item.type === "parking" && (
          <div className="map-parking-grid">
            {Array.from({ length: calculateParkingSpaces(item) }, (_, index) => (
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
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          />
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
              ? `Edit mode - changes save automatically${saveState === "error" ? " (save failed)" : ""}`
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
            <button type="button" className="tracking-map-button" onClick={handleCloseEditor}>
              Close editor
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
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("fence")}>
            + Fence line
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={() => addItem("parking")}>
            + Parking
          </button>
          <span className="tracking-map-editbar-spacer" />
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={handleCopyLayout}>
            Copy layout
          </button>
          <button type="button" className="tracking-map-button tracking-map-button--sm" onClick={handleClearMap}>
            Clear map
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
              placeholder="Optional label"
            />
          </label>
          {selectedItem.type === "parking" && (
            <div className="tracking-map-field">
              <span className="tracking-map-props-label">Spaces</span>
              <span className="tracking-map-readout">{calculateParkingSpaces(selectedItem)}</span>
            </div>
          )}
          <label className="tracking-map-field">
            <span className="tracking-map-props-label">Rotate deg</span>
            <input
              type="number"
              className="tracking-map-input"
              min={-180}
              max={180}
              value={Math.round(selectedItem.rotate || 0)}
              onChange={(event) => updateItem(selectedItem.id, { rotate: clamp(Number(event.target.value) || 0, -180, 180) })}
            />
          </label>
          <button
            type="button"
            className="tracking-map-button tracking-map-button--sm tracking-map-button--danger"
            onClick={() => deleteItem(selectedItem.id)}
          >
            Delete section
          </button>
        </div>
      )}

      <div
        ref={stageRef}
        className={`tracking-map-stage${editMode ? " tracking-map-stage--edit" : ""}`}
        onPointerDown={editMode ? () => setSelectedId(null) : undefined}
      >
        <div className="site-boundary">
          {items.map(renderItem)}

          {!editMode &&
            pins.map((pin) => (
              <div
                key={pin.id}
                className={`map-vehicle-pin ${pin.className || ""}`.trim()}
                style={pin.x != null && pin.y != null ? { left: `${pin.x}%`, top: `${pin.y}%` } : undefined}
                data-label={pin.label}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
