// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/create/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useEffect, useRef, useState } from "react"; // import React hooks including useEffect and useRef for syncing customer forms
import { useRouter } from "next/router"; // for navigation
import Layout from "@/components/Layout"; // import layout wrapper
import { useJobs } from "@/context/JobsContext"; // import jobs context
import { useUser } from "@/context/UserContext"; // import user context for signature + uploads
import {
  addCustomerToDatabase,
  checkCustomerExists,
  getCustomerById,
  updateCustomer,
} from "@/lib/database/customers";
import { createOrUpdateVehicle, getVehicleByReg } from "@/lib/database/vehicles";
import { addJobToDatabase, addJobFile } from "@/lib/database/jobs";
import { supabase } from "@/lib/supabaseClient"; // import supabase client for job request inserts
import NewCustomerPopup from "@/components/popups/NewCustomerPopup"; // import new customer popup
import ExistingCustomerPopup from "@/components/popups/ExistingCustomerPopup"; // import existing customer popup

// function to automatically detect job types based on request descriptions
const detectJobTypes = (requests) => {
  const detected = new Set(); // use a set to avoid duplicates
  requests.forEach((description) => {
    const lower = description.toLowerCase(); // convert to lowercase for easier matching
    if (lower.includes("mot")) detected.add("MOT"); // check if request mentions MOT
    if (lower.includes("service") || lower.includes("oil") || lower.includes("inspection"))
      detected.add("Service"); // check for service-related keywords
    if (lower.includes("diag") || lower.includes("investigation") || lower.includes("check") || lower.includes("warning") || lower.includes("fault"))
      detected.add("Diagnostic"); // check for diagnostic-related keywords
  });
  if (detected.size === 0) detected.add("Other"); // if no types detected, default to "Other"
  return Array.from(detected); // convert set back to array
};

const initialCustomerFormState = {
  id: null, // stores currently selected customer's UUID
  firstName: "", // stores customer first name for form binding
  lastName: "", // stores customer last name for form binding
  email: "", // stores customer email address
  mobile: "", // stores customer mobile number
  telephone: "", // stores customer telephone number
  address: "", // stores customer street address
  postcode: "", // stores customer postcode
  contactPreference: "email", // stores customer preferred contact option
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
  contactPreference:
    record?.contact_preference ||
    record?.contactPreference ||
    initialCustomerFormState.contactPreference, // normalize contact preference field
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

  // state for job requests (multiple requests can be added)
  const [requests, setRequests] = useState([{ text: "", time: "", paymentType: "Customer" }]);
  const [cosmeticDamagePresent, setCosmeticDamagePresent] = useState(false); // track whether cosmetic damage observed
  const [cosmeticNotes, setCosmeticNotes] = useState(""); // notes about cosmetic damage
  const [vhcRequired, setVhcRequired] = useState(false); // whether VHC is required
  const [waitingStatus, setWaitingStatus] = useState("Neither"); // customer waiting status
  const [jobSource, setJobSource] = useState("Retail"); // job source (Retail or Warranty)
  const [jobCategories, setJobCategories] = useState(["Other"]); // auto-detected job categories
  const [showNewCustomer, setShowNewCustomer] = useState(false); // toggle new customer popup
  const [showExistingCustomer, setShowExistingCustomer] = useState(false); // toggle existing customer popup
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false); // toggle documents popup
  const [pendingDocuments, setPendingDocuments] = useState([]); // hold selected files before job exists
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false); // track when uploads running
  const [checkSheetFile, setCheckSheetFile] = useState(null); // uploaded check-sheet file before save
  const [checkSheetPreviewUrl, setCheckSheetPreviewUrl] = useState(""); // preview URL for image check-sheets
  const [checkSheetCheckboxes, setCheckSheetCheckboxes] = useState([]); // list of checkbox metadata for current sheet
  const [userSignature, setUserSignature] = useState(null); // store current user's signature metadata
  const [isUploadingSignature, setIsUploadingSignature] = useState(false); // track signature upload state
  const [jobNumberDisplay, setJobNumberDisplay] = useState(null); // store assigned job number for header display

  // state for maintenance information (simplified - only MOT date now)
  const [nextMotDate, setNextMotDate] = useState(""); // store upcoming MOT date for maintenance info

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

  useEffect(() => () => { // cleanup preview object URLs when component unmounts or url changes
    if (checkSheetPreviewUrl) {
      URL.revokeObjectURL(checkSheetPreviewUrl);
    }
  }, [checkSheetPreviewUrl]);

  // function to determine background color based on waiting status and job source
  const getBackgroundColor = (status, source) => {
    let baseColor = "#f9fafb"; // light grey background
    switch (status) {
      case "Waiting":
        baseColor = "#fef2f2"; // red tint for waiting
        break;
      case "Loan Car":
        baseColor = "#eff6ff"; // blue tint for loan car
        break;
      case "Collection":
        baseColor = "#f0fdf4"; // green tint for collection
        break;
      default:
        baseColor = "#f9fafb"; // default background
    }
    if (source === "Warranty") { // check if job source is warranty
      if (baseColor === "#f9fafb") return "#fff7ed"; // add orange tint when neutral
      return baseColor; // keep existing tint otherwise
    }
    return baseColor; // return computed background
  };

  // handle changes to request text and auto-detect job types
  const handleRequestChange = (index, value) => {
    const updated = [...requests]; // copy current requests
    updated[index].text = value; // update text at index
    setRequests(updated); // store updated list
    setJobCategories(detectJobTypes(updated.map((r) => r.text))); // re-detect job types
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
  const handleAddRequest = () =>
    setRequests([...requests, { text: "", time: "", paymentType: "Customer" }]); // append new empty request

  // remove a request from the list by index
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index); // remove request at index
    setRequests(updated); // store updated list
    setJobCategories(detectJobTypes(updated.map((r) => r.text))); // re-detect job types after removal
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

  // update the editable customer form when any field changes
  const handleCustomerFieldChange = (field, value) => {
    setCustomerForm((prev) => ({ ...prev, [field]: value }));
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
      return; // nothing to do when payload missing
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
      return; // nothing to insert
    } // finish guard

    const { error } = await supabase.from("job_requests").insert(payload); // insert payload into Supabase table
    if (error) { // check for insert failure
      throw new Error(error.message || "Failed to save job requests"); // bubble error so caller can abort
    } // finish error handling
  }; // end helper

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

  const uploadDocumentsForJob = async (jobId, files, uploadedBy = null) => { // push pending files into Supabase storage + DB
    if (!jobId || !Array.isArray(files) || files.length === 0) { // guard against missing data
      return; // nothing to upload
    } // guard end

    setIsUploadingDocuments(true); // set uploading flag

    try {
      for (const file of files) { // iterate each file sequentially to maintain order
        const safeName = file.name || `document-${Date.now()}`; // derive filename fallback
        const ext = safeName.split(".").pop(); // capture extension
        const objectPath = `jobs/${jobId}/documents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || "bin"}`; // build storage key

        const { error: storageError } = await supabase.storage // upload into Supabase Storage bucket
          .from("job-documents")
          .upload(objectPath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (storageError) {
          throw new Error(storageError.message || "Failed to upload document");
        }

        const publicUrl = supabase.storage.from("job-documents").getPublicUrl(objectPath).data.publicUrl; // obtain accessible URL

        await addJobFile( // persist metadata in job_files table
          jobId,
          safeName,
          publicUrl,
          file.type || "application/octet-stream",
          "documents",
          uploadedBy
        );
      }
    } catch (err) {
      console.error("Document upload failed", err);
      throw err;
    } finally {
      setIsUploadingDocuments(false); // clear uploading state regardless of success
      setPendingDocuments([]); // clear pending queue after attempt
    }
  };

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
        showNotification("customer", "success", "✓ Customer found in database and loaded!");
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
          showNotification("customer", "success", "✓ Customer found in database and loaded!");
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
        const normalizedReg = (storedVehicle.registration || storedVehicle.reg_number || regUpper || "").toString().toUpperCase(); // normalize stored registration
        const storedMakeModel =
          (storedVehicle.make_model || `${storedVehicle.make || ""} ${storedVehicle.model || ""}`)
            .trim(); // combine make and model if needed

        setVehicle((prev) => ({
          reg: normalizedReg,
          makeModel: storedMakeModel || prev.makeModel || "",
          colour: storedVehicle.colour || prev.colour || "",
          chassis: storedVehicle.chassis || storedVehicle.vin || prev.chassis || "",
          engine: storedVehicle.engine || storedVehicle.engine_number || prev.engine || "",
          mileage: storedVehicle.mileage ? String(storedVehicle.mileage) : prev.mileage || "",
        }));

        if (storedVehicle.mot_due) {
          const motSource = new Date(storedVehicle.mot_due);
          if (!Number.isNaN(motSource.getTime())) {
            const motDate = motSource.toISOString().split("T")[0]; // normalize date to YYYY-MM-DD
            setNextMotDate(motDate);
          }
        }

        if (storedVehicle.customer) {
          const normalizedCustomer = normalizeCustomerRecord(storedVehicle.customer);
          if (!customer || customer.id !== normalizedCustomer.id) {
            setCustomer(normalizedCustomer);
            showNotification("customer", "success", "✓ Customer linked from existing vehicle!");
          }
        }

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

      if (data.motExpiryDate || data.nextMotDate) { // check for MOT date fields
        setNextMotDate((data.motExpiryDate || data.nextMotDate || "").split("T")[0]); // store MOT date stripped of time
      }

      showNotification("vehicle", "success", "✓ Vehicle details fetched from DVLA!"); // notify success
    } catch (err) {
      console.error("Error fetching vehicle data from DVLA:", err); // log error
      setError(`Error: ${err.message}`); // store error message
      showNotification("vehicle", "error", `✗ ${err.message}`); // notify failure
    } finally {
      setIsLoadingVehicle(false); // always stop loading state
    }
  };

  // ✅ Save Job Function - persist vehicle + job via shared helpers
  const handleSaveJob = async () => {
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

      const sanitizedRequests = requests
        .map((req) => ({
          ...req,
          text: (req.text || "").trim(),
        }))
        .filter((req) => req.text.length > 0);

      if (sanitizedRequests.length === 0) {
        alert("Please add at least one job request before saving.");
        return;
      }

      console.log("Starting save job process...");

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
        mileage: vehicle.mileage ? parseInt(vehicle.mileage, 10) || null : null,
        customer_id: customer.id,
      };

      const vehicleResult = await createOrUpdateVehicle(vehiclePayload);

      if (!vehicleResult.success || !vehicleResult.data) {
        throw new Error(vehicleResult.error?.message || "Failed to save vehicle");
      }

      const vehicleRecord = vehicleResult.data;
      const vehicleId = vehicleRecord.vehicle_id || vehicleRecord.id;

      if (!vehicleId) {
        throw new Error("Vehicle ID not returned after save");
      }

      console.log("Vehicle saved/updated with ID:", vehicleId);

      const jobDescription = sanitizedRequests.map((req) => req.text).join("\n");

      const jobPayload = {
        regNumber: regUpper,
        jobNumber: null,
        description: jobDescription || `Job card for ${regUpper}`,
        type: jobSource === "Warranty" ? "Warranty" : "Service",
        assignedTo: null,
        customerId: customer.id,
        vehicleId,
        waitingStatus,
        jobSource,
        jobCategories,
        requests: sanitizedRequests,
        cosmeticNotes: cosmeticNotes || null,
        vhcRequired: vhcRequired,
        maintenanceInfo: {
          nextMotDate: nextMotDate || null,
          cosmeticDamagePresent,
        },
      };

      console.log("Saving job via shared helper:", jobPayload);

      const jobResult = await addJobToDatabase(jobPayload);

      if (!jobResult.success || !jobResult.data) {
        throw new Error(jobResult.error?.message || "Failed to create job card");
      }

      const insertedJob = jobResult.data;
      const persistedJobId = insertedJob.id || insertedJob.jobId || insertedJob.job_id; // normalize job identifier for inserts
      if (!persistedJobId) { // ensure job id exists
        throw new Error("Job ID missing after creation"); // abort when job id not returned
      } // finish guard

      await saveCosmeticDamageDetails(persistedJobId, cosmeticDamagePresent, cosmeticNotes); // store cosmetic damage toggle + notes
      await saveJobRequestsToDatabase(persistedJobId, sanitizedRequests); // create job request rows linked to job id
      if (pendingDocuments.length > 0) { // check if any documents queued
        await uploadDocumentsForJob(persistedJobId, pendingDocuments, dbUserId || null); // upload queued documents against the job
      } // end conditional upload
      await saveCheckSheetData(persistedJobId); // persist check-sheet configuration when provided
      console.log("Job saved successfully with ID:", insertedJob.id);

      if (typeof fetchJobs === "function") {
        fetchJobs().catch((err) => console.error("❌ Error refreshing jobs:", err));
      }

      const finalJobNumber = insertedJob.jobNumber || insertedJob.id;
      setJobNumberDisplay(finalJobNumber || null); // update header display with new job number
      alert(
        `Job created successfully! Job Number: ${finalJobNumber}\n\nVehicle ${regUpper} has been saved and linked to ${customer.firstName} ${customer.lastName}`
      );

      router.push(`/appointments?jobNumber=${finalJobNumber}`);
    } catch (err) {
      console.error("❌ Error saving job:", err);
      alert(`Error saving job: ${err.message}. Check console for details.`);
    }
  };

  return (
    <Layout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "16px",
          overflow: "hidden",
          transition: "background 0.3s ease",
          background: getBackgroundColor(waitingStatus, jobSource),
        }}
      >
        {/* ✅ Header Section - Modern Design */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#666",
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              {jobNumberDisplay ? `${jobSource} — ${jobNumberDisplay}` : `${jobSource} Job Card`}
            </h2>
          </div>
          <button
            onClick={handleSaveJob}
            style={{
              padding: "12px 28px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "15px",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(16,185,129,0.2)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#059669";
              e.target.style.boxShadow = "0 6px 12px rgba(16,185,129,0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#10b981";
              e.target.style.boxShadow = "0 4px 8px rgba(16,185,129,0.2)";
            }}
          >
            Save Job Card
          </button>
        </div>

        {/* ✅ Scrollable Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* ✅ NEW LAYOUT: Top Row - Job Information, Vehicle Details, Customer Details (all 33% width) */}
          <div style={{ display: "flex", gap: "16px" }}>
            {/* Job Information Section - 33% width */}
            <div
              style={{
                flex: "0 0 33%",
                background: "white",
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginTop: 0,
                  marginBottom: "16px",
                }}
              >
                Job Information
              </h3>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Customer Status
                </label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                    <label
                      key={status}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: waitingStatus === status ? "2px solid #d10000" : "2px solid #e0e0e0",
                        backgroundColor: waitingStatus === status ? "#fff5f5" : "white",
                        transition: "all 0.2s",
                      }}
                    >
                      <input
                        type="radio"
                        name="waiting"
                        value={status}
                        checked={waitingStatus === status}
                        onChange={() => setWaitingStatus(status)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Job Source
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {["Retail", "Warranty"].map((src) => (
                    <label
                      key={src}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: jobSource === src ? "2px solid #d10000" : "2px solid #e0e0e0",
                        backgroundColor: jobSource === src ? "#fff5f5" : "white",
                        transition: "all 0.2s",
                      }}
                    >
                      <input
                        type="radio"
                        name="source"
                        value={src}
                        checked={jobSource === src}
                        onChange={() => setJobSource(src)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{src}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Detected Job Types
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {jobCategories.map((type, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "#d10000",
                        color: "white",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontWeight: "600",
                        fontSize: "12px",
                      }}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#666",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Next MOT Date
                </label>
                <input
                  type="date"
                  value={nextMotDate}
                  onChange={(e) => setNextMotDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#d10000";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e0e0e0";
                  }}
                />
              </div>
            </div>

            {/* Vehicle Details Section - 33% width */}
            <div
              style={{
                flex: "0 0 33%",
                background: "white",
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginTop: 0,
                  marginBottom: "16px",
                }}
              >
                Vehicle Details
              </h3>

              {vehicleNotification && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                    backgroundColor: vehicleNotification.type === "success" ? "#d4edda" : "#f8d7da",
                    border: `1px solid ${vehicleNotification.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
                    color: vehicleNotification.type === "success" ? "#155724" : "#721c24",
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
                    color: "#666",
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
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      textTransform: "uppercase",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#d10000";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
                    }}
                  />
                  <button
                    onClick={handleFetchVehicleData}
                    disabled={isLoadingVehicle}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: isLoadingVehicle ? "#ccc" : "#d10000",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: isLoadingVehicle ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoadingVehicle) e.target.style.backgroundColor = "#b00000";
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoadingVehicle) e.target.style.backgroundColor = "#d10000";
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
                    color: "#dc3545",
                    marginBottom: "12px",
                    padding: "10px 12px",
                    backgroundColor: "#f8d7da",
                    borderRadius: "8px",
                    border: "1px solid #f5c6cb",
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
                          color: "#666",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {labelMap[key]}
                      </label>
                      <div
                        style={{
                          padding: "10px 12px",
                          backgroundColor: "#f5f5f5",
                          borderRadius: "8px",
                          fontSize: "14px",
                          color: vehicle[key] ? "#1a1a1a" : "#999",
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
                      color: "#666",
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
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#d10000";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Customer Details Section - 33% width */}
            <div
              style={{
                flex: "0 0 33%",
                background: "white",
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginTop: 0,
                  marginBottom: "16px",
                }}
              >
                Customer Details
              </h3>

              {customerNotification && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                    backgroundColor: customerNotification.type === "success" ? "#d4edda" : "#f8d7da",
                    border: `1px solid ${customerNotification.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
                    color: customerNotification.type === "success" ? "#155724" : "#721c24",
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
                    { label: "First Name", field: "firstName", type: "text", placeholder: "Enter first name" }, // first name input
                    { label: "Last Name", field: "lastName", type: "text", placeholder: "Enter last name" }, // last name input
                    { label: "Email", field: "email", type: "email", placeholder: "Enter email address" }, // email input
                    { label: "Mobile", field: "mobile", type: "tel", placeholder: "Enter mobile number" }, // mobile input
                    { label: "Telephone", field: "telephone", type: "tel", placeholder: "Enter telephone number" }, // telephone input
                    { label: "Address", field: "address", type: "textarea", placeholder: "Enter customer address" }, // address textarea
                    { label: "Postcode", field: "postcode", type: "text", placeholder: "Enter postcode" }, // postcode input
                    { label: "Contact Preference", field: "contactPreference", type: "text", placeholder: "Enter contact preference" }, // contact preference input
                  ].map((input) => (
                    <div key={input.field}>
                      <label
                        style={{
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#666",
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
                          disabled={!isCustomerEditing || isSavingCustomer}
                          placeholder={input.placeholder}
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            backgroundColor: isCustomerEditing && !isSavingCustomer ? "white" : "#f5f5f5",
                            resize: "vertical",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#d10000";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e0e0e0";
                          }}
                        />
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
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            backgroundColor: isCustomerEditing && !isSavingCustomer ? "white" : "#f5f5f5",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#d10000";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e0e0e0";
                          }}
                        />
                      )}
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: "12px" }}>
                    {isCustomerEditing ? (
                      <>
                        <button
                          onClick={handleSaveCustomerEdits}
                          disabled={isSavingCustomer}
                          style={{
                            flex: 1,
                            padding: "12px",
                            fontSize: "14px",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: isSavingCustomer ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s",
                            opacity: isSavingCustomer ? 0.7 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isSavingCustomer) {
                              e.target.style.backgroundColor = "#059669";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "#10b981";
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
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: isSavingCustomer ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            transition: "all 0.2s",
                            opacity: isSavingCustomer ? 0.7 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isSavingCustomer) {
                              e.target.style.backgroundColor = "#4b5563";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "#6b7280";
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
                          padding: "12px",
                          fontSize: "14px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "600",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#2563eb";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#3b82f6";
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
                      padding: "12px",
                      fontSize: "14px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: isSavingCustomer ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      transition: "all 0.2s",
                      opacity: isSavingCustomer ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSavingCustomer) {
                        e.target.style.backgroundColor = "#dc2626";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#ef4444";
                    }}
                  >
                    Clear Customer
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    style={{
                      padding: "16px",
                      fontSize: "14px",
                      backgroundColor: "#d10000",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#b00000";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#d10000";
                    }}
                  >
                    + New Customer
                  </button>
                  <button
                    onClick={() => setShowExistingCustomer(true)}
                    style={{
                      padding: "16px",
                      fontSize: "14px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#dc2626";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#ef4444";
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
              background: "white",
              padding: "20px",
              borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e0e0e0",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginTop: 0,
                marginBottom: "16px",
              }}
            >
              Job Requests
            </h3>
            {requests.map((req, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  marginBottom: "12px",
                  padding: "16px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
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
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#d10000";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
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
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#d10000";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e0e0e0";
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#666",
                        fontWeight: "500",
                        minWidth: "30px",
                      }}
                    >
                      {req.time !== "" ? `${req.time}h` : ""}
                    </span>
                  </div>
                  <select
                    value={req.paymentType || "Customer"}
                    onChange={(e) => handlePaymentTypeChange(i, e.target.value)}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                      transition: "border-color 0.2s",
                      width: "160px",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#d10000";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e0e0e0";
                    }}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Sales Goodwill">Sales Goodwill</option>
                    <option value="Service Goodwill">Service Goodwill</option>
                    <option value="Internal">Internal</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Lease Company">Lease Company</option>
                    <option value="Staff">Staff</option>
                  </select>
                  <button
                    onClick={() => handleRemoveRequest(i)}
                    style={{
                      backgroundColor: "#ef4444",
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
                      e.target.style.backgroundColor = "#dc2626";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#ef4444";
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={handleAddRequest}
              style={{
                backgroundColor: "#d10000",
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
                e.target.style.backgroundColor = "#b00000";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#d10000";
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
                background: "white",
                padding: "16px",
                borderRadius: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginTop: 0,
                  marginBottom: "12px",
                }}
              >
                Cosmetic Damage
              </h4>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#666" }}>Damage Present?</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[true, false].map((choice) => (
                    <button
                      key={choice ? "yes" : "no"}
                      onClick={() => setCosmeticDamagePresent(choice)}
                      type="button"
                      style={{
                        padding: "8px 14px",
                        borderRadius: "999px",
                        border: "1px solid",
                        borderColor: cosmeticDamagePresent === choice ? "#d10000" : "#e5e7eb",
                        backgroundColor: cosmeticDamagePresent === choice ? "#fee2e2" : "white",
                        color: "#1a1a1a",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {choice ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={cosmeticNotes}
                onChange={(e) => setCosmeticNotes(e.target.value)}
                placeholder="Describe any scratches, dents, or cosmetic damage..."
                disabled={!cosmeticDamagePresent}
                style={{
                  width: "100%",
                  height: "80px",
                  padding: "10px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  resize: "none",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  backgroundColor: cosmeticDamagePresent ? "white" : "#f3f4f6",
                  color: cosmeticDamagePresent ? "#1a1a1a" : "#9ca3af",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#d10000";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e0e0e0";
                }}
              />
            </div>
            <div
              style={{
                flex: 1,
                background: "white",
                padding: "16px",
                borderRadius: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e0e0e0",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginTop: 0,
                  marginBottom: "4px",
                }}
              >
                VHC Required?
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#6b7280",
                  lineHeight: 1.4,
                }}
              >
                Toggle this on to schedule a Vehicle Health Check so the job routes to the VHC dashboard for technicians.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                {[true, false].map((choice) => (
                  <button
                    key={`vhc-${choice ? "yes" : "no"}`}
                    type="button"
                    onClick={() => setVhcRequired(choice)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "2px solid",
                      borderColor: vhcRequired === choice ? "#d10000" : "#e5e7eb",
                      backgroundColor: vhcRequired === choice ? "#fff1f2" : "#f9fafb",
                      color: "#111827",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {choice ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  lineHeight: 1.4,
                }}
              >
                {vhcRequired
                  ? "✓ This job will appear in the VHC dashboard for technicians and customers."
                  : "✕ This job stays hidden from VHC workflows until enabled."}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #6366f1, #4338ca)",
                color: "white",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 8px rgba(99,102,241,0.3)",
                transition: "all 0.2s",
              }}
              onClick={() => setShowDocumentsPopup(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(99,102,241,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(99,102,241,0.3)";
              }}
            >
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>Documents</h4>
            </div>
          </div>
        </div>

        {showNewCustomer && (
          <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onSelect={(c) => handleCustomerSelect(c)} />
        )}
        {showExistingCustomer && (
          <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelect={(c) => handleCustomerSelect(c)} />
        )}

        {showDocumentsPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1100,
            }}
            onClick={() => setShowDocumentsPopup(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "520px",
                maxWidth: "90%",
                backgroundColor: "white",
                borderRadius: "18px",
                padding: "28px",
                boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0f172a" }}>Upload Documents</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                    Attach PDFs or images now. Files stay queued until the job is saved.
                  </p>
                </div>
                <button
                  onClick={() => setShowDocumentsPopup(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: "22px",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                >
                  ×
                </button>
              </div>

              <label
                htmlFor="documents-input"
                style={{
                  border: "2px dashed #c7d2fe",
                  borderRadius: "16px",
                  padding: "28px",
                  textAlign: "center",
                  cursor: "pointer",
                  backgroundColor: "#eef2ff",
                  color: "#312e81",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Click to select files (PNG, JPG, PDF)
                <input
                  id="documents-input"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length > 0) {
                      setPendingDocuments((prev) => [...prev, ...files]);
                    }
                  }}
                />
              </label>

              {pendingDocuments.length > 0 && (
                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                >
                  {pendingDocuments.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>{file.name}</div>
                        <div style={{ fontSize: "12px", color: "#475569" }}>{(file.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button
                        onClick={() =>
                          setPendingDocuments((prev) => prev.filter((_, removeIndex) => removeIndex !== idx))
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#ef4444",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: "12px",
                  padding: "16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>Check-Sheet Builder</h4>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Upload a check-sheet image/PDF then click the preview to place interactive checkboxes.
                  </p>
                </div>
                <label
                  htmlFor="checksheet-input"
                  style={{
                    border: "1px solid #cbd5f5",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#312e81",
                    cursor: "pointer",
                    backgroundColor: "white",
                    width: "fit-content",
                  }}
                >
                  Choose Check-Sheet
                  <input
                    id="checksheet-input"
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleCheckSheetFileChange(file || null);
                    }}
                  />
                </label>

                <div
                  ref={checkSheetCanvasRef}
                  onClick={handleCheckSheetCanvasClick}
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "260px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    cursor: checkSheetFile ? "crosshair" : "not-allowed",
                  }}
                >
                  {checkSheetPreviewUrl ? (
                    <>
                      <img
                        src={checkSheetPreviewUrl}
                        alt="Check sheet preview"
                        style={{ width: "100%", display: "block" }}
                      />
                      {checkSheetCheckboxes.map((box) => (
                        <div
                          key={box.id}
                          style={{
                            position: "absolute",
                            top: `${box.y * 100}%`,
                            left: `${box.x * 100}%`,
                            transform: "translate(-50%, -50%)",
                            width: "20px",
                            height: "20px",
                            borderRadius: "4px",
                            border: "2px solid #d10000",
                            backgroundColor: "rgba(209,0,0,0.2)",
                          }}
                        />
                      ))}
                      {userSignature?.file_url && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "12px",
                            right: "12px",
                            backgroundColor: "rgba(15,23,42,0.85)",
                            color: "white",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                        >
                          Signature Ready
                        </div>
                      )}
                    </>
                  ) : checkSheetFile ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                      PDF preview not available. Coordinates will still be recorded when you click this box.
                    </div>
                  ) : (
                    <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                      Select a check-sheet file above to start placing checkboxes.
                    </div>
                  )}
                </div>

                {checkSheetCheckboxes.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {checkSheetCheckboxes.map((box) => (
                      <div
                        key={box.id}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="text"
                          value={box.label}
                          onChange={(e) => handleCheckboxLabelChange(box.id, e.target.value)}
                          style={{
                            flex: 1,
                            border: "1px solid #cbd5f5",
                            borderRadius: "8px",
                            padding: "8px 10px",
                            fontSize: "13px",
                          }}
                        />
                        <span style={{ fontSize: "11px", color: "#94a3b8", width: "120px" }}>
                          {Math.round(box.x * 100)}% / {Math.round(box.y * 100)}%
                        </span>
                        <button
                          onClick={() => handleRemoveCheckbox(box.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    padding: "14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    backgroundColor: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>Signature on File</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {userSignature?.file_url ? "Will auto-fill on the check-sheet" : "Upload a signature image to auto-fill"}
                    </div>
                  </div>
                  <label
                    htmlFor="signature-input"
                    style={{
                      border: "1px solid #cbd5f5",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#4338ca",
                      cursor: "pointer",
                      opacity: isUploadingSignature ? 0.6 : 1,
                    }}
                  >
                    {isUploadingSignature ? "Uploading..." : userSignature ? "Replace" : "Upload"}
                    <input
                      id="signature-input"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={isUploadingSignature}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleSignatureUpload(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setShowDocumentsPopup(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "white",
                    color: "#334155",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (pendingDocuments.length === 0) {
                      alert("Please select files first");
                      return;
                    }
                    alert("Documents will upload once the job is saved.");
                  }}
                  disabled={isUploadingDocuments}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #6366f1, #4338ca)",
                    color: "white",
                    fontWeight: "600",
                    cursor: isUploadingDocuments ? "not-allowed" : "pointer",
                    boxShadow: "0 10px 20px rgba(99,102,241,0.25)",
                    opacity: isUploadingDocuments ? 0.7 : 1,
                  }}
                >
                  {isUploadingDocuments ? "Uploading..." : "Queue Uploads"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
