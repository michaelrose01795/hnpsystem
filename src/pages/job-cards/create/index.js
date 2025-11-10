// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/create/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useState } from "react"; // import React and hooks
import { useRouter } from "next/router"; // for navigation
import Layout from "@/components/Layout"; // import layout wrapper
import { useJobs } from "@/context/JobsContext"; // import jobs context
import {
  addCustomerToDatabase,
  checkCustomerExists,
  getCustomerById,
} from "@/lib/database/customers";
import { createOrUpdateVehicle } from "@/lib/database/vehicles";
import { addJobToDatabase } from "@/lib/database/jobs";
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

export default function CreateJobCardPage() {
  const router = useRouter(); // Next.js router for navigation
  const { fetchJobs } = useJobs(); // refresh job cache after saves

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
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false); // loading state for DVLA API call
  const [error, setError] = useState(""); // error message for vehicle fetch

  // ✅ Notification states
  const [customerNotification, setCustomerNotification] = useState(null); // { type: 'success' | 'error', message: '' }
  const [vehicleNotification, setVehicleNotification] = useState(null); // { type: 'success' | 'error', message: '' }

  // state for job requests (multiple requests can be added)
  const [requests, setRequests] = useState([{ text: "", time: "", paymentType: "Customer" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState(""); // notes about cosmetic damage
  const [vhcRequired, setVhcRequired] = useState(false); // whether VHC is required
  const [waitingStatus, setWaitingStatus] = useState("Neither"); // customer waiting status
  const [jobSource, setJobSource] = useState("Retail"); // job source (Retail or Warranty)
  const [jobCategories, setJobCategories] = useState(["Other"]); // auto-detected job categories
  const [showNewCustomer, setShowNewCustomer] = useState(false); // toggle new customer popup
  const [showExistingCustomer, setShowExistingCustomer] = useState(false); // toggle existing customer popup
  const [showVhcPopup, setShowVhcPopup] = useState(false); // toggle VHC popup

  // state for maintenance information (simplified - only MOT date now)
  const [nextMotDate, setNextMotDate] = useState("");

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

  // ✅ Handle customer selection with shared database helpers
  const handleCustomerSelect = async (customerData) => {
    console.log("Attempting to save customer:", customerData); // debug log for incoming data

    try {
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

      let finalCustomer = null;

      const { exists, customer: existingCustomer } = await checkCustomerExists(
        normalizedPayload.email,
        normalizedPayload.mobile
      );

      if (exists && existingCustomer?.id) {
        console.log("Customer already exists in database:", existingCustomer);
        const hydratedCustomer = await getCustomerById(existingCustomer.id);
        finalCustomer = hydratedCustomer || existingCustomer;
        showNotification("customer", "success", "✓ Customer found in database and loaded!");
      } else {
        console.log("Customer not found, creating new customer...");
        finalCustomer = await addCustomerToDatabase(normalizedPayload);
        showNotification("customer", "success", "✓ New customer saved successfully!");
      }

      if (!finalCustomer) {
        throw new Error("Customer record missing after save");
      }

      setCustomer({
        id: finalCustomer.id,
        firstName: finalCustomer.firstname || finalCustomer.firstName || "",
        lastName: finalCustomer.lastname || finalCustomer.lastName || "",
        email: finalCustomer.email || "",
        mobile: finalCustomer.mobile || "",
        telephone: finalCustomer.telephone || "",
        address: finalCustomer.address || "",
        postcode: finalCustomer.postcode || "",
      });

      setShowNewCustomer(false);
      setShowExistingCustomer(false);
    } catch (err) {
      console.error("❌ Error saving customer:", err);
      showNotification("customer", "error", `✗ Error: ${err.message || "Could not save customer"}`);
    }
  };

  // ✅ NEW: DVLA API Fetch - Only fetches from DVLA API (no database access)
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
        maintenanceInfo: { nextMotDate: nextMotDate || null },
      };

      console.log("Saving job via shared helper:", jobPayload);

      const jobResult = await addJobToDatabase(jobPayload);

      if (!jobResult.success || !jobResult.data) {
        throw new Error(jobResult.error?.message || "Failed to create job card");
      }

      const insertedJob = jobResult.data;
      console.log("Job saved successfully with ID:", insertedJob.id);

      if (typeof fetchJobs === "function") {
        fetchJobs().catch((err) => console.error("❌ Error refreshing jobs:", err));
      }

      const finalJobNumber = insertedJob.jobNumber || insertedJob.id;
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
              {jobSource} Job Card
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
                <div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                    {[
                      { label: "Name", value: `${customer.firstName} ${customer.lastName}` },
                      { label: "Address", value: customer.address },
                      { label: "Email", value: customer.email },
                      { label: "Phone", value: customer.mobile || customer.telephone },
                    ].map((field, idx) => (
                      <div key={idx}>
                        <label
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#666",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          {field.label}
                        </label>
                        <div
                          style={{
                            padding: "10px 12px",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "#1a1a1a",
                          }}
                        >
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setCustomer(null)}
                    style={{
                      width: "100%",
                      padding: "12px",
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
              <textarea
                value={cosmeticNotes}
                onChange={(e) => setCosmeticNotes(e.target.value)}
                placeholder="Describe any scratches, dents, or cosmetic damage..."
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
                background: "linear-gradient(135deg, #d10000, #b00000)",
                color: "white",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 8px rgba(209,0,0,0.3)",
                transition: "all 0.2s",
              }}
              onClick={() => setShowVhcPopup(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(209,0,0,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(209,0,0,0.3)";
              }}
            >
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>Add VHC</h4>
            </div>
            <div
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                color: "white",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 8px rgba(59,130,246,0.3)",
                transition: "all 0.2s",
              }}
              onClick={() => alert("Full Car Details Coming Soon")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(59,130,246,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(59,130,246,0.3)";
              }}
            >
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>Full Car Details</h4>
            </div>
          </div>
        </div>

        {showNewCustomer && (
          <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onSelect={(c) => handleCustomerSelect(c)} />
        )}
        {showExistingCustomer && (
          <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelect={(c) => handleCustomerSelect(c)} />
        )}

        {showVhcPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowVhcPopup(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "white",
                padding: "32px",
                borderRadius: "16px",
                width: "400px",
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "20px",
                  color: "#1a1a1a",
                  fontWeight: "600",
                }}
              >
                Add VHC to this job?
              </h3>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: vhcRequired === true ? "2px solid #10b981" : "2px solid #e0e0e0",
                    backgroundColor: vhcRequired === true ? "#f0fdf4" : "white",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="radio"
                    name="vhc"
                    value="yes"
                    onChange={() => setVhcRequired(true)}
                    checked={vhcRequired === true}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "15px", fontWeight: "500" }}>Yes</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: vhcRequired === false ? "2px solid #ef4444" : "2px solid #e0e0e0",
                    backgroundColor: vhcRequired === false ? "#fef2f2" : "white",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="radio"
                    name="vhc"
                    value="no"
                    onChange={() => setVhcRequired(false)}
                    checked={vhcRequired === false}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "15px", fontWeight: "500" }}>No</span>
                </label>
              </div>
              <button
                onClick={() => setShowVhcPopup(false)}
                style={{
                  marginTop: "24px",
                  padding: "12px 32px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "15px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#b00000";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#d10000";
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
