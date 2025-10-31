// file location: src/pages/vhc/index.js
"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Layout from "../../components/Layout";
import { getJobByNumberOrReg } from "../../lib/database/jobs";
import { 
  getVHCChecksByJob, 
  createVHCCheck, 
  updateVHCCheck, 
  deleteVHCCheck 
} from "../../lib/database/vhc";

// ✅ VHC Sections
const VHC_SECTIONS = [
  { id: "brakes", name: "Brakes & Hubs", icon: "🛞" },
  { id: "tyres", name: "Wheels & Tyres", icon: "🔧" },
  { id: "lights", name: "Lights & Electrics", icon: "💡" },
  { id: "fluids", name: "Fluid Levels", icon: "🛢️" },
  { id: "suspension", name: "Suspension", icon: "🔩" },
  { id: "battery", name: "Battery", icon: "🔋" },
  { id: "wipers", name: "Wipers", icon: "🌧️" },
  { id: "airfilter", name: "Air Filter", icon: "💨" },
  { id: "exhaust", name: "Exhaust", icon: "🏭" },
  { id: "steering", name: "Steering", icon: "🎯" },
  { id: "servicebook", name: "Service Book", icon: "📖" },
  { id: "underbonnet", name: "Under Bonnet", icon: "🔍" },
  { id: "external", name: "External Inspection", icon: "🚗" },
  { id: "internal", name: "Internal Inspection", icon: "🪑" },
  { id: "underside", name: "Underside", icon: "⬇️" },
  { id: "cosmetics", name: "Cosmetics", icon: "✨" },
];

// ✅ Section Card Component
const SectionCard = ({ section, checksCount, onClick }) => (
  <div
    onClick={onClick}
    style={{
      border: "2px solid #e0e0e0",
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "white",
      cursor: "pointer",
      transition: "all 0.3s ease",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-4px)";
      e.currentTarget.style.boxShadow = "0 8px 16px rgba(209,0,0,0.15)";
      e.currentTarget.style.borderColor = "#d10000";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
      e.currentTarget.style.borderColor = "#e0e0e0";
    }}
  >
    <div style={{ fontSize: "48px" }}>{section.icon}</div>
    <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a", margin: 0, textAlign: "center" }}>
      {section.name}
    </h3>
    <div style={{
      padding: "6px 14px",
      backgroundColor: checksCount > 0 ? "#d4edda" : "#f5f5f5",
      color: checksCount > 0 ? "#155724" : "#999",
      borderRadius: "12px",
      fontSize: "13px",
      fontWeight: "600"
    }}>
      {checksCount > 0 ? `${checksCount} checks` : "No checks yet"}
    </div>
  </div>
);

// ✅ Add Check Modal
const AddCheckModal = ({ isOpen, onClose, section, onSave }) => {
  const [formData, setFormData] = useState({
    issueTitle: "",
    issueDescription: "",
    measurement: ""
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formData.issueTitle.trim()) {
      alert("Please enter an issue title");
      return;
    }

    onSave({
      section: section.name,
      issue_title: formData.issueTitle,
      issue_description: formData.issueDescription,
      measurement: formData.measurement
    });

    // Reset form
    setFormData({
      issueTitle: "",
      issueDescription: "",
      measurement: ""
    });
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "32px",
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
            {section.icon} Add Check - {section.name}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              backgroundColor: "transparent",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#999"
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
              Issue Title *
            </label>
            <input
              type="text"
              value={formData.issueTitle}
              onChange={(e) => setFormData({ ...formData, issueTitle: e.target.value })}
              placeholder="e.g., Front brake pads worn"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
              Description
            </label>
            <textarea
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              placeholder="Provide detailed description..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                minHeight: "100px",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
              Measurement / Price (£)
            </label>
            <input
              type="text"
              value={formData.measurement}
              onChange={(e) => setFormData({ ...formData, measurement: e.target.value })}
              placeholder="e.g., 250.00"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: "14px 24px",
                backgroundColor: "#d10000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
            >
              ✓ Add Check
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "14px 24px",
                backgroundColor: "#f5f5f5",
                color: "#666",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#f5f5f5"}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ Main VHC Page Component
export default function VHCPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobNumber = searchParams.get("job");

  const [jobData, setJobData] = useState(null);
  const [vhcChecks, setVhcChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // ✅ Fetch job and VHC data
  useEffect(() => {
    if (!jobNumber) {
      alert("No job number provided");
      router.push("/vhc/dashboard");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      console.log("🔍 Loading VHC page for job:", jobNumber);

      try {
        // Fetch job details
        const job = await getJobByNumberOrReg(jobNumber);
        
        if (!job) {
          alert("Job not found");
          router.push("/vhc/dashboard");
          return;
        }

        console.log("✅ Job found:", job);
        setJobData(job);

        // Fetch VHC checks
        const checks = await getVHCChecksByJob(job.id);
        console.log("✅ VHC checks loaded:", checks.length);
        setVhcChecks(checks);

      } catch (error) {
        console.error("❌ Error loading data:", error);
        alert("Failed to load VHC data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber, router]);

  // ✅ Get check count for section
  const getCheckCountForSection = (sectionName) => {
    return vhcChecks.filter(check => 
      check.section.toLowerCase().includes(sectionName.toLowerCase())
    ).length;
  };

  // ✅ Handle section click
  const handleSectionClick = (section) => {
    setSelectedSection(section);
    setShowAddModal(true);
  };

  // ✅ Handle save check
  const handleSaveCheck = async (checkData) => {
    if (!jobData) return;

    console.log("💾 Saving VHC check:", checkData);

    try {
      const result = await createVHCCheck({
        job_id: jobData.id,
        ...checkData
      });

      if (result.success) {
        console.log("✅ VHC check saved:", result.data);
        
        // Add to local state
        setVhcChecks([...vhcChecks, result.data]);
        
        // Close modal
        setShowAddModal(false);
        
        alert("✅ Check added successfully!");
      } else {
        throw new Error(result.error?.message || "Failed to save check");
      }
    } catch (error) {
      console.error("❌ Error saving check:", error);
      alert(`Failed to save check: ${error.message}`);
    }
  };

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666", fontSize: "16px" }}>Loading VHC...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "24px",
          flexShrink: 0
        }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: "0 0 8px 0" }}>
              Vehicle Health Check
            </h1>
            <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
              Job: <strong>{jobNumber}</strong> | {jobData?.reg} | {jobData?.customer}
            </p>
          </div>

          <button
            onClick={() => router.push(`/vhc/details/${jobNumber}`)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
          >
            View Full Report →
          </button>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
          flexShrink: 0
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Total Checks</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
              {vhcChecks.length}
            </p>
          </div>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Sections Complete</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
              {VHC_SECTIONS.filter(s => getCheckCountForSection(s.name) > 0).length} / {VHC_SECTIONS.length}
            </p>
          </div>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Issues Found</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444", margin: 0 }}>
              {vhcChecks.filter(c => c.measurement && parseFloat(c.measurement) > 0).length}
            </p>
          </div>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Estimated Cost</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#d10000", margin: 0 }}>
              £{vhcChecks.reduce((sum, c) => sum + (parseFloat(c.measurement) || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* VHC Sections Grid */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
          alignContent: "start"
        }}>
          {VHC_SECTIONS.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              checksCount={getCheckCountForSection(section.name)}
              onClick={() => handleSectionClick(section)}
            />
          ))}
        </div>

        {/* Add Check Modal */}
        <AddCheckModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          section={selectedSection}
          onSave={handleSaveCheck}
        />
      </div>
    </Layout>
  );
}