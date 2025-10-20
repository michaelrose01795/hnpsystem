// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import { supabase } from "../../../lib/supabaseClient";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

let localJobCounter = 30000;

const detectJobTypes = (requests) => {
  const detected = new Set();
  requests.forEach((description) => {
    const lower = description.toLowerCase();
    if (lower.includes("mot")) detected.add("MOT");
    if (lower.includes("service") || lower.includes("oil") || lower.includes("inspection"))
      detected.add("Service");
    if (lower.includes("diag") || lower.includes("investigation") || lower.includes("check") || lower.includes("warning") || lower.includes("fault"))
      detected.add("Diagnostic");
  });
  if (detected.size === 0) detected.add("Other");
  return Array.from(detected);
};

export default function CreateJobCardPage() {
  const router = useRouter();
  const { addJob } = useJobs();

  const [vehicle, setVehicle] = useState({
    reg: "",
    colour: "",
    makeModel: "",
    chassis: "",
    engine: "",
    mileage: "",
  });

  const [customer, setCustomer] = useState(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [vehicleDataSource, setVehicleDataSource] = useState("");
  const [error, setError] = useState("");

  const [requests, setRequests] = useState([{ text: "", time: "", paymentType: "Customer" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [vhcRequired, setVhcRequired] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState("Neither");
  const [jobSource, setJobSource] = useState("Retail");
  const [jobCategories, setJobCategories] = useState(["Other"]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showVhcPopup, setShowVhcPopup] = useState(false);

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

  const inputFocusStyle = {
    border: "2px solid #FF4040",
    backgroundColor: "#ffffff",
    boxShadow: "0 4px 8px rgba(255,64,64,0.1)",
  };

  const getBackgroundColor = (status, source) => {
    let baseColor = "white";
    switch (status) {
      case "Waiting":
        baseColor = "#ffcccc";
        break;
      case "Loan Car":
        baseColor = "#cce0ff";
        break;
      case "Collection":
        baseColor = "#d6f5d6";
        break;
      default:
        baseColor = "white";
    }
    if (source === "Warranty") {
      if (baseColor === "white") return "#ffeacc";
      return `linear-gradient(to bottom, ${baseColor} 50%, #ffeacc 50%)`;
    }
    return baseColor;
  };

  const handleRequestChange = (index, value) => {
    const updated = [...requests];
    updated[index].text = value;
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text)));
  };

  const handleTimeChange = (index, value) => {
    const updated = [...requests];
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0;
    updated[index].time = num;
    setRequests(updated);
  };

  const handlePaymentTypeChange = (index, value) => {
    const updated = [...requests];
    updated[index].paymentType = value;
    if (value === "Warranty") setJobSource("Warranty");
    setRequests(updated);
  };

  const handleAddRequest = () =>
    setRequests([...requests, { text: "", time: "", paymentType: "Customer" }]);
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index);
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text)));
  };

  // -------------------- DVLA API Fetch & Supabase Integration --------------------
  const handleFetchVehicleData = async () => {
    if (!vehicle.reg.trim()) {
      setError("Please enter a registration number");
      return;
    }

    setIsLoadingVehicle(true);
    setVehicleDataSource("");
    setError("");

    try {
      const regUpper = vehicle.reg.trim().toUpperCase();

      // First, try fetching from Supabase
      const { data: dbVehicle, error: dbError } = await supabase
        .from("vehicles")
        .select("*")
        .eq("reg", regUpper)
        .single();

      if (dbError && dbError.code !== "PGRST116") {
        console.error("Supabase fetch error:", dbError);
        throw dbError;
      }

      if (dbVehicle) {
        setVehicle({
          reg: dbVehicle.reg,
          colour: dbVehicle.colour || "",
          makeModel: dbVehicle.make_model || "",
          chassis: dbVehicle.chassis || "",
          engine: dbVehicle.engine || "",
          mileage: dbVehicle.mileage || "",
        });
        setVehicleDataSource("Database");

        if (dbVehicle.customer_id) {
          const { data: customerData } = await supabase
            .from("customers")
            .select("*")
            .eq("id", dbVehicle.customer_id)
            .single();
          if (customerData) setCustomer(customerData);
        }

        const { data: maintenanceData } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("vehicle_reg", regUpper)
          .single();
        if (maintenanceData) setMaintenance(maintenanceData);

        setIsLoadingVehicle(false);
        return;
      }

      // If not in DB, fetch from DVLA API using POST method
      const dvlaRes = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      if (!dvlaRes.ok) throw new Error("Failed to fetch vehicle details");

      const dvlaData = await dvlaRes.json();

      if (!dvlaData || !dvlaData.vin) {
        setError("Vehicle not found via DVLA API");
        setVehicle({
          reg: regUpper,
          makeModel: "No data provided",
          colour: "No data provided",
          chassis: "No data provided",
          engine: "No data provided",
          mileage: vehicle.mileage || "",
        });
        setVehicleDataSource("DVLA API (No data)");
        setIsLoadingVehicle(false);
        return;
      }

      const { data: newVehicle, error: insertError } = await supabase
        .from("vehicles")
        .insert({
          reg: regUpper,
          make_model: `${dvlaData.make || ""} ${dvlaData.model || ""}`.trim() || "No data provided",
          colour: dvlaData.colour || "No data provided",
          chassis: dvlaData.vin || "No data provided",
          engine: dvlaData.engineNumber || "No data provided",
          mileage: dvlaData.motTests?.[0]?.odometerValue || "",
          customer_id: customer?.id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setVehicle({
        reg: newVehicle.reg,
        makeModel: newVehicle.make_model || "No data provided",
        colour: newVehicle.colour || "No data provided",
        chassis: newVehicle.chassis || "No data provided",
        engine: newVehicle.engine || "No data provided",
        mileage: newVehicle.mileage || "",
      });
      setVehicleDataSource("DVLA API");

    } catch (err) {
      console.error("Error fetching vehicle data:", err);
      setError("Error fetching vehicle details. Check registration or API key.");
      setVehicle({
        reg: vehicle.reg.trim().toUpperCase(),
        makeModel: "No data provided",
        colour: "No data provided",
        chassis: "No data provided",
        engine: "No data provided",
        mileage: vehicle.mileage || "",
      });
      setVehicleDataSource("Error");
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const handleSaveJob = async () => {
    if (!vehicle.reg.trim()) return alert("Please enter a vehicle registration!");
    if (!customer) return alert("Please select or create a customer!");
    const validRequests = requests.filter((r) => r.text.trim());
    if (validRequests.length === 0) return alert("Please add at least one job request!");

    localJobCounter++;
    const jobNumber = localJobCounter;

    const jobCardData = {
      job_number: jobNumber,
      created_at: new Date().toISOString(),
      status: "Open",
      vehicle_reg: vehicle.reg.trim().toUpperCase(),
      customer_id: customer.id,
      requests: validRequests,
      cosmetic_notes: cosmeticNotes,
      vhc_required: vhcRequired,
      waiting_status: waitingStatus,
      job_source: jobSource,
      job_categories: jobCategories,
      maintenance,
    };

    try {
      const { error } = await supabase.from("jobs").insert(jobCardData);
      if (error) throw error;
      addJob(jobCardData);
      router.push(`/appointments?jobNumber=${jobNumber}`);
    } catch (err) {
      console.error("Error saving job:", err);
      alert("Error saving job. Check console.");
    }
  };

  const sectionHeight = "320px";

  return (
    <Layout>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px",
          transition: "background 0.3s ease",
          background: getBackgroundColor(waitingStatus, jobSource),
          borderRadius: "10px",
        }}
      >
        {/* The rest of your JSX remains unchanged, with the previous .95rem typo removed */}
      </div>
    </Layout>
  );
}
