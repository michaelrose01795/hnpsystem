// file location: src/pages/new-order/index.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { hasAnyRole, PARTS_ORDER_ROLES } from "@/lib/auth/roles";
import NewCustomerPopup from "@/components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { getVehicleRegistration } from "@/lib/canonical/fields";
import { createCustomerDisplaySlug } from "@/lib/customers/slug";
import {
  CUSTOMER_FIELD_DEFINITIONS,
  initialCustomerFormState,
  normalizeCustomerRecord,
  buildCustomerUpdatePayload,
} from "@/lib/customers/customerRecord"; // shared with /new-job
import {
  createInitialVehicleState,
  hydrateVehicleState,
  vehicleStateFromDvla,
} from "@/lib/vehicles/vehicleFormState"; // shared with /new-job
import PartsCreateOrderUi from "@/components/page-ui/parts/create-order/parts-create-order-ui";
import { logFailure } from "@/lib/utils/logFailure";

const loadCustomersDb = () => import("@/lib/database/customers");
const loadVehiclesDb = () => import("@/lib/database/vehicles");

// Wait for a pause in typing before looking a registration up in the database.
const VEHICLE_LOOKUP_DEBOUNCE_MS = 400;

const blankForm = {
  internal_notes: "",
  customer_notes: "",
  account_number: "",
  customer_type: "retail",
  pricing_level: "retail",
  delivery_type: "collection",
  delivery_address_mode: "saved",
  delivery_address: "",
  delivery_eta: "",
  delivery_window: "",
  delivery_charge: "0",
  delivery_notes: "",
  priority: "normal",
  payment_status: "draft",
  order_source: "phone",
  assigned_adviser: "",
  department: "Parts",
  customer_reference: "",
  notify_sms: true,
  notify_email: true,
  notify_phone: false,
  reserve_stock: true,
};

let partLineSequence = 0;
const blankPart = () => ({
  client_id: `part-line-${++partLineSequence}`,
  part_number: "",
  part_name: "",
  quantity: 1,
  unit_price: "",
  discount: "0",
  notes: "",
  part_catalog_id: null,
  catalog_snapshot: null,
});

const formatFullName = (record = {}) =>
  [record.firstName || record.firstname, record.lastName || record.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();

const money = (value) => Number(Number(value || 0).toFixed(2));

// The Vehicle Details card carries more fields than the parts order table has
// columns for. Make / model / VIN map onto real columns; colour, engine number
// and mileage ride along in the vehicle_details JSON the order already stores.
const splitMakeModel = (makeModel = "") => {
  const trimmed = String(makeModel || "").trim();
  if (!trimmed) return { make: "", model: "" };
  const [make, ...rest] = trimmed.split(/\s+/);
  return { make, model: rest.join(" ") };
};

export default function PartsCreateOrderPage() {
  const router = useRouter();
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = hasAnyRole(roles, PARTS_ORDER_ROLES);
  const adviserName = user?.displayName || user?.fullName || user?.name || user?.username || user?.email || "Parts team";

  const [form, setForm] = useState(() => ({ ...blankForm, assigned_adviser: adviserName }));
  const [partLines, setPartLines] = useState([blankPart()]);

  // Vehicle Details — same state shape as /new-job so the shared card renders
  // identically on both pages.
  const [vehicle, setVehicle] = useState(createInitialVehicleState);
  const [vehicleNotification, setVehicleNotification] = useState(null);
  const [vehicleError, setVehicleError] = useState("");
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [withoutVehicle, setWithoutVehicle] = useState(false);
  const currentVehicleRegistrationRef = useRef("");
  const lastVehicleLookupRef = useRef("");

  // Customer Details — same state shape as /new-job.
  const [customer, setCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState(() => ({ ...initialCustomerFormState }));
  const [isCustomerEditing, setIsCustomerEditing] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerNotification, setCustomerNotification] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [newCustomerPrefill, setNewCustomerPrefill] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [partSearchResults, setPartSearchResults] = useState([]);
  const [partSearchLoading, setPartSearchLoading] = useState(false);
  const [activePartLine, setActivePartLine] = useState(null);
  const [savingMode, setSavingMode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const showNotification = useCallback((section, type, message) => {
    if (section === "customer") {
      setCustomerNotification({ type, message });
      setTimeout(() => setCustomerNotification(null), 5000);
    } else if (section === "vehicle") {
      setVehicleNotification({ type, message });
      setTimeout(() => setVehicleNotification(null), 5000);
    }
  }, []);

  const customerName = formatFullName(customerForm);

  const validPartLines = useMemo(
    () => partLines.filter((line) => line.part_name.trim() || line.part_number.trim()),
    [partLines]
  );

  const totals = useMemo(() => {
    const subtotal = validPartLines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
      0
    );
    const discount = validPartLines.reduce((sum, line) => {
      const gross = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
      return sum + gross * Math.min(Math.max(Number(line.discount) || 0, 0), 100) / 100;
    }, 0);
    const delivery = form.delivery_type === "collection" ? 0 : Math.max(Number(form.delivery_charge) || 0, 0);
    const net = subtotal - discount + delivery;
    const vat = net * 0.2;
    return { subtotal: money(subtotal), discount: money(discount), delivery: money(delivery), vat: money(vat), total: money(net + vat) };
  }, [form.delivery_charge, form.delivery_type, validPartLines]);

  useEffect(() => {
    if (!form.assigned_adviser && adviserName) {
      setForm((current) => ({ ...current, assigned_adviser: adviserName }));
    }
  }, [adviserName, form.assigned_adviser]);

  // Keep the editable copy in step with the selected customer, matching /new-job.
  useEffect(() => {
    if (customer) {
      setCustomerForm(normalizeCustomerRecord(customer));
    } else {
      setCustomerForm({ ...initialCustomerFormState });
      setIsCustomerEditing(false);
    }
  }, [customer]);

  const hydrateVehicleFromRecord = useCallback((storedVehicle, { notifyCustomer = false } = {}) => {
    if (!storedVehicle) return;
    const registration = getVehicleRegistration(storedVehicle);
    setVehicle((previous) => hydrateVehicleState(storedVehicle, previous, { registration }));
    if (storedVehicle.customer) {
      setCustomer(normalizeCustomerRecord(storedVehicle.customer));
      if (notifyCustomer) {
        showNotification("customer", "success", "✓ Loaded customer linked to this vehicle");
      }
    }
  }, [showNotification]);

  // Debounced background lookup while the registration is typed — one query per
  // pause rather than one per keystroke.
  useEffect(() => {
    const regTrimmed = (vehicle.reg || "").trim().toUpperCase();
    currentVehicleRegistrationRef.current = regTrimmed;
    if (!regTrimmed || regTrimmed.length < 3) return undefined;
    if (lastVehicleLookupRef.current === regTrimmed) return undefined;

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const storedVehicle = await (await loadVehiclesDb()).getVehicleByReg(regTrimmed);
        lastVehicleLookupRef.current = regTrimmed;
        if (!cancelled && storedVehicle) hydrateVehicleFromRecord(storedVehicle, { notifyCustomer: false });
      } catch (error) {
        logFailure("Automatic vehicle lookup failed", error);
      }
    }, VEHICLE_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [vehicle.reg, hydrateVehicleFromRecord]);

  useEffect(() => {
    if ((vehicle.reg || "").trim()) return;
    currentVehicleRegistrationRef.current = "";
    lastVehicleLookupRef.current = "";
    setVehicleError("");
    setVehicleNotification(null);
    setIsLoadingVehicle(false);
  }, [vehicle.reg]);

  useEffect(() => {
    if (!partSearchOpen) return undefined;
    const term = partSearchQuery.trim();
    if (term.length < 2) {
      setPartSearchResults([]);
      setPartSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setPartSearchLoading(true);
      try {
        const response = await fetch(`/api/parts/catalog?search=${encodeURIComponent(term)}&limit=30`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to search the parts catalogue.");
        if (!cancelled) setPartSearchResults(payload.parts || []);
      } catch (error) {
        logFailure("Parts catalogue search failed:", error);
        if (!cancelled) setErrorMessage(error.message || "Unable to search the parts catalogue.");
      } finally {
        if (!cancelled) setPartSearchLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [partSearchOpen, partSearchQuery]);

  const loadOpenOrders = useCallback(async (record) => {
    const params = new URLSearchParams({ openOnly: "true", limit: "5" });
    if (record?.id) params.set("customerId", record.id);
    else if (formatFullName(record)) params.set("customerName", formatFullName(record));
    else return setCustomerOrders([]);
    try {
      const response = await fetch(`/api/parts/orders?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to check open orders.");
      setCustomerOrders(payload.orders || []);
    } catch (error) {
      logFailure("Open parts order check failed:", error);
      setCustomerOrders([]);
    }
  }, []);

  // Same resolution flow as /new-job: hydrate by id when the popup supplies
  // one, otherwise de-duplicate on email/mobile before inserting.
  const handleCustomerSelect = async (customerData) => {
    try {
      const providedId = customerData?.id || customerData?.customer_id || null;
      let resolvedCustomer = null;

      if (providedId) {
        const hydratedCustomer = await (await loadCustomersDb()).getCustomerById(providedId);
        resolvedCustomer = normalizeCustomerRecord(hydratedCustomer || customerData);
        if (!resolvedCustomer?.id) throw new Error("Customer record missing ID after lookup");
      } else {
        if (!customerData.email && !customerData.mobile) {
          showNotification("customer", "error", "Customer must have at least an email or mobile number.");
          return;
        }
        const normalizedPayload = {
          firstname: customerData.firstName || customerData.firstname || "",
          lastname: customerData.lastName || customerData.lastname || "",
          email: customerData.email || null,
          mobile: customerData.mobile || null,
          telephone: customerData.telephone || null,
          address: customerData.address || null,
          postcode: customerData.postcode || null,
          contact_preference: customerData.contactPreference || customerData.contact_preference || "email",
        };
        const { exists, customer: existingCustomer } = await (await loadCustomersDb()).checkCustomerExists(
          normalizedPayload.email,
          normalizedPayload.mobile
        );
        if (exists && existingCustomer?.id) {
          const hydratedCustomer = await (await loadCustomersDb()).getCustomerById(existingCustomer.id);
          resolvedCustomer = normalizeCustomerRecord(hydratedCustomer || existingCustomer);
        } else {
          const insertedCustomer = await (await loadCustomersDb()).addCustomerToDatabase(normalizedPayload);
          resolvedCustomer = normalizeCustomerRecord(insertedCustomer);
          showNotification("customer", "success", "✓ New customer saved successfully!");
        }
      }

      if (!resolvedCustomer?.id) throw new Error("Customer record missing after save");

      setCustomer(resolvedCustomer);
      setForm((current) => ({
        ...current,
        account_number: customerData.account_number || current.account_number,
        delivery_address: [resolvedCustomer.address, resolvedCustomer.postcode].filter(Boolean).join(", "),
      }));
      loadOpenOrders(resolvedCustomer);

      try {
        const vehicles = await (await loadCustomersDb()).getCustomerVehicles(resolvedCustomer.id);
        const latestVehicle = vehicles?.[0];
        if (latestVehicle) {
          setVehicle((previous) => hydrateVehicleState(latestVehicle, previous, {
            registration: getVehicleRegistration(latestVehicle),
          }));
          setWithoutVehicle(false);
          setVehicleError("");
        }
      } catch (vehicleErr) {
        logFailure("Vehicle lookup failed for customer:", vehicleErr);
      }

      setShowNewCustomer(false);
      setShowExistingCustomer(false);
    } catch (error) {
      logFailure("❌ Error saving customer:", error);
      showNotification("customer", "error", `✗ Error: ${error.message || "Could not save customer"}`);
    }
  };

  const handleCustomerFieldChange = (field, value) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveContactPreference = async (nextPreferences, previousPreferences) => {
    if (!customer?.id) return;
    try {
      setIsSavingCustomer(true);
      const result = await (await loadCustomersDb()).updateCustomer(customer.id, {
        contact_preference: nextPreferences.length ? nextPreferences.join(", ") : "email",
      });
      if (!result?.success || !result?.data) {
        throw new Error(result?.error?.message || "Failed to update contact preference.");
      }
      const normalized = normalizeCustomerRecord(result.data);
      setCustomer(normalized);
      setCustomerForm(normalized);
    } catch (err) {
      logFailure("❌ Error updating contact preference:", err);
      showNotification("customer", "error", `✗ ${err.message || "Failed to update contact preference"}`);
      setCustomerForm((prev) => ({ ...prev, contactPreference: previousPreferences }));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const toggleContactPreference = (value) => {
    setCustomerForm((prev) => {
      const current = Array.isArray(prev.contactPreference) ? prev.contactPreference : [];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      if (customer?.id) saveContactPreference(next, current);
      return { ...prev, contactPreference: next };
    });
  };

  const handleStartCustomerEdit = () => {
    if (!customer) {
      showNotification("customer", "error", "✗ Select a customer first.");
      return;
    }
    setCustomerForm(normalizeCustomerRecord(customer));
    setIsCustomerEditing(true);
  };

  const handleCancelCustomerEdit = () => {
    setCustomerForm(customer ? normalizeCustomerRecord(customer) : { ...initialCustomerFormState });
    setIsCustomerEditing(false);
  };

  const handleSaveCustomerEdits = async () => {
    if (!customer?.id) {
      showNotification("customer", "error", "✗ Please select a customer before editing.");
      return;
    }
    try {
      setIsSavingCustomer(true);
      const result = await (await loadCustomersDb()).updateCustomer(customer.id, buildCustomerUpdatePayload(customerForm));
      if (!result?.success || !result?.data) {
        throw new Error(result?.error?.message || "Failed to update customer.");
      }
      setCustomer(normalizeCustomerRecord(result.data));
      setIsCustomerEditing(false);
      showNotification("customer", "success", "✓ Customer details updated!");
    } catch (err) {
      logFailure("❌ Error updating customer:", err);
      showNotification("customer", "error", `✗ ${err.message || "Failed to update customer"}`);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const viewCustomer = () => {
    if (!customer?.id) return;
    const slug = createCustomerDisplaySlug(customer.firstName, customer.lastName);
    if (slug) router.push(`/customers/${slug}`);
  };

  const handleFieldChange = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // Same lookup order as /new-job: an existing Supabase row wins, DVLA is the
  // fallback.
  const handleFetchVehicleData = async () => {
    if (!vehicle.reg.trim()) {
      setVehicleError("Please enter a registration number");
      showNotification("vehicle", "error", "✗ Please enter a registration number");
      return;
    }

    setIsLoadingVehicle(true);
    setVehicleError("");
    setVehicleNotification(null);
    const requestedRegistration = vehicle.reg.trim().toUpperCase();
    currentVehicleRegistrationRef.current = requestedRegistration;

    try {
      const storedVehicle = await (await loadVehiclesDb()).getVehicleByReg(requestedRegistration);
      if (currentVehicleRegistrationRef.current !== requestedRegistration) return;

      if (storedVehicle) {
        hydrateVehicleFromRecord(storedVehicle, { notifyCustomer: true });
        showNotification("vehicle", "success", "✓ Vehicle details loaded from database!");
        return;
      }

      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: requestedRegistration }),
      });
      const payload = await response.json().catch(() => null);
      if (currentVehicleRegistrationRef.current !== requestedRegistration) return;
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `DVLA lookup failed with status ${response.status}`);
      }
      if (!payload || Object.keys(payload).length === 0) {
        throw new Error("No vehicle data found for that registration from DVLA");
      }

      setVehicle(vehicleStateFromDvla(payload, {
        registration: requestedRegistration,
        previousMileage: vehicle.mileage,
      }));
      setWithoutVehicle(false);
    } catch (error) {
      if (currentVehicleRegistrationRef.current !== requestedRegistration) return;
      logFailure("Error fetching vehicle data from DVLA:", error);
      setVehicleError(`Error: ${error.message}`);
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const handlePartChange = (clientId, field, value) => {
    setPartLines((current) => current.map((line) => {
      if (line.client_id !== clientId) return line;
      const next = { ...line, [field]: value };
      if (field === "part_number" && line.part_catalog_id) {
        next.part_catalog_id = null;
        next.catalog_snapshot = null;
      }
      return next;
    }));
  };

  const addManualPart = () => setPartLines((current) => [...current, blankPart()]);
  const removePart = (clientId) => setPartLines((current) => {
    const next = current.filter((line) => line.client_id !== clientId);
    return next.length ? next : [blankPart()];
  });

  const openPartSearch = (clientId = null, query = "") => {
    setActivePartLine(clientId);
    setPartSearchQuery(query);
    setPartSearchOpen(true);
  };

  const closePartSearch = () => {
    setPartSearchOpen(false);
    setPartSearchQuery("");
    setPartSearchResults([]);
    setActivePartLine(null);
  };

  const selectPart = (part) => {
    const nextLine = {
      ...blankPart(),
      part_catalog_id: part.id,
      part_number: part.part_number || "",
      part_name: part.description || part.name || "",
      unit_price: String(part.unit_price ?? ""),
      catalog_snapshot: {
        name: part.name,
        description: part.description,
        qty_in_stock: part.qty_in_stock,
        qty_reserved: part.qty_reserved,
        qty_on_order: part.qty_on_order,
        storage_location: part.storage_location,
        notes: part.notes,
        oem_reference: part.oem_reference,
      },
    };
    setPartLines((current) => {
      if (activePartLine) return current.map((line) => line.client_id === activePartLine ? { ...line, ...nextLine, client_id: line.client_id } : line);
      const onlyBlank = current.length === 1 && !current[0].part_number && !current[0].part_name;
      return onlyBlank ? [{ ...nextLine, client_id: current[0].client_id }] : [...current, nextLine];
    });
    closePartSearch();
  };

  const clearPartLink = (clientId) => setPartLines((current) => current.map((line) =>
    line.client_id === clientId ? { ...line, part_catalog_id: null, catalog_snapshot: null } : line
  ));

  const clearForm = () => {
    setForm({ ...blankForm, assigned_adviser: adviserName });
    setPartLines([blankPart()]);
    setCustomer(null);
    setCustomerOrders([]);
    setVehicle(createInitialVehicleState());
    setWithoutVehicle(false);
    setVehicleError("");
    setVehicleNotification(null);
    setErrorMessage("");
    closePartSearch();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:drafts:clear-route", { detail: { routeKey: "/new-order" } }));
    }
  };

  const saveOrder = async (status) => {
    if (status !== "draft" && !customerName) return setErrorMessage("Select a customer before creating the order.");
    if (status !== "draft" && validPartLines.length === 0) return setErrorMessage("Add at least one part before creating the order.");
    setSavingMode(status);
    setErrorMessage("");
    try {
      const { make, model } = splitMakeModel(vehicle.makeModel);
      const customerAddress = [customerForm.address, customerForm.postcode].filter(Boolean).join(", ");
      const orderContext = {
        version: 1,
        account_number: form.account_number || null,
        customer_type: form.customer_type,
        pricing_level: form.pricing_level,
        order_source: form.order_source,
        assigned_adviser: form.assigned_adviser,
        department: form.department,
        notifications: { sms: form.notify_sms, email: form.notify_email, phone: form.notify_phone },
        without_vehicle: withoutVehicle,
      };
      const order = {
        status,
        priority: form.priority,
        customer_id: customer?.id || null,
        customer_name: customerName || null,
        customer_phone: (customerForm.mobile || customerForm.telephone || "").trim() || null,
        customer_email: (customerForm.email || "").trim() || null,
        customer_address: customerAddress || null,
        vehicle_id: null,
        vehicle_reg: withoutVehicle ? null : vehicle.reg.trim() || null,
        vehicle_make: withoutVehicle ? null : make || null,
        vehicle_model: withoutVehicle ? null : model || null,
        vehicle_vin: withoutVehicle ? null : vehicle.chassis.trim() || null,
        vehicle_details: {
          reg: withoutVehicle ? null : vehicle.reg,
          make: withoutVehicle ? null : make,
          model: withoutVehicle ? null : model,
          vin: withoutVehicle ? null : vehicle.chassis,
          // No parts-order columns exist for these three — keep them with the
          // order rather than dropping what the adviser entered.
          make_model: withoutVehicle ? null : vehicle.makeModel,
          colour: withoutVehicle ? null : vehicle.colour,
          engine: withoutVehicle ? null : vehicle.engine,
          mileage: withoutVehicle ? null : vehicle.mileage,
          parts_order_context: orderContext,
        },
        notes: form.internal_notes.trim() || null,
        invoice_notes: form.customer_notes.trim() || null,
        invoice_reference: form.customer_reference.trim() || null,
        invoice_total: totals.total,
        invoice_status: form.payment_status,
        delivery_type: form.delivery_type,
        delivery_address: form.delivery_type === "collection" ? null : customerAddress || null,
        delivery_contact: customerName || null,
        delivery_phone: (customerForm.mobile || customerForm.telephone || "").trim() || null,
        delivery_eta: form.delivery_eta || null,
        delivery_window: form.delivery_window || null,
        delivery_status: "pending",
        delivery_notes: form.delivery_notes.trim() || null,
      };
      const items = validPartLines.map((line) => {
        const discount = Math.min(Math.max(Number(line.discount) || 0, 0), 100);
        const basePrice = Number(line.unit_price) || 0;
        const noteParts = [line.notes.trim(), discount ? `Discount ${discount}% from £${basePrice.toFixed(2)}` : ""].filter(Boolean);
        return {
          part_catalog_id: line.part_catalog_id,
          part_number: line.part_number.trim() || null,
          part_name: line.part_name.trim() || null,
          quantity: Number(line.quantity) || 1,
          unit_price: money(basePrice * (1 - discount / 100)),
          notes: noteParts.join(" · ") || null,
        };
      });
      const response = await fetch("/api/parts/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, items, reserveStock: status !== "draft" && form.reserve_stock }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to save the parts order.");
      window.dispatchEvent(new CustomEvent("app:drafts:clear-route", { detail: { routeKey: "/new-order" } }));
      await router.push(`/new-order/${payload.order.order_number}`);
    } catch (error) {
      logFailure("Parts order save failed:", error);
      setErrorMessage(error.message || "Unable to save the parts order.");
    } finally {
      setSavingMode("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveOrder("booked");
  };

  if (!hasPartsAccess) return <PartsCreateOrderUi view="access-denied" />;

  return (
    <PartsCreateOrderUi
      view="workflow"
      CalendarField={CalendarField}
      ExistingCustomerPopup={ExistingCustomerPopup}
      NewCustomerPopup={NewCustomerPopup}
      SearchBar={SearchBar}
      TimePickerField={TimePickerField}
      addManualPart={addManualPart}
      clearForm={clearForm}
      clearPartLink={clearPartLink}
      closePartSearch={closePartSearch}
      customer={customer}
      customerFieldDefinitions={CUSTOMER_FIELD_DEFINITIONS}
      customerForm={customerForm}
      customerNotification={customerNotification}
      customerOrders={customerOrders}
      errorMessage={errorMessage}
      form={form}
      handleCancelCustomerEdit={handleCancelCustomerEdit}
      handleCustomerFieldChange={handleCustomerFieldChange}
      handleCustomerSelect={handleCustomerSelect}
      handleFetchVehicleData={handleFetchVehicleData}
      handleFieldChange={handleFieldChange}
      handlePartChange={handlePartChange}
      handleSaveCustomerEdits={handleSaveCustomerEdits}
      handleStartCustomerEdit={handleStartCustomerEdit}
      handleSubmit={handleSubmit}
      isCustomerEditing={isCustomerEditing}
      isLoadingVehicle={isLoadingVehicle}
      isSavingCustomer={isSavingCustomer}
      newCustomerPrefill={newCustomerPrefill}
      openPartSearch={openPartSearch}
      partLines={partLines}
      partSearchLoading={partSearchLoading}
      partSearchOpen={partSearchOpen}
      partSearchQuery={partSearchQuery}
      partSearchResults={partSearchResults}
      removePart={removePart}
      savingMode={savingMode}
      selectPart={selectPart}
      setCustomer={setCustomer}
      setCustomerNotification={setCustomerNotification}
      setNewCustomerPrefill={setNewCustomerPrefill}
      setPartSearchQuery={setPartSearchQuery}
      setShowExistingCustomer={setShowExistingCustomer}
      setShowNewCustomer={setShowNewCustomer}
      setVehicle={setVehicle}
      setVehicleNotification={setVehicleNotification}
      setWithoutVehicle={setWithoutVehicle}
      showExistingCustomer={showExistingCustomer}
      showNewCustomer={showNewCustomer}
      toggleContactPreference={toggleContactPreference}
      totals={totals}
      vehicle={vehicle}
      vehicleError={vehicleError}
      vehicleNotification={vehicleNotification}
      viewCustomer={viewCustomer}
      withoutVehicle={withoutVehicle}
    />
  );
}
