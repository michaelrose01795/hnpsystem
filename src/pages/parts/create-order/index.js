"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/supabaseClient";
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup";
import NewCustomerPopup from "@/components/popups/NewCustomerPopup";
import ModalPortal from "@/components/popups/ModalPortal";
import { useTheme } from "@/styles/themeProvider";
import { updateCustomer } from "@/lib/database/customers";
import { CalendarField } from "@/components/calendarAPI";
import { TimePickerField } from "@/components/timePickerAPI";

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

const partLookupOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 90,
};

const partLookupContentStyle = {
  background: "var(--surface)",
  borderRadius: "18px",
  padding: "20px",
  width: "min(640px, 100%)",
  maxHeight: "85vh",
  overflowY: "auto",
  border: "1px solid var(--surface-light)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
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
  delivery_eta: "",
  delivery_window: "",
  delivery_notes: "",
};

const blankPart = () => ({
  part_number: "",
  part_name: "",
  quantity: 1,
  unit_price: "",
  notes: "",
  part_catalog_id: null,
  catalog_snapshot: null,
});

const formatFullName = (record = {}) =>
  [record.firstname || record.firstName, record.lastname || record.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

const splitFullName = (fullName = "", fallback = {}) => {
  const trimmed = (fullName || "").trim();
  if (!trimmed.length) {
    return {
      firstName: fallback.firstname || fallback.firstName || "",
      lastName: fallback.lastname || fallback.lastName || "",
    };
  }
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || fallback.firstname || fallback.firstName || "",
    lastName: rest.join(" ").trim() || fallback.lastname || fallback.lastName || "",
  };
};

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

  const router = useRouter();
  const [form, setForm] = useState(blankForm);
  const [partLines, setPartLines] = useState([blankPart()]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [customerRecord, setCustomerRecord] = useState(null);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [isCustomerEditing, setIsCustomerEditing] = useState(false);
  const [savingCustomerDetails, setSavingCustomerDetails] = useState(false);
  const [deliverySameAsBilling, setDeliverySameAsBilling] = useState(true);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [partSearchResults, setPartSearchResults] = useState([]);
  const [partSearchLoading, setPartSearchLoading] = useState(false);
  const [activePartLine, setActivePartLine] = useState(null);
  const hasCustomerSelected = Boolean(customerRecord);

  useEffect(() => {
    if (deliverySameAsBilling) {
      setForm((prev) => ({
        ...prev,
        delivery_address: prev.customer_address,
      }));
    }
  }, [deliverySameAsBilling, form.customer_address]);

  useEffect(() => {
    if (!partSearchOpen) {
      setPartSearchResults([]);
      setPartSearchLoading(false);
      return;
    }
    const term = partSearchQuery.trim();
    if (term.length < 2) {
      setPartSearchResults([]);
      setPartSearchLoading(false);
      return;
    }
    let cancelled = false;
    setPartSearchLoading(true);
    const searchParts = async () => {
      try {
        const params = new URLSearchParams({
          search: term,
          limit: "25",
        });
        const response = await fetch(`/api/parts/catalog?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Failed to search parts catalogue.");
        }
        if (!cancelled) {
          setPartSearchResults(payload.parts || []);
        }
      } catch (lookupError) {
        console.error("Failed to search parts catalog:", lookupError);
        if (!cancelled) {
          setPartSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setPartSearchLoading(false);
        }
      }
    };
    searchParts();
    return () => {
      cancelled = true;
    };
  }, [partSearchOpen, partSearchQuery]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePartChange = (index, field, value) => {
    setPartLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === "part_number" && line.part_catalog_id) {
          next.part_catalog_id = null;
          next.catalog_snapshot = null;
        }
        return next;
      })
    );
  };

  const handleAddPart = () => {
    setPartLines((prev) => [...prev, blankPart()]);
  };

  const handleRemovePart = (index) => {
    setPartLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  };

  const openPartSearch = (index) => {
    setActivePartLine(index);
    setPartSearchQuery(partLines[index]?.part_number || "");
    setPartSearchOpen(true);
  };

  const closePartSearch = () => {
    setPartSearchOpen(false);
    setPartSearchLoading(false);
    setPartSearchQuery("");
    setPartSearchResults([]);
    setActivePartLine(null);
  };

  const handlePartSelected = (part) => {
    if (activePartLine === null || activePartLine === undefined) {
      closePartSearch();
      return;
    }
    setPartLines((prev) =>
      prev.map((line, index) => {
        if (index !== activePartLine) return line;
        return {
          ...line,
          part_catalog_id: part.id,
          part_number: part.part_number || line.part_number,
          part_name: part.name || line.part_name,
          unit_price:
            part.unit_price === undefined || part.unit_price === null
              ? line.unit_price
              : String(part.unit_price),
          catalog_snapshot: {
            qty_in_stock: part.qty_in_stock,
            qty_reserved: part.qty_reserved,
            storage_location: part.storage_location,
            supplier: part.supplier,
          },
        };
      })
    );
    closePartSearch();
  };

  const handleClearPartLink = (index) => {
    setPartLines((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, part_catalog_id: null, catalog_snapshot: null } : line
      )
    );
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
      setIsCustomerEditing(false);
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
    setIsCustomerEditing(false);
    setForm((prev) => ({
      ...prev,
      customer_id: null,
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      customer_address: "",
      delivery_address: deliverySameAsBilling ? "" : prev.delivery_address,
    }));
  };

  const syncFormWithCustomerRecord = useCallback(() => {
    if (!customerRecord) return;
    setForm((prev) => {
      const nextState = {
        ...prev,
        customer_id: customerRecord.id,
        customer_name: formatFullName(customerRecord),
        customer_phone: customerRecord.mobile || customerRecord.telephone || "",
        customer_email: customerRecord.email || "",
        customer_address: customerRecord.address || "",
      };
      if (deliverySameAsBilling) {
        nextState.delivery_address = customerRecord.address || "";
      }
      return nextState;
    });
  }, [customerRecord, deliverySameAsBilling]);

  const handleStartCustomerEdit = () => {
    if (!customerRecord) return;
    syncFormWithCustomerRecord();
    setIsCustomerEditing(true);
  };

  const handleCancelCustomerEdit = () => {
    syncFormWithCustomerRecord();
    setIsCustomerEditing(false);
  };

  const handleSaveCustomerDetails = async () => {
    if (!customerRecord?.id) return;
    setSavingCustomerDetails(true);
    const toNullable = (value) => {
      const trimmed = (value || "").trim();
      return trimmed.length ? trimmed : null;
    };
    const { firstName, lastName } = splitFullName(form.customer_name, customerRecord);
    const phoneValue = toNullable(form.customer_phone);
    try {
      const result = await updateCustomer(customerRecord.id, {
        firstname: firstName || customerRecord.firstname || customerRecord.firstName || "",
        lastname: lastName || customerRecord.lastname || customerRecord.lastName || "",
        email: toNullable(form.customer_email),
        mobile: phoneValue,
        telephone: phoneValue,
        address: toNullable(form.customer_address),
      });
      if (!result?.success || !result?.data) {
        throw new Error(result?.error?.message || "Failed to update customer details.");
      }
      const normalized = normalizeCustomerRecord(result.data);
      setCustomerRecord(normalized);
      setForm((prev) => {
        const nextState = {
          ...prev,
          customer_id: normalized.id,
          customer_name: formatFullName(normalized),
          customer_phone: normalized.mobile || normalized.telephone || "",
          customer_email: normalized.email || "",
          customer_address: normalized.address || "",
        };
        if (deliverySameAsBilling) {
          nextState.delivery_address = normalized.address || "";
        }
        return nextState;
      });
      setIsCustomerEditing(false);
    } catch (saveError) {
      console.error("Failed to update customer details:", saveError);
      setErrorMessage(saveError.message || "Unable to update customer details.");
    } finally {
      setSavingCustomerDetails(false);
    }
  };

  const handleExistingCustomerSelect = (record) => {
    applyCustomerToForm(record);
    setShowExistingCustomer(false);
  };

  const handleNewCustomerSaved = (record) => {
    applyCustomerToForm(record);
    setShowNewCustomer(false);
  };

  const handleClearForm = () => {
    setForm({ ...blankForm });
    setPartLines([blankPart()]);
    setCustomerRecord(null);
    setDeliverySameAsBilling(true);
    closePartSearch();
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
      setErrorMessage("Add at least one part to the order.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const billingAddress = form.customer_address || "";
      const deliveryAddressValue = deliverySameAsBilling ? billingAddress : form.delivery_address || "";
      const trimmedCustomerName = form.customer_name.trim();
      const trimmedCustomerPhone = form.customer_phone.trim();

      const payload = {
        status: "booked",
        customer_id: customerRecord?.id || form.customer_id,
        customer_name: trimmedCustomerName,
        customer_phone: trimmedCustomerPhone || null,
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
        delivery_contact: trimmedCustomerName || null,
        delivery_phone: trimmedCustomerPhone || null,
        delivery_eta: form.delivery_eta || null,
        delivery_window: form.delivery_window || null,
        delivery_notes: form.delivery_notes.trim() || null,
      };

      const { data: orderRecord, error: insertError } = await supabaseClient
        .from("parts_job_cards")
        .insert([payload])
        .select("*, items:parts_job_card_items(*)")
        .maybeSingle();
      if (insertError) throw insertError;

      const partPayload = validParts.map((line) => ({
        job_id: orderRecord.id,
        part_catalog_id: line.part_catalog_id || null,
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
        orderRecord.items = itemsData;
      } else {
        orderRecord.items = [];
      }

      if (orderRecord?.order_number) {
        router.push(`/parts/create-order/${orderRecord.order_number}`);
      } else {
        router.push("/parts/create-order");
      }
    } catch (submitError) {
      console.error("Failed to create parts order:", submitError);
      setErrorMessage(submitError.message || "Unable to save parts order.");
    } finally {
      setSaving(false);
    }
  };

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have permission to access parts orders.
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <section style={cardStyle}>
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
                </div>
                {hasCustomerSelected && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {isCustomerEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveCustomerDetails}
                          disabled={savingCustomerDetails}
                          style={{
                            borderRadius: "10px",
                            border: "1px solid var(--primary)",
                            background: "var(--primary)",
                            color: "var(--surface)",
                            padding: "8px 14px",
                            fontWeight: 600,
                            cursor: savingCustomerDetails ? "not-allowed" : "pointer",
                            opacity: savingCustomerDetails ? 0.7 : 1,
                          }}
                        >
                          {savingCustomerDetails ? "Saving…" : "Save customer details"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelCustomerEdit}
                          disabled={savingCustomerDetails}
                          style={{
                            borderRadius: "10px",
                            border: "1px solid var(--surface-light)",
                            background: "var(--surface)",
                            color: "var(--primary-dark)",
                            padding: "8px 14px",
                            fontWeight: 600,
                            cursor: savingCustomerDetails ? "not-allowed" : "pointer",
                            opacity: savingCustomerDetails ? 0.7 : 1,
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartCustomerEdit}
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
                        Edit customer details
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCustomerCleared}
                      disabled={savingCustomerDetails}
                      style={{
                        borderRadius: "10px",
                        border: "1px solid var(--danger)",
                        background: "var(--danger-surface)",
                        color: "var(--danger)",
                        padding: "8px 14px",
                        fontWeight: 600,
                        cursor: savingCustomerDetails ? "not-allowed" : "pointer",
                        opacity: savingCustomerDetails ? 0.7 : 1,
                      }}
                    >
                      Clear customer
                    </button>
                  </div>
                )}
              </div>
              {!hasCustomerSelected ? (
                <div
                  style={{
                    minHeight: "180px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                    <p style={{ margin: 0, color: "var(--info)" }}>Search for or add a customer to continue.</p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                      <button
                        type="button"
                        onClick={() => setShowExistingCustomer(true)}
                        style={{
                          borderRadius: "10px",
                          border: "1px solid transparent",
                          background: isDarkMode ? "#7D3FFF" : "#E53935",
                          color: "#ffffff",
                          padding: "10px 18px",
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
                          padding: "10px 18px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Add customer
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {customerRecord && (
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
                  )}
                  <div style={twoColumnGrid}>
                    <label style={fieldStyle}>
                      <span style={{ fontWeight: 600 }}>Customer name</span>
                      <input
                        type="text"
                        required
                        disabled={!isCustomerEditing}
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
                        disabled={!isCustomerEditing}
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
                        disabled={!isCustomerEditing}
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
                      disabled={!isCustomerEditing}
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
                </>
              )}
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
                <strong style={{ fontSize: "1.05rem" }}>Delivery / Collection</strong>
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
                <CalendarField
                  label={form.delivery_type === "delivery" ? "Delivery date" : "Collection date"}
                  value={form.delivery_eta || ""}
                  onChange={(value) => handleFieldChange("delivery_eta", value)}
                  name="delivery_eta"
                />
                <TimePickerField
                  label={form.delivery_type === "delivery" ? "Delivery window / time" : "Collection time"}
                  value={form.delivery_window || ""}
                  onChange={(event) => handleFieldChange("delivery_window", event.target.value)}
                />
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <strong style={{ fontSize: "1.05rem" }}>Booked parts</strong>
                <button
                  type="button"
                  onClick={handleAddPart}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid transparent",
                    background: isDarkMode ? "var(--accent-purple)" : "var(--danger)",
                    padding: "8px 14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--surface)",
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
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <input
                          type="text"
                          value={line.part_number}
                          onChange={(event) => handlePartChange(index, "part_number", event.target.value)}
                          style={{ ...inputStyle, flex: "1 1 160px" }}
                          placeholder="e.g. 5Q0129620D"
                        />
                        <button
                          type="button"
                          onClick={() => openPartSearch(index)}
                          style={{
                            borderRadius: "10px",
                            border: "1px solid var(--surface-light)",
                            background: "var(--primary)",
                            color: "var(--surface)",
                            padding: "8px 12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Search
                        </button>
                        {line.part_catalog_id && (
                          <button
                            type="button"
                            onClick={() => handleClearPartLink(index)}
                            style={{
                              borderRadius: "10px",
                              border: "1px solid var(--surface-light)",
                              background: "var(--danger-surface)",
                              color: "var(--danger)",
                              padding: "8px 12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                      {line.catalog_snapshot && (
                        <span style={{ fontSize: "0.75rem", color: "var(--info-dark)" }}>
                          Linked to stock · {line.catalog_snapshot.supplier || "Supplier unknown"} ·{" "}
                          {line.catalog_snapshot.storage_location || "No location"} ·{" "}
                          {(Number(line.catalog_snapshot.qty_in_stock) || 0) -
                            (Number(line.catalog_snapshot.qty_reserved) || 0)}{" "}
                          available
                        </span>
                      )}
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
                onClick={handleClearForm}
                disabled={saving}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: isDarkMode ? "#ffffff" : "#000000",
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
                {saving ? "Saving…" : "Create order"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
    {partSearchOpen && (
      <ModalPortal>
        <div style={partLookupOverlayStyle}>
          <div style={partLookupContentStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: "0.75rem",
                  color: "var(--info-dark)",
                }}
              >
                Parts stock
              </p>
              <h3 style={{ margin: "4px 0 0", color: "var(--primary-dark)" }}>Search catalog</h3>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closePartSearch}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: isDarkMode ? "var(--accent-purple)" : "var(--danger)",
                  cursor: "pointer",
                  padding: "6px 0",
                }}
                aria-label="Close part search"
              >
                Close
              </button>
            </div>
          </div>
          <input
            type="search"
            value={partSearchQuery}
            onChange={(event) => setPartSearchQuery(event.target.value)}
            placeholder="Search by part number or description"
            style={{
              ...inputStyle,
              width: "100%",
              fontSize: "1rem",
            }}
          />
          {partSearchLoading ? (
            <p style={{ margin: 0, color: "var(--info-dark)" }}>Searching catalog…</p>
          ) : partSearchQuery.trim().length < 2 ? (
            <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>Enter at least two characters to search.</p>
          ) : partSearchResults.length === 0 ? (
            <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>No parts found for that search.</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "50vh",
                overflowY: "auto",
              }}
            >
              {partSearchResults.map((part) => {
                const available =
                  (Number(part.qty_in_stock) || 0) - (Number(part.qty_reserved) || 0);
                const unitPrice = Number(part.unit_price ?? 0);
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => handlePartSelected(part)}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid var(--surface-light)",
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <strong style={{ color: "var(--primary-dark)" }}>
                      {part.part_number} · {part.name}
                    </strong>
                    <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                      {part.description || "No description"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                      {available} available · Stored in {part.storage_location || "unspecified"} · Supplier:{" "}
                      {part.supplier || "Unknown"}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--primary-dark)", fontWeight: 600 }}>
                      Unit price: £{unitPrice.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </ModalPortal>
    )}
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
