// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getJobByNumber, updateJob } from "@/lib/database/jobs";
import { getNotesByJob, createJobNote, deleteJobNote } from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";

const normalizeRequests = (rawRequests) => {
  if (Array.isArray(rawRequests)) {
    return rawRequests;
  }

  if (typeof rawRequests === "string") {
    try {
      const parsed = JSON.parse(rawRequests);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.warn("Unable to parse requests string into array:", parseError);
      return [];
    }
  }

  if (rawRequests && typeof rawRequests === "object") {
    // Supabase jsonb can come back as null or object; only arrays are valid here.
    return [];
  }

  return [];
};

const deriveVhcSeverity = (check = {}) => {
  const fields = [
    check.severity,
    check.traffic_light,
    check.trafficLight,
    check.status,
    check.section,
    check.issue_title,
    check.issueDescription,
    check.issue_description
  ];

  for (const field of fields) {
    if (!field || typeof field !== "string") continue;
    const lower = field.toLowerCase();
    if (lower.includes("red")) return "red";
    if (lower.includes("amber") || lower.includes("orange")) return "amber";
  }

  return null;
};

// ✅ Ensure shared note formatting matches write-up bullet styling
const formatNoteValue = (value = "") => {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const cleaned = trimmed.replace(/^-+\s*/, "");
      return `- ${cleaned}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
};

export default function JobCardDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user } = useUser();

  // ✅ State Management
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("customer-requests");
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [customerJobHistory, setCustomerJobHistory] = useState([]);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  // ✅ Permission Check
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const canEdit = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));

  // ✅ Fetch job data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchJobData = async () => {
      try {
        console.log("🔍 Fetching job:", jobNumber);
        setLoading(true);
        
        const { data, error } = await getJobByNumber(jobNumber);

        if (error || !data) {
          console.error("❌ Job fetch error:", error);
          setError("Job card not found");
          setLoading(false);
          return;
        }

        console.log("✅ Job data loaded:", data);
        setJobData(data.jobCard);
        setIsEditingDescription(false);
        setDescriptionDraft(formatNoteValue(data.jobCard?.description || ""));

        // ✅ Fetch notes
        if (data.jobCard?.id) {
          const jobNotes = await getNotesByJob(data.jobCard.id);
          setNotes(jobNotes);
        }

        // ✅ Fetch customer job history
        if (data.customer?.customerId) {
          const history = await getCustomerJobs(data.customer.customerId);
          setCustomerJobHistory(history);
        }

        setLoading(false);
      } catch (err) {
        console.error("❌ Exception fetching job:", err);
        setError("Failed to load job card");
        setLoading(false);
      }
    };

    fetchJobData();
  }, [jobNumber]);

  // ✅ Add Note Handler
  const handleAddNote = async () => {
    if (!newNote.trim() || !jobData?.id) return;

    try {
      const result = await createJobNote({
        job_id: jobData.id,
        user_id: user?.user_id || null,
        note_text: newNote.trim()
      });

      if (result.success) {
        const updatedNotes = await getNotesByJob(jobData.id);
        setNotes(updatedNotes);
        setNewNote("");
      } else {
        alert("Failed to add note");
      }
    } catch (error) {
      console.error("Error adding note:", error);
      alert("Failed to add note");
    }
  };

  // ✅ Delete Note Handler
  const handleDeleteNote = async (noteId) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const result = await deleteJobNote(noteId, user?.user_id);
      
      if (result.success) {
        setNotes(notes.filter(n => n.noteId !== noteId));
      } else {
        alert("Failed to delete note");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Failed to delete note");
    }
  };

  // ✅ Update Job Request Handler
  const handleUpdateRequests = async (updatedRequests) => {
    if (!canEdit || !jobData?.id) return;

    try {
      const result = await updateJob(jobData.id, {
        requests: updatedRequests
      });

      if (result.success) {
        setJobData({ ...jobData, requests: updatedRequests });
        alert("✅ Job requests updated successfully");
      } else {
        alert("Failed to update job requests");
      }
    } catch (error) {
      console.error("Error updating requests:", error);
      alert("Failed to update job requests");
    }
  };

  const handleToggleVhcRequired = async (nextValue) => {
    if (!canEdit || !jobData?.id) return;

    if (!nextValue) {
      const confirmed = confirm(
        "Mark the VHC as not required for this job? Technicians will see this immediately."
      );
      if (!confirmed) return;
    }

    try {
      const result = await updateJob(jobData.id, {
        vhc_required: nextValue
      });

      if (result.success) {
        setJobData((prev) => (prev ? { ...prev, vhcRequired: nextValue } : prev));
        alert(nextValue ? "✅ VHC marked as required" : "✅ VHC marked as not required");
      } else {
        alert(result?.error?.message || "Failed to update VHC requirement");
      }
    } catch (toggleError) {
      console.error("Error updating VHC requirement:", toggleError);
      alert("Failed to update VHC requirement");
    }
  };

  const handleStartDescriptionEdit = () => {
    setDescriptionDraft(formatNoteValue(jobData?.description || ""));
    setIsEditingDescription(true);
  };

  const handleDescriptionChange = (event) => {
    setDescriptionDraft(formatNoteValue(event.target.value));
  };

  const handleDescriptionCancel = () => {
    setDescriptionDraft(formatNoteValue(jobData?.description || ""));
    setIsEditingDescription(false);
  };

  const handleDescriptionSave = async () => {
    if (!canEdit || !jobData?.id) return;

    const payload = formatNoteValue(descriptionDraft);

    try {
      const result = await updateJob(jobData.id, {
        description: payload
      });

      if (result.success && result.data) {
        setJobData(result.data);
        setDescriptionDraft(formatNoteValue(result.data.description || ""));
        setIsEditingDescription(false);
        alert("✅ Job description updated successfully");
      } else {
        alert(result?.error?.message || "Failed to update job description");
      }
    } catch (descriptionError) {
      console.error("Error updating description:", descriptionError);
      alert("Failed to update job description");
    }
  };

  // ✅ Loading State
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "80vh",
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
          <p style={{ color: "#666" }}>Loading job card #{jobNumber}...</p>
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

  // ✅ Error State
  if (error || !jobData) {
    return (
      <Layout>
        <div style={{ 
          padding: "40px", 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ color: "#d10000", marginBottom: "10px" }}>
            {error || "Job card not found"}
          </h2>
          <p style={{ color: "#666", marginBottom: "30px" }}>
            Job #{jobNumber} could not be loaded from the database.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "12px 24px",
                backgroundColor: "#d10000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
            >
              View All Job Cards
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const jobVhcChecks = Array.isArray(jobData.vhcChecks) ? jobData.vhcChecks : [];
  const redIssues = jobVhcChecks.filter((check) => deriveVhcSeverity(check) === "red");
  const amberIssues = jobVhcChecks.filter((check) => deriveVhcSeverity(check) === "amber");
  const vhcSummaryCounts = {
    total: jobVhcChecks.length,
    red: redIssues.length,
    amber: amberIssues.length
  };
  const vhcTabBadge = vhcSummaryCounts.red
    ? `⚠ ${vhcSummaryCounts.red}`
    : vhcSummaryCounts.amber
      ? `⚠ ${vhcSummaryCounts.amber}`
      : undefined;

  // ✅ Tab Configuration
  const tabs = [
    { id: "customer-requests", label: "Customer Requests"},
    { id: "contact", label: "Contact"},
    { id: "scheduling", label: "Scheduling"},
    { id: "service-history", label: "Service History"},
    { id: "parts", label: "Parts"},
    { id: "notes", label: "Notes"},
    { id: "vhc", label: "VHC"},
    { id: "messages", label: "Messages"},
    { id: "documents", label: "Documents"}
  ];

  // ✅ Main Render
  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        
        {/* ✅ Header Section */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          padding: "20px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0",
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 style={{ 
                margin: 0, 
                color: "#d10000", 
                fontSize: "28px", 
                fontWeight: "700" 
              }}>
                Job Card #{jobData.jobNumber}
              </h1>
              <span style={{
                padding: "6px 14px",
                backgroundColor: 
                  jobData.status === "Open" ? "#e8f5e9" : 
                  jobData.status === "Complete" ? "#e3f2fd" : 
                  "#fff3e0",
                color: 
                  jobData.status === "Open" ? "#2e7d32" : 
                  jobData.status === "Complete" ? "#1565c0" : 
                  "#e65100",
                borderRadius: "20px",
                fontWeight: "600",
                fontSize: "13px"
              }}>
                {jobData.status}
              </span>
              {jobData.jobSource && (
                <span style={{
                  padding: "6px 14px",
                  backgroundColor: jobData.jobSource === "Warranty" ? "#fff3e0" : "#e8f5e9",
                  color: jobData.jobSource === "Warranty" ? "#e65100" : "#2e7d32",
                  borderRadius: "20px",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  {jobData.jobSource}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
              Created: {new Date(jobData.createdAt).toLocaleString()} | 
              Last Updated: {new Date(jobData.updatedAt).toLocaleString()}
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#5a6268"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#6c757d"}
            >
              ← Back
            </button>
            
            {canEdit && (
              <button
                onClick={() => router.push(`/job-cards/create?edit=${jobData.id}`)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#2563eb"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#3b82f6"}
              >
                Edit Job
              </button>
            )}
          </div>
        </div>

        {jobData && (
          <div style={{
            marginBottom: "16px",
            padding: "20px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
                Job Description
              </h2>
              {canEdit && (
                isEditingDescription ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleDescriptionSave}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px"
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleDescriptionCancel}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartDescriptionEdit}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "14px"
                    }}
                  >
                    Edit Description
                  </button>
                )
              )}
            </div>
            {isEditingDescription ? (
              <textarea
                value={descriptionDraft}
                onChange={handleDescriptionChange}
                style={{
                  width: "100%",
                  minHeight: "140px",
                  padding: "12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  outline: "none"
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
              />
            ) : (
              <div>
                {jobData.description ? (
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#444", fontSize: "14px" }}>
                    {jobData.description
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter((line) => line)
                      .map((line, index) => (
                        <li key={`${line}-${index}`}>{line.replace(/^-+\s*/, "")}</li>
                      ))}
                  </ul>
                ) : (
                  <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                    No description recorded yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ✅ Vehicle & Customer Info Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{
            padding: "16px 20px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>VEHICLE</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#d10000", marginBottom: "4px" }}>
              {jobData.reg || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "#333" }}>
              {jobData.makeModel || `${jobData.make} ${jobData.model}`}
            </div>
          </div>

          <div style={{
            padding: "16px 20px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>CUSTOMER</div>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "#333", marginBottom: "4px" }}>
              {jobData.customer || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "#666" }}>
              {jobData.customerPhone || jobData.customerEmail || "No contact info"}
            </div>
          </div>
        </div>

        {/* ✅ Tabs Navigation */}
        <div style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          marginBottom: "16px",
          padding: "8px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0",
          flexShrink: 0
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 16px",
                backgroundColor: activeTab === tab.id ? "#d10000" : "transparent",
                color: activeTab === tab.id ? "white" : "#666",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? "600" : "500",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                position: "relative"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = "#f5f5f5";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = "transparent";
                }
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  padding: "2px 8px",
                  backgroundColor: activeTab === tab.id ? "rgba(255,255,255,0.3)" : "#d10000",
                  color: activeTab === tab.id ? "white" : "white",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "600"
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ✅ Tab Content */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0",
          padding: "24px"
        }}>
          {/* Customer Requests Tab */}
          {activeTab === "customer-requests" && (
            <CustomerRequestsTab 
              jobData={jobData} 
              canEdit={canEdit}
              onUpdate={handleUpdateRequests}
              onToggleVhcRequired={handleToggleVhcRequired}
              vhcSummary={vhcSummaryCounts}
              vhcChecks={jobVhcChecks}
            />
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <ContactTab jobData={jobData} canEdit={canEdit} />
          )}

          {/* Scheduling Tab */}
          {activeTab === "scheduling" && (
            <SchedulingTab jobData={jobData} canEdit={canEdit} />
          )}

          {/* Service History Tab */}
          {activeTab === "service-history" && (
            <ServiceHistoryTab 
              customerJobHistory={customerJobHistory}
              currentJobId={jobData.id}
              onViewJob={setSelectedHistoryJob}
            />
          )}

          {/* Parts Tab */}
          {activeTab === "parts" && (
            <PartsTab jobData={jobData} canEdit={canEdit} />
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <NotesTab 
              notes={notes}
              newNote={newNote}
              setNewNote={setNewNote}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              canEdit={canEdit}
              currentUser={user}
            />
          )}

          {/* VHC Tab */}
          {activeTab === "vhc" && (
            <VHCTab jobNumber={jobNumber} />
          )}

          {/* Messages Tab */}
          {activeTab === "messages" && (
            <MessagesTab jobData={jobData} />
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <DocumentsTab jobData={jobData} canEdit={canEdit} />
          )}
        </div>

        {/* ✅ Job History Popup */}
        {selectedHistoryJob && (
          <JobHistoryPopup 
            job={selectedHistoryJob}
            onClose={() => setSelectedHistoryJob(null)}
          />
        )}
      </div>
    </Layout>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

// ✅ Customer Requests Tab
function CustomerRequestsTab({
  jobData,
  canEdit,
  onUpdate,
  onToggleVhcRequired = () => {},
  vhcSummary = { total: 0, red: 0, amber: 0 },
  vhcChecks = []
}) {
  const [requests, setRequests] = useState(() => normalizeRequests(jobData.requests));
  const [editing, setEditing] = useState(false);
  const highlightedItems = (vhcChecks || [])
    .map((check) => ({ check, severity: deriveVhcSeverity(check) }))
    .filter(({ severity }) => severity === "red" || severity === "amber");

  useEffect(() => {
    setRequests(normalizeRequests(jobData.requests));
  }, [jobData.requests]);

  const handleSave = () => {
    onUpdate(requests);
    setEditing(false);
  };

  const handleAddRequest = () => {
    setRequests([...requests, { text: "", time: "", paymentType: "Customer" }]);
  };

  const handleRemoveRequest = (index) => {
    setRequests(requests.filter((_, i) => i !== index));
  };

  const handleUpdateRequest = (index, field, value) => {
    const updated = [...requests];
    updated[index][field] = value;
    setRequests(updated);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
          Customer Requests
        </h2>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Edit Requests
          </button>
        )}
        {editing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setRequests(normalizeRequests(jobData.requests));
                setEditing(false);
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          {requests.map((req, index) => (
            <div key={index} style={{
              padding: "16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "12px",
              backgroundColor: "#fafafa"
            }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                    Request Description
                  </label>
                  <input
                    type="text"
                    value={req.text}
                    onChange={(e) => handleUpdateRequest(index, "text", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div style={{ width: "120px" }}>
                  <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={req.time}
                    onChange={(e) => handleUpdateRequest(index, "time", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div style={{ width: "160px" }}>
                  <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "4px" }}>
                    Payment Type
                  </label>
                  <select
                    value={req.paymentType}
                    onChange={(e) => handleUpdateRequest(index, "paymentType", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer"
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
                </div>
                <button
                  onClick={() => handleRemoveRequest(index)}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                    marginTop: "20px"
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
              padding: "10px 20px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            + Add Request
          </button>
        </div>
      ) : (
        <div>
          {requests && requests.length > 0 ? (
            requests.map((req, index) => (
              <div key={index} style={{
                padding: "14px",
                backgroundColor: "#f9f9f9",
                borderLeft: "4px solid #d10000",
                borderRadius: "6px",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "14px", color: "#333" }}>
                    {req.text || req}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {req.time && (
                    <span style={{
                      padding: "4px 10px",
                      backgroundColor: "#e3f2fd",
                      color: "#1976d2",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {req.time}h
                    </span>
                  )}
                  {req.paymentType && (
                    <span style={{
                      padding: "4px 10px",
                      backgroundColor: 
                        req.paymentType === "Warranty" ? "#fff3cd" : 
                        req.paymentType === "Customer" ? "#d4edda" : 
                        "#f8d7da",
                      color: 
                        req.paymentType === "Warranty" ? "#856404" : 
                        req.paymentType === "Customer" ? "#155724" : 
                        "#721c24",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {req.paymentType}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: "#999", fontStyle: "italic" }}>No requests logged.</p>
          )}
        </div>
      )}

      {/* Additional Job Info */}
      <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid #f0f0f0" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#333", marginBottom: "16px" }}>
          Additional Information
        </h3>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "stretch",
          marginBottom: "16px"
        }}>
          <div style={{
            flex: "1 1 320px",
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
              Vehicle Health Check
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#4b5563" }}>
              {jobData.vhcRequired
                ? "A VHC is required for this job card."
                : "VHC has been marked as not required for this job."}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                Red: {vhcSummary.red}
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                backgroundColor: "#fef3c7",
                color: "#b45309",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                Amber: {vhcSummary.amber}
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                backgroundColor: "#e0f2fe",
                color: "#0369a1",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                Total Checks: {vhcSummary.total}
              </span>
            </div>

            {jobData.vhcRequired ? (
              highlightedItems.length > 0 ? (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                    Items requiring attention
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                    {highlightedItems.slice(0, 3).map(({ check, severity }) => {
                      const severityStyle = severity === "red"
                        ? { label: "Red", color: "#b91c1c" }
                        : { label: "Amber", color: "#b45309" };
                      return (
                        <li key={check.vhc_id} style={{ fontSize: "13px", color: "#4b5563", display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "8px",
                            fontWeight: "700",
                            color: "#ffffff",
                            backgroundColor: severity === "red" ? "#dc2626" : "#d97706",
                            fontSize: "11px",
                            letterSpacing: "0.04em"
                          }}>
                            {severityStyle.label.toUpperCase()}
                          </span>
                          <span style={{ fontWeight: "600", color: severityStyle.color }}>
                            {check.issue_title || check.section}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {highlightedItems.length > 3 && (
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
                      +{highlightedItems.length - 3} more issues logged
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                  No red or amber items have been logged yet.
                </p>
              )
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                Service or management can enable the VHC if it becomes required.
              </p>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => onToggleVhcRequired(!jobData.vhcRequired)}
              style={{
                padding: "12px 20px",
                borderRadius: "10px",
                border: "none",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                backgroundColor: jobData.vhcRequired ? "#ef4444" : "#10b981",
                color: "white",
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                alignSelf: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {jobData.vhcRequired ? "Mark VHC Not Required" : "Mark VHC Required"}
            </button>
          )}
        </div>
        
        {jobData.cosmeticNotes && (
          <div style={{ marginBottom: "16px" }}>
            <strong style={{ fontSize: "14px", color: "#666", display: "block", marginBottom: "8px" }}>
              Cosmetic Damage Notes:
            </strong>
            <div style={{
              padding: "12px",
              backgroundColor: "#fff9e6",
              borderLeft: "4px solid #ffc107",
              borderRadius: "6px"
            }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#333" }}>
                {jobData.cosmeticNotes}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Contact Tab
function ContactTab({ jobData, canEdit }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Contact Details
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            CUSTOMER NAME
          </label>
          <div style={{
            padding: "12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#333",
            fontWeight: "500"
          }}>
            {jobData.customer || "N/A"}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            EMAIL ADDRESS
          </label>
          <div style={{
            padding: "12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#0066cc",
            fontWeight: "500"
          }}>
            {jobData.customerEmail || "N/A"}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            MOBILE PHONE
          </label>
          <div style={{
            padding: "12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#333",
            fontWeight: "500"
          }}>
            {jobData.customerPhone || "N/A"}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            CONTACT PREFERENCE
          </label>
          <div style={{
            padding: "12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#333",
            fontWeight: "500"
          }}>
            {jobData.customerContactPreference || "Email"}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            ADDRESS
          </label>
          <div style={{
            padding: "12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#333",
            fontWeight: "500"
          }}>
            {jobData.customerAddress || "N/A"}
            {jobData.customerPostcode && (
              <>
                <br />
                {jobData.customerPostcode}
              </>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <div style={{ marginTop: "24px" }}>
          <button
            onClick={() => alert("Customer editing coming soon - will open customer profile page")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Edit Customer Details
          </button>
          <p style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
            Note: Changes to customer details must be approved by the customer
          </p>
        </div>
      )}
    </div>
  );
}

// ✅ Scheduling Tab
function SchedulingTab({ jobData, canEdit }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Scheduling Information
      </h2>

      {/* Appointment Info */}
      {jobData.appointment ? (
        <div style={{
          padding: "20px",
          backgroundColor: "#e8f5e9",
          borderLeft: "4px solid #4caf50",
          borderRadius: "8px",
          marginBottom: "24px"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#2e7d32" }}>
            Appointment Scheduled
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <strong style={{ fontSize: "12px", color: "#666" }}>Date:</strong>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
                {jobData.appointment.date}
              </div>
            </div>
            <div>
              <strong style={{ fontSize: "12px", color: "#666" }}>Time:</strong>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "#333" }}>
                {jobData.appointment.time}
              </div>
            </div>
            {jobData.appointment.notes && (
              <div style={{ gridColumn: "1 / -1" }}>
                <strong style={{ fontSize: "12px", color: "#666" }}>Notes:</strong>
                <div style={{ fontSize: "14px", color: "#333", marginTop: "4px" }}>
                  {jobData.appointment.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: "20px",
          backgroundColor: "#fff3e0",
          borderLeft: "4px solid #ff9800",
          borderRadius: "8px",
          marginBottom: "24px"
        }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#e65100", fontWeight: "500" }}>
            No appointment scheduled yet
          </p>
        </div>
      )}

      {/* Waiting Status */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
          WAITING STATUS
        </label>
        <div style={{
          padding: "12px 16px",
          backgroundColor: 
            jobData.waitingStatus === "Waiting" ? "#ffebee" :
            jobData.waitingStatus === "Loan Car" ? "#e3f2fd" :
            jobData.waitingStatus === "Collection" ? "#e8f5e9" :
            "#f9f9f9",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          color:
            jobData.waitingStatus === "Waiting" ? "#c62828" :
            jobData.waitingStatus === "Loan Car" ? "#1565c0" :
            jobData.waitingStatus === "Collection" ? "#2e7d32" :
            "#666"
        }}>
          {jobData.waitingStatus || "Neither"}
        </div>
      </div>

      {/* Courtesy Car Section */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#333" }}>
          Courtesy Car
        </h3>
        <div style={{
          padding: "16px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          textAlign: "center",
          color: "#999"
        }}>
          Courtesy car management coming soon
        </div>
      </div>

      {/* Collection Details */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#333" }}>
          Collection Details
        </h3>
        <div style={{
          padding: "16px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          textAlign: "center",
          color: "#999"
        }}>
          Collection management coming soon
        </div>
      </div>

      {/* Return Details */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#333" }}>
          Return Details
        </h3>
        <div style={{
          padding: "16px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          textAlign: "center",
          color: "#999"
        }}>
          Return management coming soon
        </div>
      </div>
    </div>
  );
}

// ✅ Service History Tab
function ServiceHistoryTab({ customerJobHistory, currentJobId, onViewJob }) {
  const history = customerJobHistory.filter(job => job.id !== currentJobId);

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Customer Service History
      </h2>

      {history.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {history.map((job) => (
            <div
              key={job.id}
              onClick={() => onViewJob(job)}
              style={{
                padding: "16px",
                backgroundColor: "#f9f9f9",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f9f9f9";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "600", color: "#d10000" }}>
                    Job #{job.job_number}
                  </span>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: "#e0e0e0",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "600"
                  }}>
                    {job.type}
                  </span>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: 
                      job.status === "Complete" ? "#e8f5e9" : 
                      job.status === "Open" ? "#fff3e0" : 
                      "#e0e0e0",
                    color:
                      job.status === "Complete" ? "#2e7d32" : 
                      job.status === "Open" ? "#e65100" : 
                      "#666",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "600"
                  }}>
                    {job.status}
                  </span>
                </div>
                <span style={{ fontSize: "13px", color: "#666" }}>
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: "14px", color: "#333" }}>
                {job.vehicle_reg} • {job.vehicle_make_model}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <p style={{ fontSize: "14px", color: "#666" }}>
            No previous service history for this customer
          </p>
        </div>
      )}
    </div>
  );
}

// ✅ Parts Tab (TODO)
function PartsTab({ jobData, canEdit }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Parts
      </h2>
      <div style={{
        padding: "40px",
        textAlign: "center",
        backgroundColor: "#fff3e0",
        borderRadius: "8px",
        border: "2px dashed #ff9800"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}></div>
        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e65100", marginBottom: "8px" }}>
          Parts Management Coming Soon
        </h3>
        <p style={{ fontSize: "14px", color: "#666" }}>
          This feature is currently under development
        </p>
      </div>
    </div>
  );
}

// ✅ Notes Tab
function NotesTab({ notes, newNote, setNewNote, onAddNote, onDeleteNote, canEdit, currentUser }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Job Notes
      </h2>

      {/* Add Note Section */}
      {canEdit && (
        <div style={{
          padding: "16px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          marginBottom: "24px"
        }}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a new note..."
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "12px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
              marginBottom: "12px"
            }}
          />
          <button
            onClick={onAddNote}
            disabled={!newNote.trim()}
            style={{
              padding: "10px 20px",
              backgroundColor: newNote.trim() ? "#10b981" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: newNote.trim() ? "pointer" : "not-allowed",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Add Note
          </button>
        </div>
      )}

      {/* Notes List */}
      {notes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {notes.map((note) => (
            <div
              key={note.noteId}
              style={{
                padding: "16px",
                backgroundColor: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "8px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <strong style={{ fontSize: "14px", color: "#333" }}>
                    {note.createdBy}
                  </strong>
                  {note.createdByRole && (
                    <span style={{
                      marginLeft: "8px",
                      padding: "2px 8px",
                      backgroundColor: "#e0e0e0",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: "600"
                    }}>
                      {note.createdByRole}
                    </span>
                  )}
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
                {canEdit && note.userId === currentUser?.user_id && (
                  <button
                    onClick={() => onDeleteNote(note.noteId)}
                    style={{
                      padding: "4px 12px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ fontSize: "14px", color: "#333", whiteSpace: "pre-wrap" }}>
                {note.noteText}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
          <p style={{ fontSize: "14px", color: "#666" }}>
            No notes added yet
          </p>
        </div>
      )}
    </div>
  );
}

// ✅ VHC Tab
function VHCTab({ jobNumber }) {
  const router = useRouter();

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Vehicle Health Check
      </h2>
      <div style={{
        padding: "40px",
        textAlign: "center",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}></div>
        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#333", marginBottom: "16px" }}>
          View Full VHC Report
        </h3>
        <button
          onClick={() => router.push(`/vhc/details/${jobNumber}`)}
          style={{
            padding: "12px 24px",
            backgroundColor: "#d10000",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px"
          }}
        >
          🔍 Open VHC Dashboard
        </button>
      </div>
    </div>
  );
}

// ✅ Messages Tab (TODO)
function MessagesTab({ jobData }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Messages
      </h2>
      <div style={{
        padding: "40px",
        textAlign: "center",
        backgroundColor: "#fff3e0",
        borderRadius: "8px",
        border: "2px dashed #ff9800"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}></div>
        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e65100", marginBottom: "8px" }}>
          Messaging System Coming Soon
        </h3>
        <p style={{ fontSize: "14px", color: "#666" }}>
          This feature is currently under development
        </p>
      </div>
    </div>
  );
}

// ✅ Documents Tab (TODO)
function DocumentsTab({ jobData, canEdit }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Documents & Attachments
      </h2>
      <div style={{
        padding: "40px",
        textAlign: "center",
        backgroundColor: "#fff3e0",
        borderRadius: "8px",
        border: "2px dashed #ff9800"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}></div>
        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#e65100", marginBottom: "8px" }}>
          Document Management Coming Soon
        </h3>
        <p style={{ fontSize: "14px", color: "#666" }}>
          This feature is currently under development
        </p>
      </div>
    </div>
  );
}

// ✅ Job History Popup
function JobHistoryPopup({ job, onClose }) {
  return (
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
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          width: "600px",
          maxWidth: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#d10000" }}>
            Job #{job.job_number}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <strong style={{ fontSize: "12px", color: "#666" }}>Status:</strong>
            <div style={{ fontSize: "14px", color: "#333", marginTop: "4px" }}>
              {job.status}
            </div>
          </div>
          <div>
            <strong style={{ fontSize: "12px", color: "#666" }}>Vehicle:</strong>
            <div style={{ fontSize: "14px", color: "#333", marginTop: "4px" }}>
              {job.vehicle_reg} • {job.vehicle_make_model}
            </div>
          </div>
          <div>
            <strong style={{ fontSize: "12px", color: "#666" }}>Job Type:</strong>
            <div style={{ fontSize: "14px", color: "#333", marginTop: "4px" }}>
              {job.type}
            </div>
          </div>
          <div>
            <strong style={{ fontSize: "12px", color: "#666" }}>Created:</strong>
            <div style={{ fontSize: "14px", color: "#333", marginTop: "4px" }}>
              {new Date(job.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
          <button
            onClick={() => window.open(`/job-cards/${job.job_number}`, '_blank')}
            style={{
              flex: 1,
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            View Full Job Card
          </button>
          <button
            onClick={() => alert("Invoice viewing coming soon")}
            style={{
              flex: 1,
              padding: "10px 20px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            View Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
