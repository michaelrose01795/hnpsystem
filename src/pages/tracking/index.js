// file location: src/pages/tracking/index.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { buildApiUrl } from "@/utils/apiClient";
import { fetchTrackingSnapshot } from "@/lib/database/tracking";
import { supabaseClient } from "@/lib/supabaseClient";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { CalendarField } from "@/components/calendarAPI";

const CAR_LOCATIONS = [
  { id: "service-side", label: "Service side" },
  { id: "sales-side", label: "Sales side" },
  { id: "staff-parking", label: "Staff parking" },
];

const KEY_LOCATION_GROUPS = [
  {
    title: "Showroom Cupboard",
    options: [
      { id: "showroom-main", label: "Main" },
    ],
  },
  {
    title: "Workshop Cupboard",
    options: [
      { id: "workshop-jobs-to-start", label: "Jobs to be Started" },
      { id: "workshop-jobs-in-progress", label: "Jobs in Progress" },
      { id: "workshop-mot", label: "MOT" },
      { id: "workshop-wash", label: "Wash" },
      { id: "workshop-complete", label: "Complete" },
    ],
  },
];

const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    id: option.id,
    label: `${group.title} – ${option.label}`,
    group: group.title,
  }))
);

const AUTO_MOVEMENT_RULES = {
  "workshop in progress": {
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleLocation: "In Workshop",
    vehicleStatus: "In Workshop",
  },
  wash: {
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  complete: {
    keyLocation: "Workshop Cupboard – Complete",
    vehicleLocation: "Ready for Release",
    vehicleStatus: "Ready for Release",
  },
};

const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[status.trim().toLowerCase()] || null;
};

const STATUS_COLORS = {
  "Awaiting Authorization": "var(--danger)",
  "Waiting For Collection": "var(--info)",
  "Ready For Collection": "var(--info)",
  "Complete": "var(--info)",
  "Valet Hold": "var(--accent-orange)",
  "In Transit": "var(--accent-purple)",
};

const NEXT_ACTION_ENDPOINT = "/api/tracking/next-action";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_EQUIPMENT_CHECKS = [];

const DEFAULT_OIL_CHECKS = [];

const formatDateLabel = (value) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDueLabel = (value) => {
  if (!value) return "Schedule pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Schedule pending";
  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const days = Math.ceil(diff / MS_PER_DAY);
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
};

const nextDueFrom = (reference, intervalDays = 7) => {
  const baseTime =
    reference instanceof Date ? reference.getTime() : Number(reference || Date.now());
  const days = Number.isFinite(Number(intervalDays)) ? Number(intervalDays) : 7;
  return new Date(baseTime + days * MS_PER_DAY).toISOString();
};

const cloneList = (list) => list.map((entry) => ({ ...entry }));

const SECTION_STYLE = {
  padding: "24px",
  borderRadius: "24px",
  background: "var(--surface)",
  border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

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

const CombinedTrackerCard = ({ entry, isHighlighted }) => {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "16px",
        border: isHighlighted ? "2px solid var(--danger)" : "1px solid rgba(var(--grey-accent-rgb), 0.3)",
        background: isHighlighted ? "rgba(var(--danger-rgb), 0.05)" : "var(--surface)",
        boxShadow: isHighlighted ? "0 4px 12px rgba(var(--danger-rgb), 0.2)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <div>
          <strong style={{ fontSize: "1.05rem", color: "var(--accent-purple)" }}>{entry.jobNumber || "Unknown job"}</strong>
          <p style={{ margin: "2px 0 0", color: "var(--info-dark)" }}>{entry.customer || "Customer pending"}</p>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Updated {formatRelativeTime(entry.updatedAt)}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Vehicle</p>
          <strong style={{ color: "var(--accent-purple)" }}>{entry.reg || "Unknown reg"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Car location</p>
          <strong style={{ color: "var(--success-dark)" }}>{entry.vehicleLocation || "Unallocated"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Key location</p>
          <strong style={{ color: "var(--accent-purple)" }}>{entry.keyLocation || "Pending"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Last move</p>
          <strong style={{ color: "var(--accent-purple)" }}>{formatRelativeTime(entry.updatedAt)}</strong>
        </div>
      </div>

      <p style={{ margin: 0, color: "var(--info-dark)" }}>{entry.notes || "No additional notes"}</p>
    </div>
  );
};

const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 200,
      }}
    >
      <div
        style={{
          ...popupCardStyles,
          width: "min(600px, 100%)",
          background: "var(--search-surface)",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          border: "1px solid var(--search-surface-muted)",
          color: "var(--search-text)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info)", letterSpacing: "0.08em" }}>
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
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"}
          style={{
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid var(--search-surface-muted)",
            backgroundColor: "var(--search-surface)",
            color: "var(--search-text)",
          }}
        />

        <div style={{ maxHeight: "320px", overflow: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((option) => (
            <div
              key={option.id}
              style={{
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid var(--search-surface-muted)",
                background: "var(--search-surface)",
                color: "var(--search-text)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "var(--accent-purple)" }}>{option.label}</strong>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(var(--primary-rgb),0.3)",
                  backgroundColor: "var(--surface)",
                  color: "var(--primary-dark)",
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
                border: "1px dashed var(--search-surface-muted)",
                textAlign: "center",
                color: "var(--search-text)",
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

const EquipmentToolsModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({
    name: "",
    lastCheckedDate: "",
    nextDueDate: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name) {
      alert("Please enter equipment name");
      return;
    }

    // Convert dates to ISO strings
    const lastChecked = form.lastCheckedDate
      ? new Date(`${form.lastCheckedDate}T00:00:00`).toISOString()
      : null;
    const nextDue = form.nextDueDate
      ? new Date(`${form.nextDueDate}T00:00:00`).toISOString()
      : null;

    onSave({
      name: form.name,
      lastChecked,
      nextDue,
    });
  };

  return (
    <div style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(600px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Add Equipment/Tools</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Name *
          </label>
          <input
            required
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Equipment name"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Last Checked
          </label>
          <CalendarField
            value={form.lastCheckedDate}
            onChange={(e) => handleChange("lastCheckedDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Next Due
          </label>
          <CalendarField
            value={form.nextDueDate}
            onChange={(e) => handleChange("nextDueDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              backgroundColor: "transparent",
              color: "var(--text)",
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
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
};

const OilStockModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({
    stock: "",
    title: "",
    lastCheckDate: "",
    nextCheckDate: "",
    lastToppedUpDate: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title) {
      alert("Please enter title");
      return;
    }

    // Convert dates to ISO strings
    const lastCheck = form.lastCheckDate
      ? new Date(`${form.lastCheckDate}T00:00:00`).toISOString()
      : null;
    const nextCheck = form.nextCheckDate
      ? new Date(`${form.nextCheckDate}T00:00:00`).toISOString()
      : null;
    const lastToppedUp = form.lastToppedUpDate
      ? new Date(`${form.lastToppedUpDate}T00:00:00`).toISOString()
      : null;

    onSave({
      title: form.title,
      stock: form.stock,
      lastCheck,
      nextCheck,
      lastToppedUp,
    });
  };

  return (
    <div style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(650px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Add Oil / Stock</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Title *
          </label>
          <input
            required
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="Oil/Stock title"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Stock
          </label>
          <input
            value={form.stock}
            onChange={(event) => handleChange("stock", event.target.value)}
            placeholder="e.g., 18 × 5L cans"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Last Check
          </label>
          <CalendarField
            value={form.lastCheckDate}
            onChange={(e) => handleChange("lastCheckDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Next Check
          </label>
          <CalendarField
            value={form.nextCheckDate}
            onChange={(e) => handleChange("nextCheckDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Last Topped Up
          </label>
          <CalendarField
            value={form.lastToppedUpDate}
            onChange={(e) => handleChange("lastToppedUpDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              backgroundColor: "transparent",
              color: "var(--text)",
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
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
};

const SimplifiedTrackingModal = ({ initialData, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    jobNumber: initialData?.jobNumber || "",
    reg: initialData?.reg || "",
    customer: initialData?.customer || "",
    makeModel: initialData?.makeModel || "",
    colour: initialData?.colour || "",
    vehicleLocation: initialData?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: initialData?.keyLocation || KEY_LOCATIONS[0].label,
  }));
  const [showUpdate, setShowUpdate] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill functionality when job number, reg, or customer is entered
  const handleAutoFill = async (searchField, searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;

    setIsSearching(true);
    try {
      // Try to fetch job details from the database
      const { data, error } = await supabaseClient
        .from("jobs")
        .select(`
          job_number,
          vehicle:vehicle_id(registration, reg, make, model, make_model, colour),
          customer:customer_id(name, firstname, lastname)
        `)
        .or(
          searchField === "jobNumber" ? `job_number.ilike.%${searchValue}%` :
          searchField === "reg" ? `vehicle_id.registration.ilike.%${searchValue}%,vehicle_id.reg.ilike.%${searchValue}%` :
          `customer_id.name.ilike.%${searchValue}%,customer_id.firstname.ilike.%${searchValue}%,customer_id.lastname.ilike.%${searchValue}%`
        )
        .limit(1)
        .single();

      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          jobNumber: data.job_number || prev.jobNumber,
          reg: data.vehicle?.registration || data.vehicle?.reg || prev.reg,
          customer: data.customer?.name || `${data.customer?.firstname || ""} ${data.customer?.lastname || ""}`.trim() || prev.customer,
          makeModel: data.vehicle?.make_model || `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim() || prev.makeModel,
          colour: data.vehicle?.colour || prev.colour,
        }));
      }
    } catch (err) {
      console.error("Auto-fill error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "job_checked_in";
    onSave({ ...form, actionType, context: "car" });
  };

  const handleUpdateLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "location_update";
    onSave({ ...form, actionType, context: "update" });
  };

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 220,
      }}
    >
      <div
        style={{
          ...popupCardStyles,
          width: "min(800px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0" }}>Vehicle & Key Tracking</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>
              Track vehicle and key locations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Top Row: Job Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            padding: "16px",
            backgroundColor: "var(--surface-light)",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Job Number</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.jobNumber || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Registration</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.reg || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Make & Model</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.makeModel || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Colour</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.colour || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Customer</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.customer || "—"}</div>
          </div>
        </div>

        {/* Add Location Section */}
        <form onSubmit={handleAddLocation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ margin: "0", fontSize: "1rem", fontWeight: 600 }}>Add Location</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                Job Number / Reg / Customer
              </span>
              <input
                value={form.jobNumber || form.reg || form.customer}
                onChange={(e) => {
                  const value = e.target.value;
                  // Try to determine which field it is
                  if (value.match(/^\d+$/)) {
                    handleChange("jobNumber", value);
                    handleAutoFill("jobNumber", value);
                  } else if (value.match(/^[A-Z0-9\s]+$/i) && value.length <= 10) {
                    handleChange("reg", value);
                    handleAutoFill("reg", value);
                  } else {
                    handleChange("customer", value);
                    handleAutoFill("customer", value);
                  }
                }}
                placeholder="Enter job number, reg, or customer name"
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "0.95rem",
                }}
                disabled={isSearching}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>Vehicle Location</span>
              <select
                value={form.vehicleLocation}
                onChange={(e) => handleChange("vehicleLocation", e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                }}
              >
                {CAR_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.label}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>Key Location</span>
              <select
                value={form.keyLocation}
                onChange={(e) => handleChange("keyLocation", e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                }}
              >
                {KEY_LOCATION_GROUPS.map((group) => (
                  <optgroup key={group.title} label={group.title}>
                    {group.options.map((option) => {
                      const label = `${group.title} – ${option.label}`;
                      return (
                        <option key={option.id} value={label}>
                          {option.label}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Add Location
          </button>
        </form>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--accent-purple-surface)" }} />

        {/* Update Section Toggle */}
        <button
          type="button"
          onClick={() => setShowUpdate(!showUpdate)}
          style={{
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid var(--info)",
            background: showUpdate ? "var(--info)" : "transparent",
            color: showUpdate ? "white" : "var(--info)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          {showUpdate ? "Hide Update Section" : "Update Existing Location"}
        </button>

        {/* Update Location Section */}
        {showUpdate && (
          <form onSubmit={handleUpdateLocation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ margin: "0", fontSize: "1rem", fontWeight: 600 }}>Update Location</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>Vehicle Location</span>
                <select
                  value={form.vehicleLocation}
                  onChange={(e) => handleChange("vehicleLocation", e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "12px",
                    border: "1px solid var(--accent-purple-surface)",
                  }}
                >
                  {CAR_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.label}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>Key Location</span>
                <select
                  value={form.keyLocation}
                  onChange={(e) => handleChange("keyLocation", e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "12px",
                    border: "1px solid var(--accent-purple-surface)",
                  }}
                >
                  {KEY_LOCATION_GROUPS.map((group) => (
                    <optgroup key={group.title} label={group.title}>
                      {group.options.map((option) => {
                        const label = `${group.title} – ${option.label}`;
                        return (
                          <option key={option.id} value={label}>
                            {option.label}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                border: "none",
                background: "var(--success)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Update
            </button>
          </form>
        )}
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

    // Validate that at least one of the key fields is filled
    const hasJobNumber = form.jobNumber && form.jobNumber.trim();
    const hasReg = form.reg && form.reg.trim();
    const hasCustomer = form.customer && form.customer.trim();

    if (!hasJobNumber && !hasReg && !hasCustomer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = context === "car" ? "job_checked_in" : "job_complete";
    onSave({ ...form, actionType, context });
  };

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 220,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(720px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "var(--info)" }}>
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
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
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
            { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821", required: false },
            { label: "Registration", field: "reg", placeholder: "GY21 HNP", required: false },
            { label: "Customer", field: "customer", placeholder: "Customer name", required: false },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service...", required: false },
          ].map((input) => (
            <label key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>
                {input.label}
                {["jobNumber", "reg", "customer"].includes(input.field) && (
                  <span style={{ fontSize: "0.75rem", color: "var(--info)", fontWeight: 400 }}> (at least one required)</span>
                )}
              </span>
              <input
                value={form[input.field]}
                onChange={(event) => handleChange(input.field, event.target.value)}
                placeholder={input.placeholder}
                style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
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
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Vehicle Location</span>
            <select
              value={form.vehicleLocation}
              onChange={(event) => handleChange("vehicleLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
            >
              {CAR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Key Location</span>
            <select
              required
              value={form.keyLocation}
              onChange={(event) => handleChange("keyLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
            >
              {KEY_LOCATION_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.options.map((option) => {
                    const label = `${group.title} – ${option.label}`;
                    return (
                      <option key={option.id} value={label}>
                        {option.label}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Status</span>
            <select
              value={form.status}
              onChange={(event) => handleChange("status", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
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
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Key Tag / Guidance</span>
          <input
            value={form.keyTip}
            onChange={(event) => handleChange("keyTip", event.target.value)}
            placeholder="Green tag #4, handover drawer, etc."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => handleChange("notes", event.target.value)}
            placeholder="Collection time, valet status, instructions..."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "var(--surface)",
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
              background: "var(--primary)",
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
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });
  const [simplifiedModal, setSimplifiedModal] = useState({ open: false, initialData: null });
  const [highlightedJobNumber, setHighlightedJobNumber] = useState(null);
  const [equipmentModal, setEquipmentModal] = useState({ open: false });
  const [oilStockModal, setOilStockModal] = useState({ open: false });
  const { dbUserId, user } = useUser();
  const userRoles = useMemo(() => (user?.roles || []).map((role) => role.toLowerCase()), [user]);
  const isWorkshopManager = userRoles.includes("workshop manager");
  const tabs = useMemo(() => {
    const base = [{ id: "tracker", label: "Tracker" }];
    if (isWorkshopManager) {
      base.push({ id: "equipment", label: "Equipment/Tools" }, { id: "oil-stock", label: "Oil/Stock" });
    }
    return base;
  }, [isWorkshopManager]);
  const [activeTab, setActiveTab] = useState("tracker");
  const [equipmentChecks, setEquipmentChecks] = useState(() => cloneList(DEFAULT_EQUIPMENT_CHECKS));
  const [oilChecks, setOilChecks] = useState(() => cloneList(DEFAULT_OIL_CHECKS));

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchTrackingSnapshot();
      if (!snapshot.success) {
        throw new Error(snapshot.error?.message || "Failed to load tracking data");
      }
      const normalized = Array.isArray(snapshot.data) ? snapshot.data : [];
      setEntries(normalized);
      setLastUpdated(new Date().toISOString());
    } catch (fetchError) {
      console.error("Failed to fetch tracking snapshot", fetchError);
      setEntries([]);
      setError(fetchError?.message || "Unable to load tracking data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Handle URL parameters from job card redirect
  useEffect(() => {
    if (!router.isReady) return;

    const { jobNumber, reg, customer, makeModel, colour, openPopup } = router.query;

    // If we have URL params, check if an entry exists for this job
    if (jobNumber || reg || customer) {
      setHighlightedJobNumber(jobNumber);

      // If openPopup=true, use the simplified modal with pre-filled data
      if (openPopup === "true") {
        setSimplifiedModal({
          open: true,
          initialData: {
            jobNumber: jobNumber || "",
            reg: reg || "",
            customer: customer || "",
            makeModel: makeModel || "",
            colour: colour || "",
          },
        });
        return;
      }

      // Check if an existing entry matches the job
      const existingEntry = entries.find(
        (entry) =>
          (jobNumber && entry.jobNumber?.toLowerCase() === jobNumber.toLowerCase()) ||
          (reg && entry.reg?.toLowerCase() === reg.toLowerCase())
      );

      // If no existing entry found, auto-open the Log New popup with pre-filled data
      if (!existingEntry && entries.length > 0) {
        openEntryModal("car", {
          ...emptyForm,
          jobNumber: jobNumber || "",
          reg: reg || "",
          customer: customer || "",
        });
      }
    }
  }, [router.isReady, router.query, entries]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "tracker");
    }
  }, [tabs, activeTab]);

  const handleEquipmentCheck = useCallback((id) => {
    setEquipmentChecks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          lastChecked: new Date().toISOString(),
          nextDue: nextDueFrom(new Date(), item.frequencyDays),
          status: "Serviced",
        };
      })
    );
  }, []);

  const handleOilCheck = useCallback((id) => {
    setOilChecks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          lastCheck: new Date().toISOString(),
          nextCheck: nextDueFrom(new Date(), 7),
        };
      })
    );
  }, []);

  const handleSaveEquipment = useCallback(async (form) => {
    // TODO: Save to database
    const newEquipment = {
      id: `equipment-${Date.now()}`,
      name: form.name,
      lastChecked: form.lastChecked || new Date().toISOString(),
      nextDue: form.nextDue || nextDueFrom(new Date(), 7),
      status: "Ready",
    };
    setEquipmentChecks((prev) => [...prev, newEquipment]);
    setEquipmentModal({ open: false });
  }, []);

  const handleSaveOilStock = useCallback(async (form) => {
    // TODO: Save to database - note this should link to consumables-tracker
    const newOilStock = {
      id: `oil-${Date.now()}`,
      title: form.title,
      stock: form.stock,
      lastCheck: form.lastCheck || new Date().toISOString(),
      nextCheck: form.nextCheck || nextDueFrom(new Date(), 7),
      lastToppedUp: form.lastToppedUp,
    };
    setOilChecks((prev) => [...prev, newOilStock]);
    setOilStockModal({ open: false });
  }, []);

  const handleAutoMovement = useCallback(
    async (job, rule, newStatus) => {
      try {
        const payload = {
          actionType: "job_status_change",
          jobId: job.id || job.job_id || null,
          jobNumber: (job.job_number || job.jobNumber || "").toString().trim().toUpperCase(),
          vehicleId: job.vehicle_id || job.vehicleId || null,
          vehicleReg: (job.vehicle_reg || job.reg || "").toString().trim().toUpperCase(),
          keyLocation: rule.keyLocation,
          vehicleLocation: rule.vehicleLocation,
          vehicleStatus: rule.vehicleStatus,
          notes: `Auto-sync from status "${newStatus}"`,
          performedBy: dbUserId || null,
        };

        const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorPayload = await response
            .json()
            .catch(() => ({ message: "Failed to auto-sync locations" }));
          console.error("Auto movement failed", errorPayload?.message || response.statusText);
          return;
        }

        await loadEntries();
      } catch (autoError) {
        console.error("Auto movement error", autoError);
      }
    },
    [dbUserId, loadEntries]
  );

  useEffect(() => {
    const channel = supabaseClient
      .channel("tracking-job-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        (payload) => {
          const newJob = payload?.new;
          const oldJob = payload?.old;
          if (!newJob?.status || newJob.status === oldJob?.status) {
            return;
          }
          const rule = getAutoMovementRule(newJob.status);
          if (!rule) return;
          handleAutoMovement(newJob, rule, newJob.status);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [handleAutoMovement]);

  const activeEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.jobId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        ),
    [entries]
  );

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

  const handleSave = async (form) => {
    try {
      setError(null);
      const jobNumberQuery = form.jobNumber ? form.jobNumber.trim() : "";
      const regQuery = form.reg ? form.reg.trim() : "";
      let resolvedJob = null;

      if (!form.jobId && jobNumberQuery) {
        const { data: jobMatches, error: jobLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("job_number", jobNumberQuery)
          .limit(1);

        if (jobLookupError) {
          console.warn("Job lookup failed", jobLookupError);
        } else {
          resolvedJob = jobMatches?.[0] || null;
        }
      }

      if (!resolvedJob && !form.vehicleId && regQuery) {
        const { data: regMatches, error: regLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("vehicle_reg", regQuery)
          .limit(1);

        if (regLookupError) {
          console.warn("Vehicle lookup failed", regLookupError);
        } else {
          resolvedJob = regMatches?.[0] || null;
        }
      }

      const payload = {
        actionType: form.actionType || "job_complete",
        jobId: form.jobId || resolvedJob?.id || null,
        jobNumber: jobNumberQuery ? jobNumberQuery.toUpperCase() : "",
        vehicleId: form.vehicleId || resolvedJob?.vehicle_id || null,
        vehicleReg: regQuery ? regQuery.toUpperCase() : "",
        keyLocation: form.keyLocation,
        vehicleLocation: form.vehicleLocation,
        notes: form.notes,
        performedBy: dbUserId || null,
      };

      const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: "Failed to save entry" }));
        throw new Error(errorPayload?.message || "Failed to save entry");
      }

      await loadEntries();
      closeEntryModal();
    } catch (saveError) {
      console.error("Failed to log tracking entry", saveError);
      setError(saveError.message || "Unable to save tracking entry");
    }
  };

  const renderTrackerContent = () => (
    <section style={SECTION_STYLE}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>Active jobs</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadEntries}
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              border: "none",
              background: "var(--accent-purple)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            Refresh
          </button>
          {loading && (
            <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>Refreshing…</span>
          )}
          <button
            type="button"
            onClick={() => openEntryModal("car")}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add location
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {entries.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            No active job tracking data yet.
          </div>
        )}
        {activeEntries.length === 0 && entries.length > 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Waiting for job-mapped tracking entries.
          </div>
        )}
        {activeEntries.map((entry) => {
          const isHighlighted = highlightedJobNumber && entry.jobNumber?.toLowerCase() === highlightedJobNumber.toLowerCase();
          return (
            <CombinedTrackerCard
              key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
              entry={entry}
              isHighlighted={isHighlighted}
            />
          );
        })}
      </div>
    </section>
  );

  const renderEquipmentContent = () => (
    <section style={{ ...SECTION_STYLE, gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>
            Equipment &amp; tools
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setEquipmentModal({ open: true })}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "var(--primary)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add Equipment/tools
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        {equipmentChecks.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Equipment service list is empty.
          </div>
        )}
        {equipmentChecks.map((check) => {
          const dueLabel = getDueLabel(check.nextDue);
          const isDue = dueLabel === "Due now";
          const badgeColor =
            check.status?.toLowerCase().includes("due") || isDue ? "var(--danger)" : "var(--success-dark)";
          return (
            <div
              key={check.id}
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: "1.05rem" }}>{check.name}</strong>
                  <p style={{ margin: "2px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>{check.location}</p>
                  <p style={{ margin: "2px 0 0", color: "var(--info-dark)", fontSize: "0.8rem" }}>
                    Owner: {check.owner}
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: badgeColor }}>
                  {check.status || dueLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Last checked</span>
                  <strong>{formatDateLabel(check.lastChecked)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Next due</span>
                  <strong>{formatDateLabel(check.nextDue)}</strong>
                </div>
                <p style={{ margin: "6px 0 0", color: "var(--info)", fontSize: "0.8rem" }}>{check.notes}</p>
              </div>
              <button
                type="button"
                onClick={() => handleEquipmentCheck(check.id)}
                style={{
                  marginTop: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Log check
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderOilContent = () => (
    <section style={{ ...SECTION_STYLE, gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>
            Oil / Stock
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOilStockModal({ open: true })}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "var(--primary)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add Oil / Stock
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px",
        }}
      >
        {oilChecks.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Oil stock checklist is empty.
          </div>
        )}
        {oilChecks.map((item) => {
          const dueLabel = getDueLabel(item.nextCheck);
          const isDue = dueLabel === "Due now";
          return (
            <div
              key={item.id}
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: "1.05rem" }}>{item.title}</strong>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: isDue ? "var(--danger)" : "var(--success-dark)",
                  }}
                >
                  {dueLabel}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                  color: "var(--info-dark)",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span style={{ display: "block", color: "var(--info)" }}>Stock</span>
                  <strong>{item.stock || "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--info)" }}>Last check</span>
                  <strong>{formatDateLabel(item.lastCheck)}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--info)" }}>Next check</span>
                  <strong>{formatDateLabel(item.nextCheck)}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--info)" }}>Last topped up</span>
                  <strong>{formatDateLabel(item.lastToppedUp)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOilCheck(item.id)}
                style={{
                  marginTop: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Mark checked
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderActiveTabContent = () => {
    if (activeTab === "equipment") {
      return renderEquipmentContent();
    }
    if (activeTab === "oil-stock") {
      return renderOilContent();
    }
    return renderTrackerContent();
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
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: isActive
                      ? "1px solid var(--primary)"
                      : "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                    background: isActive ? "rgba(var(--primary-rgb), 0.08)" : "var(--surface)",
                    color: isActive ? "var(--primary)" : "var(--info-dark)",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 2px 8px rgba(0, 0, 0, 0.08)" : "none",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--danger-rgb), 0.25)",
                background: "rgba(var(--danger-rgb), 0.8)",
                color: "var(--danger)",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
          {renderActiveTabContent()}
        </div>
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

      {simplifiedModal.open && (
        <SimplifiedTrackingModal
          initialData={simplifiedModal.initialData}
          onClose={() => setSimplifiedModal({ open: false, initialData: null })}
          onSave={handleSave}
        />
      )}

      {equipmentModal.open && (
        <EquipmentToolsModal
          onClose={() => setEquipmentModal({ open: false })}
          onSave={handleSaveEquipment}
        />
      )}

      {oilStockModal.open && (
        <OilStockModal
          onClose={() => setOilStockModal({ open: false })}
          onSave={handleSaveOilStock}
        />
      )}
    </Layout>
  );
}
