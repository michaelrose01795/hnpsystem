// file location: src/pages/tracking/index.js
"use client";

import React, { useMemo, useState } from "react";
import Layout from "@/components/Layout";

const CAR_LOCATIONS = [
  { id: "front-a", label: "Front Row – Bay A" },
  { id: "front-b", label: "Front Row – Bay B" },
  { id: "valet-1", label: "Valet Lane" },
  { id: "overflow-west", label: "Overflow – West Fence" },
  { id: "handover-suite", label: "Handover Suite" },
];

const KEY_LOCATIONS = [
  { id: "safe-a", label: "Key Safe A – Hooks 1-10" },
  { id: "safe-b", label: "Key Safe B – Hooks 11-20" },
  { id: "valet-pouch", label: "Valet Pouch Rack" },
  { id: "service-desk", label: "Service Desk Drawer" },
  { id: "afterhours-box", label: "After Hours Drop" },
];

const STATUS_COLORS = {
  "Awaiting Authorization": "#f97316",
  "Waiting For Collection": "#0ea5e9",
  "Ready For Collection": "#10b981",
  "Complete": "#10b981",
  "Valet Hold": "#a21caf",
  "In Transit": "#6366f1",
};

const initialTrackingEntries = [
  {
    id: "track-1001",
    jobNumber: "HNP-4821",
    reg: "GY21 HNP",
    customer: "Emma Lane",
    serviceType: "Major Service",
    status: "Waiting For Collection",
    parkedBy: "Tom Jackson",
    parkedAt: "09:45",
    updatedAt: "2024-05-06T09:45:00.000Z",
    vehicleLocation: "Front Row – Bay A",
    keyLocation: "Key Safe A – Hooks 1-10",
    keyTip: "Green tag #4",
    notes: "Customer collecting at 16:00",
  },
  {
    id: "track-1002",
    jobNumber: "HNP-4610",
    reg: "AB70 RFT",
    customer: "Caleb Howard",
    serviceType: "Warranty Repair",
    status: "Awaiting Authorization",
    parkedBy: "Maya Patel",
    parkedAt: "10:12",
    updatedAt: "2024-05-06T10:12:00.000Z",
    vehicleLocation: "Overflow – West Fence",
    keyLocation: "Key Safe B – Hooks 11-20",
    keyTip: "Yellow tag #12",
    notes: "Awaiting callback from customer",
  },
  {
    id: "track-1003",
    jobNumber: "HNP-4598",
    reg: "PX22 VHC",
    customer: "Gemma Price",
    serviceType: "Valet",
    status: "Valet Hold",
    parkedBy: "Valet Team",
    parkedAt: "11:05",
    updatedAt: "2024-05-06T11:05:00.000Z",
    vehicleLocation: "Valet Lane",
    keyLocation: "Valet Pouch Rack",
    keyTip: "Pouch slot 3",
    notes: "Interior detail in progress",
  },
  {
    id: "track-1004",
    jobNumber: "HNP-4580",
    reg: "HJ19 FBC",
    customer: "Zac Morgan",
    serviceType: "MOT & Service",
    status: "Ready For Collection",
    parkedBy: "Service Team",
    parkedAt: "08:55",
    updatedAt: "2024-05-06T08:55:00.000Z",
    vehicleLocation: "Handover Suite",
    keyLocation: "Service Desk Drawer",
    keyTip: "Drawer slot 2",
    notes: "Customer waiting with adviser",
  },
];

const emptyForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  vehicleLocation: CAR_LOCATIONS[0].label,
  keyLocation: KEY_LOCATIONS[0].label,
  keyTip: "",
  status: "Waiting For Collection",
  notes: "",
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "now";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.round(diff / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const UpdateRow = ({ entry, context }) => {
  const badge = context === "car" ? entry.vehicleLocation : entry.keyLocation;
  const secondary = context === "car" ? entry.status : entry.keyTip;
  const color = context === "car" ? STATUS_COLORS[entry.status] || "#9ca3af" : "#4338ca";

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "18px",
        border: "1px solid rgba(226,232,240,0.8)",
        background: "linear-gradient(180deg, #ffffff, #f8fafc)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>
            {entry.reg} • {entry.jobNumber}
          </strong>
          <p style={{ margin: "4px 0 0", color: "#64748b" }}>{entry.customer}</p>
        </div>
        <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Updated {formatRelativeTime(entry.updatedAt)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "#94a3b8" }}>
            {context === "car" ? "Current Bay" : "Key Location"}
          </p>
          <strong style={{ color: color }}>{badge}</strong>
          <p style={{ margin: "2px 0 0", color: context === "car" ? color : "#2563eb", fontSize: "0.85rem" }}>{secondary}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "#94a3b8" }}>Notes</p>
          <p style={{ margin: "2px 0 0", color: "#475569", maxWidth: "320px" }}>{entry.notes || "No notes"}</p>
        </div>
      </div>
    </div>
  );
};

const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "min(600px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", letterSpacing: "0.08em" }}>
              {type === "car" ? "Parking library" : "Key hook library"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>Search location</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(15,23,42,0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"}
          style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />

        <div style={{ maxHeight: "320px", overflow: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((option) => (
            <div
              key={option.id}
              style={{
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid #e0e7ff",
                background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "#0f172a" }}>{option.label}</strong>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(209,0,0,0.3)",
                  backgroundColor: "white",
                  color: "#a00000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Use location
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px dashed #e2e8f0",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              No locations found.
            </div>
          )}
        </div>

        {/* TODO: Replace static location lists with DB-driven results */}
      </div>
    </div>
  );
};

const LocationEntryModal = ({ context, entry, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: entry?.keyLocation || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection",
  }));

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 60,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "#94a3b8" }}>
              {context === "car" ? "Update vehicle location" : "Update key location"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{entry ? "Edit existing" : "Log new"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(15,23,42,0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821" },
            { label: "Registration", field: "reg", placeholder: "GY21 HNP" },
            { label: "Customer", field: "customer", placeholder: "Customer name" },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service..." },
          ].map((input) => (
            <label key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{input.label}</span>
              <input
                required
                value={form[input.field]}
                onChange={(event) => handleChange(input.field, event.target.value)}
                placeholder={input.placeholder}
                style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
              />
            </label>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Vehicle Location</span>
            <select
              value={form.vehicleLocation}
              onChange={(event) => handleChange("vehicleLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              {CAR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Key Location</span>
            <select
              value={form.keyLocation}
              onChange={(event) => handleChange("keyLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              {KEY_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Status</span>
            <select
              value={form.status}
              onChange={(event) => handleChange("status", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              {Object.keys(STATUS_COLORS).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Key Tag / Guidance</span>
          <input
            value={form.keyTip}
            onChange={(event) => handleChange("keyTip", event.target.value)}
            placeholder="Green tag #4, handover drawer, etc."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => handleChange("notes", event.target.value)}
            placeholder="Collection time, valet status, instructions..."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid #e5e7eb", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(15,23,42,0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(120deg, #d10000, #a00000)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save update
          </button>
        </div>

        {/* TODO: Persist vehicle/key updates via API endpoint */}
      </form>
    </div>
  );
};

export default function TrackingDashboard() {
  const [entries, setEntries] = useState(initialTrackingEntries);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });

  const recentEntries = useMemo(() => entries.slice(0, 3), [entries]);

  const openSearchModal = (type) => setSearchModal({ open: true, type });
  const closeSearchModal = () => setSearchModal({ open: false, type: null });

  const openEntryModal = (type, entry = null) => setEntryModal({ open: true, type, entry });
  const closeEntryModal = () => setEntryModal({ open: false, type: null, entry: null });

  const handleLocationSelect = (option) => {
    closeSearchModal();
    openEntryModal(searchModal.type, {
      ...emptyForm,
      vehicleLocation: searchModal.type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: searchModal.type === "key" ? option.label : KEY_LOCATIONS[0].label,
    });
  };

  const handleSave = (form) => {
    const now = new Date().toISOString();
    setEntries((prev) => {
      const next = form.id
        ? prev.map((item) => (item.id === form.id ? { ...item, ...form, updatedAt: now } : item))
        : [
            {
              ...form,
              id: `track-${Date.now()}`,
              parkedBy: "Auto Prompt",
              parkedAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
              updatedAt: now,
            },
            ...prev,
          ];
      return next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
    closeEntryModal();
  };

  return (
    <Layout>
      <div
        style={{
          padding: "32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
        }}
      >
        <section
          style={{
            padding: "24px",
            borderRadius: "24px",
            background: "white",
            border: "1px solid #ffe4e6",
            boxShadow: "0 18px 40px rgba(209,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.1em", color: "#9ca3af" }}>Parking Tracker</p>
              <h1 style={{ margin: "6px 0 0", fontSize: "1.4rem", color: "#0f172a" }}>Latest 3 vehicle updates</h1>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => openSearchModal("car")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(209,0,0,0.25)",
                  backgroundColor: "white",
                  color: "#a00000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Search location
              </button>
              <button
                type="button"
                onClick={() => openEntryModal("car")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(120deg, #d10000, #a00000)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add location
              </button>
            </div>
          </div>
          {recentEntries.map((entry) => (
            <UpdateRow key={`${entry.id}-car`} entry={entry} context="car" />
          ))}
        </section>

        <section
          style={{
            padding: "24px",
            borderRadius: "24px",
            background: "white",
            border: "1px solid #e0e7ff",
            boxShadow: "0 18px 40px rgba(79,70,229,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.1em", color: "#94a3b8" }}>Key Tracker</p>
              <h1 style={{ margin: "6px 0 0", fontSize: "1.4rem", color: "#0f172a" }}>Latest 3 key updates</h1>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => openSearchModal("key")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(99,102,241,0.35)",
                  backgroundColor: "white",
                  color: "#4338ca",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Search location
              </button>
              <button
                type="button"
                onClick={() => openEntryModal("key")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(120deg, #6366f1, #4338ca)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add location
              </button>
            </div>
          </div>
          {recentEntries.map((entry) => (
            <UpdateRow key={`${entry.id}-key`} entry={entry} context="key" />
          ))}
        </section>
      </div>

      {searchModal.open && (
        <LocationSearchModal
          type={searchModal.type}
          options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS}
          onClose={closeSearchModal}
          onSelect={handleLocationSelect}
        />
      )}

      {entryModal.open && (
        <LocationEntryModal
          context={entryModal.type}
          entry={entryModal.entry}
          onClose={closeEntryModal}
          onSave={handleSave}
        />
      )}
    </Layout>
  );
}
