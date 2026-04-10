// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/create/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"; // import React hooks including useEffect/useCallback/useRef for syncing customer forms
import { useRouter } from "next/router"; // for navigation
import Layout from "@/components/Layout"; // import layout wrapper
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useJobs } from "@/context/JobsContext"; // import jobs context
import { useUser } from "@/context/UserContext"; // import user context for signature + uploads
import {
  addCustomerToDatabase,
  checkCustomerExists,
  getCustomerById,
  getCustomerVehicles,
  updateCustomer,
} from "@/lib/database/customers";
import { getVehicleByReg } from "@/lib/database/vehicles";
import { getJobByNumber } from "@/lib/database/jobs";
import { createFullJobBatch } from "@/lib/services/createJobService"; // consolidated job creation service
import { supabase } from "@/lib/supabaseClient"; // import supabase client for signature lookups
import NewCustomerPopup from "@/components/popups/NewCustomerPopup"; // import new customer popup
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup"; // import existing customer popup
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import RequestPresetAutosuggestInput from "@/components/JobCards/RequestPresetAutosuggestInput";
import { getVehicleRegistration } from "@/lib/canonical/fields";
import { DropdownField } from "@/components/dropdownAPI";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { detectJobTypesForRequests } from "@/lib/ai/jobTypeDetection";
import { isDiagnosticRequestText } from "@/lib/jobRequestPresets/constants";

const PAYMENT_TYPE_OPTIONS = [
  { value: "Customer", label: "Customer" },
  { value: "Warranty", label: "Warranty" },
  { value: "Sales Goodwill", label: "Sales Goodwill" },
  { value: "Service Goodwill", label: "Service Goodwill" },
  { value: "Internal", label: "Internal" },
  { value: "Insurance", label: "Insurance" },
  { value: "Lease Company", label: "Lease Company" },
  { value: "Staff", label: "Staff" },
];

 

const initialCustomerFormState = {
  id: null, // stores currently selected customer's UUID
  firstName: "", // stores customer first name for form binding
  lastName: "", // stores customer last name for form binding
  email: "", // stores customer email address
  mobile: "", // stores customer mobile number
  telephone: "", // stores customer telephone number
  address: "", // stores customer street address
  postcode: "", // stores customer postcode
  contactPreference: ["email"], // stores customer preferred contact option(s)
};

const normalizeCustomerRecord = (record = {}) => ({
  id: record?.id || record?.customer_id || null, // prefer Supabase UUID and fall back to nested keys
  firstName: record?.firstname || record?.firstName || initialCustomerFormState.firstName, // normalize first name casing
  lastName: record?.lastname || record?.lastName || initialCustomerFormState.lastName, // normalize last name casing
  email: record?.email || initialCustomerFormState.email, // normalize email field
  mobile: record?.mobile || initialCustomerFormState.mobile, // normalize mobile field
  telephone: record?.telephone || initialCustomerFormState.telephone, // normalize telephone field
  address: record?.address || initialCustomerFormState.address, // normalize address field
  postcode: record?.postcode || initialCustomerFormState.postcode, // normalize postcode field
  contactPreference: (() => {
    const raw =
      record?.contact_preference ??
      record?.contactPreference ??
      initialCustomerFormState.contactPreference;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLowerCase());
      if (cleaned.length) return cleaned;
      return [raw.toLowerCase()];
    }
    return initialCustomerFormState.contactPreference;
  })(), // normalize contact preference field
});

export default function CreateJobCardPage() {
  const router = useRouter(); // Next.js router for navigation
  const { fetchJobs } = useJobs(); // refresh job cache after saves
  const { dbUserId } = useUser(); // get Supabase user id for uploads + signatures
  const checkSheetCanvasRef = useRef(null); // ref for check-sheet canvas to calculate click offsets

  // state for vehicle information
  const [vehicle, setVehicle] = useState({
    reg: "", // vehicle registration number
    colour: "", // vehicle colour
    makeModel: "", // vehicle make and model combined
    chassis: "", // chassis/VIN number
    engine: "", // engine number
    mileage: "", // current mileage
  });

  const [customer, setCustomer] = useState(null); // selected customer object
  const [customerForm, setCustomerForm] = useState(() => ({ ...initialCustomerFormState })); // editable copy of customer fields
  const [isCustomerEditing, setIsCustomerEditing] = useState(false); // controls whether inputs are editable
  const [isSavingCustomer, setIsSavingCustomer] = useState(false); // tracks when customer updates are being persisted
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false); // loading state for DVLA API call
  const [error, setError] = useState(""); // error message for vehicle fetch

  // ✅ Notification states
  const [customerNotification, setCustomerNotification] = useState(null); // { type: 'success' | 'error', message: '' }
  const [vehicleNotification, setVehicleNotification] = useState(null); // { type: 'success' | 'error', message: '' }

  // ✅ Multi-tab job state - each tab represents a separate job card
  const createDefaultJobTab = (tabId = 1) => ({
    id: tabId,
    waitingStatus: "Neither",
    jobSource: "Retail",
    jobDivision: "Retail",
    jobCategories: [],
    jobDetections: [],
    requests: [{ text: "", time: "", paymentType: "Customer", presetId: null }],
    uploadedFiles: [],
  });

  const [jobTabs, setJobTabs] = useState([createDefaultJobTab(1)]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [lastDetectionSignature, setLastDetectionSignature] = useState("");

  // Get current tab data
  const currentTab = jobTabs[activeTabIndex] || jobTabs[0];

  // Helper to update current tab
  const updateCurrentTab = (updates) => {
    setJobTabs((prev) => {
      const newTabs = [...prev];
      newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], ...updates };
      return newTabs;
    });
  };

  // Convenience getters/setters for current tab (maintains compatibility)
  const requests = currentTab.requests;
  const setRequests = (newRequests) => updateCurrentTab({ requests: typeof newRequests === "function" ? newRequests(currentTab.requests) : newRequests });
  const waitingStatus = currentTab.waitingStatus;
  const setWaitingStatus = (val) => updateCurrentTab({ waitingStatus: val });
  const jobSource = currentTab.jobSource;
  const setJobSource = (val) => updateCurrentTab({ jobSource: val });
  const jobCategories = currentTab.jobCategories;
  const setJobCategories = (val) => updateCurrentTab({ jobCategories: val });
  const jobDetections = currentTab.jobDetections || [];
  const setJobDetections = (val) => updateCurrentTab({ jobDetections: val });
  const uploadedFiles = currentTab.uploadedFiles;
  const setUploadedFiles = (val) => updateCurrentTab({ uploadedFiles: typeof val === "function" ? val(currentTab.uploadedFiles) : val });
  const visibleJobDetections = jobDetections.filter((d) => d.sourceText);
  const populatedRequests = requests
    .map((request, index) => ({
      index,
      text: String(request?.text || "").trim(),
    }))
    .filter((request) => request.text);

  // Shared state (same across all tabs)
  const [cosmeticDamagePresent, setCosmeticDamagePresent] = useState(false); // track whether cosmetic damage observed
  const [cosmeticNotes, setCosmeticNotes] = useState(""); // notes about cosmetic damage
  const [washRequired, setWashRequired] = useState(false); // whether the vehicle needs washing after workshop
  const [vhcRequired, setVhcRequired] = useState(false); // whether VHC is required
  const WAITING_STATUS_STORAGE_KEY = "jobCardCreateWaitingStatus"; // key used to persist waiting status background choice
  const WASH_REQUIRED_STORAGE_KEY = "jobCardCreateWashRequired"; // key used to persist wash choice when revisiting the create page
  const [showNewCustomer, setShowNewCustomer] = useState(false); // toggle new customer popup
  const [showExistingCustomer, setShowExistingCustomer] = useState(false); // toggle existing customer popup
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false); // toggle documents popup
  const [showDetectedRequestsPopup, setShowDetectedRequestsPopup] = useState(false); // toggle detected requests popup
  const [newCustomerPrefill, setNewCustomerPrefill] = useState({ firstName: "", lastName: "" });

  // ✅ Tab management functions
  const addNewJobTab = () => {
    const newTabId = jobTabs.length + 1;
    setJobTabs((prev) => [...prev, createDefaultJobTab(newTabId)]);
    setActiveTabIndex(jobTabs.length); // Switch to new tab
  };

  const removeJobTab = (indexToRemove) => {
    if (jobTabs.length <= 1) return; // Keep at least one tab
    setJobTabs((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    // Adjust active tab if needed
    if (activeTabIndex >= indexToRemove && activeTabIndex > 0) {
      setActiveTabIndex(activeTabIndex - 1);
    }
  };
  const [checkSheetFile, setCheckSheetFile] = useState(null); // uploaded check-sheet file before save
  const [checkSheetPreviewUrl, setCheckSheetPreviewUrl] = useState(""); // preview URL for image check-sheets
  const [checkSheetCheckboxes, setCheckSheetCheckboxes] = useState([]); // list of checkbox metadata for current sheet
  const [userSignature, setUserSignature] = useState(null); // store current user's signature metadata
  const [isUploadingSignature, setIsUploadingSignature] = useState(false); // track signature upload state
  const lastVehicleLookupRef = useRef(""); // track last registration looked up to avoid duplicate fetches
  const vehicleSectionRef = useRef(null); // ref for measuring vehicle section height
  const [topRowHeight, setTopRowHeight] = useState(null); // sync top row card heights

  // ✅ Prime/Sub-job state
  const [isSubJobMode, setIsSubJobMode] = useState(false); // true when creating a sub-job under a prime job
  const [primeJobData, setPrimeJobData] = useState(null); // prime job data when in sub-job mode
  const [asPrimeJob, setAsPrimeJob] = useState(false); // checkbox to create this job as a prime job

  useEffect(() => { // sync editable form with whichever customer is selected
    if (customer) { // when a customer exists use their values
      setCustomerForm(normalizeCustomerRecord(customer)); // copy normalized customer data into the form controls
    } else { // when customer cleared
      setCustomerForm({ ...initialCustomerFormState }); // reset the form fields to defaults
    }
    setIsCustomerEditing(false); // always exit edit mode on change
    setIsSavingCustomer(false); // clear any pending loading state
  }, [customer]); // rerun whenever the selected customer reference changes

  useEffect(() => { // fetch stored signature for logged in user
    let cancelled = false; // guard against state updates after unmount

    const fetchSignature = async () => {
      if (!dbUserId) { // if no db user id available
        setUserSignature(null); // reset signature state
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("user_id, signature_file_url, signature_storage_path")
        .eq("user_id", dbUserId)
        .maybeSingle();

      if (!cancelled) {
        if (error) {
          console.warn("Signature lookup failed", error.message);
          setUserSignature(null);
        } else {
          setUserSignature(data || null);
        }
      }
    };

    fetchSignature();
    return () => {
      cancelled = true;
    };
  }, [dbUserId]);

  useEffect(() => {
    const signature = (requests || [])
      .map((req) => (req?.text || "").trim())
      .join("||");
    if (signature === lastDetectionSignature) return;
    const detections = detectJobTypesForRequests(requests);
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
    setLastDetectionSignature(signature);
  }, [requests, lastDetectionSignature, setJobDetections, setJobCategories]);

  useLayoutEffect(() => {
    const node = vehicleSectionRef.current;
    if (!node) return;

    const updateHeight = () => {
      const nextHeight = node.offsetHeight;
      setTopRowHeight(nextHeight > 0 ? nextHeight : null);
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(node);
      window.addEventListener("resize", updateHeight);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", updateHeight);
      };
    }

    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => () => { // cleanup preview object URLs when component unmounts or url changes
    if (checkSheetPreviewUrl) {
      URL.revokeObjectURL(checkSheetPreviewUrl);
    }
  }, [checkSheetPreviewUrl]);

  useEffect(() => { // load persisted waiting status for consistent background when revisiting the page
    if (typeof window === "undefined") return; // ensure browser environment before accessing localStorage
    const storedStatus = localStorage.getItem(WAITING_STATUS_STORAGE_KEY); // read stored value
    if (storedStatus && ["Waiting", "Loan Car", "Collection", "Neither"].includes(storedStatus)) { // validate stored option
      setWaitingStatus(storedStatus); // apply stored status to restore background colour
    }
  }, []); // run once on mount

  useEffect(() => { // persist waiting status selection for future visits
    if (typeof window === "undefined") return; // guard for SSR
    localStorage.setItem(WAITING_STATUS_STORAGE_KEY, waitingStatus); // store the selection for next visit
  }, [waitingStatus]); // run whenever waiting status changes

  useEffect(() => { // load persisted wash selection when revisiting the page
    if (typeof window === "undefined") return; // ensure browser environment before accessing localStorage
    const storedWashChoice = localStorage.getItem(WASH_REQUIRED_STORAGE_KEY); // restore explicit yes/no choice when present
    if (storedWashChoice === "true" || storedWashChoice === "false") {
      setWashRequired(storedWashChoice === "true");
    }
  }, []); // run once on mount

  useEffect(() => { // persist wash selection for future visits
    if (typeof window === "undefined") return; // guard for SSR
    localStorage.setItem(WASH_REQUIRED_STORAGE_KEY, String(washRequired)); // store the selection for next visit
  }, [washRequired]); // run whenever wash selection changes

  // ✅ Detect sub-job mode from query param ?primeJob=XXXXX
  useEffect(() => {
    const primeJobNumber = router.query?.primeJob;
    if (!primeJobNumber) {
      setIsSubJobMode(false);
      setPrimeJobData(null);
      return;
    }

    const fetchPrimeJob = async () => {
      console.log("📋 Sub-job mode: fetching prime job", primeJobNumber);
      const result = await getJobByNumber(primeJobNumber);
      if (result.success && result.data) {
        setPrimeJobData(result.data);
        setIsSubJobMode(true);

        // Pre-fill customer and vehicle from prime job
        if (result.data.customerId) {
          const normalizedCustomer = {
            id: result.data.customerId,
            firstName: result.data.customer?.split(" ")[0] || "",
            lastName: result.data.customer?.split(" ").slice(1).join(" ") || "",
            email: result.data.customerEmail || "",
            mobile: result.data.customerPhone || "",
            telephone: "",
            address: result.data.customerAddress || "",
            postcode: result.data.customerPostcode || "",
          };
          setCustomer(normalizedCustomer);
          setCustomerForm(normalizedCustomer);
        }

        if (result.data.reg) {
          setVehicle({
            reg: result.data.reg || "",
            colour: result.data.colour || "",
            makeModel: result.data.makeModel || "",
            chassis: result.data.vin || result.data.chassis || "",
            engine: result.data.engine || "",
            mileage:
              result.data.mileage === null || result.data.mileage === undefined
                ? ""
                : String(result.data.mileage),
          });
        }

        console.log("✅ Prime job loaded for sub-job creation:", result.data.jobNumber);
      } else {
        console.error("❌ Failed to fetch prime job:", primeJobNumber);
        setIsSubJobMode(false);
        setPrimeJobData(null);
      }
    };

    fetchPrimeJob();
  }, [router.query?.primeJob]);

  // function to determine background color based on waiting status and job source
  const getBackgroundColor = (status, source) => {
    let baseColor = "var(--info-surface)"; // light grey background
    switch (status) {
      case "Waiting":
        baseColor = "var(--danger-surface)"; // red tint for waiting
        break;
      case "Loan Car":
        baseColor = "var(--info-surface)"; // blue tint for loan car
        break;
      case "Collection":
        baseColor = "var(--success-surface)"; // green tint for collection
        break;
      default:
        baseColor = "var(--info-surface)"; // default background
    }
    if (source === "Warranty") { // check if job source is warranty
      if (baseColor === "var(--info-surface)") return "var(--warning-surface)"; // add orange tint when neutral
      return baseColor; // keep existing tint otherwise
    }
    return baseColor; // return computed background
  };

  // handle changes to request text and auto-detect job types
  const handleRequestChange = (index, value) => {
    const updated = [...requests]; // copy current requests
    updated[index].text = value; // update text at index
    if (updated[index]?.presetId && String(value || "").trim() !== String(updated[index].selectedPresetLabel || "").trim()) {
      updated[index].presetId = null;
      updated[index].selectedPresetLabel = "";
    }
    if (isDiagnosticRequestText(value)) {
      updated[index].time = "1.00";
    }
    const detections = detectJobTypesForRequests(updated);
    setRequests(updated); // store updated list
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
  };

  // handle changes to estimated time for a request
  const handleTimeChange = (index, value) => {
    const updated = [...requests]; // copy current requests
    const raw = String(value ?? "").trim();
    if (raw === "") {
      updated[index].time = "";
      setRequests(updated); // store updated list
      return;
    }

    const normalizedRaw = raw.startsWith(".") ? `0${raw}` : raw;
    if (!/^\d+(\.\d{0,2})?$/.test(normalizedRaw)) {
      return;
    }

    let num = Number(normalizedRaw); // parse numeric value
    if (!Number.isFinite(num) || num < 0) num = 0; // ensure valid number
    updated[index].time = normalizedRaw; // keep editing-friendly raw value
    setRequests(updated); // store updated list
  };

  const normalizeHoursToTwoDecimals = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    let numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) numeric = 0;
    return numeric.toFixed(2);
  };

  const persistPresetDefaultHours = async (requestEntry = {}) => {
    const requestText = String(requestEntry?.text || "").trim();
    const parsedHours = Number(requestEntry?.time);
    if (!requestText) return;
    if (!Number.isFinite(parsedHours) || parsedHours < 0) return;

    try {
      await fetch("/api/job-requests/presets/update-default-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: requestEntry?.presetId || null,
          requestText,
          hours: parsedHours,
        }),
      });
    } catch (error) {
      console.error("Failed to persist preset default hours", error);
    }
  };

  // handle changes to payment type for a request
  const handlePaymentTypeChange = (index, value) => {
    const updated = [...requests]; // copy current requests
    updated[index].paymentType = value; // update payment type
    if (value === "Warranty") setJobSource("Warranty"); // auto-set job source if warranty selected
    setRequests(updated); // store updated list
  };

  // add a new empty request to the list
  const handleAddRequest = () => {
    const nextRequests = [...requests, { text: "", time: "", paymentType: "Customer", presetId: null }];
    const detections = detectJobTypesForRequests(nextRequests);
    setRequests(nextRequests);
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
  }; // append new empty request

  const sectionCardStyle = {
    background: "var(--layer-section-level-2)",
    border: "none",
  };

  const jobCardSelectorOptions = jobTabs.map((tab, index) => ({
    id: tab.id,
    index,
    label: `Job${index + 1}`,
  }));
  const hasLinkedJobCards = jobCardSelectorOptions.length > 1;

  const binaryToggleGroupStyle = {
    display: "flex",
    gap: "8px",
    padding: "6px",
    borderRadius: "var(--control-radius)",
    backgroundColor: "var(--surface)",
    border: "none",
    width: "fit-content",
  };

  const getBinaryToggleButtonStyle = (isSelected) => ({
    padding: "6px 14px",
    borderRadius: "var(--control-radius)",
    border: isSelected ? "1px solid var(--primary)" : "1px solid transparent",
    backgroundColor: isSelected ? "var(--surface)" : "transparent",
    color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: isSelected ? "600" : "500",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  const jobInfoOptionGroupStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    width: "100%",
  };

  const getJobInfoOptionStyle = (isSelected) => ({
    width: "100%",
    maxWidth: "320px",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "12px 16px",
    borderRadius: "var(--radius-xs)",
    border: isSelected ? "1px solid var(--primary)" : "1px solid var(--accent-border)",
    backgroundColor: "var(--surface)",
    color: isSelected ? "var(--primary)" : "var(--text-primary)",
    transition: "all 0.2s",
    fontWeight: isSelected ? 600 : 500,
  });

  const customerFieldDefinitions = [
    { label: "First Name", field: "firstName", type: "text", placeholder: "" },
    { label: "Last Name", field: "lastName", type: "text", placeholder: "" },
    { label: "Email", field: "email", type: "email", placeholder: "" },
    { label: "Mobile", field: "mobile", type: "tel", placeholder: "" },
    { label: "Telephone", field: "telephone", type: "tel", placeholder: "" },
    { label: "Address", field: "address", type: "textarea", placeholder: "" },
    { label: "Contact Preference", field: "contactPreference", type: "multi-select" },
  ];

  // remove a request from the list by index
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index); // remove request at index
    const detections = detectJobTypesForRequests(updated);
    setRequests(updated); // store updated list
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
  };

  // ✅ Show notification and auto-hide after 5 seconds
  const showNotification = (section, type, message) => {
    if (section === "customer") { // check if customer section should show notification
      setCustomerNotification({ type, message }); // set notification
      setTimeout(() => setCustomerNotification(null), 5000); // auto-hide after 5 seconds
    } else if (section === "vehicle") { // check if vehicle section should show notification
      setVehicleNotification({ type, message }); // set notification
      setTimeout(() => setVehicleNotification(null), 5000); // auto-hide after 5 seconds
    }
  };

  const hydrateVehicleFromRecord = useCallback(
    (storedVehicle, { notifyCustomer = false } = {}) => { // copy Supabase vehicle into local form state
      if (!storedVehicle) { // guard when no record provided
        return; // nothing to hydrate
      }

      const normalizedReg = getVehicleRegistration(storedVehicle); // normalize registration text
      const combinedMakeModel = (storedVehicle.make_model || `${storedVehicle.make || ""} ${storedVehicle.model || ""}`)
        .trim(); // build make/model label

      setVehicle((prev) => ({ // merge values into form state
        ...prev,
        reg: normalizedReg || prev.reg,
        makeModel: combinedMakeModel || prev.makeModel,
        colour: storedVehicle.colour || prev.colour,
        chassis: storedVehicle.chassis || storedVehicle.vin || prev.chassis,
        engine: storedVehicle.engine || storedVehicle.engine_number || prev.engine,
        mileage:
          storedVehicle.mileage === null || storedVehicle.mileage === undefined
            ? prev.mileage
            : String(storedVehicle.mileage),
      }));

      if (storedVehicle.mot_due) { // hydrate MOT date when available
        const motDate = new Date(storedVehicle.mot_due);
        if (!Number.isNaN(motDate.getTime())) {
          setNextMotDate(motDate.toISOString().split("T")[0]); // store ISO date for preview
        }
      }

      if (storedVehicle.customer) { // auto-link stored customer when present
        setCustomer(normalizeCustomerRecord(storedVehicle.customer));
        if (notifyCustomer) {
          showNotification("customer", "success", "✓ Loaded customer linked to this vehicle");
        }
      }
    },
    [normalizeCustomerRecord, showNotification]
  );

  useEffect(() => { // auto-fetch vehicle details from Supabase when registration changes
    const regTrimmed = (vehicle.reg || "").trim().toUpperCase(); // normalized registration input
    if (!regTrimmed || regTrimmed.length < 3) { // skip when not enough characters
      return;
    }

    if (lastVehicleLookupRef.current === regTrimmed) { // avoid duplicate lookups
      return;
    }

    let cancelled = false; // track cleanup flag

    const lookupVehicle = async () => {
      try {
        const storedVehicle = await getVehicleByReg(regTrimmed); // query Supabase for existing vehicle row
        lastVehicleLookupRef.current = regTrimmed; // mark lookup as completed for this reg
        if (!cancelled && storedVehicle) {
          hydrateVehicleFromRecord(storedVehicle, { notifyCustomer: false }); // hydrate local form state
        }
      } catch (err) {
        console.error("Automatic vehicle lookup failed", err); // log lookup failures without blocking user
      }
    };

    lookupVehicle();

    return () => {
      cancelled = true; // prevent state updates after unmount or reg change
    };
  }, [vehicle.reg, hydrateVehicleFromRecord]);

  // update the editable customer form when any field changes
  const handleCustomerFieldChange = (field, value) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveContactPreference = async (nextPreferences, previousPreferences) => {
    if (!customer?.id) {
      return;
    }

    try {
      setIsSavingCustomer(true);
      const updatePayload = {
        contact_preference: nextPreferences.length ? nextPreferences.join(", ") : "email",
      };

      const result = await updateCustomer(customer.id, updatePayload);
      if (!result?.success || !result?.data) {
        throw new Error(result?.error?.message || "Failed to update contact preference.");
      }

      const normalized = normalizeCustomerRecord(result.data);
      setCustomer(normalized);
      setCustomerForm(normalized);
    } catch (err) {
      console.error("❌ Error updating contact preference:", err);
      showNotification("customer", "error", `✗ ${err.message || "Failed to update contact preference"}`);
      setCustomerForm((prev) => ({ ...prev, contactPreference: previousPreferences }));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const toggleContactPreference = (value) => {
    setCustomerForm((prev) => {
      const current = Array.isArray(prev.contactPreference)
        ? prev.contactPreference
        : [];
      const previous = current;
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      if (customer?.id) {
        saveContactPreference(next, previous);
      }

      return { ...prev, contactPreference: next };
    });
  };

  // enable editing mode and refresh the editable copy
  const handleStartCustomerEdit = () => {
    if (!customer) {
      showNotification("customer", "error", "✗ Select a customer first.");
      return;
    }
    setCustomerForm(normalizeCustomerRecord(customer));
    setIsCustomerEditing(true);
  };

  // revert form values and exit edit mode
  const handleCancelCustomerEdit = () => {
    if (customer) {
      setCustomerForm(normalizeCustomerRecord(customer));
    } else {
      setCustomerForm({ ...initialCustomerFormState });
    }
    setIsCustomerEditing(false);
  };

  // persist customer edits to Supabase and refresh the UI copy
  const handleSaveCustomerEdits = async () => {
    if (!customer?.id) {
      showNotification("customer", "error", "✗ Please select a customer before editing.");
      return;
    }

    try {
      setIsSavingCustomer(true);

      const toNullable = (value) => {
        if (Array.isArray(value)) {
          const joined = value.map((item) => String(item).trim()).filter(Boolean).join(", ");
          return joined.length ? joined : null;
        }
        const trimmed = (value || "").trim();
        return trimmed.length ? trimmed : null;
      };

      const updatePayload = {
        firstname: (customerForm.firstName || "").trim(),
        lastname: (customerForm.lastName || "").trim(),
        email: toNullable(customerForm.email),
        mobile: toNullable(customerForm.mobile),
        telephone: toNullable(customerForm.telephone),
        address: toNullable(customerForm.address),
        postcode: toNullable(customerForm.postcode),
        contact_preference: toNullable(customerForm.contactPreference) || "email",
      };

      const result = await updateCustomer(customer.id, updatePayload);

      if (!result?.success || !result?.data) {
        throw new Error(result?.error?.message || "Failed to update customer.");
      }

      const normalized = normalizeCustomerRecord(result.data);
      setCustomer(normalized);
      showNotification("customer", "success", "✓ Customer details updated!");
    } catch (err) {
      console.error("❌ Error updating customer:", err);
      showNotification("customer", "error", `✗ ${err.message || "Failed to update customer"}`);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // saveJobRequestsToDatabase, saveJobRequestDetections, saveCosmeticDamageDetails,
  // and saveCustomerStatus have been moved to src/lib/services/createJobService.js

  const captureTempUploadMetadata = useCallback((metadataList = []) => {
    if (!Array.isArray(metadataList) || metadataList.length === 0) {
      return;
    }

    setUploadedFiles((prev) => {
      const existingKeys = new Set(
        prev.map((item) => `${item.jobId || "temp"}-${item.fileName}`)
      );
      const filtered = metadataList.filter((item) => {
        const key = `${item.jobId || "temp"}-${item.fileName}`;
        return !existingKeys.has(key);
      });
      return filtered.length === 0 ? prev : [...prev, ...filtered];
    });
  }, []);

  const handleCheckSheetFileChange = (file) => { // respond to user selecting a check-sheet file
    if (!file) {
      setCheckSheetFile(null);
      setCheckSheetPreviewUrl("");
      setCheckSheetCheckboxes([]);
      return;
    }

    if (checkSheetPreviewUrl) {
      URL.revokeObjectURL(checkSheetPreviewUrl); // release existing preview url
    }

    const isImage = file.type?.startsWith("image/");
    const preview = isImage ? URL.createObjectURL(file) : ""; // create preview for images only

    setCheckSheetFile(file);
    setCheckSheetPreviewUrl(preview);
    setCheckSheetCheckboxes([]); // reset checkbox layout when new file selected
  };

  const handleCheckSheetCanvasClick = (event) => { // add checkbox metadata at click position
    if (!checkSheetFile || (!checkSheetPreviewUrl && !checkSheetFile.type?.includes("pdf"))) {
      return; // skip when no sheet ready
    }

    const container = checkSheetCanvasRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;

    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      return; // ignore clicks outside bounds
    }

    setCheckSheetCheckboxes((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `Check Item ${prev.length + 1}`,
        x: Number(xRatio.toFixed(4)),
        y: Number(yRatio.toFixed(4)),
      },
    ]);
  };

  const handleCheckboxLabelChange = (checkboxId, value) => { // update checkbox label text
    setCheckSheetCheckboxes((prev) =>
      prev.map((box) =>
        box.id === checkboxId
          ? {
              ...box,
              label: value,
            }
          : box
      )
    );
  };

  const handleRemoveCheckbox = (checkboxId) => { // delete a checkbox configuration
    setCheckSheetCheckboxes((prev) => prev.filter((box) => box.id !== checkboxId));
  };

  const handleSignatureUpload = async (file) => { // upload/update the current user's signature asset
    if (!file || !dbUserId) {
      alert("Please log in before uploading a signature");
      return;
    }

    setIsUploadingSignature(true);
    try {
      const ext = file.name?.split(".").pop() || "png";
      const objectPath = `users/${dbUserId}/signature.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("user-signatures")
        .upload(objectPath, file, {
          contentType: file.type || "image/png",
          upsert: true,
        });

      if (storageError) {
        throw new Error(storageError.message);
      }

      const publicUrl = supabase.storage.from("user-signatures").getPublicUrl(objectPath).data.publicUrl;

      // Users table writes are restricted to HR Manager > Employees and password reset flow.
      // Keep uploaded signature available in current UI state for this session only.
      setUserSignature({
        user_id: dbUserId,
        signature_storage_path: objectPath,
        signature_file_url: publicUrl,
      });
    } catch (err) {
      console.error("Signature upload failed", err);
      alert(err.message || "Failed to upload signature");
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const saveCheckSheetData = async (jobId) => { // persist check-sheet file + checkbox metadata to DB
    if (!jobId || !checkSheetFile) {
      return; // nothing to save when no sheet selected
    }

    try {
      const ext = checkSheetFile.name?.split(".").pop() || "png";
      const storagePath = `jobs/${jobId}/checksheets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("job-documents")
        .upload(storagePath, checkSheetFile, {
          contentType: checkSheetFile.type || "application/octet-stream",
          upsert: false,
        });

      if (storageError) {
        throw new Error(storageError.message);
      }

      const publicUrl = supabase.storage.from("job-documents").getPublicUrl(storagePath).data.publicUrl;

      const signatureUrl = userSignature?.signature_file_url || null;

      const { data: sheetRecord, error: sheetError } = await supabase
        .from("job_check_sheets")
        .insert([
          {
            job_id: jobId,
            file_name: checkSheetFile.name,
            file_url: publicUrl,
            storage_path: storagePath,
            file_type: checkSheetFile.type || "application/octet-stream",
            created_by: dbUserId || null,
            signature_url: signatureUrl,
          },
        ])
        .select()
        .single();

      if (sheetError) {
        throw new Error(sheetError.message);
      }

      const sheetId = sheetRecord.sheet_id || sheetRecord.id;

      if (sheetId && checkSheetCheckboxes.length > 0) {
        const checkboxPayload = checkSheetCheckboxes.map((box, index) => ({
          sheet_id: sheetId,
          label: box.label || `Item ${index + 1}`,
          position_x: box.x,
          position_y: box.y,
        }));

        const { error: checkboxError } = await supabase
          .from("job_check_sheet_checkboxes")
          .insert(checkboxPayload);

        if (checkboxError) {
          throw new Error(checkboxError.message);
        }
      }
    } finally {
      setCheckSheetFile(null);
      setCheckSheetCheckboxes([]);
      setCheckSheetPreviewUrl("");
    }
  };

  // ✅ Handle customer selection with shared database helpers
  const handleCustomerSelect = async (customerData) => {
    console.log("Attempting to save customer:", customerData); // debug log for incoming data

    try {
      const providedId = customerData?.id || customerData?.customer_id || null; // detect if record already exists
      let resolvedCustomer = null; // store whichever record gets hydrated

      if (providedId) { // when popup sent an ID we just hydrate the row
        console.log("Existing customer selected by ID:", providedId);
        const hydratedCustomer = await getCustomerById(providedId);
        const recordToUse = hydratedCustomer || customerData;
        resolvedCustomer = normalizeCustomerRecord(recordToUse);
        if (!resolvedCustomer?.id) {
          throw new Error("Customer record missing ID after lookup");
        }
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

        const { exists, customer: existingCustomer } = await checkCustomerExists(
          normalizedPayload.email,
          normalizedPayload.mobile
        );

        if (exists && existingCustomer?.id) {
          console.log("Customer already exists in database:", existingCustomer);
          const hydratedCustomer = await getCustomerById(existingCustomer.id);
          const recordToUse = hydratedCustomer || existingCustomer;
          resolvedCustomer = normalizeCustomerRecord(recordToUse);
        } else {
          console.log("Customer not found, creating new customer...");
          const insertedCustomer = await addCustomerToDatabase(normalizedPayload);
          resolvedCustomer = normalizeCustomerRecord(insertedCustomer);
          showNotification("customer", "success", "✓ New customer saved successfully!");
        }
      }

      if (!resolvedCustomer?.id) {
        throw new Error("Customer record missing after save");
      }

      setCustomer(resolvedCustomer);
      try {
        const vehicles = await getCustomerVehicles(resolvedCustomer.id);
        const latestVehicle = vehicles?.[0];
        if (latestVehicle) {
          setVehicle({
            reg: getVehicleRegistration(latestVehicle),
            colour: latestVehicle.colour || "",
            makeModel: latestVehicle.make_model || "",
            chassis: latestVehicle.vin || latestVehicle.chassis || "",
            engine: latestVehicle.engine_number || latestVehicle.engine || "",
            mileage:
              latestVehicle.mileage === null || latestVehicle.mileage === undefined
                ? ""
                : String(latestVehicle.mileage),
          });
          setError("");
        }
      } catch (vehicleErr) {
        console.warn("Vehicle lookup failed for customer:", vehicleErr);
      }
      setShowNewCustomer(false);
      setShowExistingCustomer(false);
    } catch (err) {
      console.error("❌ Error saving customer:", err);
      showNotification("customer", "error", `✗ Error: ${err.message || "Could not save customer"}`);
    }
  };

  // ✅ Vehicle lookup - prefer existing Supabase vehicle rows before DVLA fallback
  const handleFetchVehicleData = async () => {
    if (!vehicle.reg.trim()) { // validate that registration number is entered
      setError("Please enter a registration number"); // set validation error
      showNotification("vehicle", "error", "✗ Please enter a registration number"); // show notification
      return; // stop execution when missing registration
    }

    setIsLoadingVehicle(true); // show loading state
    setError(""); // clear any previous errors
    setVehicleNotification(null); // clear any previous notifications

    try {
      const regUpper = vehicle.reg.trim().toUpperCase(); // normalize registration to uppercase

      const storedVehicle = await getVehicleByReg(regUpper); // attempt pulling existing vehicle from Supabase first

      if (storedVehicle) { // if the vehicle already lives in our database
        console.log("Vehicle found in Supabase, hydrating from DB:", storedVehicle.vehicle_id);
        hydrateVehicleFromRecord(storedVehicle, { notifyCustomer: true }); // unify hydration logic for stored vehicles
        showNotification("vehicle", "success", "✓ Vehicle details loaded from database!");
        return; // stop here because DB already satisfied the lookup
      }

      console.log("Fetching vehicle data from DVLA API for:", regUpper); // log fetch start

      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      const responseText = await response.text();
      console.log("DVLA API raw response:", responseText);

      if (!response.ok) {
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = null;
        }
        const message =
          parsed?.message || parsed?.error || responseText || `DVLA lookup failed with status ${response.status}`;
        throw new Error(message);
      }

      let data = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.error("DVLA API response JSON parse error:", parseErr);
          throw new Error("DVLA API returned malformed data");
        }
      }
      console.log("DVLA API response data:", data); // log response payload

      if (!data || Object.keys(data).length === 0) { // if no data returned or empty object
        throw new Error("No vehicle data found for that registration from DVLA"); // throw descriptive error
      }

      const normalizedRegistration = (data.registrationNumber || data.registration || regUpper || "").toString().toUpperCase(); // normalize registration from response
      const detectedMake = data.make || data.vehicleMake || ""; // detect make field from response variants
      const detectedModel = data.model || data.vehicleModel || ""; // detect model field from response variants
      const combinedMakeModel = `${detectedMake} ${detectedModel}`.trim(); // combine make and model into single label
      const fallbackMakeModel = combinedMakeModel.length > 0 ? combinedMakeModel : detectedMake || "Unknown"; // ensure fallback value

      const vehicleData = { // build vehicle object for state update
        reg: normalizedRegistration,
        makeModel: fallbackMakeModel,
        colour: data.colour || data.vehicleColour || data.bodyColour || "Not provided",
        chassis: data.vin || data.chassisNumber || data.vehicleIdentificationNumber || "Not provided",
        engine: data.engineNumber || data.engineCapacity || data.engine || "Not provided",
        mileage: data.mileage || data.currentMileage || (data.motTests && data.motTests[0]?.odometerValue) || vehicle.mileage || "",
      };

      console.log("Setting vehicle data from DVLA:", vehicleData); // log normalized vehicle data

      setVehicle(vehicleData); // update vehicle state with DVLA data

    } catch (err) {
      console.error("Error fetching vehicle data from DVLA:", err); // log error
      setError(`Error: ${err.message}`); // store error message
    } finally {
      setIsLoadingVehicle(false); // always stop loading state
    }
  };

  // ✅ Save Job Function - delegates to createJobService for all database writes
  const handleSaveJob = async () => {
    // ===== VALIDATION PHASE - NO DATABASE OPERATIONS =====
    // Perform all validations first before touching the database
    try {
      if (!customer) {
        alert("Please select a customer before saving the job.");
        return;
      }

      if (isCustomerEditing) { // prevent saving while customer edits are unsaved
        alert("Please save customer edits before creating the job card.");
        return;
      }

      if (!vehicle.reg) {
        alert("Please enter a vehicle registration before saving the job.");
        return;
      }

      // Validate all tabs have at least one request
      for (let i = 0; i < jobTabs.length; i++) {
        const tabRequests = jobTabs[i].requests
          .map((req) => ({ ...req, text: (req.text || "").trim() }))
          .filter((req) => req.text.length > 0);
        if (tabRequests.length === 0) {
          alert(`Please add at least one job request in Job ${i + 1} before saving.`);
          setActiveTabIndex(i);
          return;
        }
      }

      // All validations passed - proceed with database operations via service layer
      console.log("✓ All validations passed. Starting save job process via createJobService...");

      // ===== DATABASE OPERATIONS PHASE (via service layer) =====
      const batchResult = await createFullJobBatch({
        customer: { // normalized customer object
          id: customer.id,
          firstName: customerForm.firstName,
          lastName: customerForm.lastName,
          email: customerForm.email,
          mobile: customerForm.mobile,
          telephone: customerForm.telephone,
          address: customerForm.address,
          postcode: customerForm.postcode,
        },
        vehicle, // vehicle state object { reg, makeModel, colour, chassis, engine, mileage }
        tabs: jobTabs, // array of tab objects with requests, waitingStatus, jobSource, etc.
        sharedOptions: {
          cosmeticNotes: cosmeticNotes || null, // cosmetic damage notes
          cosmeticDamagePresent, // cosmetic damage flag
          vhcRequired, // VHC required flag
          washRequired, // wash required flag
          isSubJobMode, // sub-job mode from query param
          primeJobData, // prime job data when in sub-job mode
          asPrimeJob, // create as prime job checkbox
        },
      });

      if (!batchResult.success) {
        throw new Error("Job creation batch failed");
      }

      const { createdJobs, primaryJob } = batchResult.data;

      // Link uploaded files for each job (file operations stay client-side)
      for (let i = 0; i < createdJobs.length; i++) {
        const tab = jobTabs[i];
        const jobId = createdJobs[i].job?.id || createdJobs[i].job?.jobId || createdJobs[i].job?.job_id;
        if (tab.uploadedFiles.length > 0 && jobId) {
          await linkUploadedFilesToJobById(jobId, tab.uploadedFiles);
        }
      }

      console.log("✓ All jobs and related data saved successfully via service layer");

      // Refresh jobs cache
      if (typeof fetchJobs === "function") {
        fetchJobs().catch((err) => console.error("❌ Error refreshing jobs:", err));
      }

      // Update UI and redirect
      const finalJobNumber = primaryJob?.jobNumber || primaryJob?.job_number || primaryJob?.id;
      const regUpper = vehicle.reg.trim().toUpperCase();
      const jobsCreatedMessage = createdJobs.length > 1
        ? `${createdJobs.length} linked jobs created: ${createdJobs.map((j) => j.job?.jobNumber || j.job?.job_number).join(", ")}`
        : `Job created: ${finalJobNumber}`;

      alert(
        `${jobsCreatedMessage}\n\nVehicle ${regUpper} has been saved and linked to ${customer.firstName} ${customer.lastName}`
      );

      router.push(`/appointments?jobNumber=${encodeURIComponent(finalJobNumber || "")}`);

    } catch (err) {
      console.error("❌ Error saving job:", err);
      alert(`Error saving job: ${err.message}. Please check the details and try again.`);
      // Do not proceed with any further operations
      // The job and related data were not saved to the database
    }
  };

  // Helper to link files to a specific job by ID
  const linkUploadedFilesToJobById = async (jobId, files) => {
    if (!files || files.length === 0) return;
    try {
      const response = await fetch('/api/jobcards/link-uploaded-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, files })
      });
      if (!response.ok) {
        throw new Error('Failed to link uploaded files');
      }
    } catch (err) {
      console.error("Error linking files to job:", err);
    }
  };

  return (
    <Layout>
      <DevLayoutSection
        sectionKey="job-cards-create-page-shell"
        sectionType="page-shell"
        shell
        widthMode="page"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          transition: "background 0.3s ease",
          background: "transparent",
        }}
      >
        {/* ✅ Header Section - Modern Design */}
        <DevLayoutSection
          sectionKey="job-cards-create-header"
          sectionType="toolbar"
          parentKey="job-cards-create-page-shell"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
            flexShrink: 0,
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            className="job-cards-create-header-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              minWidth: 0,
              flex: "1 1 420px",
            }}
          >
            <div
              className="job-cards-create-selector-wrap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <div
                className="job-cards-create-selector"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px",
                  backgroundColor: "var(--accent-purple-surface)",
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  flexWrap: "wrap",
                }}
              >
                {jobCardSelectorOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setActiveTabIndex(option.index)}
                    aria-pressed={activeTabIndex === option.index}
                    style={{
                      minHeight: "36px",
                      padding: "0 14px",
                      borderRadius: "var(--radius-pill)",
                      border: "none",
                      backgroundColor: activeTabIndex === option.index ? "var(--primary)" : "var(--surface-light)",
                      color: activeTabIndex === option.index ? "white" : "var(--text-primary)",
                      cursor: "pointer",
                      fontWeight: activeTabIndex === option.index ? "600" : "500",
                      fontSize: "13px",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {!isSubJobMode && (
                <button
                  type="button"
                  onClick={addNewJobTab}
                  className="job-cards-create-add-linked-button"
                  style={{
                    minHeight: "36px",
                    padding: "0 14px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px dashed var(--primary)",
                    backgroundColor: "transparent",
                    color: "var(--primary)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary-surface)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  title="Add another linked job"
                >
                  + Link job card
                </button>
              )}

              {!isSubJobMode && hasLinkedJobCards && (
                <button
                  type="button"
                  onClick={() => removeJobTab(activeTabIndex)}
                  className="job-cards-create-remove-linked-button"
                  style={{
                    minHeight: "36px",
                    padding: "0 14px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-light)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  Remove selected
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              flex: "1 1 280px",
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "520px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "6px",
                borderRadius: "var(--radius-pill)",
                background: "var(--accent-surface)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {populatedRequests.length === 0 ? (
                <span
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                  }}
                >
                  No detected requests yet
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDetectedRequestsPopup(true)}
                  style={{
                    width: "100%",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    borderRadius: "999px",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--accent-border)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "var(--accent-strong)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Request 1
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      flex: "0 1 auto",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {populatedRequests[0]?.text}
                  </span>
                  {populatedRequests.length > 1 ? (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "var(--accent-strong)",
                        background: "var(--accent-surface)",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      +{populatedRequests.length - 1} more
                    </span>
                  ) : null}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Job Source Badge */}
            <span
              style={{
                padding: "8px 16px",
                borderRadius: "var(--control-radius-xs)",
                backgroundColor: jobSource === "Warranty" ? "var(--warning-surface)" : "var(--success-surface)",
                color: jobSource === "Warranty" ? "var(--danger)" : "var(--success-dark)",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid currentColor",
                letterSpacing: "0.3px",
              }}
            >
              {jobSource}
            </span>
            <button
              onClick={handleSaveJob}
              style={{
                padding: "12px 28px",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "var(--primary-dark)";
                e.target.style.boxShadow = "0 6px 12px rgba(var(--primary-rgb), 0.3)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "var(--primary)";
                e.target.style.boxShadow = "0 4px 8px rgba(var(--primary-rgb), 0.2)";
              }}
            >
              {asPrimeJob && jobTabs.length > 1 ? `Save ${jobTabs.length} Jobs` : "Save Job Card"}
            </button>
          </div>
        </DevLayoutSection>

        {/* ✅ Sub-job Mode Banner */}
        {isSubJobMode && primeJobData && (
          <DevLayoutSection
            sectionKey="job-cards-create-subjob-banner"
            sectionType="status-banner"
            parentKey="job-cards-create-page-shell"
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--primary-surface)",
              borderRadius: "var(--radius-xs)",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              border: "1px solid var(--primary-light)",
            }}
          >
            <span style={{ fontSize: "18px" }}>🔗</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                Creating sub-job linked to Job {primeJobData.jobNumber}
              </span>
              <span style={{ marginLeft: "12px", color: "var(--text-secondary)", fontSize: "13px" }}>
                Customer and vehicle details are inherited from the prime job
              </span>
            </div>
            <button
              onClick={() => router.push(`/job-cards/${primeJobData.jobNumber}`)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
              }}
            >
              View Prime Job
            </button>
          </DevLayoutSection>
        )}

        {/* ✅ Content Area */}
        <DevLayoutSection
          sectionKey="job-cards-create-content"
          sectionType="section-shell"
          parentKey="job-cards-create-page-shell"
          shell
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* ✅ NEW LAYOUT: Top Row - Job Information, Vehicle Details, Customer Details (all 33% width) */}
          <DevLayoutSection
            sectionKey="job-cards-create-top-row"
            sectionType="section-shell"
            parentKey="job-cards-create-content"
            shell
            style={{ display: "flex", gap: "16px", width: "100%" }}
          >
            {/* Job Information Section - 33% width */}
            <DevLayoutSection
              sectionKey="job-cards-create-job-information"
              sectionType="content-card"
              parentKey="job-cards-create-top-row"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                height: topRowHeight ? `${topRowHeight}px` : "auto",
                minHeight: "420px",
                boxSizing: "border-box",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  gap: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--accent-border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                      margin: 0,
                    }}
                  >
                    Job Information
                  </h3>
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Customer Status
                  </label>
                  <div style={jobInfoOptionGroupStyle}>
                    {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                      <label key={status} style={getJobInfoOptionStyle(waitingStatus === status)}>
                        <input
                          type="radio"
                          name="waiting"
                          value={status}
                          checked={waitingStatus === status}
                          onChange={() => setWaitingStatus(status)}
                          style={{ display: "none" }}
                        />
                        <span style={{ fontSize: "13px", textAlign: "center" }}>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Job Source
                  </label>
                  <div style={jobInfoOptionGroupStyle}>
                    {["Retail", "Warranty"].map((src) => (
                      <label key={src} style={getJobInfoOptionStyle(jobSource === src)}>
                        <input
                          type="radio"
                          name="source"
                          value={src}
                          checked={jobSource === src}
                          onChange={() => setJobSource(src)}
                          style={{ display: "none" }}
                        />
                        <span style={{ fontSize: "13px", textAlign: "center" }}>{src}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </DevLayoutSection>

            {/* Vehicle Details Section - 33% width */}
            <DevLayoutSection
              sectionKey="job-cards-create-vehicle-details"
              sectionType="content-card"
              parentKey="job-cards-create-top-row"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                height: topRowHeight ? `${topRowHeight}px` : "auto",
                minHeight: "420px",
                boxSizing: "border-box",
                overflowY: "auto",
              }}
              ref={vehicleSectionRef}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginTop: 0,
                  marginBottom: "16px",
                }}
              >
                Vehicle Details
                {isSubJobMode && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      fontWeight: "500",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--primary-surface)",
                      color: "var(--primary)",
                    }}
                  >
                    Inherited
                  </span>
                )}
              </h3>

              {vehicleNotification && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: vehicleNotification.type === "success" ? "var(--success)" : "var(--danger-surface)",
                    border: `1px solid ${vehicleNotification.type === "success" ? "var(--success)" : "var(--danger)"}`,
                    color: vehicleNotification.type === "success" ? "var(--success-dark)" : "var(--danger-dark)",
                    fontSize: "13px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{vehicleNotification.message}</span>
                  <button
                    onClick={() => setVehicleNotification(null)}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      fontSize: "20px",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Registration Number
                </label>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={vehicle.reg}
                    onChange={(e) => setVehicle({ ...vehicle, reg: e.target.value })}
                    placeholder="e.g. AB12 CDE"
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--surface)",
                      fontSize: "14px",
                      textTransform: "uppercase",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--primary)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--surface-light)";
                    }}
                  />
                  <button
                    onClick={handleFetchVehicleData}
                    disabled={isLoadingVehicle}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: isLoadingVehicle ? "var(--background)" : "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: isLoadingVehicle ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoadingVehicle) e.target.style.backgroundColor = "var(--primary-dark)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoadingVehicle) e.target.style.backgroundColor = "var(--primary)";
                    }}
                  >
                    {isLoadingVehicle ? "Loading..." : "Search"}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--danger)",
                    marginBottom: "12px",
                    padding: "10px 12px",
                    backgroundColor: "var(--danger-surface)",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--danger)",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {["colour", "makeModel", "chassis", "engine"].map((key, idx) => {
                  const labelMap = {
                    colour: "Colour",
                    makeModel: "Make & Model",
                    chassis: "Chassis Number",
                    engine: "Engine Number",
                  };
                  return (
                    <div key={`${key}-${idx}`}>
                      <label
                        style={{
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "var(--text-secondary)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {labelMap[key]}
                      </label>
                      <div
                        style={{
                          padding: "10px 12px",
                          backgroundColor: "var(--surface)",
                          borderRadius: "var(--radius-xs)",
                          fontSize: "14px",
                          color: vehicle[key] ? "var(--text-primary)" : "var(--grey-accent-light)",
                        }}
                      >
                        {vehicle[key] || "Not available"}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    Current Mileage
                  </label>
                  <input
                    type="number"
                    value={vehicle.mileage}
                    onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })}
                    placeholder="Enter mileage"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--surface)",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--primary)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--surface-light)";
                    }}
                  />
                </div>
              </div>
            </DevLayoutSection>

            {/* Customer Details Section - 33% width */}
            <DevLayoutSection
              sectionKey="job-cards-create-customer-details"
              sectionType="content-card"
              parentKey="job-cards-create-top-row"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                height: topRowHeight ? `${topRowHeight}px` : "auto",
                minHeight: "420px",
                boxSizing: "border-box",
                overflowY: "auto",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginTop: 0,
                  marginBottom: "16px",
                }}
              >
                Customer Details
                {isSubJobMode && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      fontWeight: "500",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--primary-surface)",
                      color: "var(--primary)",
                    }}
                  >
                    Inherited
                  </span>
                )}
              </h3>

              {customerNotification && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: customerNotification.type === "success" ? "var(--success)" : "var(--danger-surface)",
                    border: `1px solid ${customerNotification.type === "success" ? "var(--success)" : "var(--danger)"}`,
                    color: customerNotification.type === "success" ? "var(--success-dark)" : "var(--danger-dark)",
                    fontSize: "13px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{customerNotification.message}</span>
                  <button
                    onClick={() => setCustomerNotification(null)}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      fontSize: "20px",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {customer ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {isCustomerEditing ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {customerFieldDefinitions.map((input) => (
                        <div
                          key={input.field}
                          style={{
                            gridColumn:
                              input.field === "email" ||
                              input.field === "address" ||
                              input.field === "contactPreference"
                                ? "1 / -1"
                                : "auto",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "13px",
                              fontWeight: "500",
                              color: "var(--text-secondary)",
                              display: "block",
                              marginBottom: "6px",
                            }}
                          >
                            {input.label}
                          </label>
                          {input.type === "textarea" ? (
                            <textarea
                              value={customerForm[input.field] || ""}
                              onChange={(e) => handleCustomerFieldChange(input.field, e.target.value)}
                              onInput={(e) => {
                                if (input.field !== "address") return;
                                e.target.style.height = "auto";
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              disabled={!isCustomerEditing || isSavingCustomer}
                              placeholder={input.placeholder}
                              rows={input.field === "address" ? 1 : 3}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "none",
                                borderRadius: "var(--radius-xs)",
                                fontSize: "14px",
                                outline: "none",
                                transition: "border-color 0.2s",
                                backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "transparent",
                                resize: input.field === "address" ? "none" : "vertical",
                                minHeight: input.field === "address" ? "40px" : "unset",
                                overflow: "hidden",
                                lineHeight: 1.45,
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = "var(--primary)";
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = "var(--surface-light)";
                              }}
                            />
                          ) : input.type === "multi-select" ? (
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                padding: "6px",
                                borderRadius: "var(--control-radius)",
                                backgroundColor: isCustomerEditing ? "var(--surface-light)" : "transparent",
                                border: "none",
                                width: "100%",
                              }}
                            >
                              {["phone", "email", "sms"].map((pref) => {
                                const active = Array.isArray(customerForm.contactPreference) &&
                                  customerForm.contactPreference.includes(pref);
                                return (
                                  <button
                                    key={pref}
                                    type="button"
                                    onClick={() => toggleContactPreference(pref)}
                                    style={{
                                      padding: "8px 14px",
                                      borderRadius: "var(--control-radius)",
                                      border: active ? "1px solid var(--primary)" : "1px solid transparent",
                                      backgroundColor: active ? "var(--surface)" : "transparent",
                                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                                      fontSize: "13px",
                                      fontWeight: active ? "600" : "500",
                                      cursor: "pointer",
                                      transition: "all 0.2s",
                                      textTransform: "none",
                                      letterSpacing: "0",
                                    }}
                                  >
                                    {pref === "sms" ? "SMS" : pref.charAt(0).toUpperCase() + pref.slice(1)}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <input
                              type={input.type}
                              value={customerForm[input.field] || ""}
                              onChange={(e) => handleCustomerFieldChange(input.field, e.target.value)}
                              disabled={!isCustomerEditing || isSavingCustomer}
                              placeholder={input.placeholder}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "none",
                                borderRadius: "var(--radius-xs)",
                                fontSize: "14px",
                                outline: "none",
                                transition: "border-color 0.2s",
                                backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "transparent",
                                color: input.type === "tel" ? "#000" : "inherit",
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = "var(--primary)";
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = "var(--surface-light)";
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {customerFieldDefinitions
                        .filter((input) => input.field !== "contactPreference")
                        .map((input) => (
                          <div
                            key={input.field}
                            style={{
                              gridColumn:
                                input.field === "email" || input.field === "address"
                                  ? "1 / -1"
                                  : "auto",
                              padding:
                                input.field === "email"
                                  ? "12px 14px"
                                  : input.field === "mobile" || input.field === "telephone"
                                    ? "12px 14px"
                                    : "10px 12px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--surface)",
                              border: "1px solid var(--accent-border)",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                marginBottom: "4px",
                              }}
                            >
                              {input.label}
                            </div>
                            <div
                              style={{
                                fontSize:
                                  input.field === "email"
                                    ? "14px"
                                    : "13px",
                                fontWeight: "600",
                                color: "var(--text-primary)",
                                lineHeight: 1.4,
                                wordBreak: "break-word",
                              }}
                            >
                              {customerForm[input.field] || "Not provided"}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                    {isCustomerEditing ? (
                      <>
                        <button
                          onClick={handleSaveCustomerEdits}
                          disabled={isSavingCustomer}
                          style={{
                            flex: 1,
                            padding: "12px",
                            fontSize: "14px",
                            backgroundColor: "var(--primary)",
                            color: "var(--text-inverse)",
                            border: "none",
                            borderRadius: "var(--radius-xs)",
                            cursor: isSavingCustomer ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s",
                            opacity: isSavingCustomer ? 0.7 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isSavingCustomer) {
                              e.target.style.backgroundColor = "var(--primary-dark)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "var(--primary)";
                          }}
                        >
                          {isSavingCustomer ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={handleCancelCustomerEdit}
                          disabled={isSavingCustomer}
                          style={{
                            flex: 1,
                            padding: "12px",
                            fontSize: "14px",
                            backgroundColor: "var(--surface-light)",
                            color: "var(--text-primary)",
                            border: "none",
                            borderRadius: "var(--radius-xs)",
                            cursor: isSavingCustomer ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s",
                            opacity: isSavingCustomer ? 0.7 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isSavingCustomer) {
                              e.target.style.backgroundColor = "var(--surface-muted)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "var(--surface-light)";
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleStartCustomerEdit}
                          style={{
                            width: "100%",
                            maxWidth: "320px",
                            padding: "14px",
                            fontSize: "14px",
                            backgroundColor: "var(--primary)",
                            color: "var(--text-inverse)",
                            border: "none",
                            borderRadius: "var(--radius-xs)",
                            cursor: "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s",
                            alignSelf: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = "var(--primary-dark)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "var(--primary)";
                          }}
                        >
                          Edit Customer
                        </button>
                        <button
                          onClick={() => setCustomer(null)}
                          disabled={isSavingCustomer}
                          style={{
                            width: "100%",
                            maxWidth: "320px",
                            padding: "12px 16px",
                            fontSize: "14px",
                            backgroundColor: "var(--accent-purple-surface)",
                            color: "var(--accent-purple)",
                            border: "1px solid var(--accent-purple)",
                            borderRadius: "var(--radius-xs)",
                            cursor: isSavingCustomer ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                            opacity: isSavingCustomer ? 0.7 : 1,
                            alignSelf: "center",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSavingCustomer) {
                              e.target.style.backgroundColor = "var(--accent-purple)";
                              e.target.style.color = "var(--text-inverse)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "var(--accent-purple-surface)";
                            e.target.style.color = "var(--accent-purple)";
                          }}
                        >
                          Clear Customer
                        </button>
                      </>
                    )}
                  </div>

                  {isCustomerEditing && (
                    <button
                      onClick={() => setCustomer(null)}
                      disabled={isSavingCustomer}
                      style={{
                        width: "100%",
                        maxWidth: "320px",
                        padding: "12px",
                        fontSize: "14px",
                        backgroundColor: "var(--surface-light)",
                        color: "var(--text-primary)",
                        border: "none",
                        borderRadius: "var(--radius-xs)",
                        cursor: isSavingCustomer ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        transition: "all 0.2s",
                        opacity: isSavingCustomer ? 0.7 : 1,
                        alignSelf: "center",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSavingCustomer) {
                          e.target.style.backgroundColor = "var(--surface-muted)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "var(--surface-light)";
                      }}
                    >
                      Clear Customer
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    style={{
                      width: "100%",
                      maxWidth: "320px",
                      padding: "14px",
                      fontSize: "14px",
                      backgroundColor: "var(--primary)",
                      color: "var(--text-inverse)",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      cursor: "pointer",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "var(--primary-dark)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "var(--primary)";
                    }}
                  >
                    New Customer
                  </button>
                  <button
                    onClick={() => setShowExistingCustomer(true)}
                    style={{
                      width: "100%",
                      maxWidth: "320px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      backgroundColor: "var(--accent-purple-surface)",
                      color: "var(--accent-purple)",
                      border: "1px solid var(--accent-purple)",
                      borderRadius: "var(--radius-xs)",
                      cursor: "pointer",
                      fontWeight: "600",
                      transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "var(--accent-purple)";
                      e.target.style.color = "var(--text-inverse)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "var(--accent-purple-surface)";
                      e.target.style.color = "var(--accent-purple)";
                    }}
                  >
                    Search Existing Customer
                  </button>
                </div>
              )}
            </DevLayoutSection>
          </DevLayoutSection>

          {/* ✅ Job Requests Section - Full Width */}
          <DevLayoutSection
            sectionKey="job-cards-create-job-requests"
            sectionType="section-shell"
            parentKey="job-cards-create-content"
            style={{
              padding: "var(--section-card-padding)",
              borderRadius: "var(--radius-md)",
              ...sectionCardStyle,
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "var(--text-primary)",
                marginTop: 0,
                marginBottom: "16px",
              }}
            >
              Job Requests
            </h3>
            <div style={{ maxHeight: "360px", overflowY: "auto", paddingRight: "4px", marginBottom: "12px" }}>
              {requests.map((req, i) => (
                <DevLayoutSection
                  key={`job-request-row-${i}`}
                  sectionKey={`job-cards-create-job-request-${i + 1}`}
                  sectionType="content-card"
                  parentKey="job-cards-create-job-requests"
                  style={{
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "12px",
                    padding: "16px",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      marginBottom: "12px",
                    }}
                  >
                    Request {i + 1}
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <RequestPresetAutosuggestInput
                      value={req.text || ""}
                      onChange={(nextValue) => handleRequestChange(i, nextValue)}
                      onPresetSelect={(preset) => {
                        const updated = [...requests];
                        updated[i] = {
                          ...updated[i],
                          text: preset.label,
                          time: normalizeHoursToTwoDecimals(preset.defaultHours),
                          presetId: preset.id,
                          selectedPresetLabel: preset.label,
                        };
                        const detections = detectJobTypesForRequests(updated);
                        setRequests(updated);
                        setJobDetections(detections);
                        setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
                      }}
                      placeholder="Enter job request (MOT, Service, Diagnostic)"
                      containerStyle={{ flex: 2, minWidth: "250px" }}
                      inputStyle={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        backgroundColor: "var(--accent-surface)",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number"
                        min="0.00"
                        step="0.01"
                        value={req.time || ""}
                        onChange={(e) => handleTimeChange(i, e.target.value)}
                        placeholder="Hours"
                        style={{
                          width: "90px",
                          padding: "10px 12px",
                          border: "none",
                          borderRadius: "var(--radius-xs)",
                          fontSize: "14px",
                          outline: "none",
                          transition: "border-color 0.2s",
                          backgroundColor: "var(--accent-surface)",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "var(--primary)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "var(--surface-light)";
                          const updated = [...requests];
                          updated[i].time = normalizeHoursToTwoDecimals(updated[i]?.time);
                          setRequests(updated);
                          persistPresetDefaultHours(updated[i]);
                        }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          fontWeight: "500",
                          minWidth: "30px",
                        }}
                      >
                        h
                      </span>
                    </div>
                    <DropdownField
                      value={req.paymentType || "Customer"}
                      onChange={(e) => handlePaymentTypeChange(i, e.target.value)}
                      options={PAYMENT_TYPE_OPTIONS}
                      className="job-request-payment-dropdown"
                    />
                    <button
                      onClick={() => handleRemoveRequest(i)}
                      style={{
                        backgroundColor: "var(--danger)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-xs)",
                        padding: "10px 16px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "var(--danger)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "var(--danger)";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </DevLayoutSection>
              ))}
            </div>
            <button
              onClick={handleAddRequest}
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "12px 20px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "var(--primary-dark)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "var(--primary)";
              }}
            >
              + Add Request
            </button>
          </DevLayoutSection>

          {/* ✅ Bottom Row: Cosmetic Damage, Add VHC, Full Car Details */}
          <DevLayoutSection
            sectionKey="job-cards-create-bottom-row"
            sectionType="section-shell"
            parentKey="job-cards-create-content"
            shell
            className="job-cards-create-bottom-row"
          >
            <DevLayoutSection
              sectionKey="job-cards-create-cosmetic-damage"
              sectionType="content-card"
              parentKey="job-cards-create-bottom-row"
              className="job-cards-create-bottom-card"
              style={{
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div className="job-cards-create-bottom-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  Cosmetic Damage
                </h4>
                <div style={binaryToggleGroupStyle}>
                  {[true, false].map((choice) => (
                    <button
                      key={choice ? "yes" : "no"}
                      onClick={() => setCosmeticDamagePresent(choice)}
                      type="button"
                      style={getBinaryToggleButtonStyle(cosmeticDamagePresent === choice)}
                    >
                      {choice ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
              {cosmeticDamagePresent && (
                <textarea
                  value={cosmeticNotes}
                  onChange={(e) => setCosmeticNotes(e.target.value)}
                  placeholder="Describe any scratches, dents, or cosmetic damage..."
                  className="cosmetic-notes-active"
                  style={{
                    width: "100%",
                    height: "80px",
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: "var(--radius-xs)",
                    resize: "none",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    backgroundColor: "var(--background)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--primary)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--surface-light)";
                  }}
                />
              )}
            </DevLayoutSection>
            <DevLayoutSection
              sectionKey="job-cards-create-wash"
              sectionType="content-card"
              parentKey="job-cards-create-bottom-row"
              className="job-cards-create-bottom-card"
              style={{
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                justifyContent: "space-between",
              }}
            >
              <div className="job-cards-create-bottom-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  Wash
                </h4>
                <div style={binaryToggleGroupStyle}>
                  {[true, false].map((choice) => (
                    <button
                      key={`wash-${choice ? "yes" : "no"}`}
                      type="button"
                      onClick={() => setWashRequired(choice)}
                      style={getBinaryToggleButtonStyle(washRequired === choice)}
                    >
                      {choice ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </DevLayoutSection>
            <DevLayoutSection
              sectionKey="job-cards-create-vhc-required"
              sectionType="content-card"
              parentKey="job-cards-create-bottom-row"
              className="job-cards-create-bottom-card"
              style={{
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div className="job-cards-create-bottom-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  VHC Required?
                </h4>
                <div style={binaryToggleGroupStyle}>
                  {[true, false].map((choice) => (
                    <button
                      key={`vhc-${choice ? "yes" : "no"}`}
                      type="button"
                      onClick={() => setVhcRequired(choice)}
                      style={getBinaryToggleButtonStyle(vhcRequired === choice)}
                    >
                      {choice ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </DevLayoutSection>
            <DevLayoutSection
              sectionKey="job-cards-create-documents"
              sectionType="content-card"
              parentKey="job-cards-create-bottom-row"
              className="job-cards-create-bottom-card"
              style={{
                padding: "var(--section-card-padding)",
                borderRadius: "var(--radius-md)",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                justifyContent: "space-between",
              }}
            >
              <div className="job-cards-create-bottom-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  Documents
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDocumentsPopup(true)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "background-color 0.2s, transform 0.2s",
                      }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary-dark)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.zIndex = "0";
                  }}
                >
                  Manage Documents
                </button>
              </div>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>

        {showNewCustomer && (
          <NewCustomerPopup
            onClose={() => setShowNewCustomer(false)}
            onSelect={(c) => handleCustomerSelect(c)}
            initialName={newCustomerPrefill}
          />
        )}
        {showExistingCustomer && (
          <ExistingCustomerPopup
            onClose={() => setShowExistingCustomer(false)}
            onSelect={(c) => handleCustomerSelect(c)}
            onCreateNew={(prefill) => {
              setNewCustomerPrefill(prefill);
              setShowExistingCustomer(false);
              setShowNewCustomer(true);
            }}
          />
        )}

        <DocumentsUploadPopup
          open={showDocumentsPopup}
          onClose={() => setShowDocumentsPopup(false)}
          jobId={null}
          userId={dbUserId || null}
          onTempFilesQueued={captureTempUploadMetadata}
          existingDocuments={uploadedFiles.map((f) => ({
            name: f.fileName,
            type: f.contentType,
            url: f.url || "",
          }))}
        />
        {showDetectedRequestsPopup && (
          <div
            style={popupOverlayStyles}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowDetectedRequestsPopup(false);
              }
            }}
          >
            <div
              style={{
                ...popupCardStyles,
                width: "100%",
                maxWidth: "620px",
                maxHeight: "88vh",
                overflowY: "auto",
                border: "none",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ padding: "28px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "var(--primary)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Job Requests
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDetectedRequestsPopup(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "22px",
                      lineHeight: 1,
                      color: "var(--info)",
                    }}
                    aria-label="Close job requests popup"
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  {populatedRequests.map((request) => {
                    const requestDetections = visibleJobDetections.filter(
                      (detection) => Number(detection.requestIndex) === request.index
                    );

                    return (
                      <div
                        key={`detected-request-popup-${request.index}`}
                        style={{
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--surface-light)",
                          padding: "14px 16px",
                          display: "grid",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                            Request {request.index + 1}
                          </span>
                          {requestDetections.length > 0 ? (
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {requestDetections.map((detection, index) => (
                                <span
                                  key={`request-detection-${request.index}-${index}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    minHeight: "24px",
                                    padding: "0 8px",
                                    borderRadius: "999px",
                                    background: "var(--surface)",
                                    color: "var(--accent-strong)",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                  }}
                                >
                                  {detection.jobType}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            lineHeight: 1.5,
                            color: "var(--text-primary)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {request.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </DevLayoutSection>
    </Layout>
  );
}
