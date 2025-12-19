"use client";

import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/supabaseClient";
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup";
import NewCustomerPopup from "@/components/popups/NewCustomerPopup";
import { useTheme } from "@/styles/themeProvider";

const cardStyle = {
  borderRadius: "20px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  padding: "10px 12px",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const sectionCardStyle = {
  borderRadius: "16px",
  border: "1px solid rgba(var(--primary-rgb), 0.08)",
  background: "rgba(var(--surface-rgb), 0.9)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "12px",
};

const blankForm = {
  customer_id: null,
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  vehicle_reg: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_vin: "",
  notes: "",
  delivery_type: "delivery",
  delivery_address: "",
  delivery_contact: "",
  delivery_phone: "",
  delivery_eta: "",
  delivery_window: "",
  delivery_notes: "",
  invoice_reference: "",
  invoice_total: "",
  invoice_status: "draft",
  invoice_notes: "",
};

const blankPart = () => ({
  part_number: "",
  part_name: "",
  quantity: 1,
  unit_price: "",
  notes: "",
});

const formatFullName = (record = {}) =>
  [record.firstname || record.firstName, record.lastname || record.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

const normalizeCustomerRecord = (record = {}) => ({
  id: record.id || record.customer_id || null,
  firstname: record.firstname || record.firstName || "",
  lastname: record.lastname || record.lastName || "",
  email: record.email || "",
  mobile: record.mobile || "",
  telephone: record.telephone || "",
  address: record.address || "",
  postcode: record.postcode || "",
});

export default function PartsJobCardPage() {
  const { resolvedMode } = useTheme();
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = roles.includes("parts") || roles.includes("parts manager");
  const isDarkMode = resolvedMode === "dark";

  const [form, setForm] = useState(blankForm);
  const [partLines, setPartLines] = useState([blankPart()]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notification, setNotification] = useState("");
  const [customerRecord, setCustomerRecord] = useState(null);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [deliverySameAsBilling, setDeliverySameAsBilling] = useState(true);
  const [loadingVehicle, setLoadingVehicle] = useState(false);

  useEffect(() => {
    if (deliverySameAsBilling) {
      setForm((prev) => ({
        ...prev,
        delivery_address: prev.customer_address,
      }));
    }
  }, [deliverySameAsBilling, form.customer_address]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePartChange = (index, field, value) => {
    setPartLines((prev) =>
      prev.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  };

  const handleAddPart = () => {
    setPartLines((prev) => [...prev, blankPart()]);
  };

  const handleRemovePart = (index) => {
    setPartLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  };

  const fetchLatestVehicleForCustomer = useCallback(async (customerId) => {
    if (!customerId) return;
    setLoadingVehicle(true);
    try {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("registration, reg_number, make, model, make_model, chassis, vin")
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          vehicle_reg: data.registration || data.reg_number || prev.vehicle_reg,
          vehicle_make: data.make || data.make_model || prev.vehicle_make,
          vehicle_model: data.model || prev.vehicle_model,
          vehicle_vin: data.vin || data.chassis || prev.vehicle_vin,
        }));
      }
    } catch (vehicleError) {
      console.error("Failed to load vehicle for customer:", vehicleError);
    } finally {
      setLoadingVehicle(false);
    }
  }, []);

  const applyCustomerToForm = useCallback(
    (record) => {
      if (!record) return;
      const normalized = normalizeCustomerRecord(record);
      setCustomerRecord(normalized);
      setForm((prev) => {
        const nextState = {
          ...prev,
          customer_id: normalized.id,
          customer_name: formatFullName(normalized) || prev.customer_name,
          customer_phone: normalized.mobile || normalized.telephone || prev.customer_phone,
          customer_email: normalized.email || prev.customer_email,
          customer_address: normalized.address || prev.customer_address,
        };
        if (deliverySameAsBilling) {
          nextState.delivery_address = normalized.address || prev.delivery_address;
        }
        return nextState;
      });
      if (normalized.id) {
        fetchLatestVehicleForCustomer(normalized.id);
      }
    },
    [deliverySameAsBilling, fetchLatestVehicleForCustomer]
  );

  const handleCustomerCleared = () => {
    setCustomerRecord(null);
    setForm((prev) => ({
      ...prev,
      customer_id: null,
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      customer_address: "",
    }));
  };

  const handleExistingCustomerSelect = (record) => {
    applyCustomerToForm(record);
    setShowExistingCustomer(false);
  };

  const handleNewCustomerSaved = (record) => {
    applyCustomerToForm(record);
    setShowNewCustomer(false);
  };

  const resetForm = () => {
    setForm({ ...blankForm });
    setPartLines([blankPart()]);
    setNotification("Parts job card created.");
    setTimeout(() => setNotification(""), 3500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }
    const validParts = partLines.filter(
      (line) => line.part_name.trim() || line.part_number.trim() || Number(line.quantity) > 0
    );
    if (validParts.length === 0) {
      setErrorMessage("Add at least one part to the job card.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const billingAddress = form.customer_address || "";
      const deliveryAddressValue = deliverySameAsBilling ? billingAddress : form.delivery_address || "";

      const payload = {
        customer_id: customerRecord?.id || form.customer_id,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        customer_email: form.customer_email.trim() || null,
        customer_address: billingAddress.trim() || null,
        vehicle_reg: form.vehicle_reg.trim() || null,
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_vin: form.vehicle_vin.trim() || null,
        notes: form.notes.trim() || null,
        vehicle_details: {
          reg: form.vehicle_reg,
          make: form.vehicle_make,
          model: form.vehicle_model,
          vin: form.vehicle_vin,
        },
        delivery_type: form.delivery_type,
        delivery_address:
          form.delivery_type === "delivery"
            ? deliveryAddressValue.trim() || null
            : null,
        delivery_contact: form.delivery_contact.trim() || form.customer_name.trim() || null,
        delivery_phone: form.delivery_phone.trim() || form.customer_phone.trim() || null,
        delivery_eta: form.delivery_eta || null,
        delivery_window: form.delivery_window || null,
        delivery_notes: form.delivery_notes.trim() || null,
        invoice_reference: form.invoice_reference.trim() || null,
        invoice_total: form.invoice_total === "" ? 0 : Number(form.invoice_total) || 0,
        invoice_status: form.invoice_status || "draft",
        invoice_notes: form.invoice_notes.trim() || null,
      };

      const { data: job, error: insertError } = await supabaseClient
        .from("parts_job_cards")
        .insert([payload])
        .select("*, items:parts_job_card_items(*)")
        .maybeSingle();
      if (insertError) throw insertError;

      const partPayload = validParts.map((line) => ({
        job_id: job.id,
        part_number: line.part_number.trim() || null,
        part_name: line.part_name.trim() || null,
        quantity: Number(line.quantity) || 1,
        unit_price: line.unit_price === "" ? 0 : Number(line.unit_price),
        notes: line.notes.trim() || null,
      }));

      if (partPayload.length > 0) {
        const { error: itemsError, data: itemsData } = await supabaseClient
          .from("parts_job_card_items")
          .insert(partPayload)
          .select("*");
        if (itemsError) throw itemsError;
        job.items = itemsData;
      } else {
        job.items = [];
      }

      resetForm();
    } catch (submitError) {
      console.error("Failed to create parts job card:", submitError);
      setErrorMessage(submitError.message || "Unable to save parts job card.");
    } finally {
      setSaving(false);
    }
  };

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have permission to access parts job cards.
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <section style={cardStyle}>
          {notification && (
            <div style={{ padding: "10px", borderRadius: "10px", background: "var(--success-surface)", color: "var(--success)" }}>
              {notification}
            </div>
          )}
          {errorMessage && (
            <div style={{ padding: "10px", borderRadius: "10px", background: "var(--danger-surface)", color: "var(--danger)" }}>
              {errorMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <strong style={{ fontSize: "1.05rem" }}>Customer details</strong>
                  <p style={{ margin: 0, color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>
                    Search for an existing customer or create a new record to preload address and vehicle data.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShowExistingCustomer(true)}
                    style={{
                      borderRadius: "10px",
                      border: "1px solid transparent",
                      background: isDarkMode ? "#7D3FFF" : "#E53935",
                      color: "#ffffff",
                      padding: "8px 14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Search existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    style={{
                      borderRadius: "10px",
                      border: "1px solid var(--primary)",
                      background: "var(--primary)",
                      color: "var(--surface)",
                      padding: "8px 14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Add customer
                  </button>
                  {customerRecord && (
                    <button
                      type="button"
                      onClick={handleCustomerCleared}
                      style={{
                        borderRadius: "10px",
                        border: "1px solid var(--danger)",
                        background: "var(--danger-surface)",
                        color: "var(--danger)",
                        padding: "8px 14px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {customerRecord ? (
                <div
                  style={{
                    border: "1px solid var(--surface-light)",
                    borderRadius: "14px",
                    padding: "12px",
                    background: "var(--surface)",
                  }}
                >
                  <strong>{formatFullName(customerRecord)}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                    {customerRecord.email || "No email"} · {customerRecord.mobile || customerRecord.telephone || "No phone"}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                    {customerRecord.address || "No saved address"}
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "0.85rem" }}>
                  No linked customer yet. Use the buttons above to search or create one.
                </p>
              )}
              <div style={twoColumnGrid}>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Customer name</span>
                  <input
                    type="text"
                    required
                    value={form.customer_name}
                    onChange={(event) => handleFieldChange("customer_name", event.target.value)}
                    style={inputStyle}
                    placeholder="Name"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Customer phone</span>
                  <input
                    type="tel"
                    value={form.customer_phone}
                    onChange={(event) => handleFieldChange("customer_phone", event.target.value)}
                    style={inputStyle}
                    placeholder="Phone"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Customer email</span>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(event) => handleFieldChange("customer_email", event.target.value)}
                    style={inputStyle}
                    placeholder="Email"
                  />
                </label>
              </div>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Billing address</span>
                <textarea
                  rows={2}
                  value={form.customer_address}
                  onChange={(event) => handleFieldChange("customer_address", event.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Billing address"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => handleFieldChange("notes", event.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Special instructions or payment notes"
                />
              </label>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <strong style={{ fontSize: "1.05rem" }}>Vehicle details</strong>
                {loadingVehicle && (
                  <p style={{ margin: 0, color: "var(--info)", fontSize: "0.85rem" }}>Loading recent vehicle data…</p>
                )}
              </div>
              <div style={twoColumnGrid}>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Vehicle registration</span>
                  <input
                    type="text"
                    value={form.vehicle_reg}
                    onChange={(event) => handleFieldChange("vehicle_reg", event.target.value.toUpperCase())}
                    style={inputStyle}
                    placeholder="Vehicle reg"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Vehicle make</span>
                  <input
                    type="text"
                    value={form.vehicle_make}
                    onChange={(event) => handleFieldChange("vehicle_make", event.target.value)}
                    style={inputStyle}
                    placeholder="Manufacturer"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Vehicle model</span>
                  <input
                    type="text"
                    value={form.vehicle_model}
                    onChange={(event) => handleFieldChange("vehicle_model", event.target.value)}
                    style={inputStyle}
                    placeholder="Model"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Vehicle VIN</span>
                  <input
                    type="text"
                    value={form.vehicle_vin}
                    onChange={(event) => handleFieldChange("vehicle_vin", event.target.value.toUpperCase())}
                    style={inputStyle}
                    placeholder="VIN"
                  />
                </label>
              </div>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <strong style={{ fontSize: "1.05rem" }}>Delivery / Collection</strong>
                  <p style={{ margin: 0, color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>
                    Choose how the parts will be handed over and capture the date, time, and contact information.
                  </p>
                </div>
              </div>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Fulfilment type</span>
                <select
                  value={form.delivery_type}
                  onChange={(event) => handleFieldChange("delivery_type", event.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="delivery">Delivery</option>
                  <option value="collection">Collection</option>
                </select>
              </label>
              <div style={twoColumnGrid}>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {form.delivery_type === "delivery" ? "Delivery date" : "Collection date"}
                  </span>
                  <input
                    type="date"
                    value={form.delivery_eta || ""}
                    onChange={(event) => handleFieldChange("delivery_eta", event.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {form.delivery_type === "delivery" ? "Delivery window / time" : "Collection time"}
                  </span>
                  <input
                    type="time"
                    value={form.delivery_window || ""}
                    onChange={(event) => handleFieldChange("delivery_window", event.target.value)}
                    style={inputStyle}
                  />
                </label>
              </div>
              <div style={twoColumnGrid}>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {form.delivery_type === "delivery" ? "Delivery contact" : "Collection contact"}
                  </span>
                  <input
                    type="text"
                    value={form.delivery_contact}
                    onChange={(event) => handleFieldChange("delivery_contact", event.target.value)}
                    style={inputStyle}
                    placeholder="Contact name"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {form.delivery_type === "delivery" ? "Delivery phone" : "Collection phone"}
                  </span>
                  <input
                    type="tel"
                    value={form.delivery_phone}
                    onChange={(event) => handleFieldChange("delivery_phone", event.target.value)}
                    style={inputStyle}
                    placeholder="Contact number"
                  />
                </label>
              </div>
              {form.delivery_type === "delivery" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    border: "1px solid var(--surface-light)",
                    borderRadius: "14px",
                    padding: "12px",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="checkbox"
                      checked={deliverySameAsBilling}
                      onChange={(event) => setDeliverySameAsBilling(event.target.checked)}
                    />
                    <span>Use billing address as delivery address</span>
                  </label>
                  {!deliverySameAsBilling && (
                    <textarea
                      rows={2}
                      value={form.delivery_address}
                      onChange={(event) => handleFieldChange("delivery_address", event.target.value)}
                      style={{ ...inputStyle, resize: "vertical" }}
                      placeholder="Delivery address"
                    />
                  )}
                </div>
              )}
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>
                  {form.delivery_type === "delivery" ? "Delivery notes" : "Collection notes"}
                </span>
                <textarea
                  rows={3}
                  value={form.delivery_notes}
                  onChange={(event) => handleFieldChange("delivery_notes", event.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Access instructions, collection requirements, etc."
                />
              </label>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <strong style={{ fontSize: "1.05rem" }}>Invoice details</strong>
              </div>
              <div style={twoColumnGrid}>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Invoice reference</span>
                  <input
                    type="text"
                    value={form.invoice_reference}
                    onChange={(event) => handleFieldChange("invoice_reference", event.target.value)}
                    style={inputStyle}
                    placeholder="e.g. INV-123"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Invoice total (£)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.invoice_total}
                    onChange={(event) => handleFieldChange("invoice_total", event.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={{ fontWeight: 600 }}>Invoice status</span>
                  <select
                    value={form.invoice_status}
                    onChange={(event) => handleFieldChange("invoice_status", event.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Invoice notes</span>
                <textarea
                  rows={2}
                  value={form.invoice_notes}
                  onChange={(event) => handleFieldChange("invoice_notes", event.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Payment references, approvals, etc."
                />
              </label>
            </div>

            <div style={sectionCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <strong style={{ fontSize: "1.05rem" }}>Booked parts</strong>
                <button
                  type="button"
                  onClick={handleAddPart}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--danger-surface)",
                    padding: "8px 14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add part
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                {partLines.map((line, index) => (
                  <div
                    key={`part-line-${index}`}
                    style={{
                      border: "1px solid var(--surface-light)",
                      borderRadius: "12px",
                      padding: "12px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Part number</span>
                      <input
                        type="text"
                        value={line.part_number}
                        onChange={(event) => handlePartChange(index, "part_number", event.target.value)}
                        style={inputStyle}
                        placeholder="e.g. 5Q0129620D"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Part name</span>
                      <input
                        type="text"
                        value={line.part_name}
                        onChange={(event) => handlePartChange(index, "part_name", event.target.value)}
                        style={inputStyle}
                        placeholder="Item description"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(event) => handlePartChange(index, "quantity", event.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Unit price (£)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => handlePartChange(index, "unit_price", event.target.value)}
                        style={inputStyle}
                        placeholder="0.00"
                      />
                    </label>
                    <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Line notes</span>
                      <textarea
                        rows={2}
                        value={line.notes}
                        onChange={(event) => handlePartChange(index, "notes", event.target.value)}
                        style={{ ...inputStyle, resize: "vertical" }}
                        placeholder="Collection details or supplier reference"
                      />
                    </label>
                    {partLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePart(index)}
                        style={{
                          gridColumn: "1 / -1",
                          border: "1px solid var(--danger)",
                          borderRadius: "10px",
                          background: "var(--danger-surface)",
                          color: "var(--danger)",
                          padding: "8px 12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove part
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Create job card"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
    {showExistingCustomer && (
      <ExistingCustomerPopup
        onClose={() => setShowExistingCustomer(false)}
        onSelect={handleExistingCustomerSelect}
      />
    )}
    {showNewCustomer && (
      <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onSelect={handleNewCustomerSaved} />
    )}
    </>
  );
}
