// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber]/car-details.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import useJobcardsApi from "@/hooks/api/useJobcardsApi";

export default function CarDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [carData, setCarData] = useState(null);
  const [error, setError] = useState("");
  const { getJobcard } = useJobcardsApi();

  useEffect(() => {
    if (!jobNumber) return;

    let isMounted = true;

    const fetchJobData = async () => {
      setError("");
      try {
        const payload = await getJobcard(jobNumber);
        if (!payload || !isMounted) {
          return;
        }
        const job = payload?.job || payload?.legacy?.jobCard || null;
        if (!job) {
          throw new Error("Job card not found");
        }

        const vehicle =
          job.vehicle ||
          payload?.legacy?.vehicle ||
          payload?.structured?.jobCard?.vehicle ||
          {};
        const customer =
          vehicle?.customer || payload?.legacy?.customer || job.customer || {};
        const vhcChecks = job.vhcChecks || vehicle?.vhcChecks || {};
        const notesSource =
          payload?.legacy?.jobCard?.notes ||
          job.notes ||
          payload?.structured?.jobCard?.notes ||
          [];
        const formattedNotes = Array.isArray(notesSource)
          ? notesSource
              .map(
                (note) =>
                  note?.note || note?.text || note?.content || note?.message || ""
              )
              .filter(Boolean)
              .join(", ")
          : "";

        if (!isMounted) {
          return;
        }

        setCarData({
          registration:
            job.reg ||
            job.vehicle_reg ||
            vehicle.registration ||
            vehicle.reg ||
            "",
          make: vehicle.make || "",
          model: vehicle.model || "",
          year: vehicle.year || "",
          colour: vehicle.colour || "",
          vin: vehicle.vin || "",
          engineNumber: vehicle.engine_number || vehicle.engineNumber || "",
          mileage: vehicle.mileage || "",
          fuelType: vehicle.fuel_type || vehicle.fuelType || "",
          transmission: vehicle.transmission || "",
          bodyStyle: vehicle.body_style || vehicle.bodyStyle || "",
          MOTDue: vehicle.mot_due || "",
          serviceHistory: vehicle.service_history || "",
          ownerName:
            customer.fullName ||
            customer.name ||
            [customer.firstname, customer.lastname]
              .filter(Boolean)
              .join(" ")
              .trim(),
          address: customer.address || "",
          email: customer.email || "",
          phone: customer.phone || customer.mobile || customer.telephone || "",
          contactPreference: customer.contact_preference || "",
          warrantyType: vehicle.warranty_type || "",
          warrantyExpiry: vehicle.warranty_expiry || "",
          insuranceProvider: vehicle.insurance_provider || "",
          insurancePolicyNumber: vehicle.insurance_policy_number || "",
          engineOil: vhcChecks?.engineOil || "",
          brakesCondition: vhcChecks?.brakesCondition || "",
          tyresCondition: vhcChecks?.tyresCondition || "",
          batteryStatus: vhcChecks?.batteryStatus || "",
          suspension: vhcChecks?.suspension || "",
          electronics: vhcChecks?.electronics || "",
          airCon: vhcChecks?.airCon || "",
          warningLights: vhcChecks?.warningLights || "",
          comments: formattedNotes,
        });
      } catch (loadError) {
        console.error("Failed to load car details", loadError);
        if (isMounted) {
          setError(loadError.message || "Unable to load car details");
          setCarData(null);
        }
      }
    };

    fetchJobData();

    return () => {
      isMounted = false;
    };
  }, [jobNumber, getJobcard]);

  const handleBack = () => router.back();
  const handleVHC = () => router.push(`/job-cards/myjobs/${jobNumber}?tab=vhc`);
  const handleWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const handleCheckBox = () => router.push(`/job-cards/${jobNumber}/check-box`);

  const sectionStyle = {
    backgroundColor: "var(--surface)",
    padding: "16px",
    borderRadius: "8px",
    boxShadow: "none"
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  };

  const fieldStyle = { marginBottom: "8px" };
  const buttonStyle = {
    flex: 1,
    padding: "12px",
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem"
  };

  if (error) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      </Layout>
    );
  }

  if (!carData) {
    return (
      <Layout>
        <p>Loading car details...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "16px" }}>
          Full Car Details - Job {jobNumber}
        </h1>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "24px",
            padding: "8px 16px",
            backgroundColor: "var(--background)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Back
        </button>

        {/* Vehicle & Customer Info */}
        <div style={gridStyle}>
          <section style={sectionStyle}>
            <h2>Vehicle Information</h2>
            {[
              ["Registration", carData.registration],
              ["Make", carData.make],
              ["Model", carData.model],
              ["Year", carData.year],
              ["Colour", carData.colour],
              ["VIN", carData.vin],
              ["Engine Number", carData.engineNumber],
              ["Mileage", carData.mileage],
              ["Fuel Type", carData.fuelType],
              ["Transmission", carData.transmission],
              ["Body Style", carData.bodyStyle],
              ["MOT Due", carData.MOTDue],
              ["Service History", carData.serviceHistory]
            ].map(([label, value]) => (
              <div key={label} style={fieldStyle}>
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2>Owner / Customer Information</h2>
            {[
              ["Full Name", carData.ownerName],
              ["Address", carData.address],
              ["Email", carData.email],
              ["Phone", carData.phone],
              ["Contact Preference", carData.contactPreference]
            ].map(([label, value]) => (
              <div key={label} style={fieldStyle}>
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2>Insurance & Warranty</h2>
            {[
              ["Warranty Type", carData.warrantyType],
              ["Warranty Expiry", carData.warrantyExpiry],
              ["Insurance Provider", carData.insuranceProvider],
              ["Insurance Policy Number", carData.insurancePolicyNumber]
            ].map(([label, value]) => (
              <div key={label} style={fieldStyle}>
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2>Technical / Engine</h2>
            {[
              ["Engine Oil", carData.engineOil],
              ["Brakes Condition", carData.brakesCondition],
              ["Tyres Condition", carData.tyresCondition],
              ["Battery Status", carData.batteryStatus],
              ["Suspension", carData.suspension],
              ["Electronics", carData.electronics],
              ["Air Conditioning", carData.airCon],
              ["Warning Lights", carData.warningLights]
            ].map(([label, value]) => (
              <div key={label} style={fieldStyle}>
                <strong>{label}:</strong> {value}
              </div>
            ))}
          </section>
        </div>

        {/* Additional Comments */}
        <section style={sectionStyle}>
          <h2>Additional Comments / Notes</h2>
          <p>{carData.comments}</p>
        </section>

        {/* Bottom Navigation Buttons */}
        <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
          <button onClick={handleVHC} style={buttonStyle}>
            Go to VHC
          </button>
          <button onClick={handleWriteUp} style={buttonStyle}>
            Go to Write-Up
          </button>
          <button onClick={handleCheckBox} style={buttonStyle}>
            Go to Check Box
          </button>
        </div>
      </div>
    </Layout>
  );
}
