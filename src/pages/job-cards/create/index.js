// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/create/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"; // import React hooks including useEffect/useCallback/useRef for syncing customer forms
import { useRouter } from "next/router"; // for navigation
import Layout from "@/components/Layout"; // import layout wrapper
import { useJobs } from "@/context/JobsContext"; // import jobs context
import { useUser } from "@/context/UserContext"; // import user context for signature + uploads
import {
  addCustomerToDatabase,
  checkCustomerExists,
  getCustomerById,
  getCustomerVehicles,
  updateCustomer,
} from "@/lib/database/customers";
import { createOrUpdateVehicle, getVehicleByReg } from "@/lib/database/vehicles";
import { addJobToDatabase, addJobFile, getJobByNumber } from "@/lib/database/jobs";
import { supabase } from "@/lib/supabaseClient"; // import supabase client for job request inserts
import NewCustomerPopup from "@/components/popups/NewCustomerPopup"; // import new customer popup
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup"; // import existing customer popup
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import { DropdownField } from "@/components/dropdownAPI";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { detectJobTypesForRequests } from "@/lib/ai/jobTypeDetection";

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
    mileage: 0, // current mileage
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
    requests: [{ text: "", time: "", paymentType: "Customer" }],
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
  const jobDivision = currentTab.jobDivision;
  const setJobDivision = (val) => updateCurrentTab({ jobDivision: val });
  const jobCategories = currentTab.jobCategories;
  const setJobCategories = (val) => updateCurrentTab({ jobCategories: val });
  const jobDetections = currentTab.jobDetections || [];
  const setJobDetections = (val) => updateCurrentTab({ jobDetections: val });
  const uploadedFiles = currentTab.uploadedFiles;
  const setUploadedFiles = (val) => updateCurrentTab({ uploadedFiles: typeof val === "function" ? val(currentTab.uploadedFiles) : val });

  // Shared state (same across all tabs)
  const [cosmeticDamagePresent, setCosmeticDamagePresent] = useState(false); // track whether cosmetic damage observed
  const [cosmeticNotes, setCosmeticNotes] = useState(""); // notes about cosmetic damage
  const [vhcRequired, setVhcRequired] = useState(false); // whether VHC is required
  const WAITING_STATUS_STORAGE_KEY = "jobCardCreateWaitingStatus"; // key used to persist waiting status background choice
  const [showNewCustomer, setShowNewCustomer] = useState(false); // toggle new customer popup
  const [showExistingCustomer, setShowExistingCustomer] = useState(false); // toggle existing customer popup
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false); // toggle documents popup
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
  const [jobNumberDisplay, setJobNumberDisplay] = useState(null); // store assigned job number for header display
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
        .from("user_signatures")
        .select("id, user_id, file_url, storage_path")
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
            mileage: result.data.mileage ?? 0,
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
    const detections = detectJobTypesForRequests(updated);
    setRequests(updated); // store updated list
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
  };

  // handle changes to estimated time for a request
  const handleTimeChange = (index, value) => {
    const updated = [...requests]; // copy current requests
    let num = parseFloat(value); // parse numeric value
    if (Number.isNaN(num) || num < 0) num = 0; // ensure valid number
    updated[index].time = num; // store sanitized number
    setRequests(updated); // store updated list
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
    const nextRequests = [...requests, { text: "", time: "", paymentType: "Customer" }];
    const detections = detectJobTypesForRequests(nextRequests);
    setRequests(nextRequests);
    setJobDetections(detections);
    setJobCategories(Array.from(new Set(detections.map((d) => d.jobType))));
  }; // append new empty request

  const sectionCardStyle = {
    background: "var(--layer-section-level-2)",
    border: "1px solid var(--surface-light)",
  };

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

      const normalizedReg = (storedVehicle.registration || storedVehicle.reg_number || "")
        .toString()
        .toUpperCase(); // normalize registration text
      const combinedMakeModel = (storedVehicle.make_model || `${storedVehicle.make || ""} ${storedVehicle.model || ""}`)
        .trim(); // build make/model label

      setVehicle((prev) => ({ // merge values into form state
        ...prev,
        reg: normalizedReg || prev.reg,
        makeModel: combinedMakeModel || prev.makeModel,
        colour: storedVehicle.colour || prev.colour,
        chassis: storedVehicle.chassis || storedVehicle.vin || prev.chassis,
        engine: storedVehicle.engine || storedVehicle.engine_number || prev.engine,
        mileage: storedVehicle.mileage ? String(storedVehicle.mileage) : prev.mileage,
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

  const saveJobRequestsToDatabase = async (jobId, jobRequestEntries) => { // persist each job request as its own Supabase row
    if (!jobId || !Array.isArray(jobRequestEntries) || jobRequestEntries.length === 0) { // guard against invalid inputs
      return []; // nothing to do when payload missing
    } // comment for guard end

    const timestamp = new Date().toISOString(); // reuse timestamp for created/updated columns

    const payload = jobRequestEntries // begin mapping job requests into insert payload
      .map((entry, index) => { // iterate each request to normalize fields
        const trimmedDescription = (entry.text || "").trim(); // sanitize description text
        if (!trimmedDescription) { // skip empty descriptions
          return null; // produce null placeholder removed later
        } // finish empty guard

        const parsedHours = entry.time === "" || entry.time === null || entry.time === undefined ? null : Number(entry.time); // parse numeric hours when present
        const safeHours = Number.isFinite(parsedHours) ? parsedHours : null; // ensure NaN becomes null

        return { // build insert row
          job_id: jobId, // link to parent job id
          description: trimmedDescription, // set description text
          hours: safeHours, // store parsed hours or null
          job_type: (entry.paymentType || "Customer").trim() || "Customer", // persist job type label
          sort_order: index + 1, // keep order for UI grouping
          created_at: timestamp, // assign creation timestamp
          updated_at: timestamp, // assign update timestamp
        }; // end row object
      })
      .filter(Boolean); // remove null rows from skipped descriptions

    if (payload.length === 0) { // guard when all rows skipped
      return []; // nothing to insert
    } // finish guard

    console.log("📝 saveJobRequestsToDatabase payload:", payload.map((row) => ({ description: row.description?.slice(0, 30), hours: row.hours, job_type: row.job_type })));

    const { data, error } = await supabase
      .from("job_requests")
      .insert(payload)
      .select("request_id, description, sort_order, hours"); // insert payload into Supabase table
    if (error) { // check for insert failure
      throw new Error(error.message || "Failed to save job requests"); // bubble error so caller can abort
    } // finish error handling
    console.log("✅ saveJobRequestsToDatabase result:", (data || []).map((row) => ({ request_id: row.request_id, hours: row.hours })));
    return data || [];
  }; // end helper

  const saveJobRequestDetections = async (jobId, jobNumber, insertedRequests, jobRequestEntries) => {
    if (!jobId || !Array.isArray(insertedRequests) || insertedRequests.length === 0) {
      return;
    }

    const detections = detectJobTypesForRequests(jobRequestEntries);
    if (!detections.length) return;

    const requestIdByOrder = new Map(
      insertedRequests.map((row) => [row.sort_order, row.request_id])
    );

    const timestamp = new Date().toISOString();
    const payload = detections.map((detection) => ({
      job_id: jobId,
      job_number: jobNumber || null,
      request_id: requestIdByOrder.get(detection.requestIndex + 1) || null,
      request_index: detection.requestIndex + 1,
      source_text: detection.sourceText,
      job_type: detection.jobType,
      item_category: detection.itemCategory,
      confidence: Number.isFinite(detection.confidence) ? detection.confidence : null,
      explanation: detection.explanation || null,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    const { error } = await supabase.from("job_request_detections").insert(payload);
    if (error) {
      throw new Error(error.message || "Failed to save job request detections");
    }
  };

  const saveCosmeticDamageDetails = async (jobId, hasDamage, notes) => { // persist cosmetic damage flag + notes per job
    if (!jobId) { // ensure job id provided
      return; // skip when no job id available
    } // end guard

    const timestamp = new Date().toISOString(); // shared timestamp for audit columns
    const payload = { // build upsert payload
      job_id: jobId, // link to parent job
      has_damage: hasDamage === true, // coerce boolean flag
      notes: (notes || "").trim() || null, // store trimmed notes or null
      created_at: timestamp, // track creation time
      updated_at: timestamp, // track update time
    }; // end payload

    const { error } = await supabase // insert or upsert record
      .from("job_cosmetic_damage") // target cosmetic table
      .upsert(payload, { onConflict: "job_id" }); // enforce single record per job

    if (error) { // handle supabase error
      throw new Error(error.message || "Failed to save cosmetic damage details"); // propagate for caller to handle
    } // finish error handling
  }; // end helper

  const saveCustomerStatus = async (jobId, status) => { // persist customer status in dedicated table for later scheduling hook
    if (!jobId) { // ensure we have a job id before writing
      return; // skip when job missing
    }

    const timestamp = new Date().toISOString(); // shared timestamp for audit trail
    const payload = { // build insert payload for customer status table
      job_id: jobId,
      customer_status: status || "Neither",
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from("job_customer_statuses").insert([payload]); // insert status row
    if (error) { // log but don't block job creation
      console.error("Failed to save customer status", error.message);
    }
  };

  const linkUploadedFilesToJob = async (jobId) => { // Link previously uploaded files to the newly created job
    if (uploadedFiles.length === 0) return;

    try {
      // Call API to update temp uploaded files with actual job ID
      const response = await fetch('/api/jobcards/link-uploaded-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: jobId,
          files: uploadedFiles
        })
      });

      if (!response.ok) {
        throw new Error('Failed to link uploaded files');
      }

      setUploadedFiles([]); // Clear after linking
    } catch (error) {
      console.error("Failed to link uploaded files to job:", error);
      // Don't throw - files are already uploaded, linking can be done manually if needed
    }
  };

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

      const payload = {
        user_id: dbUserId,
        storage_path: objectPath,
        file_url: publicUrl,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("user_signatures")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setUserSignature(data);
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

      const signatureUrl = userSignature?.file_url || null;

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
            reg: (latestVehicle.registration || latestVehicle.reg_number || "").toUpperCase(),
            colour: latestVehicle.colour || "",
            makeModel: latestVehicle.make_model || "",
            chassis: latestVehicle.vin || latestVehicle.chassis || "",
            engine: latestVehicle.engine_number || latestVehicle.engine || "",
            mileage: latestVehicle.mileage ?? 0,
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

  // ✅ Save Job Function - persist job info, vehicle, customer status, requests, documents, and check-sheets together
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

      // All validations passed - proceed with database operations
      console.log("✓ All validations passed. Starting save job process...");

      // ===== DATABASE OPERATIONS PHASE =====
      // Prepare vehicle data
      const regUpper = vehicle.reg.trim().toUpperCase();
      const makeModelParts = (vehicle.makeModel || "").trim().split(/\s+/);
      const primaryMake = makeModelParts[0] || "Unknown";
      const modelName = makeModelParts.slice(1).join(" ");

      const vehiclePayload = {
        registration: regUpper,
        reg_number: regUpper,
        make_model: vehicle.makeModel || "",
        make: primaryMake,
        model: modelName,
        colour: vehicle.colour || null,
        chassis: vehicle.chassis || null,
        vin: vehicle.chassis || null,
        engine: vehicle.engine || null,
        engine_number: vehicle.engine || null,
        mileage: Number.isFinite(Number(vehicle.mileage)) ? parseInt(vehicle.mileage, 10) : 0,
        customer_id: customer.id,
      };

      // Step 1: Save/update vehicle
      const vehicleResult = await createOrUpdateVehicle(vehiclePayload);

      if (!vehicleResult.success || !vehicleResult.data) {
        throw new Error(vehicleResult.error?.message || "Failed to save vehicle");
      }

      const vehicleRecord = vehicleResult.data;
      const vehicleId = vehicleRecord.vehicle_id || vehicleRecord.id;

      if (!vehicleId) {
        throw new Error("Vehicle ID not returned after save");
      }

      console.log("✓ Vehicle saved/updated with ID:", vehicleId);

      // Step 2: Create jobs - handle multiple tabs if asPrimeJob is enabled
      const createdJobs = [];
      let primeJobId = null;

      for (let tabIndex = 0; tabIndex < jobTabs.length; tabIndex++) {
        const tab = jobTabs[tabIndex];
        const isFirstTab = tabIndex === 0;

        // Sanitize requests for this tab
        const sanitizedRequests = tab.requests
          .map((req) => ({ ...req, text: (req.text || "").trim() }))
          .filter((req) => req.text.length > 0);

        const jobDescription = sanitizedRequests.map((req) => req.text).join("\n");
        const detectedJobTypes = Array.from(
          new Set(detectJobTypesForRequests(sanitizedRequests).map((d) => d.jobType))
        );

        const jobPayload = {
          regNumber: regUpper,
          jobNumber: null,
          description: jobDescription || `Job card for ${regUpper}`,
          type: tab.jobSource === "Warranty" ? "Warranty" : "Service",
          assignedTo: null,
          customerId: customer.id,
          vehicleId,
          waitingStatus: tab.waitingStatus,
          jobSource: tab.jobSource,
          jobDivision: tab.jobDivision,
          jobCategories: detectedJobTypes,
          requests: sanitizedRequests,
          cosmeticNotes: isFirstTab ? (cosmeticNotes || null) : null,
          vhcRequired: isFirstTab ? vhcRequired : false,
          maintenanceInfo: isFirstTab ? { cosmeticDamagePresent } : {},
          // Prime/Sub-job parameters
          primeJobId: isSubJobMode && primeJobData
            ? primeJobData.id
            : (!isFirstTab && primeJobId ? primeJobId : null),
          asPrimeJob: !isSubJobMode && asPrimeJob && isFirstTab,
        };

        console.log(`Saving job ${tabIndex + 1} via shared helper:`, jobPayload);

        const jobResult = await addJobToDatabase(jobPayload);

        if (!jobResult.success || !jobResult.data) {
          throw new Error(jobResult.error?.message || `Failed to create job card ${tabIndex + 1}`);
        }

        const insertedJob = jobResult.data;
        createdJobs.push(insertedJob);

        // Store the prime job ID for linking subsequent jobs
        if (isFirstTab && asPrimeJob && !isSubJobMode) {
          primeJobId = insertedJob.id || insertedJob.jobId || insertedJob.job_id;
        }

        console.log(`✓ Job ${tabIndex + 1} created successfully:`, insertedJob.jobNumber);
      }

      // Use the first job for the rest of the save process
      const insertedJob = createdJobs[0];
      const persistedJobId = insertedJob.id || insertedJob.jobId || insertedJob.job_id;

      if (!persistedJobId) {
        throw new Error("Job ID missing after creation");
      }

      console.log("✓ Job created successfully with ID:", persistedJobId);

      // Step 3: Save related data for all created jobs
      for (let i = 0; i < createdJobs.length; i++) {
        const job = createdJobs[i];
        const tab = jobTabs[i];
        const jobId = job.id || job.jobId || job.job_id;
        const isFirstJob = i === 0;

        const tabRequests = tab.requests
          .map((req) => ({ ...req, text: (req.text || "").trim() }))
          .filter((req) => req.text.length > 0);

        console.log("🕐 tabRequests before save (time values):", tabRequests.map((r) => ({ text: (r.text || "").slice(0, 30), time: r.time, typeofTime: typeof r.time })));

        if (isFirstJob) {
          await saveCosmeticDamageDetails(jobId, cosmeticDamagePresent, cosmeticNotes);
        }
        await saveCustomerStatus(jobId, tab.waitingStatus);

        const insertedRequests = await saveJobRequestsToDatabase(jobId, tabRequests);
        await saveJobRequestDetections(
          jobId,
          job.jobNumber || job.job_number || null,
          insertedRequests,
          tabRequests
        );

        if (tab.uploadedFiles.length > 0) {
          await linkUploadedFilesToJobById(jobId, tab.uploadedFiles);
        }

        console.log(`✓ Related data saved for job ${i + 1}`);
      }

      console.log("✓ All related data saved successfully");

      // Step 4: Refresh jobs cache
      if (typeof fetchJobs === "function") {
        fetchJobs().catch((err) => console.error("❌ Error refreshing jobs:", err));
      }

      // Step 5: Update UI and redirect
      const finalJobNumber = insertedJob.jobNumber || insertedJob.id;
      setJobNumberDisplay(finalJobNumber || null);

      const jobsCreatedMessage = createdJobs.length > 1
        ? `${createdJobs.length} linked jobs created: ${createdJobs.map((j) => j.jobNumber).join(", ")}`
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
    for (const file of files) {
      try {
        await addJobFile({
          jobId,
          fileName: file.fileName,
          fileUrl: file.publicUrl,
          fileType: file.contentType,
          folder: "documents",
          storagePath: file.storagePath,
        });
      } catch (err) {
        console.error("Error linking file to job:", err);
      }
    }
  };

  return (
    <Layout>
      <div
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "14px",
                color: isSubJobMode ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: "500",
              }}
            >
              {isSubJobMode
                ? `Sub-job for ${primeJobData?.jobNumber || "Prime Job"}`
                : jobNumberDisplay
                ? `${jobDivision} — ${jobNumberDisplay}`
                : "New Job Card"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Job Source Bubble */}
            <span
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                backgroundColor: jobSource === "Warranty" ? "var(--warning-surface)" : "var(--success-surface)",
                color: jobSource === "Warranty" ? "var(--danger)" : "var(--success-dark)",
                fontSize: "13px",
                fontWeight: 600,
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
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "none",
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
        </div>

        {/* ✅ Job Tabs Bar - Always shown unless in sub-job mode */}
        {!isSubJobMode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "12px",
              padding: "8px 12px",
              backgroundColor: "var(--surface)",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
            }}
          >
            {jobTabs.map((tab, index) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: activeTabIndex === index ? "var(--primary)" : "var(--surface-light)",
                  color: activeTabIndex === index ? "white" : "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: activeTabIndex === index ? "600" : "500",
                  fontSize: "13px",
                  transition: "all 0.2s",
                }}
              >
                <span>Job {index + 1}</span>
                {jobTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeJobTab(index);
                    }}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: activeTabIndex === index ? "rgba(255,255,255,0.3)" : "var(--text-secondary)",
                      color: activeTabIndex === index ? "white" : "var(--surface)",
                      cursor: "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {/* Add New Job Tab Button */}
            <button
              onClick={addNewJobTab}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "2px dashed var(--primary)",
                backgroundColor: "transparent",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: "18px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "var(--primary-surface)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
              title="Add another linked job"
            >
              +
            </button>
            <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
              Link new job card
            </span>
          </div>
        )}

        {/* ✅ Sub-job Mode Banner */}
        {isSubJobMode && primeJobData && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--primary-surface)",
              borderRadius: "8px",
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
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              View Prime Job
            </button>
          </div>
        )}

        {/* ✅ Content Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* ✅ NEW LAYOUT: Top Row - Job Information, Vehicle Details, Customer Details (all 33% width) */}
          <div style={{ display: "flex", gap: "16px", width: "100%" }}>
            {/* Job Information Section - 33% width */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "none",
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
                Job Information
              </h3>

              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Customer Status
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    padding: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--surface-light)",
                    border: "1px solid var(--surface-light)",
                    width: "fit-content",
                  }}
                >
                  {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                    <label
                      key={status}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        padding: "8px 14px",
                        borderRadius: "999px",
                        border: waitingStatus === status ? "1px solid var(--primary)" : "1px solid transparent",
                        backgroundColor: waitingStatus === status ? "var(--surface)" : "transparent",
                        color: waitingStatus === status ? "var(--text-primary)" : "var(--text-secondary)",
                        transition: "all 0.2s",
                        fontWeight: waitingStatus === status ? 600 : 500,
                      }}
                    >
                      <input
                        type="radio"
                        name="waiting"
                        value={status}
                        checked={waitingStatus === status}
                        onChange={() => setWaitingStatus(status)}
                        style={{ display: "none" }}
                      />
                      <span style={{ fontSize: "13px" }}>{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Job Source
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    padding: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--surface-light)",
                    border: "1px solid var(--surface-light)",
                    width: "fit-content",
                  }}
                >
                  {["Retail", "Warranty"].map((src) => (
                    <label
                      key={src}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        padding: "8px 16px",
                        borderRadius: "999px",
                        border: jobSource === src ? "1px solid var(--primary)" : "1px solid transparent",
                        backgroundColor: jobSource === src ? "var(--surface)" : "transparent",
                        color: jobSource === src ? "var(--text-primary)" : "var(--text-secondary)",
                        transition: "all 0.2s",
                        fontWeight: jobSource === src ? 600 : 500,
                      }}
                    >
                      <input
                        type="radio"
                        name="source"
                        value={src}
                        checked={jobSource === src}
                        onChange={() => setJobSource(src)}
                        style={{ display: "none" }}
                      />
                      <span style={{ fontSize: "13px" }}>{src}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Job Division
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    padding: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--surface-light)",
                    border: "1px solid var(--surface-light)",
                    width: "fit-content",
                  }}
                >
                  {["Retail", "Sales"].map((division) => (
                    <label
                      key={division}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        padding: "8px 16px",
                        borderRadius: "999px",
                        border: jobDivision === division ? "1px solid var(--primary)" : "1px solid transparent",
                        backgroundColor: jobDivision === division ? "var(--surface)" : "transparent",
                        color: jobDivision === division ? "var(--text-primary)" : "var(--text-secondary)",
                        transition: "all 0.2s",
                        fontWeight: jobDivision === division ? 600 : 500,
                      }}
                    >
                      <input
                        type="radio"
                        name="jobDivision"
                        value={division}
                        checked={jobDivision === division}
                        onChange={() => setJobDivision(division)}
                        style={{ display: "none" }}
                      />
                      <span style={{ fontSize: "13px" }}>{division}</span>
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
                    marginBottom: "8px",
                  }}
                >
                  AI Detected Job Types
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {jobDetections.filter((d) => d.sourceText).length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No detections yet</div>
                  ) : (
                    jobDetections
                      .filter((d) => d.sourceText)
                      .map((detection, index) => (
                        <div
                          key={`${detection.requestIndex}-${index}`}
                          style={{
                            border: "1px solid var(--surface-light)",
                            borderRadius: "12px",
                            padding: "10px 12px",
                            backgroundColor: "var(--surface-light)",
                            display: "grid",
                            gridTemplateColumns: "120px 1fr 80px",
                            gap: "8px",
                            alignItems: "center",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{detection.jobType}</div>
                          <div style={{ color: "var(--text-secondary)" }}>
                            <strong style={{ color: "var(--text-primary)" }}>{detection.itemCategory}</strong>
                            <span style={{ marginLeft: "6px" }}>{detection.sourceText}</span>
                          </div>
                          <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                            {Math.round(detection.confidence * 100)}%
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>

            {/* Vehicle Details Section - 33% width */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "none",
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
                      borderRadius: "4px",
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
                    borderRadius: "8px",
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
                      border: "1px solid var(--surface-light)",
                      borderRadius: "8px",
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
                      borderRadius: "8px",
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
                    {isLoadingVehicle ? "Loading..." : "Fetch Data"}
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
                    borderRadius: "8px",
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
                          backgroundColor: "var(--surface-light)",
                          borderRadius: "8px",
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
                      border: "1px solid var(--surface-light)",
                      borderRadius: "8px",
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
            </div>

            {/* Customer Details Section - 33% width */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "none",
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
                      borderRadius: "4px",
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
                    borderRadius: "8px",
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
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { label: "First Name", field: "firstName", type: "text", placeholder: "" }, // first name input
                    { label: "Last Name", field: "lastName", type: "text", placeholder: "" }, // last name input
                    { label: "Email", field: "email", type: "email", placeholder: "" }, // email input
                    { label: "Mobile", field: "mobile", type: "tel", placeholder: "" }, // mobile input
                    { label: "Telephone", field: "telephone", type: "tel", placeholder: "" }, // telephone input
                    { label: "Address", field: "address", type: "textarea", placeholder: "" }, // address textarea
                    { label: "Postcode", field: "postcode", type: "text", placeholder: "" }, // postcode input
                    { label: "Contact Preference", field: "contactPreference", type: "multi-select" }, // contact preference input
                  ].map((input) => (
                    <div key={input.field}>
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
                            border: "1px solid var(--surface-light)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "var(--surface)",
                            resize: input.field === "address" ? "none" : "vertical",
                            minHeight: input.field === "address" ? "40px" : "unset",
                            overflow: "hidden",
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
                            borderRadius: "999px",
                            backgroundColor: "var(--surface-light)",
                            border: "1px solid var(--surface-light)",
                            width: "fit-content",
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
                                  borderRadius: "999px",
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
                            border: "1px solid var(--surface-light)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "var(--surface)",
                            color: input.field === "mobile" ? "white" : "inherit",
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

                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
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
                            borderRadius: "8px",
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
                            border: "1px solid var(--surface-light)",
                            borderRadius: "8px",
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
                      <button
                        onClick={handleStartCustomerEdit}
                        style={{
                          width: "100%",
                          maxWidth: "320px",
                          padding: "12px",
                          fontSize: "14px",
                          backgroundColor: "var(--primary)",
                          color: "var(--text-inverse)",
                          border: "none",
                          borderRadius: "8px",
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
                    )}
                  </div>

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
                      border: "1px solid var(--surface-light)",
                      borderRadius: "8px",
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
                      borderRadius: "8px",
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
                      padding: "14px",
                      fontSize: "14px",
                      backgroundColor: "var(--surface-light)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "var(--surface-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "var(--surface-light)";
                    }}
                  >
                    Search Existing Customer
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Job Requests Section - Full Width */}
          <div
            style={{
              padding: "20px",
              borderRadius: "16px",
              boxShadow: "none",
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
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--surface-light)",
                    borderRadius: "12px",
                    marginBottom: "12px",
                    padding: "16px",
                    backgroundColor: "var(--surface-light)",
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
                    <input
                      type="text"
                      value={req.text}
                      onChange={(e) => handleRequestChange(i, e.target.value)}
                      placeholder="Enter job request (MOT, Service, Diagnostic)"
                      style={{
                        flex: 2,
                        minWidth: "250px",
                        padding: "10px 12px",
                        border: "1px solid var(--surface-light)",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s",
                        backgroundColor: "var(--surface)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--primary)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--surface-light)";
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={req.time || ""}
                        onChange={(e) => handleTimeChange(i, e.target.value)}
                        placeholder="Hours"
                        style={{
                          width: "90px",
                          padding: "10px 12px",
                          border: "1px solid var(--surface-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          outline: "none",
                          transition: "border-color 0.2s",
                          backgroundColor: "var(--surface)",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "var(--primary)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "var(--surface-light)";
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
                        borderRadius: "8px",
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
                </div>
              ))}
            </div>
            <button
              onClick={handleAddRequest}
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "8px",
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
          </div>

          {/* ✅ Bottom Row: Cosmetic Damage, Add VHC, Full Car Details */}
          <div style={{ display: "flex", gap: "16px" }}>
            <div
              style={{
                flex: 1,
                padding: "16px",
                borderRadius: "16px",
                boxShadow: "none",
                ...sectionCardStyle,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
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
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    padding: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--surface-light)",
                    border: "1px solid var(--surface-light)",
                    width: "fit-content",
                  }}
                >
                  {[true, false].map((choice) => (
                    <button
                      key={choice ? "yes" : "no"}
                      onClick={() => setCosmeticDamagePresent(choice)}
                      type="button"
                      style={{
                        padding: "6px 14px",
                        borderRadius: "999px",
                        border: cosmeticDamagePresent === choice ? "1px solid var(--primary)" : "1px solid transparent",
                        backgroundColor: cosmeticDamagePresent === choice ? "var(--surface)" : "transparent",
                        color: cosmeticDamagePresent === choice ? "var(--text-primary)" : "var(--text-secondary)",
                        fontSize: "12px",
                        fontWeight: cosmeticDamagePresent === choice ? "600" : "500",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
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
                    border: "1px solid var(--surface-light)",
                    borderRadius: "8px",
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
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px",
                borderRadius: "16px",
                boxShadow: "none",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
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
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    padding: "6px",
                    borderRadius: "999px",
                    backgroundColor: "var(--surface-light)",
                    border: "1px solid var(--surface-light)",
                    width: "fit-content",
                  }}
                >
                  {[true, false].map((choice) => (
                    <button
                      key={`vhc-${choice ? "yes" : "no"}`}
                      type="button"
                      onClick={() => setVhcRequired(choice)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "999px",
                        border: vhcRequired === choice ? "1px solid var(--primary)" : "1px solid transparent",
                        backgroundColor: vhcRequired === choice ? "var(--surface)" : "transparent",
                        color: vhcRequired === choice ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: vhcRequired === choice ? "600" : "500",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {choice ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px",
                borderRadius: "16px",
                boxShadow: "none",
                ...sectionCardStyle,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
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
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "background-color 0.2s, transform 0.2s",
                    boxShadow: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary-dark)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Manage Documents
                </button>
              </div>
            </div>
          </div>
        </div>

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
        />

      </div>
      <style jsx global>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
          appearance: textfield;
        }

        .job-request-payment-dropdown {
          width: 160px;
        }

        .job-request-payment-dropdown .dropdown-api__control {
          min-height: 40px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          border: 1px solid var(--surface-light);
          background: var(--surface);
          gap: 8px;
        }

        .job-request-payment-dropdown .dropdown-api__value {
          font-size: 14px;
          font-weight: 500;
        }

        .job-request-payment-dropdown.dropdown-api.is-open .dropdown-api__control,
        .job-request-payment-dropdown .dropdown-api__control:focus-visible {
          border-color: var(--primary);
          background: var(--surface);
        }

        .job-request-payment-dropdown .dropdown-api__chevron {
          width: 16px;
          height: 16px;
        }
      `}</style>
    </Layout>
  );
}
