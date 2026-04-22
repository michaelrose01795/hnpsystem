// file location: src/pages/parts/create-order/index.js
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/database/supabaseClient";
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup";
import NewCustomerPopup from "@/components/popups/NewCustomerPopup";
import ModalPortal from "@/components/popups/ModalPortal";
import { useTheme } from "@/styles/themeProvider";
import { updateCustomer } from "@/lib/database/customers";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { getVehicleRegistration } from "@/lib/canonical/fields";
import PartsJobCardPageUi from "@/components/page-ui/parts/create-order/parts-create-order-ui"; // Extracted presentation layer.

const cardStyle = {
  gap: "18px"
};

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px"
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px"
};

const inputStyle = {
  borderRadius: "var(--radius-sm)",
  border: "none",
  padding: "var(--control-padding)",
  fontSize: "0.95rem",
  fontFamily: "inherit"
};

const sectionCardStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "rgba(var(--surface-rgb), 0.9)",
  padding: "var(--section-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "12px"
};

const partLookupOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 90
};

const partLookupContentStyle = {
  background: "var(--surface)",
  borderRadius: "var(--radius-md)",
  padding: "var(--section-card-padding)",
  width: "min(640px, 100%)",
  maxHeight: "85vh",
  overflowY: "auto",
  border: "none",
  display: "flex",
  flexDirection: "column",
  gap: "14px"
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
  delivery_notes: ""
};

const blankPart = () => ({
  part_number: "",
  part_name: "",
  quantity: 1,
  unit_price: "",
  notes: "",
  part_catalog_id: null,
  catalog_snapshot: null
});

const formatFullName = (record = {}) =>
[record.firstname || record.firstName, record.lastname || record.lastName].
filter(Boolean).
join(" ").
trim();

const splitFullName = (fullName = "", fallback = {}) => {
  const trimmed = (fullName || "").trim();
  if (!trimmed.length) {
    return {
      firstName: fallback.firstname || fallback.firstName || "",
      lastName: fallback.lastname || fallback.lastName || ""
    };
  }
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || fallback.firstname || fallback.firstName || "",
    lastName: rest.join(" ").trim() || fallback.lastname || fallback.lastName || ""
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
  postcode: record.postcode || ""
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
        delivery_address: prev.customer_address
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
          limit: "25"
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
      [field]: value
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
        part.unit_price === undefined || part.unit_price === null ?
        line.unit_price :
        String(part.unit_price),
        catalog_snapshot: {
          qty_in_stock: part.qty_in_stock,
          qty_reserved: part.qty_reserved,
          storage_location: part.storage_location,
          supplier: part.supplier
        }
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
      const { data, error } = await supabaseClient.
      from("vehicles").
      select("registration, reg_number, make, model, make_model, chassis, vin").
      eq("customer_id", customerId).
      order("updated_at", { ascending: false }).
      limit(1).
      maybeSingle();
      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          vehicle_reg: getVehicleRegistration(data) || prev.vehicle_reg,
          vehicle_make: data.make || data.make_model || prev.vehicle_make,
          vehicle_model: data.model || prev.vehicle_model,
          vehicle_vin: data.vin || data.chassis || prev.vehicle_vin
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
          customer_address: normalized.address || prev.customer_address
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
      delivery_address: deliverySameAsBilling ? "" : prev.delivery_address
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
        customer_address: customerRecord.address || ""
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
        address: toNullable(form.customer_address)
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
          customer_address: normalized.address || ""
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
          vin: form.vehicle_vin
        },
        delivery_type: form.delivery_type,
        delivery_address:
        form.delivery_type === "delivery" ?
        deliveryAddressValue.trim() || null :
        null,
        delivery_contact: trimmedCustomerName || null,
        delivery_phone: trimmedCustomerPhone || null,
        delivery_eta: form.delivery_eta || null,
        delivery_window: form.delivery_window || null,
        delivery_notes: form.delivery_notes.trim() || null
      };

      const { data: orderRecord, error: insertError } = await supabaseClient.
      from("parts_order_cards").
      insert([payload]).
      select("*, items:parts_order_card_items(*)").
      maybeSingle();
      if (insertError) throw insertError;

      const partPayload = validParts.map((line) => ({
        order_id: orderRecord.id,
        part_catalog_id: line.part_catalog_id || null,
        part_number: line.part_number.trim() || null,
        part_name: line.part_name.trim() || null,
        quantity: Number(line.quantity) || 1,
        unit_price: line.unit_price === "" ? 0 : Number(line.unit_price),
        notes: line.notes.trim() || null
      }));

      if (partPayload.length > 0) {
        const { error: itemsError, data: itemsData } = await supabaseClient.
        from("parts_order_card_items").
        insert(partPayload).
        select("*");
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
    return <PartsJobCardPageUi view="section1" />;






  }

  return <PartsJobCardPageUi view="section2" CalendarField={CalendarField} cardStyle={cardStyle} closePartSearch={closePartSearch} customerRecord={customerRecord} deliverySameAsBilling={deliverySameAsBilling} errorMessage={errorMessage} ExistingCustomerPopup={ExistingCustomerPopup} fieldStyle={fieldStyle} form={form} formatFullName={formatFullName} handleAddPart={handleAddPart} handleCancelCustomerEdit={handleCancelCustomerEdit} handleClearForm={handleClearForm} handleClearPartLink={handleClearPartLink} handleCustomerCleared={handleCustomerCleared} handleExistingCustomerSelect={handleExistingCustomerSelect} handleFieldChange={handleFieldChange} handleNewCustomerSaved={handleNewCustomerSaved} handlePartChange={handlePartChange} handlePartSelected={handlePartSelected} handleRemovePart={handleRemovePart} handleSaveCustomerDetails={handleSaveCustomerDetails} handleStartCustomerEdit={handleStartCustomerEdit} handleSubmit={handleSubmit} hasCustomerSelected={hasCustomerSelected} inputStyle={inputStyle} isCustomerEditing={isCustomerEditing} isDarkMode={isDarkMode} loadingVehicle={loadingVehicle} ModalPortal={ModalPortal} NewCustomerPopup={NewCustomerPopup} openPartSearch={openPartSearch} partLines={partLines} partLookupContentStyle={partLookupContentStyle} partLookupOverlayStyle={partLookupOverlayStyle} partSearchLoading={partSearchLoading} partSearchOpen={partSearchOpen} partSearchQuery={partSearchQuery} partSearchResults={partSearchResults} saving={saving} savingCustomerDetails={savingCustomerDetails} SearchBar={SearchBar} sectionCardStyle={sectionCardStyle} sectionHeaderStyle={sectionHeaderStyle} setDeliverySameAsBilling={setDeliverySameAsBilling} setPartSearchQuery={setPartSearchQuery} setShowExistingCustomer={setShowExistingCustomer} setShowNewCustomer={setShowNewCustomer} showExistingCustomer={showExistingCustomer} showNewCustomer={showNewCustomer} TimePickerField={TimePickerField} twoColumnGrid={twoColumnGrid} />;
















































































































































































































































































































































































































































































































































































































































































}
