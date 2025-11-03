// file location: src/pages/job-cards/create/index.js
"use client"; // enables client-side rendering for Next.js

import React, { useState } from "react"; // import React and hooks
import { useRouter } from "next/router"; // for navigation
import Layout from "../../../components/Layout"; // import layout wrapper
import { useJobs } from "../../../context/JobsContext"; // import jobs context
import { supabase } from "../../../lib/supabaseClient"; // import Supabase client
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup"; // import new customer popup
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup"; // import existing customer popup

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
        baseColor = "#f9fafb";
    }
    // if warranty job, add orange tint
    if (source === "Warranty") {
      if (baseColor === "#f9fafb") return "#fff7ed";
      return baseColor;
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

  // ✅ Handle customer selection with better database validation
  const handleCustomerSelect = async (customerData) => {
    console.log("Attempting to save customer:", customerData); // debug log

    try {
      // ✅ Validate customer data before saving
      if (!customerData.email && !customerData.mobile) {
        showNotification("customer", "error", "Customer must have at least an email or mobile number.");
        return;
      }

      // ✅ Check if customer already exists in database by email or phone
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

      // ✅ If customer doesn't exist, save them to database
      if (!existingCustomers || existingCustomers.length === 0) {
        console.log("Customer not found, creating new customer..."); // debug log

        const customerToInsert = {
          firstname: customerData.firstName || "", // note: database uses lowercase
          lastname: customerData.lastName || "", // note: database uses lowercase
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
          throw insertError;
        }

        finalCustomer = newCustomer;
        console.log("New customer saved to database:", newCustomer); // debug log
        showNotification("customer", "success", "✓ New customer saved successfully!");
      } else {
        // ✅ Customer already exists, use existing customer
        finalCustomer = existingCustomers[0];
        console.log("Customer already exists in database:", finalCustomer); // debug log
        showNotification("customer", "success", "✓ Customer found in database and loaded!");
      }

      // ✅ Set customer state with normalized property names
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
      showNotification("customer", "error", `✗ Error: ${err.message || "Could not save customer"}`);
    }
  };

  // ✅ NEW: DVLA API Fetch - Only fetches from DVLA API and saves to database
  const handleFetchVehicleData = async () => {
    // validate that registration number is entered
    if (!vehicle.reg.trim()) {
      setError("Please enter a registration number");
      showNotification("vehicle", "error", "✗ Please enter a registration number");
      return;
    }

    setIsLoadingVehicle(true); // show loading state
    setError(""); // clear any previous errors
    setVehicleNotification(null); // clear any previous notifications

    try {
      const regUpper = vehicle.reg.trim().toUpperCase(); // normalize registration to uppercase
      console.log("Fetching vehicle data from DVLA API for:", regUpper);

      // ✅ Fetch from DVLA API via our backend endpoint
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      console.log("DVLA API response status:", response.status);

      // if API request fails, throw error
      if (!response.ok) {
        const errorText = await response.text();
        console.error("DVLA API error:", errorText);
        throw new Error(`Failed to fetch vehicle details from DVLA: ${errorText}`);
      }

      const data = await response.json();
      console.log("DVLA API response data:", data);

      // if no data returned or empty object, show error
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle data found for that registration from DVLA");
      }

      // ✅ Extract data from DVLA response and populate vehicle fields
      const vehicleData = {
        reg: regUpper,
        makeModel: data.make && data.model 
          ? `${data.make} ${data.model}`.trim() 
          : data.make || "Unknown",
        colour: data.colour || "Not provided",
        chassis: data.vin || "Not provided",
        engine: data.engineNumber || data.engineCapacity || "Not provided",
        mileage: data.motTests && data.motTests.length > 0 
          ? data.motTests[0].odometerValue || "" 
          : vehicle.mileage || "",
      };

      console.log("Setting vehicle data from DVLA:", vehicleData);
      
      // ✅ Update vehicle state with DVLA data
      setVehicle(vehicleData);
      
      // ✅ Update MOT date if available from DVLA
      if (data.motExpiryDate) {
        setNextMotDate(data.motExpiryDate);
      }

      showNotification("vehicle", "success", "✓ Vehicle details fetched from DVLA!");

      // ✅ NEW: Save vehicle to database immediately after fetching from DVLA
      console.log("Saving vehicle to database after DVLA fetch...");

      // Check if vehicle already exists
      const { data: existingVehicle, error: vehicleCheckError } = await supabase
        .from("vehicles")
        .select("*")
        .or(`registration.eq.${regUpper},reg_number.eq.${regUpper}`)
        .maybeSingle();

      console.log("Existing vehicle check:", existingVehicle, vehicleCheckError);

      if (existingVehicle) {
        // ✅ Vehicle exists - update it with DVLA data
        console.log("Vehicle exists, updating with DVLA data...");

        const { error: updateError } = await supabase
          .from("vehicles")
          .update({
            make_model: vehicleData.makeModel,
            colour: vehicleData.colour,
            chassis: vehicleData.chassis,
            vin: vehicleData.chassis, // old column for compatibility
            engine: vehicleData.engine,
            engine_number: vehicleData.engine, // old column for compatibility
            mileage: parseInt(vehicleData.mileage) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingVehicle.id);

        if (updateError) {
          console.error("Error updating vehicle:", updateError);
          throw updateError;
        }

        console.log("Vehicle updated successfully in database");
        showNotification("vehicle", "success", "✓ Vehicle updated in database!");

        // ✅ If vehicle has a linked customer, auto-fill customer details
        if (existingVehicle.customer_id) {
          console.log("Vehicle has linked customer, fetching customer...");

          const { data: linkedCustomer, error: customerError } = await supabase
            .from("customers")
            .select("*")
            .eq("id", existingVehicle.customer_id)
            .single();

          console.log("Linked customer result:", linkedCustomer, customerError);

          // if linked customer found, populate customer state
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
            });
            console.log("Customer auto-filled from database");
            showNotification("customer", "success", "✓ Customer details auto-filled from database!");
          }
        }
      } else {
        // ✅ Vehicle doesn't exist - create new vehicle entry (without customer link for now)
        console.log("Vehicle doesn't exist, creating new vehicle...");

        const vehicleToInsert = {
          registration: regUpper, // NEW column
          reg_number: regUpper, // OLD column (keep for compatibility)
          make_model: vehicleData.makeModel, // NEW combined column
          make: vehicleData.makeModel.split(' ')[0] || 'Unknown', // OLD column
          model: vehicleData.makeModel.split(' ').slice(1).join(' ') || '', // OLD column
          colour: vehicleData.colour,
          chassis: vehicleData.chassis, // NEW column
          vin: vehicleData.chassis, // OLD column (keep for compatibility)
          engine: vehicleData.engine, // NEW column
          engine_number: vehicleData.engine, // OLD column (keep for compatibility)
          mileage: parseInt(vehicleData.mileage) || null,
          customer_id: null, // will be linked when job is saved
          created_at: new Date().toISOString(),
        };

        console.log("Inserting vehicle:", vehicleToInsert);

        const { data: newVehicle, error: insertError } = await supabase
          .from("vehicles")
          .insert([vehicleToInsert])
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting vehicle:", insertError);
          throw insertError;
        }

        console.log("Vehicle created successfully in database with ID:", newVehicle.id);
        showNotification("vehicle", "success", "✓ Vehicle saved to database!");
      }

    } catch (err) {
      console.error("Error fetching vehicle data from DVLA:", err);
      setError(`Error: ${err.message}`);
      showNotification("vehicle", "error", `✗ ${err.message}`);

      // set vehicle with "Not provided" for all fields except reg
      setVehicle({
        reg: vehicle.reg.trim().toUpperCase(),
        makeModel: "Not provided",
        colour: "Not provided",
        chassis: "Not provided",
        engine: "Not provided",
        mileage: vehicle.mileage || "",
      });
    } finally {
      setIsLoadingVehicle(false); // always stop loading state
    }
  };

  // ✅ Save Job Function - save or update vehicle and link to customer
  const handleSaveJob = async () => {
    try {
      // ✅ Validate that customer and vehicle are selected
      if (!customer) {
        alert("Please select a customer before saving the job.");
        return;
      }

      if (!vehicle.reg) {
        alert("Please enter a vehicle registration before saving the job.");
        return;
      }

      // ✅ Validate that at least one request has text
      if (!requests.some(req => req.text.trim())) {
        alert("Please add at least one job request before saving.");
        return;
      }

      console.log("Starting save job process...");

      // ✅ STEP 1: Ensure vehicle is linked to customer
      console.log("Linking vehicle to customer...");

      // check if vehicle exists
      const { data: existingVehicle, error: vehicleCheckError } = await supabase
        .from("vehicles")
        .select("*")
        .or(`registration.eq.${vehicle.reg},reg_number.eq.${vehicle.reg}`)
        .maybeSingle();

      console.log("Existing vehicle check:", existingVehicle, vehicleCheckError);

      let vehicleId;

      if (existingVehicle) {
        // ✅ Vehicle exists - update it with customer link
        console.log("Vehicle exists, updating with customer link...");

        const { error: updateError } = await supabase
          .from("vehicles")
          .update({
            customer_id: customer.id, // link to customer
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingVehicle.id);

        if (updateError) {
          console.error("Error updating vehicle:", updateError);
          throw updateError;
        }

        vehicleId = existingVehicle.id;
        console.log("Vehicle updated successfully with customer link, ID:", vehicleId);
      } else {
        // ✅ Vehicle doesn't exist - this shouldn't happen if Fetch was used, but handle it
        console.log("Vehicle doesn't exist, creating new vehicle with customer link...");

        const vehicleToInsert = {
          registration: vehicle.reg, // NEW column
          reg_number: vehicle.reg, // OLD column (keep for compatibility)
          make_model: vehicle.makeModel, // NEW combined column
          make: vehicle.makeModel.split(' ')[0] || 'Unknown', // OLD column
          model: vehicle.makeModel.split(' ').slice(1).join(' ') || '', // OLD column
          colour: vehicle.colour,
          chassis: vehicle.chassis, // NEW column
          vin: vehicle.chassis, // OLD column (keep for compatibility)
          engine: vehicle.engine, // NEW column
          engine_number: vehicle.engine, // OLD column (keep for compatibility)
          mileage: parseInt(vehicle.mileage) || null,
          customer_id: customer.id, // link to customer
          created_at: new Date().toISOString(),
        };

        console.log("Inserting vehicle:", vehicleToInsert);

        const { data: newVehicle, error: insertError } = await supabase
          .from("vehicles")
          .insert([vehicleToInsert])
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting vehicle:", insertError);
          throw insertError;
        }

        vehicleId = newVehicle.id;
        console.log("Vehicle created successfully with ID:", vehicleId);
      }

      // ✅ STEP 2: Create job record
      console.log("Creating job record...");

      const jobData = {
        customer: `${customer.firstName} ${customer.lastName}`,
        customer_id: customer.id, // link customer by ID
        vehicle_reg: vehicle.reg, // snake_case column name
        vehicle_make_model: vehicle.makeModel, // snake_case column name
        waiting_status: waitingStatus, // snake_case column name
        job_source: jobSource, // snake_case column name
        job_categories: jobCategories, // snake_case column name
        requests: requests.filter(req => req.text.trim()), // only save requests with text
        cosmetic_notes: cosmeticNotes || null, // save cosmetic damage notes
        vhc_required: vhcRequired, // save VHC requirement
        maintenance_info: { nextMotDate }, // only save MOT date now
        created_at: new Date().toISOString(),
        status: "Open", // default status for new jobs
      };

      console.log("Saving job:", jobData);

      // ✅ Insert job and get the auto-generated ID back
      const { data: insertedJob, error: jobInsertError } = await supabase
        .from("jobs")
        .insert([jobData])
        .select()
        .single();

      if (jobInsertError) {
        console.error("Error inserting job:", jobInsertError);
        throw jobInsertError;
      }

      console.log("Job saved successfully with ID:", insertedJob.id);

      addJob(insertedJob); // update local context with the returned job data

      // ✅ Show success message
      alert(`Job created successfully! Job Number: ${insertedJob.id}\n\nVehicle ${vehicle.reg} has been saved and linked to ${customer.firstName} ${customer.lastName}`);

      // ✅ Redirect to appointments page with the actual job number from database
      router.push(`/appointments?jobNumber=${insertedJob.id}`);
    } catch (err) {
      console.error("Error saving job:", err);
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
          background: getBackgroundColor(waitingStatus, jobSource), // dynamic background based on status
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
            <h2 style={{ 
              margin: 0, 
              fontSize: "14px", 
              color: "#666",
              fontWeight: "500",
              marginBottom: "4px"
            }}>
              {jobSource} Job Card
            </h2>
            <h1 style={{ 
              fontSize: "28px", 
              fontWeight: "700", 
              color: "#1a1a1a",
              margin: 0
            }}>
              Create New Job Card
            </h1>
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
        <div style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>

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
              <h3 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "#1a1a1a",
                marginTop: 0,
                marginBottom: "16px"
              }}>
                Job Information
              </h3>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ 
                  fontSize: "13px", 
                  fontWeight: "600", 
                  color: "#666",
                  display: "block",
                  marginBottom: "8px"
                }}>
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
                        transition: "all 0.2s"
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
                <label style={{ 
                  fontSize: "13px", 
                  fontWeight: "600", 
                  color: "#666",
                  display: "block",
                  marginBottom: "8px"
                }}>
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
                        transition: "all 0.2s"
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
                <label style={{ 
                  fontSize: "13px", 
                  fontWeight: "600", 
                  color: "#666",
                  display: "block",
                  marginBottom: "8px"
                }}>
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

              {/* ✅ MOT Date field added here */}
              <div style={{ marginTop: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
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
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#d10000"}
                  onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
              <h3 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "#1a1a1a",
                marginTop: 0,
                marginBottom: "16px"
              }}>
                Vehicle Details
              </h3>

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
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
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
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#d10000"}
                    onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
                {[
                  { label: "Colour", value: vehicle.colour },
                  { label: "Make & Model", value: vehicle.makeModel },
                  { label: "Chassis Number", value: vehicle.chassis },
                  { label: "Engine Number", value: vehicle.engine }
                ].map((field, idx) => (
                  <div key={idx}>
                    <label style={{ fontSize: "13px", fontWeight: "500", color: "#666", display: "block", marginBottom: "4px" }}>
                      {field.label}
                    </label>
                    <div
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: field.value ? "#1a1a1a" : "#999"
                      }}
                    >
                      {field.value || "Not available"}
                    </div>
                  </div>
                ))}
                
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
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
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#d10000"}
                    onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
              <h3 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                color: "#1a1a1a",
                marginTop: 0,
                marginBottom: "16px"
              }}>
                Customer Details
              </h3>

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
                      { label: "Phone", value: customer.mobile || customer.telephone }
                    ].map((field, idx) => (
                      <div key={idx}>
                        <label style={{ fontSize: "13px", fontWeight: "500", color: "#666", display: "block", marginBottom: "4px" }}>
                          {field.label}
                        </label>
                        <div
                          style={{
                            padding: "10px 12px",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "#1a1a1a"
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
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#dc2626"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#ef4444"}
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
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
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
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#2563eb"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#3b82f6"}
                  >
                    Search Existing Customer
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Job Requests Section - Full Width */}
          <div style={{ 
            background: "white", 
            padding: "20px", 
            borderRadius: "16px", 
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: "#1a1a1a",
              marginTop: 0,
              marginBottom: "16px"
            }}>
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
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#666", marginBottom: "12px" }}>
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
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#d10000"}
                    onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#d10000"}
                      onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
                    />
                    <span style={{ fontSize: "13px", color: "#666", fontWeight: "500", minWidth: "30px" }}>
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
                      width: "160px"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#d10000"}
                    onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#dc2626"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#ef4444"}
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
              onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
            >
              + Add Request
            </button>
          </div>

          {/* ✅ Bottom Row: Cosmetic Damage, Add VHC, Full Car Details */}
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ 
              flex: 1, 
              background: "white", 
              padding: "16px", 
              borderRadius: "16px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e0e0e0"
            }}>
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginTop: 0, marginBottom: "12px" }}>
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
                  transition: "border-color 0.2s"
                }}
                onFocus={(e) => e.target.style.borderColor = "#d10000"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
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
            onSelect={(c) => handleCustomerSelect(c)}
          />
        )}

        {/* ✅ VHC Popup - Modern Design */}
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
              <h3 style={{ margin: "0 0 24px 0", fontSize: "20px", color: "#1a1a1a", fontWeight: "600" }}>
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
                    transition: "all 0.2s"
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
                    transition: "all 0.2s"
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
                onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
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