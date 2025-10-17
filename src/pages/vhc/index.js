// file location: src/pages/vhc/index.js

"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";

// ✅ Reusable card component
const SectionCard = ({ title, subtitle, onClick }) => (
  <div
    className={`border p-4 rounded ${onClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
    onClick={onClick}
  >
    <h2 className="font-semibold">{title}</h2>
    <p>{subtitle}</p>
  </div>
);

export default function VHCPage() {
  const params = useSearchParams();
  const jobNumber = params.get("job") || "JOB1234"; // fallback for testing
  const [isWheelsTyresOpen, setIsWheelsTyresOpen] = useState(false);
  const [wheelsTyresData, setWheelsTyresData] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Load any existing VHC data
  useEffect(() => {
    const fetchVhcData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vhc_checks")
        .select("wheels_tyres")
        .eq("job_number", jobNumber)
        .single();

      if (!error && data && data.wheels_tyres) {
        setWheelsTyresData(data.wheels_tyres);
      }
      setLoading(false);
    };

    fetchVhcData();
  }, [jobNumber]);

  // ✅ Save Wheels & Tyres data
  const handleSave = async (data) => {
    setWheelsTyresData(data);

    const { error } = await supabase
      .from("vhc_checks")
      .upsert({
        job_number: jobNumber,
        wheels_tyres: data,
        updated_at: new Date(),
      });

    if (error) {
      console.error("Error saving VHC data:", error);
      alert("Failed to save data");
    } else {
      alert("Wheels & Tyres details saved!");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Vehicle Health Check – Job {jobNumber}
      </h1>

      {loading ? (
        <p>Loading VHC data...</p>
      ) : (
        <div className="space-y-4">
          {/* Wheels & Tyres */}
          <SectionCard
            title="Wheels & Tyres"
            subtitle={
              wheelsTyresData ? "Details completed" : "No issues logged yet"
            }
            onClick={() => setIsWheelsTyresOpen(true)}
          />

          {/* Other Sections (placeholders for now) */}
          <SectionCard title="Brakes & Hubs" subtitle="0 issues logged" />
          <SectionCard title="Service Book" subtitle="0 issues logged" />
          <SectionCard title="Under Bonnet" subtitle="0 issues logged" />
          <SectionCard
            title="External / Drive-in Inspection"
            subtitle="0 issues logged"
          />
          <SectionCard
            title="Internal / Lamps / Electrics"
            subtitle="0 issues logged"
          />
          <SectionCard title="Underside" subtitle="0 issues logged" />
          <SectionCard title="Cosmetics" subtitle="0 issues logged" />
        </div>
      )}

      {/* Wheels & Tyres Modal */}
      <WheelsTyresDetailsModal
        isOpen={isWheelsTyresOpen}
        onClose={() => setIsWheelsTyresOpen(false)}
        onComplete={handleSave}
      />
    </div>
  );
}