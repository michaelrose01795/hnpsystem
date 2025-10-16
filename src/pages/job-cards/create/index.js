// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import JobCardModal from "../../../components/JobCards/JobCardModal";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

let localJobCounter = 30000; // Initialize local job counter starting at 30000

const detectJobTypes = (requests) => {
  // Function to automatically detect job types based on request descriptions
  const detected = new Set(); // Use Set to avoid duplicate job types
  requests.forEach((description) => {
    const lower = description.toLowerCase(); // Convert to lowercase for case-insensitive matching
    if (lower.includes("mot")) detected.add("MOT"); // Check if request mentions MOT
    if (lower.includes("service") || lower.includes("oil") || lower.includes("inspection"))
      detected.add("Service"); // Check if request mentions service-related keywords
    if (
      lower.includes("diag") ||
      lower.includes("investigation") ||
      lower.includes("check") ||
      lower.includes("warning") ||
      lower.includes("fault")
    )
      detected.add("Diagnostic"); // Check if request mentions diagnostic-related keywords
  });
  if (detected.size === 0) detected.add("Other"); // Default to "Other" if no specific type detected
  return Array.from(detected); // Convert Set to Array
};

const generateFakeVehicleData = (reg) => {
  // Function to generate mock vehicle data for testing purposes
  const colours = ["Red", "Blue", "White", "Black", "Grey", "Silver"]; // Array of possible colours
  const makes = [
    "Mitsubishi L200",
    "Suzuki Swift",
    "SsangYong Tivoli",
    "Nissan Qashqai",
    "Toyota Corolla",
  ]; // Array of possible makes/models
  return {
    reg: reg.toUpperCase(), // Convert registration to uppercase
    colour: colours[Math.floor(Math.random() * colours.length)], // Randomly select a colour
    makeModel: makes[Math.floor(Math.random() * makes.length)], // Randomly select a make/model
    chassis: `CH${Math.floor(100000 + Math.random() * 900000)}`, // Generate random chassis number
    engine: `EN${Math.floor(10000 + Math.random() * 90000)}`, // Generate random engine number
    mileage: Math.floor(10000 + Math.random() * 90000), // Generate random mileage
  };
};

// Function to fetch vehicle data from database (when connected)
const fetchVehicleFromDatabase = async (reg) => {
  try {
    // When database is connected, this will call your API endpoint
    const response = await fetch(`/api/vehicles/lookup?reg=${encodeURIComponent(reg)}`);
    if (response.ok) {
      const data = await response.json();
      return data; // Returns vehicle data from database
    }
    return null; // Return null if not found
  } catch (error) {
    console.error("Error fetching vehicle from database:", error);
    return null; // Return null on error
  }
};

// Function to fetch vehicle manufacturing data from DVLA API or similar service
const fetchManufacturingData = async (reg) => {
  try {
    // This would call DVLA API or similar vehicle data service
    // Example: UK DVLA API endpoint (requires API key)
    const response = await fetch(`/api/vehicles/manufacturing?reg=${encodeURIComponent(reg)}`);
    if (response.ok) {
      const data = await response.json();
      return {
        makeModel: data.make + " " + data.model,
        colour: data.colour,
        yearOfManufacture: data.yearOfManufacture,
        engineCapacity: data.engineCapacity,
        fuelType: data.fuelType,
        motExpiryDate: data.motExpiryDate,
        taxStatus: data.taxStatus,
        co2Emissions: data.co2Emissions,
        // Add any other fields from manufacturing data
      };
    }
    return null; // Return null if not found
  } catch (error) {
    console.error("Error fetching manufacturing data:", error);
    return null; // Return null on error
  }
};

// Function to autofill maintenance dates based on vehicle history from database
const fetchMaintenanceHistory = async (reg) => {
  try {
    // When database is connected, fetch maintenance history for this vehicle
    const response = await fetch(`/api/vehicles/maintenance-history?reg=${encodeURIComponent(reg)}`);
    if (response.ok) {
      const data = await response.json();
      return {
        nextServiceDate: data.nextServiceDate || "",
        nextMotDate: data.nextMotDate || "",
        leaseCO: data.leaseCO || "",
        privileges: data.privileges || "",
        nextVHC: data.nextVHC || "",
        warrantyExpiry: data.warrantyExpiry || "",
        servicePlanSupplier: data.servicePlanSupplier || "",
        servicePlanType: data.servicePlanType || "",
        servicePlanExpiry: data.servicePlanExpiry || "",
      };
    }
    return null; // Return null if not found
  } catch (error) {
    console.error("Error fetching maintenance history:", error);
    return null; // Return null on error
  }
};

// Function to fetch customer data from database based on vehicle registration
const fetchCustomerFromVehicle = async (reg) => {
  try {
    // When database is connected, find customer associated with this vehicle
    const response = await fetch(`/api/customers/by-vehicle?reg=${encodeURIComponent(reg)}`);
    if (response.ok) {
      const data = await response.json();
      return data; // Returns customer data associated with vehicle
    }
    return null; // Return null if not found
  } catch (error) {
    console.error("Error fetching customer from vehicle:", error);
    return null; // Return null on error
  }
};

export default function CreateJobCardPage() {
  const router = useRouter(); // Next.js router for navigation
  const { addJob } = useJobs(); // Get addJob function from Jobs context

  // State for vehicle details
  const [vehicle, setVehicle] = useState({
    reg: "",
    colour: "",
    makeModel: "",
    chassis: "",
    engine: "",
    mileage: "",
  });
  
  const [customer, setCustomer] = useState(null); // State for selected customer
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false); // Loading state for vehicle fetch
  const [vehicleDataSource, setVehicleDataSource] = useState(""); // Track where data came from

  // State for popup modals
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showVhcPopup, setShowVhcPopup] = useState(false);

  // State for job requests array
  const [requests, setRequests] = useState([{ text: "", time: "" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState(""); // State for cosmetic damage notes
  const [vhcRequired, setVhcRequired] = useState(false); // State for VHC requirement
  const [waitingStatus, setWaitingStatus] = useState("Neither"); // State for customer waiting status
  const [jobSource, setJobSource] = useState("Retail"); // State for job source (Retail/Warranty)
  const [jobCategories, setJobCategories] = useState(["Other"]); // State for detected job categories

  // State for maintenance information
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

  const getBackgroundColor = (status, source) => {
    // Function to determine background color based on waiting status and job source
    let baseColor = "white"; // Default background color
    switch (status) {
      case "Waiting":
        baseColor = "#ffcccc"; // Light red for waiting customers
        break;
      case "Loan Car":
        baseColor = "#cce0ff"; // Light blue for loan car customers
        break;
      case "Collection":
        baseColor = "#d6f5d6"; // Light green for collection customers
        break;
      default:
        baseColor = "white"; // White for neither status
    }
    if (source === "Warranty") {
      // If job source is warranty, add orange tint
      if (baseColor === "white") return "#ffeacc"; // Light orange for warranty jobs
      return `linear-gradient(to bottom, ${baseColor} 50%, #ffeacc 50%)`; // Gradient for combined status
    }
    return baseColor; // Return calculated background color
  };

  const handleRequestChange = (index, value) => {
    // Function to handle changes to job request descriptions
    const updated = [...requests]; // Create copy of requests array
    updated[index].text = value; // Update the text at specified index

    // Auto-fill Time Required based on job type keywords
    const lower = value.toLowerCase();
    if (lower.includes("mot")) updated[index].time = updated[index].time || 0.1; // Default 0.1 hours for MOT
    else if (lower.includes("diag")) updated[index].time = updated[index].time || 1; // Default 1 hour for diagnostic

    setRequests(updated); // Update state with modified requests
    const allTexts = updated.map((r) => r.text); // Extract all request texts
    setJobCategories(detectJobTypes(allTexts)); // Re-detect job categories
  };

  const handleTimeChange = (index, value) => {
    // Function to handle changes to time required for each request
    const updated = [...requests]; // Create copy of requests array
    let num = parseFloat(value); // Parse input value to number
    if (isNaN(num) || num < 0) num = 0; // Ensure number is valid and non-negative
    updated[index].time = num; // Update time at specified index
    setRequests(updated); // Update state with modified requests
  };

  const handleAddRequest = () => setRequests([...requests, { text: "", time: "" }]); // Add new empty request to array
  
  const handleRemoveRequest = (index) => {
    // Function to remove a request from the array
    const updated = requests.filter((_, i) => i !== index); // Filter out request at specified index
    setRequests(updated); // Update state with filtered requests
    setJobCategories(detectJobTypes(updated.map((r) => r.text))); // Re-detect job categories after removal
  };

  const handleSaveJob = async () => {
    // Function to save the job card and navigate to appointments
    if (!vehicle.reg.trim()) {
      alert("Please enter a vehicle registration!"); // Validate vehicle registration
      return;
    }
    if (!customer) {
      alert("Please select or create a customer!"); // Validate customer selection
      return;
    }
    const validRequests = requests.filter((r) => r.text.trim()); // Filter out empty requests
    if (validRequests.length === 0) {
      alert("Please add at least one job request!"); // Validate at least one request exists
      return;
    }

    localJobCounter++; // Increment job counter for new job number
    const jobNumber = localJobCounter; // Assign job number

    // Create job card data object
    const jobCardData = {
      jobNumber,
      createdAt: new Date().toISOString(), // Current timestamp
      status: "Open", // Initial status
      vehicle,
      customer,
      requests: validRequests.map((r) => r.text), // Extract request texts
      cosmeticNotes,
      vhcRequired,
      waitingStatus,
      jobSource,
      jobCategories,
      maintenance,
    };

    addJob(jobCardData); // Add job to context

    const encodedData = encodeURIComponent(JSON.stringify(jobCardData)); // Encode job data for URL

    router.push(`/appointments?jobNumber=${jobNumber}&data=${encodedData}`); // Navigate to appointments page
  };

  const handleFetchVehicleData = async () => {
    // Enhanced function to fetch vehicle data from multiple sources
    if (!vehicle.reg.trim()) {
      alert("Please enter a registration first!"); // Validate registration is entered
      return;
    }

    setIsLoadingVehicle(true); // Set loading state
    setVehicleDataSource(""); // Clear previous data source

    try {
      // Step 1: Try to fetch from database first
      const dbVehicle = await fetchVehicleFromDatabase(vehicle.reg);
      
      if (dbVehicle) {
        // If vehicle found in database, use that data
        setVehicle({
          reg: vehicle.reg.toUpperCase(),
          colour: dbVehicle.colour || "",
          makeModel: dbVehicle.makeModel || "",
          chassis: dbVehicle.chassis || "",
          engine: dbVehicle.engine || "",
          mileage: dbVehicle.mileage || "",
        });
        setVehicleDataSource("Database"); // Indicate data came from database

        // Step 2: Try to fetch maintenance history from database
        const maintenanceData = await fetchMaintenanceHistory(vehicle.reg);
        if (maintenanceData) {
          setMaintenance(maintenanceData); // Autofill maintenance fields
        }

        // Step 3: Try to fetch associated customer from database
        const customerData = await fetchCustomerFromVehicle(vehicle.reg);
        if (customerData) {
          setCustomer(customerData); // Autofill customer
          alert("Customer information loaded from previous records!");
        }

        setIsLoadingVehicle(false); // Clear loading state
        return; // Exit function as we found data in database
      }

      // Step 4: If not in database, try manufacturing data API (DVLA or similar)
      const manufacturingData = await fetchManufacturingData(vehicle.reg);
      
      if (manufacturingData) {
        // If manufacturing data found, use that
        setVehicle({
          reg: vehicle.reg.toUpperCase(),
          colour: manufacturingData.colour || "",
          makeModel: manufacturingData.makeModel || "",
          chassis: vehicle.chassis, // Keep existing if not provided
          engine: vehicle.engine, // Keep existing if not provided
          mileage: vehicle.mileage, // Keep existing as not in manufacturing data
        });
        setVehicleDataSource("DVLA/Manufacturing Data"); // Indicate data came from DVLA

        // If MOT date is in manufacturing data, autofill it
        if (manufacturingData.motExpiryDate) {
          setMaintenance({
            ...maintenance,
            nextMotDate: manufacturingData.motExpiryDate,
          });
        }

        setIsLoadingVehicle(false); // Clear loading state
        return; // Exit function as we found manufacturing data
      }

      // Step 5: If neither database nor API has data, use mock data for testing
      setVehicle(generateFakeVehicleData(vehicle.reg)); // Generate and set fake vehicle data
      setVehicleDataSource("Mock Data (Testing)"); // Indicate mock data
      alert("Vehicle not found in database or DVLA. Using test data.");

    } catch (error) {
      console.error("Error in handleFetchVehicleData:", error);
      alert("Error fetching vehicle data. Please try again.");
    } finally {
      setIsLoadingVehicle(false); // Always clear loading state
    }
  };

  const sectionHeight = "260px"; // Height for vehicle/customer sections
  const bottomRowHeight = "150px"; // Height for bottom row sections

  return (
    <Layout>
      <div
        style={{
          maxWidth: "1200px", // Maximum width of container
          margin: "0 auto", // Center container
          padding: "16px", // Internal padding
          transition: "background 0.3s ease", // Smooth background color transition
          background: getBackgroundColor(waitingStatus, jobSource), // Dynamic background based on status
          borderRadius: "10px", // Rounded corners
        }}
      >
        {/* Header with title and save button */}
        <div
          style={{
            display: "flex", // Flexbox layout
            justifyContent: "space-between", // Space between title and button
            alignItems: "flex-start", // Align items to top
            marginBottom: "24px", // Bottom margin
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>
              Retail / Warranty
            </h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>
          <button
            onClick={handleSaveJob} // Call save function on click
            style={{
              padding: "12px 20px", // Button padding
              backgroundColor: "green", // Green background
              color: "white", // White text
              border: "none", // No border
              borderRadius: "6px", // Rounded corners
              fontWeight: "bold", // Bold text
              cursor: "pointer", // Pointer cursor on hover
            }}
          >
            Save Job
          </button>
        </div>

        {/* Three column section: Job Info + Maintenance + GDPR */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Job Information Section - 33% width */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>Job Information</h3>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Customer Status:</strong>
              {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                <label key={status} style={{ marginRight: "12px" }}>
                  <input 
                    type="radio" 
                    name="waiting" 
                    value={status} 
                    checked={waitingStatus===status} 
                    onChange={()=>setWaitingStatus(status)} // Update waiting status on change
                  /> {status}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Job Source:</strong>
              {["Retail","Warranty"].map((src)=>( 
                <label key={src} style={{ marginRight: "12px" }}>
                  <input 
                    type="radio" 
                    name="source" 
                    value={src} 
                    checked={jobSource===src} 
                    onChange={()=>setJobSource(src)} // Update job source on change
                  /> {src}
                </label>
              ))}
            </div>
            <div>
              <strong>Detected Job Types:</strong>{" "}
              {jobCategories.map((type,index)=>(
                <span 
                  key={index} 
                  style={{ 
                    display:"inline-block", 
                    marginRight:"8px", 
                    backgroundColor:"#FF4040", 
                    color:"white", 
                    padding:"4px 10px", 
                    borderRadius:"20px", 
                    fontWeight:"bold", 
                    fontSize:"0.9rem" 
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Maintenance Section - 33% width */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>Maintenance</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.9rem" }}>
                Next Service Date: 
                <input 
                  type="date" 
                  value={maintenance.nextServiceDate} 
                  onChange={e=>setMaintenance({...maintenance,nextServiceDate:e.target.value})} // Update next service date
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Next MOT Date: 
                <input 
                  type="date" 
                  value={maintenance.nextMotDate} 
                  onChange={e=>setMaintenance({...maintenance,nextMotDate:e.target.value})} // Update next MOT date
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Lease CO: 
                <input 
                  type="text" 
                  value={maintenance.leaseCO} 
                  onChange={e=>setMaintenance({...maintenance,leaseCO:e.target.value})} // Update lease company
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Privileges: 
                <input 
                  type="text" 
                  value={maintenance.privileges} 
                  onChange={e=>setMaintenance({...maintenance,privileges:e.target.value})} // Update privileges
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Next VHC: 
                <input 
                  type="date" 
                  value={maintenance.nextVHC} 
                  onChange={e=>setMaintenance({...maintenance,nextVHC:e.target.value})} // Update next VHC date
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Warranty Expiry: 
                <input 
                  type="date" 
                  value={maintenance.warrantyExpiry} 
                  onChange={e=>setMaintenance({...maintenance,warrantyExpiry:e.target.value})} // Update warranty expiry date
                  style={{ marginLeft: "8px", padding: "4px", width: "140px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Service Plan Supplier: 
                <input 
                  type="text" 
                  value={maintenance.servicePlanSupplier} 
                  onChange={e=>setMaintenance({...maintenance,servicePlanSupplier:e.target.value})} // Update service plan supplier
                  style={{ marginLeft: "8px", padding: "4px", width: "100px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Service Plan Type: 
                <input 
                  type="text" 
                  value={maintenance.servicePlanType} 
                  onChange={e=>setMaintenance({...maintenance,servicePlanType:e.target.value})} // Update service plan type
                  style={{ marginLeft: "8px", padding: "4px", width: "100px", fontSize: "0.85rem" }}
                />
              </label>
              <label style={{ fontSize: "0.9rem" }}>
                Service Plan Expiry: 
                <input 
                  type="date" 
                  value={maintenance.servicePlanExpiry} 
                  onChange={e=>setMaintenance({...maintenance,servicePlanExpiry:e.target.value})} // Update service plan expiry date
                  style={{ marginLeft: "8px", padding: "4px", width: "100px", fontSize: "0.85rem" }}
                />
              </label>
            </div>
          </div>

          {/* GDPR Settings Section - 33% width */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>GDPR Settings</h3>
            <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"16px", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Contact Type</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>From Us</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>From Franchise</th>
                </tr>
              </thead>
              <tbody>
                {["Email","SMS","Letter","Telephone","Social media"].map(method=>(
                  <tr key={method}>
                    <td style={{padding:"4px 0"}}>{method}</td>
                    <td><input type="checkbox"/></td> {/* Checkbox for consent from us */}
                    <td><input type="checkbox"/></td> {/* Checkbox for consent from franchise */}
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Marketing / Service</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Allowed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{padding:"4px 0"}}>Marketing Messages</td>
                  <td><input type="checkbox"/></td> {/* Checkbox for marketing consent */}
                </tr>
                <tr>
                  <td style={{padding:"4px 0"}}>Service Dept Follow Up</td>
                  <td><input type="checkbox"/></td> {/* Checkbox for service follow-up consent */}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle & Customer Section */}
        <div style={{ display:"flex", gap:"16px", marginBottom:"24px" }}>
          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight }}>
            <h3 style={{marginTop:0}}>Vehicle Details</h3>
            <label>
              <strong>Registration:</strong> 
              <input 
                type="text" 
                value={vehicle.reg} 
                onChange={e=>setVehicle({...vehicle,reg:e.target.value})} // Update vehicle registration
                placeholder="Enter reg" 
                style={{ marginLeft:"8px", padding:"4px 8px", width:"120px"}}
              />
            </label>
            <button 
              onClick={handleFetchVehicleData} // Fetch vehicle data on click
              disabled={isLoadingVehicle} // Disable button while loading
              style={{ 
                marginLeft:"12px", 
                backgroundColor: isLoadingVehicle ? "#ccc" : "#007bff", // Grey when loading
                color:"white", 
                border:"none", 
                borderRadius:"4px", 
                padding:"4px 10px", 
                cursor: isLoadingVehicle ? "not-allowed" : "pointer" // Change cursor when disabled
              }}
            >
              {isLoadingVehicle ? "Loading..." : "Fetch Vehicle Data"} {/* Show loading text */}
            </button>
            {vehicleDataSource && ( // Display data source if available
              <p style={{ fontSize: "0.8rem", color: "#007bff", marginTop: "8px" }}>
                <em>Data from: {vehicleDataSource}</em>
              </p>
            )}
            <p><strong>Colour:</strong> {vehicle.colour}</p>
            <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
            <p><strong>Chassis:</strong> {vehicle.chassis}</p>
            <p><strong>Engine:</strong> {vehicle.engine}</p>
            <label>
              <strong>Mileage:</strong> 
              <input 
                type="number" 
                value={vehicle.mileage} 
                onChange={e=>setVehicle({...vehicle,mileage:e.target.value})} // Update vehicle mileage
                placeholder="Enter miles" 
                style={{ marginLeft:"8px", padding:"4px 8px", width:"100px"}}
              />
            </label>
          </div>

          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight }}>
            <h3 style={{marginTop:0}}>Customer Details</h3>
            {customer ? (
              <>
                <p><strong>Name:</strong> {customer.firstName} {customer.lastName}</p>
                <p><strong>Address:</strong> {customer.address}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Phone:</strong> {customer.mobile||customer.telephone}</p>
                <button 
                  onClick={()=>setCustomer(null)} // Clear selected customer
                  style={{ 
                    marginTop:"12px", 
                    padding:"6px 12px", 
                    fontSize:"0.9rem", 
                    backgroundColor:"#FF4040", 
                    color:"white", 
                    border:"none", 
                    borderRadius:"6px", 
                    cursor:"pointer"
                  }}
                >
                  Clear Customer
                </button>
              </>
            ):(
              <div style={{ display:"flex", gap:"12px" }}>
                <button 
                  onClick={()=>setShowNewCustomer(true)} // Show new customer popup
                  style={{ 
                    flex:1, 
                    padding:"14px 0", 
                    fontSize:"1rem", 
                    backgroundColor:"#007bff", 
                    color:"white", 
                    border:"none", 
                    borderRadius:"6px", 
                    cursor:"pointer", 
                    fontWeight:"bold"
                  }}
                >
                  New Customer
                </button>
                <button 
                  onClick={()=>setShowExistingCustomer(true)} // Show existing customer popup
                  style={{ 
                    flex:1, 
                    padding:"14px 0", 
                    fontSize:"1rem", 
                    backgroundColor:"#FF4040", 
                    color:"white",border:"none", 
                    borderRadius:"6px", 
                    cursor:"pointer", 
                    fontWeight:"bold"
                  }}
                >
                  Existing Customer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Job Requests Section */}
        <div style={{ backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", marginBottom:"24px" }}>
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          {requests.map((req, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: "6px", marginBottom: "12px", padding: "12px" }}>
              <strong>Request {i + 1}:</strong>
              <div style={{ marginLeft: "20px", marginTop: "6px", display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  value={req.text}
                  onChange={(e) => handleRequestChange(i, e.target.value)} // Update request text
                  placeholder="Enter job request (MOT, Service, Diagnostic)"
                  style={{ flex: 2, padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={req.time || ""}
                  onChange={(e) => handleTimeChange(i, e.target.value)} // Update time required
                  placeholder="Time (h)"
                  style={{ width: "80px", padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
                <span>{req.time !== "" ? `${req.time}h` : ""}</span> {/* Display time with unit */}
                <button
                  onClick={() => handleRemoveRequest(i)} // Remove this request
                  style={{ 
                    backgroundColor: "#FF4040", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    padding: "6px 10px", 
                    cursor: "pointer" 
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handleAddRequest} // Add new empty request
            style={{ 
              backgroundColor: "#007bff", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              padding: "8px 14px", 
              cursor: "pointer" 
            }}
          >
            + Add Request
          </button>
        </div>

        {/* Cosmetic + VHC + Details Buttons */}
        <div style={{ display:"flex", gap:"16px", height:bottomRowHeight }}>
          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)" }}>
            <h4 style={{ marginTop:0 }}>Cosmetic Damage</h4>
            <textarea 
              value={cosmeticNotes} 
              onChange={e=>setCosmeticNotes(e.target.value)} // Update cosmetic notes
              placeholder="Scratches, dents, etc..." 
              style={{ width:"100%", height:"80px", padding:"8px"}}
            />
          </div>
          <div 
            style={{ 
              flex:1, 
              backgroundColor:"#FF4040", 
              color:"white", 
              borderRadius:"8px", 
              display:"flex", 
              alignItems:"center", 
              justifyContent:"center", 
              cursor:"pointer"
            }} 
            onClick={()=>setShowVhcPopup(true)} // Show VHC popup
          >
            <h4>Add VHC</h4>
          </div>
          <div 
            style={{ 
              flex:1, 
              backgroundColor:"#FF4040", 
              color:"white", 
              borderRadius:"8px", 
              display:"flex", 
              alignItems:"center", 
              justifyContent:"center", 
              cursor:"pointer"
            }} 
            onClick={()=>alert("Full Car Details Coming Soon")} // Placeholder for full car details
          >
            <h4>Full Car Details</h4>
          </div>
        </div>

        {/* Popups */}
        {showNewCustomer && <NewCustomerPopup onClose={()=>setShowNewCustomer(false)} onSelect={c=>{setCustomer(c); setShowNewCustomer(false);}}/>} {/* New customer popup */}
        {showExistingCustomer && <ExistingCustomerPopup onClose={()=>setShowExistingCustomer(false)} onSelect={c=>{setCustomer(c); setShowExistingCustomer(false);}}/>} {/* Existing customer popup */}

        {/* VHC Popup */}
        {showVhcPopup && (
          <div style={{ position:"fixed", top:0,left:0,right:0,bottom:0, backgroundColor:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
            <div style={{ backgroundColor:"white", padding:"24px", borderRadius:"8px", width:"320px", textAlign:"center"}}>
              <h3>Add VHC to this job?</h3>
              <div style={{ display:"flex", justifyContent:"space-around", marginTop:"16px"}}>
                <label>
                  <input 
                    type="radio" 
                    name="vhc" 
                    value="yes" 
                    onChange={()=>setVhcRequired(true)} 
                    checked={vhcRequired===true}
                  /> Yes
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="vhc" 
                    value="no" 
                    onChange={()=>setVhcRequired(false)} 
                    checked={vhcRequired===false}
                  /> No
                </label>
              </div>
              <button 
                onClick={()=>setShowVhcPopup(false)} // Close VHC popup
                style={{ 
                  marginTop:"16px", 
                  padding:"8px 16px", 
                  backgroundColor:"#FF4040", 
                  color:"white", 
                  border:"none", 
                  borderRadius:"6px", 
                  cursor:"pointer"
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