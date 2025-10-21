// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import { supabase } from "../../../lib/supabaseClient";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

let localJobCounter = 30000; // local counter for job IDs

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
  const { addJob } = useJobs(); // context function to add jobs to global state

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

  // state for maintenance information
  const [maintenance, setMaintenance] = useState({
    nextServiceDate: "",
    nextMotDate: "",
    leaseCO: "",
    privileges: "",
    nextVHC: "",
    warrantyExpiry: "",
    servicePlanSupplier: "",
    servicePlanType: "",
    servicePlanExpiry: "",
  });

  // modern input styling object
  const modernInputStyle = {
    padding: "10px 14px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
    outline: "none",
    backgroundColor: "#fafafa",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  };

  // input focus styling
  const inputFocusStyle = {
    border: "2px solid #FF4040",
    backgroundColor: "#ffffff",
    boxShadow: "0 4px 8px rgba(255,64,64,0.1)",
  };

  // function to determine background color based on waiting status and job source
  const getBackgroundColor = (status, source) => {
    let baseColor = "white";
    switch (status) {
      case "Waiting":
        baseColor = "#ffcccc"; // red tint for waiting
        break;
      case "Loan Car":
        baseColor = "#cce0ff"; // blue tint for loan car
        break;
      case "Collection":
        baseColor = "#d6f5d6"; // green tint for collection
        break;
      default:
        baseColor = "white";
    }
    // if warranty job, add orange tint or gradient
    if (source === "Warranty") {
      if (baseColor === "white") return "#ffeacc";
      return `linear-gradient(to bottom, ${baseColor} 50%, #ffeacc 50%)`;
    }
    return baseColor;
  };

  // handle changes to request text and auto-detect job types
  const handleRequestChange = (index, value) => {
    const updated = [...requests];
    updated[index].text = value;
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text))); // re-detect job types
  };

  // handle changes to estimated time for a request
  const handleTimeChange = (index, value) => {
    const updated = [...requests];
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0; // ensure valid number
    updated[index].time = num;
    setRequests(updated);
  };

  // handle changes to payment type for a request
  const handlePaymentTypeChange = (index, value) => {
    const updated = [...requests];
    updated[index].paymentType = value;
    if (value === "Warranty") setJobSource("Warranty"); // auto-set job source if warranty selected
    setRequests(updated);
  };

  // add a new empty request to the list
  const handleAddRequest = () =>
    setRequests([...requests, { text: "", time: "", paymentType: "Customer" }]);

  // remove a request from the list by index
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index);
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text))); // re-detect job types after removal
  };

  // ✅ Show notification and auto-hide after 5 seconds
  const showNotification = (section, type, message) => {
    if (section === "customer") {
      setCustomerNotification({ type, message });
      setTimeout(() => setCustomerNotification(null), 5000); // auto-hide after 5 seconds
    } else if (section === "vehicle") {
      setVehicleNotification({ type, message });
      setTimeout(() => setVehicleNotification(null), 5000); // auto-hide after 5 seconds
    }
  };

  // -------------------- Handle customer selection with inline notifications --------------------
  const handleCustomerSelect = async (customerData) => {
    console.log("Attempting to save customer:", customerData); // debug log

    try {
      // validate customer data before saving
      if (!customerData.email && !customerData.mobile) {
        showNotification("customer", "error", "Customer must have at least an email or mobile number.");
        return;
      }

      // check if customer already exists in database by email or phone
      let searchQuery = supabase.from("customers").select("*");

      if (customerData.email && customerData.mobile) {
        searchQuery = searchQuery.or(`email.eq.${customerData.email},mobile.eq.${customerData.mobile}`);
      } else if (customerData.email) {
        searchQuery = searchQuery.eq("email", customerData.email);
      } else if (customerData.mobile) {
        searchQuery = searchQuery.eq("mobile", customerData.mobile);
      }

      const { data: existingCustomers, error: searchError } = await searchQuery;

      if (searchError) {
        console.error("Error searching for existing customer:", searchError);
        throw searchError;
      }

      console.log("Existing customers found:", existingCustomers); // debug log

      let finalCustomer = customerData;

      // if customer doesn't exist, save them to database
      if (!existingCustomers || existingCustomers.length === 0) {
        console.log("Customer not found, creating new customer..."); // debug log

        const customerToInsert = {
          firstname: customerData.firstName || "", // note: lowercase 'f' to match SQL
          lastname: customerData.lastName || "", // note: lowercase 'l' to match SQL
          email: customerData.email || null,
          mobile: customerData.mobile || null,
          telephone: customerData.telephone || null,
          address: customerData.address || null,
          postcode: customerData.postcode || null,
          created_at: new Date().toISOString(),
        };

        console.log("Inserting customer data:", customerToInsert); // debug log

        const { data: newCustomer, error: insertError } = await supabase
          .from("customers")
          .insert([customerToInsert])
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting customer:", insertError);
          console.error("Insert error details:", insertError.message, insertError.details, insertError.hint);
          throw insertError;
        }

        finalCustomer = newCustomer;
        console.log("New customer saved to database:", newCustomer); // debug log
        showNotification("customer", "success", "✓ New customer saved successfully!");
      } else {
        // customer already exists, use existing customer
        finalCustomer = existingCustomers[0];
        console.log("Customer already exists in database:", finalCustomer); // debug log
        showNotification("customer", "success", "✓ Customer found in database and loaded!");
      }

      // set customer state with correct property names
      setCustomer({
        id: finalCustomer.id,
        firstName: finalCustomer.firstname || finalCustomer.firstName,
        lastName: finalCustomer.lastname || finalCustomer.lastName,
        email: finalCustomer.email,
        mobile: finalCustomer.mobile,
        telephone: finalCustomer.telephone,
        address: finalCustomer.address,
        postcode: finalCustomer.postcode,
      });

      setShowNewCustomer(false);
      setShowExistingCustomer(false);
    } catch (err) {
      console.error("Error saving customer:", err);
      console.error("Full error object:", JSON.stringify(err, null, 2));
      showNotification("customer", "error", `✗ Error: ${err.message || "Could not save customer"}`);
    }
  };

  // -------------------- DVLA API Fetch with inline notifications --------------------
  const handleFetchVehicleData = async () => {
    // validate that registration is entered
    if (!vehicle.reg.trim()) {
      setError("Please enter a registration number");
      return;
    }

    setIsLoadingVehicle(true); // set loading state
    setError(""); // clear previous errors
    setVehicleNotification(null); // clear previous notifications

    try {
      const regUpper = vehicle.reg.trim().toUpperCase(); // normalize registration to uppercase

      console.log("Fetching vehicle data for:", regUpper); // debug log

      // ✅ STEP 1: Check if vehicle exists in database and has a linked customer
      const { data: existingVehicle, error: vehicleSearchError } = await supabase
        .from("vehicles")
        .select("*, customer_id")
        .eq("registration", regUpper)
        .single();

      console.log("Vehicle search result:", existingVehicle, vehicleSearchError); // debug log

      // if vehicle exists and has a customer linked, fetch customer details
      if (existingVehicle && existingVehicle.customer_id && !vehicleSearchError) {
        console.log("Vehicle found in database, fetching linked customer..."); // debug log

        const { data: linkedCustomer, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", existingVehicle.customer_id)
          .single();

        console.log("Linked customer result:", linkedCustomer, customerError); // debug log

        if (linkedCustomer && !customerError) {
          setCustomer({
            id: linkedCustomer.id,
            firstName: linkedCustomer.firstname || linkedCustomer.firstName,
            lastName: linkedCustomer.lastname || linkedCustomer.lastName,
            email: linkedCustomer.email,
            mobile: linkedCustomer.mobile,
            telephone: linkedCustomer.telephone,
            address: linkedCustomer.address,
            postcode: linkedCustomer.postcode,
          }); // auto-fill customer details
          console.log("Customer auto-filled from database"); // debug log
          showNotification("customer", "success", "✓ Customer details auto-filled from database!");
        }

        // use vehicle data from database
        setVehicle({
          reg: regUpper,
          makeModel: existingVehicle.make_model || "No data provided",
          colour: existingVehicle.colour || "No data provided",
          chassis: existingVehicle.chassis || "No data provided",
          engine: existingVehicle.engine || "No data provided",
          mileage: existingVehicle.mileage || "",
        });
        showNotification("vehicle", "success", "✓ Vehicle loaded from database!");
        setIsLoadingVehicle(false);
        return; // exit early since we found vehicle in database
      }

      console.log("Vehicle not in database, fetching from DVLA API..."); // debug log

      // ✅ STEP 2: If vehicle not in database, fetch from DVLA API
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      // check if response is ok
      if (!response.ok) throw new Error("Failed to fetch vehicle details");

      const data = await response.json(); // parse JSON response

      console.log("DVLA API response:", data); // debug log

      // check if data is empty
      if (!data || Object.keys(data).length === 0) {
        setError("No vehicle data found for that registration.");
        setVehicle({
          reg: regUpper,
          makeModel: "No data provided",
          colour: "No data provided",
          chassis: "No data provided",
          engine: "No data provided",
          mileage: "", // keep mileage editable
        });
        showNotification("vehicle", "error", "✗ No vehicle data found for this registration");
        return;
      }

      // populate vehicle state with API data
      const vehicleData = {
        reg: regUpper,
        makeModel: `${data.make || "No data"} ${data.model || ""}`.trim(), // combine make and model
        colour: data.colour || "No data provided",
        chassis: data.vin || "No data provided",
        engine: data.engineNumber || "No data provided",
        mileage: data.motTests?.[0]?.odometerValue || vehicle.mileage || "No data provided", // use MOT mileage or keep existing
      };

      setVehicle(vehicleData);
      showNotification("vehicle", "success", "✓ Vehicle details fetched from DVLA!");

      // ✅ STEP 3: Save vehicle to database for future use
      const vehicleToInsert = {
        registration: regUpper,
        make_model: vehicleData.makeModel,
        colour: vehicleData.colour,
        chassis: vehicleData.chassis,
        engine: vehicleData.engine,
        mileage: vehicleData.mileage,
        customer_id: null, // no customer linked yet
        created_at: new Date().toISOString(),
      };

      console.log("Saving vehicle to database:", vehicleToInsert); // debug log

      const { error: vehicleInsertError } = await supabase.from("vehicles").insert([vehicleToInsert]);

      if (vehicleInsertError) {
        console.log("Vehicle may already exist in database:", vehicleInsertError);
      } else {
        console.log("Vehicle saved to database for future lookups");
      }
    } catch (err) {
      console.error("Error fetching vehicle data:", err);
      setError("Error fetching vehicle details. Please check registration or API key.");
      showNotification("vehicle", "error", "✗ Error fetching vehicle details");

      // fill with fallback text on error
      setVehicle({
        reg: vehicle.reg.trim().toUpperCase(),
        makeModel: "No data provided",
        colour: "No data provided",
        chassis: "No data provided",
        engine: "No data provided",
        mileage: vehicle.mileage || "", // keep mileage editable
      });
    } finally {
      setIsLoadingVehicle(false); // stop loading spinner
    }
  };

  // -------------------- ✅ UPDATED: Save Job Function with redirect and job number --------------------
  const handleSaveJob = async () => {
    try {
      const newJobId = localJobCounter++; // increment job ID counter

      // create job data object with CORRECT column names (snake_case)
      const jobData = {
        id: newJobId,
        customer: customer ? `${customer.firstName} ${customer.lastName}` : "Unknown Customer",
        customer_id: customer ? customer.id : null, // link customer by ID
        vehicle_reg: vehicle.reg, // snake_case
        vehicle_make_model: vehicle.makeModel, // snake_case
        waiting_status: waitingStatus, // snake_case
        job_source: jobSource, // snake_case
        job_categories: jobCategories, // snake_case
        requests: requests,
        created_at: new Date().toISOString(),
      };

      console.log("Saving job:", jobData); // debug log

      const { error: jobInsertError } = await supabase.from("jobs").insert([jobData]);

      if (jobInsertError) {
        console.error("Error inserting job:", jobInsertError);
        throw jobInsertError;
      }

      addJob(jobData); // update local context

      // ✅ Link customer to vehicle in database (if customer selected)
      if (customer && vehicle.reg) {
        console.log("Linking customer to vehicle..."); // debug log

        const { error: linkError } = await supabase
          .from("vehicles")
          .update({ customer_id: customer.id })
          .eq("registration", vehicle.reg);

        if (linkError) {
          console.error("Error linking customer to vehicle:", linkError);
        } else {
          console.log("Customer successfully linked to vehicle in database");
        }
      }

      // ✅ Redirect to appointments page with job number pre-filled
      router.push(`/appointments?jobNumber=${newJobId}`);
    } catch (err) {
      console.error("Error saving job:", err);
      alert(`Error saving job: ${err.message}. Check console for details.`);
    }
  };

  // section height constants for consistent layout
  const sectionHeight = "320px";
  const bottomRowHeight = "100px";

  return (
    <Layout>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px",
          transition: "background 0.3s ease",
          background: getBackgroundColor(waitingStatus, jobSource), // dynamic background based on status
          borderRadius: "10px",
        }}
      >
        {/* Header with title and save button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>Retail / Warranty</h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>
          <button
            onClick={handleSaveJob}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "1rem",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(40,167,69,0.2)",
              transition: "all 0.3s ease",
            }}
          >
            Save Job
          </button>
        </div>

        {/* Top row: Job Information, Maintenance, GDPR Settings */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Job Information Section */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Job Information</h3>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Customer Status:</strong>
              {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                <label key={status} style={{ marginRight: "12px" }}>
                  <input
                    type="radio"
                    name="waiting"
                    value={status}
                    checked={waitingStatus === status}
                    onChange={() => setWaitingStatus(status)}
                  />{" "}
                  {status}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Job Source:</strong>
              {["Retail", "Warranty"].map((src) => (
                <label key={src} style={{ marginRight: "12px" }}>
                  <input
                    type="radio"
                    name="source"
                    value={src}
                    checked={jobSource === src}
                    onChange={() => setJobSource(src)}
                  />{" "}
                  {src}
                </label>
              ))}
            </div>
            <div>
              <strong>Detected Job Types:</strong>{" "}
              {jobCategories.map((type, index) => (
                <span
                  key={index}
                  style={{
                    display: "inline-block",
                    marginRight: "8px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Maintenance Section */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Maintenance</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    color: "#555",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Next Service Date
                </label>
                <input
                  type="date"
                  value={maintenance.nextServiceDate}
                  onChange={(e) => setMaintenance({ ...maintenance, nextServiceDate: e.target.value })}
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    color: "#555",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Next MOT Date
                </label>
                <input
                  type="date"
                  value={maintenance.nextMotDate}
                  onChange={(e) => setMaintenance({ ...maintenance, nextMotDate: e.target.value })}
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    color: "#555",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Lease Company
                </label>
                <input
                  type="text"
                  value={maintenance.leaseCO}
                  onChange={(e) => setMaintenance({ ...maintenance, leaseCO: e.target.value })}
                  placeholder="Enter lease company"
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    color: "#555",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Privileges
                </label>
                <input
                  type="text"
                  value={maintenance.privileges}
                  onChange={(e) => setMaintenance({ ...maintenance, privileges: e.target.value })}
                  placeholder="Enter privileges"
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
            </div>
          </div>

          {/* GDPR Settings Section */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>GDPR Settings</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: "4px 0" }}>Contact Type</th>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: "4px 0" }}>From Us</th>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: "4px 0" }}>
                    From Franchise
                  </th>
                </tr>
              </thead>
              <tbody>
                {["Email", "SMS", "Letter", "Telephone", "Social media"].map((method) => (
                  <tr key={method}>
                    <td style={{ padding: "4px 0" }}>{method}</td>
                    <td>
                      <input type="checkbox" />
                    </td>
                    <td>
                      <input type="checkbox" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: "4px 0" }}>
                    Marketing / Service
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: "4px 0" }}>Allowed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0" }}>Marketing Messages</td>
                  <td>
                    <input type="checkbox" />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0" }}>Service Dept Follow Up</td>
                  <td>
                    <input type="checkbox" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle row: Vehicle Details and Customer Details */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Vehicle Details Section */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Vehicle Details</h3>

            {/* ✅ Vehicle notification banner */}
            {vehicleNotification && (
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "16px",
                  borderRadius: "8px",
                  backgroundColor: vehicleNotification.type === "success" ? "#d4edda" : "#f8d7da",
                  border: `1px solid ${vehicleNotification.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
                  color: vehicleNotification.type === "success" ? "#155724" : "#721c24",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  animation: "slideIn 0.3s ease",
                }}
              >
                <span>{vehicleNotification.message}</span>
                <button
                  onClick={() => setVehicleNotification(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  color: "#555",
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
                    ...modernInputStyle,
                    flex: 1,
                    textTransform: "uppercase",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
                <button
                  onClick={handleFetchVehicleData}
                  disabled={isLoadingVehicle}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: isLoadingVehicle ? "#ccc" : "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    cursor: isLoadingVehicle ? "not-allowed" : "pointer",
                    boxShadow: isLoadingVehicle ? "none" : "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    if (!isLoadingVehicle) {
                      e.target.style.backgroundColor = "#cc0000";
                      e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isLoadingVehicle) {
                      e.target.style.backgroundColor = "#FF4040";
                      e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                    }
                  }}
                >
                  {isLoadingVehicle ? "Loading..." : "Fetch Data"}
                </button>
              </div>
            </div>

            {/* ✅ REMOVED: Data Source section */}

            {/* Display error message if any */}
            {error && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#dc3545",
                  marginBottom: "12px",
                  padding: "8px 12px",
                  backgroundColor: "#f8d7da",
                  borderRadius: "6px",
                  border: "1px solid #f5c6cb",
                }}
              >
                {error}
              </div>
            )}

            {/* Display vehicle colour */}
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Colour</p>
              <p
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              >
                {vehicle.colour || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>

            {/* Display vehicle make and model */}
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>
                Make & Model
              </p>
              <p
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              >
                {vehicle.makeModel || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>

            {/* Display chassis number */}
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>
                Chassis Number
              </p>
              <p
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              >
                {vehicle.chassis || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>

            {/* Display engine number */}
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>
                Engine Number
              </p>
              <p
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                }}
              >
                {vehicle.engine || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>

            {/* Editable mileage input */}
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "500",
                  color: "#555",
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
                  ...modernInputStyle,
                  width: "100%",
                }}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.border = "2px solid #e0e0e0";
                  e.target.style.backgroundColor = "#fafafa";
                  e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                }}
              />
            </div>
          </div>

          {/* Customer Details Section */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Customer Details</h3>

            {/* ✅ Customer notification banner */}
            {customerNotification && (
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "16px",
                  borderRadius: "8px",
                  backgroundColor: customerNotification.type === "success" ? "#d4edda" : "#f8d7da",
                  border: `1px solid ${customerNotification.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
                  color: customerNotification.type === "success" ? "#155724" : "#721c24",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  animation: "slideIn 0.3s ease",
                }}
              >
                <span>{customerNotification.message}</span>
                <button
                  onClick={() => setCustomerNotification(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
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
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Name</p>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    {customer.firstName} {customer.lastName}
                  </p>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Address</p>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    {customer.address}
                  </p>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Email</p>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    {customer.email}
                  </p>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Phone</p>
                  <p
                    style={{
                      margin: 0,
                      padding: "8px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    {customer.mobile || customer.telephone}
                  </p>
                </div>
                <button
                  onClick={() => setCustomer(null)}
                  style={{
                    marginTop: "12px",
                    padding: "10px 16px",
                    fontSize: "0.9rem",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#cc0000";
                    e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#FF4040";
                    e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                  }}
                >
                  Clear Customer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={() => setShowNewCustomer(true)}
                  style={{
                    padding: "16px",
                    fontSize: "1rem",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#cc0000";
                    e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#FF4040";
                    e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  + New Customer
                </button>
                <button
                  onClick={() => setShowExistingCustomer(true)}
                  style={{
                    padding: "16px",
                    fontSize: "1rem",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#cc0000";
                    e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#FF4040";
                    e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  Search Existing Customer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Job Requests Section */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          {requests.map((req, i) => (
            <div
              key={i}
              style={{
                border: "2px solid #e0e0e0",
                borderRadius: "8px",
                marginBottom: "12px",
                padding: "16px",
                backgroundColor: "#fafafa",
              }}
            >
              <strong style={{ fontSize: "0.95rem", color: "#333" }}>Request {i + 1}:</strong>
              <div style={{ marginTop: "10px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={req.text}
                  onChange={(e) => handleRequestChange(i, e.target.value)}
                  placeholder="Enter job request (MOT, Service, Diagnostic)"
                  style={{
                    flex: 2,
                    minWidth: "200px",
                    ...modernInputStyle,
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
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
                      ...modernInputStyle,
                    }}
                    onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={(e) => {
                      e.target.style.border = "2px solid #e0e0e0";
                      e.target.style.backgroundColor = "#fafafa";
                      e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                    }}
                  />
                  <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: "500", minWidth: "30px" }}>
                    {req.time !== "" ? `${req.time}h` : ""}
                  </span>
                </div>
                <select
                  value={req.paymentType || "Customer"}
                  onChange={(e) => handlePaymentTypeChange(i, e.target.value)}
                  style={{
                    ...modernInputStyle,
                    width: "160px",
                    cursor: "pointer",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
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
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#cc0000";
                    e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#FF4040";
                    e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
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
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.95rem",
              boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#cc0000";
              e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#FF4040";
              e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
            }}
          >
            + Add Request
          </button>
        </div>

        {/* Bottom row: Cosmetic Damage, Add VHC, Full Car Details */}
        <div style={{ display: "flex", gap: "16px", height: bottomRowHeight }}>
          <div style={{ flex: 1, backgroundColor: "white", padding: "12px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <h4 style={{ marginTop: 0, marginBottom: "8px", fontSize: "0.9rem", color: "#333" }}>Cosmetic Damage</h4>
            <textarea
              value={cosmeticNotes}
              onChange={(e) => setCosmeticNotes(e.target.value)}
              placeholder="Describe any scratches, dents, or cosmetic damage..."
              style={{
                width: "100%",
                height: "55px",
                ...modernInputStyle,
                resize: "none",
                fontFamily: "inherit",
                fontSize: "0.85rem",
              }}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => {
                e.target.style.border = "2px solid #e0e0e0";
                e.target.style.backgroundColor = "#fafafa";
                e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
              transition: "all 0.3s ease",
            }}
            onClick={() => setShowVhcPopup(true)}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#cc0000";
              e.currentTarget.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#FF4040";
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600" }}>Add VHC</h4>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
              transition: "all 0.3s ease",
            }}
            onClick={() => alert("Full Car Details Coming Soon")}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#cc0000";
              e.currentTarget.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#FF4040";
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600" }}>Full Car Details</h4>
          </div>
        </div>

        {/* Customer Popups */}
        {showNewCustomer && (
          <NewCustomerPopup
            onClose={() => setShowNewCustomer(false)}
            onSelect={(c) => handleCustomerSelect(c)}
          />
        )}
        {showExistingCustomer && (
          <ExistingCustomerPopup
            onClose={() => setShowExistingCustomer(false)}
            onSelect={(c) => {
              setCustomer(c);
              setShowExistingCustomer(false);
            }}
          />
        )}

        {/* VHC Popup */}
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
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "32px",
                borderRadius: "12px",
                width: "360px",
                textAlign: "center",
                boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ margin: "0 0 20px 0", fontSize: "1.3rem", color: "#333" }}>Add VHC to this job?</h3>
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "1rem",
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
                  <span>Yes</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "1rem",
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
                  <span>No</span>
                </label>
              </div>
              <button
                onClick={() => setShowVhcPopup(false)}
                style={{
                  marginTop: "24px",
                  padding: "12px 24px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "1rem",
                  boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                  transition: "all 0.3s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#cc0000";
                  e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "#FF4040";
                  e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ CSS animation for notifications */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Layout>
  );
}