// file location: src/pages/tracking/index.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";

const CAR_LOCATIONS = [
  {
    id: "front-a",
    label: "Front Row – Bay A",
    description: "Closest to reception, ideal for customers waiting on-site.",
  },
  {
    id: "front-b",
    label: "Front Row – Bay B",
    description: "Use for priority collections and mobility customers.",
  },
  {
    id: "valet-1",
    label: "Valet Lane",
    description: "Hand over to valet team for finishing touches.",
  },
  {
    id: "overflow-west",
    label: "Overflow – West Fence",
    description: "Long-stay vehicles or awaiting parts.",
  },
  {
    id: "handover-suite",
    label: "Handover Suite",
    description: "When customer is already on-site for handover.",
  },
];

const KEY_LOCATIONS = [
  {
    id: "safe-a",
    label: "Key Safe A – Hooks 1-10",
    tip: "Use green tags for service jobs.",
  },
  {
    id: "safe-b",
    label: "Key Safe B – Hooks 11-20",
    tip: "Use yellow tags for awaiting authorisation.",
  },
  {
    id: "valet-pouch",
    label: "Valet Pouch Rack",
    tip: "Only for valet team once vehicle is moved.",
  },
  {
    id: "service-desk",
    label: "Service Desk Drawer",
    tip: "Use when customer is in reception.",
  },
  {
    id: "afterhours-box",
    label: "After Hours Drop",
    tip: "Lock and log code in tracker notes.",
  },
];

const STATUS_COLORS = {
  "Awaiting Authorization": "#f59e0b",
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
  const minutes = Math.round(diff / (1000 * 60));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const TrackingStat = ({ label, value, sublabel, accent }) => (
  <div
    style={{
      padding: "16px 18px",
      borderRadius: "16px",
      background: "white",
      border: "1px solid rgba(209,0,0,0.08)",
      boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
      minWidth: "160px",
      flex: "1 1 160px",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.7rem", color: "#6b7280", letterSpacing: "0.08em" }}>{label}</p>
    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
      <span style={{ fontSize: "1.7rem", fontWeight: 700, color: accent || "#111827" }}>{value}</span>
      {sublabel && <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{sublabel}</span>}
    </div>
  </div>
);

const RecentUpdate = ({ entry, context, onEdit }) => (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: "14px",
      border: "1px solid #fce7f3",
      background: "linear-gradient(180deg, #ffffff, #fff5f7)",
      display: "flex",
      justifyContent: "space-between",
      gap: "12px",
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <div style={{ minWidth: "200px" }}>
      <p style={{ margin: 0, fontSize: "0.7rem", color: "#9ca3af", letterSpacing: "0.08em" }}>Reg / Job</p>
      <strong style={{ fontSize: "1rem", color: "#111827" }}>
        {entry.reg} • {entry.jobNumber}
      </strong>
      <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>{entry.customer}</p>
    </div>
    <div style={{ minWidth: "180px" }}>
      <p style={{ margin: 0, fontSize: "0.7rem", color: "#9ca3af", letterSpacing: "0.08em" }}>
        {context === "car" ? "Vehicle Location" : "Key Location"}
      </p>
      <strong style={{ color: "#111827" }}>
        {context === "car" ? entry.vehicleLocation : entry.keyLocation}
      </strong>
      <p style={{ margin: "2px 0 0", color: context === "car" ? "#64748b" : "#2563eb", fontSize: "0.85rem" }}>
        {context === "car" ? entry.status : entry.keyTip}
      </p>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{formatRelativeTime(entry.updatedAt)}</span>
      <button
        type="button"
        onClick={() => onEdit(entry)}
        style={{
          padding: "8px 14px",
          borderRadius: "10px",
          border: "1px solid rgba(209,0,0,0.3)",
          backgroundColor: "white",
          color: "#a00000",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Update
      </button>
    </div>
  </div>
);

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
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: "min(640px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "#9ca3af" }}>
              {type === "car" ? "Search where to park" : "Search key drop"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{type === "car" ? "Parking Library" : "Key Location Library"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "999px",
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
          placeholder={type === "car" ? "Search bays, overflow, valet..." : "Search key safes, drawers..."}
          style={{
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid #e5e7eb",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "320px", overflowY: "auto" }}>
          {filtered.map((option) => (
            <div
              key={option.id}
              style={{
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid #e0e7ff",
                background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <strong style={{ color: "#111827" }}>{option.label}</strong>
              <p style={{ margin: 0, color: "#6b7280" }}>{option.description || option.tip}</p>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  alignSelf: "flex-start",
                  marginTop: "8px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(209,0,0,0.3)",
                  backgroundColor: "white",
                  color: "#a00000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Use this {type === "car" ? "parking bay" : "key drop"}
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                border: "1px dashed #e5e7eb",
                textAlign: "center",
                color: "#9ca3af",
              }}
            >
              No options match that search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UpdatesModal = ({ type, entries, onClose, onEdit }) => {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => {
    const haystack = `${entry.reg} ${entry.jobNumber} ${entry.customer}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 55,
      }}
    >
      <div
        style={{
          width: "min(900px, 100%)",
          maxHeight: "90vh",
          overflow: "hidden",
          background: "white",
          borderRadius: "28px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "#9ca3af" }}>
              {type === "car" ? "Vehicle updates" : "Key updates"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{type === "car" ? "Parking activity" : "Key tracker activity"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "999px",
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
          placeholder="Search reg, job number, customer"
          style={{
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid #e5e7eb",
          }}
        />

        <div style={{ overflowY: "auto", paddingRight: "6px", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((entry) => (
            <div
              key={`${entry.id}-${type}`}
              style={{
                padding: "18px 20px",
                borderRadius: "20px",
                border: "1px solid #f1f5f9",
                background: "linear-gradient(180deg, #ffffff, #f8fafc)",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: "240px" }}>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "0.08em" }}>Vehicle</p>
                <strong style={{ color: "#0f172a" }}>
                  {entry.reg} • {entry.jobNumber}
                </strong>
                <p style={{ margin: "4px 0 0", color: "#475569" }}>{entry.customer}</p>
                <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>{entry.serviceType}</p>
              </div>

              <div style={{ minWidth: "200px" }}>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "0.08em" }}>
                  {type === "car" ? "Current bay" : "Key location"}
                </p>
                <strong style={{ color: "#0f172a" }}>
                  {type === "car" ? entry.vehicleLocation : entry.keyLocation}
                </strong>
                <p style={{ margin: "2px 0 0", color: type === "car" ? "#0ea5e9" : "#6366f1", fontSize: "0.85rem" }}>
                  {type === "car" ? entry.status : entry.keyTip}
                </p>
              </div>

              <div style={{ minWidth: "200px" }}>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "0.08em" }}>Notes</p>
                <p style={{ margin: "2px 0 0", color: "#475569" }}>{entry.notes || "No notes"}</p>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Updated {formatRelativeTime(entry.updatedAt)}</span>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <Link
                  href={`/job-cards/${encodeURIComponent(entry.jobNumber)}/vhc`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(15,23,42,0.2)",
                    textDecoration: "none",
                    color: "#0f172a",
                    fontWeight: 600,
                  }}
                >
                  Open Job
                </Link>
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(120deg, #d10000, #a00000)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "32px",
                borderRadius: "18px",
                border: "1px dashed #cbd5f5",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              Nothing logged yet. Search with a different term.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrackingModal = ({ mode, entry, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: entry?.keyLocation || KEY_LOCATIONS[0].label,
    status: entry?.status || (mode === "car" ? "Complete" : "Waiting For Collection"),
  }));

  useEffect(() => {
    setForm({
      ...emptyForm,
      ...entry,
      vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
      keyLocation: entry?.keyLocation || KEY_LOCATIONS[0].label,
      status: entry?.status || (mode === "car" ? "Complete" : "Waiting For Collection"),
    });
  }, [entry, mode]);

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
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "#9ca3af" }}>
              {mode === "car" ? "Parking prompt" : "Key prompt"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{entry ? "Update log" : "Log new vehicle"}</h2>
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
            gap: "12px",
          }}
        >
          {[
            { label: "Job Number", field: "jobNumber", placeholder: "e.g. HNP-4821" },
            { label: "Registration", field: "reg", placeholder: "e.g. GY21 HNP" },
            { label: "Customer", field: "customer", placeholder: "Customer name" },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service, Valet..." },
          ].map((input) => (
            <label key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{input.label}</span>
              <input
                required
                value={form[input.field]}
                onChange={(e) => handleChange(input.field, e.target.value)}
                placeholder={input.placeholder}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                }}
              />
            </label>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Vehicle Location</span>
            <select
              value={form.vehicleLocation}
              onChange={(e) => handleChange("vehicleLocation", e.target.value)}
              style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              {CAR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Key Location</span>
            <select
              value={form.keyLocation}
              onChange={(e) => handleChange("keyLocation", e.target.value)}
              style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              {KEY_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Status</span>
            <select
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
              style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
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
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Key Guidance</span>
          <input
            value={form.keyTip}
            onChange={(e) => handleChange("keyTip", e.target.value)}
            placeholder="e.g. Green tag #4, logged in key safe"
            style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Collection time, valet instructions, etc."
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              resize: "vertical",
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
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
              padding: "10px 18px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(120deg, #d10000, #a00000)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Tracking
          </button>
        </div>
      </form>
    </div>
  );
};

export default function TrackingDashboard() {
  const [entries, setEntries] = useState(initialTrackingEntries);
  const [modalState, setModalState] = useState({ open: false, mode: "car", entry: null });
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [updatesModal, setUpdatesModal] = useState({ open: false, type: null });

  const carStats = useMemo(() => {
    const awaiting = entries.filter((item) => item.status === "Awaiting Authorization").length;
    const ready = entries.filter((item) =>
      ["Ready For Collection", "Waiting For Collection"].includes(item.status)
    ).length;
    const valet = entries.filter((item) => item.serviceType.toLowerCase().includes("valet")).length;
    return {
      total: entries.length,
      awaiting,
      ready,
      valet,
    };
  }, [entries]);

  const recommendedKey = useMemo(() => {
    return (
      KEY_LOCATIONS.find((slot) => !entries.some((entry) => entry.keyLocation === slot.label)) ||
      KEY_LOCATIONS[0]
    );
  }, [entries]);

  const recentEntries = useMemo(() => entries.slice(0, 3), [entries]);

  const openModal = (mode, entry = null) => {
    setModalState({ open: true, mode, entry });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: "car", entry: null });
  };

  const openSearch = (type) => setSearchModal({ open: true, type });
  const closeSearch = () => setSearchModal({ open: false, type: null });

  const openUpdates = (type) => setUpdatesModal({ open: true, type });
  const closeUpdates = () => setUpdatesModal({ open: false, type: null });

  const handleSearchSelect = (type, option) => {
    closeSearch();
    const base = {
      ...emptyForm,
      vehicleLocation: type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: type === "key" ? option.label : recommendedKey.label,
    };

    if (type === "car") {
      openModal("car", { ...base, notes: option.description });
    } else {
      openModal("key", { ...base, keyTip: option.tip });
    }
  };

  const handleSave = (form) => {
    setEntries((prev) => {
      if (form.id) {
        return prev
          .map((item) =>
            item.id === form.id
              ? {
                  ...item,
                  ...form,
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      }

      const now = new Date();
      const newEntry = {
        ...form,
        id: `track-${Date.now()}`,
        parkedBy: "Auto Prompt",
        parkedAt: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        updatedAt: now.toISOString(),
      };
      return [newEntry, ...prev];
    });
    closeModal();
  };

  return (
    <Layout>
      <div
        style={{
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <section
          style={{
            borderRadius: "32px",
            padding: "32px",
            background: "linear-gradient(135deg, #d10000, #7f1d1d)",
            color: "white",
            display: "flex",
            flexWrap: "wrap",
            gap: "32px",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <p style={{ margin: 0, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.8rem" }}>
              Tracking Hub
            </p>
            <h1 style={{ margin: "10px 0 12px", fontSize: "2rem" }}>Vehicle & Key Tracker</h1>
            <p style={{ margin: 0, maxWidth: "520px", lineHeight: 1.6 }}>
              Keep the handover area tidy and every hook labelled. Use the quick buttons below to
              search parking suggestions, update a log, or review the latest actions without
              scrolling a long board.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <TrackingStat label="Vehicles Logged" value={carStats.total} accent="#ffffff" />
            <TrackingStat label="Awaiting Auth" value={carStats.awaiting} sublabel="Need call" accent="#fde68a" />
            <TrackingStat label="Ready/Waiting" value={carStats.ready} sublabel="Collection queue" accent="#a7f3d0" />
            <TrackingStat label="Valet Queue" value={carStats.valet} sublabel="Needing wash" accent="#f0abfc" />
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderRadius: "24px",
              background: "white",
              border: "1px solid #ffe4e6",
              boxShadow: "0 18px 40px rgba(209,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#9ca3af", letterSpacing: "0.1em" }}>Car Tracker</p>
                <h2 style={{ margin: "4px 0 0" }}>Latest Parking Updates</h2>
              </div>
              <span style={{ fontSize: "0.85rem", color: "#d10000", fontWeight: 600 }}>
                {recentEntries.length} updated today
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentEntries.map((entry) => (
                <RecentUpdate key={`${entry.id}-car`} entry={entry} context="car" onEdit={(row) => openModal("car", row)} />
              ))}
              {recentEntries.length === 0 && (
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "18px",
                    border: "1px dashed #fecdd3",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  No vehicles updated yet today.
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <button
                type="button"
                onClick={() => openSearch("car")}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(209,0,0,0.3)",
                  backgroundColor: "white",
                  color: "#a00000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Search parking spots
              </button>
              <button
                type="button"
                onClick={() => openModal("car")}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(120deg, #d10000, #a00000)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Update car location
              </button>
              <button
                type="button"
                onClick={() => openUpdates("car")}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "1px dashed rgba(209,0,0,0.3)",
                  backgroundColor: "white",
                  color: "#a00000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View full parking log
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              borderRadius: "24px",
              background: "white",
              border: "1px solid #e0e7ff",
              boxShadow: "0 18px 40px rgba(79,70,229,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", letterSpacing: "0.1em" }}>Key Tracker</p>
                <h2 style={{ margin: "4px 0 0" }}>Latest Key Updates</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>Suggested drop</span>
                <strong>{recommendedKey.label}</strong>
                <p style={{ margin: 0, color: "#0ea5e9" }}>{recommendedKey.tip}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentEntries.map((entry) => (
                <RecentUpdate key={`${entry.id}-key`} entry={entry} context="key" onEdit={(row) => openModal("key", row)} />
              ))}
              {recentEntries.length === 0 && (
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "18px",
                    border: "1px dashed #cbd5f5",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No key updates yet today.
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <button
                type="button"
                onClick={() => openSearch("key")}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(99,102,241,0.35)",
                  backgroundColor: "white",
                  color: "#4338ca",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Search key hooks
              </button>
              <button
                type="button"
                onClick={() => openModal("key")}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(120deg, #6366f1, #4338ca)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Update key location
              </button>
              <button
                type="button"
                onClick={() => openUpdates("key")}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "1px dashed rgba(99,102,241,0.35)",
                  backgroundColor: "white",
                  color: "#4338ca",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View key tracking log
              </button>
            </div>
          </div>
        </section>
      </div>

      {modalState.open && (
        <TrackingModal
          mode={modalState.mode}
          entry={modalState.entry}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {searchModal.open && (
        <LocationSearchModal
          type={searchModal.type}
          options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS}
          onClose={closeSearch}
          onSelect={(option) => handleSearchSelect(searchModal.type, option)}
        />
      )}

      {updatesModal.open && (
        <UpdatesModal
          type={updatesModal.type}
          entries={entries}
          onClose={closeUpdates}
          onEdit={(entry) => {
            closeUpdates();
            openModal(updatesModal.type === "car" ? "car" : "key", entry);
          }}
        />
      )}
    </Layout>
  );
}
