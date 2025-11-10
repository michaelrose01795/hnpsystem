// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber]/car-details.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { getJobByNumberOrReg } from "@/lib/database/jobs";

export default function CarDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [carData, setCarData] = useState(null);

  useEffect(() => {
    if (!jobNumber) return;

    const fetchJobData = async () => {
      const job = await getJobByNumberOrReg(jobNumber);
      if (job) {
        setCarData({
          registration: job.reg,
          make: job.vehicle?.make || "",
          model: job.vehicle?.model || "",
          year: job.vehicle?.year || "",
          colour: job.vehicle?.colour || "",
          vin: job.vehicle?.vin || "",
          engineNumber: job.vehicle?.engine_number || "",
          mileage: job.vehicle?.mileage || "",
          fuelType: job.vehicle?.fuel_type || "",
          transmission: job.vehicle?.transmission || "",
          bodyStyle: job.vehicle?.body_style || "",
          MOTDue: job.vehicle?.mot_due || "",
          serviceHistory: job.vehicle?.service_history || "",
          ownerName: job.customer || "",
          address: job.vehicle?.customer?.address || "",
          email: job.vehicle?.customer?.email || "",
          phone: job.vehicle?.customer?.phone || "",
          contactPreference: job.vehicle?.customer?.contact_preference || "",
          warrantyType: job.vehicle?.warranty_type || "",
          warrantyExpiry: job.vehicle?.warranty_expiry || "",
          insuranceProvider: job.vehicle?.insurance_provider || "",
          insurancePolicyNumber: job.vehicle?.insurance_policy_number || "",
          engineOil: job.vhcChecks?.engineOil || "",
          brakesCondition: job.vhcChecks?.brakesCondition || "",
          tyresCondition: job.vhcChecks?.tyresCondition || "",
          batteryStatus: job.vhcChecks?.batteryStatus || "",
          suspension: job.vhcChecks?.suspension || "",
          electronics: job.vhcChecks?.electronics || "",
          airCon: job.vhcChecks?.airCon || "",
          warningLights: job.vhcChecks?.warningLights || "",
          comments: job.notes?.map(n => n.note).join(", ") || ""
        });
      }
    };

    fetchJobData();
  }, [jobNumber]);

  const handleBack = () => router.back();
  const handleVHC = () => router.push(`/job-cards/${jobNumber}/vhc`);
  const handleWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const handleCheckBox = () => router.push(`/job-cards/${jobNumber}/check-box`);

  const sectionStyle = {
    backgroundColor: "white",
    padding: "16px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
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
    backgroundColor: "#FF4040",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem"
  };

  if (!carData) return <Layout><p>Loading car details...</p></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>
          Full Car Details - Job {jobNumber}
        </h1>
        <button
          onClick={handleBack}
          style={{
            marginBottom: "24px",
            padding: "8px 16px",
            backgroundColor: "#ccc",
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