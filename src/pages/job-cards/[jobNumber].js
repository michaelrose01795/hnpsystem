// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { getJobByNumber, updateJob, addJobFile, deleteJobFile } from "@/lib/database/jobs";
import {
  getNotesByJob,
  createJobNote,
  deleteJobNote,
  updateJobNote
} from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";
import {
  normalizeRequests,
  mapCustomerJobsToHistory
} from "@/lib/jobcards/utils";

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
    if (lower.includes("grey") || lower.includes("gray") || lower.includes("green")) return "grey";
  }

  return null;
};

const resolveVhcSeverity = (check = {}) => deriveVhcSeverity(check) || "grey";

const sanitizeFileName = (value = "") => {
  const trimmed = value || "";
  const safe = trimmed.replace(/[^a-z0-9._-]/gi, "_");
  return safe || `document-${Date.now()}`;
};

const mapJobFileRecord = (record = {}) => ({
  id: record.file_id ?? record.id ?? null,
  name: record.file_name || record.name || "Document",
  url: record.file_url || record.url || "",
  type: record.file_type || record.type || "",
  folder: (record.folder || "general").toLowerCase(),
  uploadedBy: record.uploaded_by || record.uploadedBy || null,
  uploadedAt: record.uploaded_at || record.uploadedAt || null
});

const deriveStoragePathFromUrl = (url = "") => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = "/job-documents/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(parsed.pathname.substring(idx + marker.length));
    }
    const storageIdx = parsed.pathname.indexOf("/storage/v1/object/public/");
    if (storageIdx >= 0) {
      const segment = parsed.pathname.substring(storageIdx + "/storage/v1/object/public/".length);
      if (segment.startsWith("job-documents/")) {
        return decodeURIComponent(segment.substring("job-documents/".length));
      }
    }
  } catch (_err) {
    // fallback to string parsing
  }
  const fallbackMarker = "/job-documents/";
  const fallbackIdx = url.indexOf(fallbackMarker);
  if (fallbackIdx >= 0) {
    return decodeURIComponent(url.substring(fallbackIdx + fallbackMarker.length));
  }
  return null;
};

const JOB_DOCUMENT_BUCKET = "job-documents";

export default function JobCardDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user } = useUser();

  // ✅ State Management
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("customer-requests");
  const [sharedNote, setSharedNote] = useState("");
  const [sharedNoteMeta, setSharedNoteMeta] = useState(null);
  const [sharedNoteSaving, setSharedNoteSaving] = useState(false);
  const sharedNoteSaveRef = useRef(null);
  const jobRealtimeRefreshRef = useRef(null);
  const [vehicleJobHistory, setVehicleJobHistory] = useState([]);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [waitingStatusSaving, setWaitingStatusSaving] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);

  // ✅ Permission Check
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const canEdit = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));
  const canManageDocuments = [
    "service manager",
    "workshop manager",
    "after-sales manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));

  const fetchSharedNote = useCallback(async (jobId) => {
    if (!jobId) return null;

    try {
      const notes = await getNotesByJob(jobId);
      return notes[0] || null;
    } catch (noteError) {
      console.error("❌ Failed to load shared note:", noteError);
      return null;
    }
  }, []);

  const refreshSharedNote = useCallback(async (jobId) => {
    if (!jobId) return null;
    const latest = await fetchSharedNote(jobId);
    setSharedNote(latest?.noteText || "");
    setSharedNoteMeta(latest);
    return latest;
  }, [fetchSharedNote]);

  const fetchJobData = useCallback(
    async (options = { silent: false }) => {
      if (!jobNumber) return;

      const { silent } = options;

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        const { data, error } = await getJobByNumber(jobNumber);

        if (error || !data?.jobCard) {
          setError(error?.message || "Job card not found");
          return;
        }

        const jobCard = data.jobCard;
        const mappedFiles = (jobCard.files || []).map(mapJobFileRecord);
        const hydratedJobCard = { ...jobCard, files: mappedFiles };
        setJobData(hydratedJobCard);
        setJobDocuments(mappedFiles);

        const latestSharedNote = jobCard.id
          ? await fetchSharedNote(jobCard.id)
          : null;
        setSharedNote(latestSharedNote?.noteText || "");
        setSharedNoteMeta(latestSharedNote);

        const customerJobs = jobCard.customerId
          ? await getCustomerJobs(jobCard.customerId)
          : [];
        setVehicleJobHistory(
          mapCustomerJobsToHistory(customerJobs, jobCard.reg)
        );
      } catch (err) {
        console.error("❌ Exception fetching job:", err);
        setError(err?.message || "Failed to load job card");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [jobNumber, fetchSharedNote]
  );

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (jobRealtimeRefreshRef.current) {
      clearTimeout(jobRealtimeRefreshRef.current);
    }
    jobRealtimeRefreshRef.current = setTimeout(() => {
      fetchJobData({ silent: true });
    }, 250);
  }, [fetchJobData]);

  useEffect(() => {
    if (jobData?.files) {
      const mapped = (jobData.files || []).map(mapJobFileRecord);
      setJobDocuments(mapped);
    }
  }, [jobData?.files]);

  useEffect(() => {
    return () => {
      if (sharedNoteSaveRef.current) {
        clearTimeout(sharedNoteSaveRef.current);
      }
      if (jobRealtimeRefreshRef.current) {
        clearTimeout(jobRealtimeRefreshRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!jobData?.id) return;

    const tablesToWatch = [
      { table: "jobs", filter: `id=eq.${jobData.id}` },
      { table: "appointments", filter: `job_id=eq.${jobData.id}` },
      { table: "parts_job_items", filter: `job_id=eq.${jobData.id}` },
      { table: "parts_requests", filter: `job_id=eq.${jobData.id}` },
      { table: "vhc_checks", filter: `job_id=eq.${jobData.id}` },
      { table: "job_clocking", filter: `job_id=eq.${jobData.id}` },
      { table: "job_writeups", filter: `job_id=eq.${jobData.id}` },
      { table: "job_requests", filter: `job_id=eq.${jobData.id}` },
      { table: "job_files", filter: `job_id=eq.${jobData.id}` },
      { table: "job_cosmetic_damage", filter: `job_id=eq.${jobData.id}` },
      { table: "job_customer_statuses", filter: `job_id=eq.${jobData.id}` },
      { table: "job_progress", filter: `job_id=eq.${jobData.id}` },
      {
        table: "job_notes",
        filter: `job_id=eq.${jobData.id}`,
        shouldRefresh: false,
        onPayload: () => refreshSharedNote(jobData.id)
      }
    ];

    const channel = supabase.channel(`job-card-sync-${jobData.id}`);

    tablesToWatch.forEach(({ table, filter, shouldRefresh = true, onPayload }) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter
        },
        () => {
          if (typeof onPayload === "function") {
            onPayload();
          }
          if (shouldRefresh) {
            scheduleRealtimeRefresh();
          }
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobData?.id, refreshSharedNote, scheduleRealtimeRefresh]);

  const handleCustomerDetailsSave = useCallback(
    async (updatedDetails) => {
      if (!jobData?.customerId) {
        alert("No customer is linked to this job card.");
        return { success: false, error: { message: "Missing customer record" } };
      }

      setCustomerSaving(true);

      try {
        const payload = {
          firstname: updatedDetails.firstName?.trim() || null,
          lastname: updatedDetails.lastName?.trim() || null,
          email: updatedDetails.email?.trim() || null,
          mobile: updatedDetails.mobile?.trim() || null,
          telephone: updatedDetails.telephone?.trim() || null,
          address: updatedDetails.address?.trim() || null,
          postcode: updatedDetails.postcode?.trim() || null,
          contact_preference: updatedDetails.contactPreference || null
        };

        const { error: customerError } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", jobData.customerId);

        if (customerError) {
          throw customerError;
        }

        const updatedName = `${updatedDetails.firstName || ""} ${updatedDetails.lastName || ""}`.trim();

        const { error: jobError } = await supabase
          .from("jobs")
          .update({
            customer: updatedName || null
          })
          .eq("id", jobData.id);

        if (jobError) {
          throw jobError;
        }

        await fetchJobData({ silent: true });

        return { success: true };
      } catch (saveError) {
        console.error("❌ Failed to update customer:", saveError);
        alert(saveError?.message || "Failed to update customer details");
        return { success: false, error: saveError };
      } finally {
        setCustomerSaving(false);
      }
    },
    [jobData, fetchJobData]
  );

  const handleWaitingStatusChange = useCallback(
    async (nextStatus) => {
      if (!canEdit || !jobData?.id) return { success: false };

      setWaitingStatusSaving(true);

      try {
        const result = await updateJob(jobData.id, {
          waiting_status: nextStatus
        });

        if (result.success) {
          setJobData((prev) =>
            prev ? { ...prev, waitingStatus: nextStatus } : prev
          );
          return { success: true };
        }

        alert(result?.error?.message || "Failed to update customer status");
        return { success: false, error: result?.error };
      } catch (statusError) {
        console.error("❌ Failed to update waiting status:", statusError);
        alert(statusError?.message || "Failed to update customer status");
        return { success: false, error: statusError };
      } finally {
        setWaitingStatusSaving(false);
      }
    },
    [canEdit, jobData]
  );

  const handleAppointmentSave = useCallback(
    async (appointmentDetails) => {
      if (!canEdit || !jobData?.id) return { success: false };

      if (!appointmentDetails.date || !appointmentDetails.time) {
        alert("Please provide both date and time.");
        return { success: false };
      }

      setAppointmentSaving(true);

      try {
        const scheduledTime = new Date(
          `${appointmentDetails.date}T${appointmentDetails.time}`
        );

        if (Number.isNaN(scheduledTime.getTime())) {
          throw new Error("Invalid appointment date or time");
        }

        const payload = {
          scheduled_time: scheduledTime.toISOString(),
          status: appointmentDetails.status || "booked",
          notes: appointmentDetails.notes || null,
          updated_at: new Date().toISOString()
        };

        if (jobData.appointment?.appointmentId) {
          const { error } = await supabase
            .from("appointments")
            .update(payload)
            .eq("appointment_id", jobData.appointment.appointmentId);

          if (error) {
            throw error;
          }
        } else {
          const insertPayload = {
            ...payload,
            job_id: jobData.id,
            customer_id: jobData.customerId || null
          };

          const { error } = await supabase
            .from("appointments")
            .insert([insertPayload]);

          if (error) {
            throw error;
          }
        }

        await fetchJobData({ silent: true });
        return { success: true };
      } catch (appointmentError) {
        console.error("❌ Failed to update appointment:", appointmentError);
        alert(appointmentError?.message || "Failed to update appointment");
        return { success: false, error: appointmentError };
      } finally {
        setAppointmentSaving(false);
      }
    },
    [canEdit, jobData, fetchJobData]
  );

  const handleDocumentUpload = useCallback(
    async (fileList, categoryId = "general") => {
      if (!jobData?.id) {
        alert("Save the job before uploading documents.");
        return;
      }

      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      setDocumentUploading(true);
      const folderKey = categoryId || "general";

      try {
        for (const file of files) {
          const safeName = sanitizeFileName(file.name || `document-${Date.now()}`);
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
          const objectPath = `jobs/${jobData.id}/${folderKey}/${uniqueSuffix}.${ext}`;

          const { error: storageError } = await supabase.storage
            .from(JOB_DOCUMENT_BUCKET)
            .upload(objectPath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream"
            });

          if (storageError) {
            throw storageError;
          }

          const { data: publicUrlData } = supabase.storage
            .from(JOB_DOCUMENT_BUCKET)
            .getPublicUrl(objectPath);

          const publicUrl = publicUrlData?.publicUrl;

          const response = await addJobFile(
            jobData.id,
            safeName,
            publicUrl,
            file.type || "application/octet-stream",
            folderKey,
            user?.user_id || null
          );

          if (response?.success && response.data) {
            const mapped = mapJobFileRecord(response.data);
            setJobDocuments((prev) => [mapped, ...prev]);
            setJobData((prev) =>
              prev ? { ...prev, files: [mapped, ...(prev.files || [])] } : prev
            );
          } else if (response?.error) {
            throw new Error(response.error.message || "Failed to save file metadata");
          }
        }

        alert("✅ Files uploaded successfully");
      } catch (uploadError) {
        console.error("❌ Failed to upload documents:", uploadError);
        alert(uploadError?.message || "Failed to upload documents");
      } finally {
        setDocumentUploading(false);
      }
    },
    [jobData?.id, user?.user_id]
  );

  const handleDeleteDocument = useCallback(
    async (file) => {
      if (!canManageDocuments || !file?.id) return;
      const confirmDelete = confirm(`Delete ${file.name || "this file"}?`);
      if (!confirmDelete) return;

      try {
        const storagePath = deriveStoragePathFromUrl(file.url);
        if (storagePath) {
          const { error: removeError } = await supabase.storage
            .from(JOB_DOCUMENT_BUCKET)
            .remove([storagePath]);
          if (removeError) {
            console.warn("⚠️ Failed to remove file from storage:", removeError);
          }
        }

        const result = await deleteJobFile(file.id);
        if (!result?.success) {
          alert(result?.error?.message || "Failed to delete document");
          return;
        }

        setJobDocuments((prev) => prev.filter((doc) => doc.id !== file.id));
        setJobData((prev) =>
          prev
            ? { ...prev, files: (prev.files || []).filter((doc) => doc.id !== file.id) }
            : prev
        );
      } catch (deleteError) {
        console.error("❌ Failed to delete document:", deleteError);
        alert(deleteError?.message || "Failed to delete document");
      }
    },
    [canManageDocuments]
  );

  const saveSharedNote = useCallback(
    async (value) => {
      if (!jobData?.id) return;

      try {
        setSharedNoteSaving(true);
        const draftValue = typeof value === "string" ? value : "";
        const isEmpty = draftValue.trim().length === 0;

        if (isEmpty && sharedNoteMeta?.noteId) {
          const deleteResult = await deleteJobNote(
            sharedNoteMeta.noteId,
            user?.user_id || null
          );
          if (!deleteResult?.success) {
            throw deleteResult?.error || new Error("Failed to delete note");
          }
          setSharedNote("");
          setSharedNoteMeta(null);
          return;
        }

        if (isEmpty) {
          return;
        }

        if (sharedNoteMeta?.noteId) {
          const updateResult = await updateJobNote(
            sharedNoteMeta.noteId,
            draftValue,
            user?.user_id || null
          );

          if (!updateResult?.success) {
            throw updateResult?.error || new Error("Failed to update note");
          }
        } else {
          const createResult = await createJobNote({
            job_id: jobData.id,
            user_id: user?.user_id || null,
            note_text: draftValue
          });

          if (!createResult?.success) {
            throw createResult?.error || new Error("Failed to create note");
          }
        }

        const latest = await fetchSharedNote(jobData.id);
        setSharedNote(latest?.noteText || "");
        setSharedNoteMeta(latest);
      } catch (saveError) {
        console.error("❌ Failed to save note:", saveError);
        alert(saveError?.message || "Failed to save note");
      } finally {
        setSharedNoteSaving(false);
      }
    },
    [jobData?.id, sharedNoteMeta?.noteId, user?.user_id, fetchSharedNote]
  );

  const handleSharedNoteChange = useCallback((value) => {
    if (!canEdit) return;
    setSharedNote(value);

    if (sharedNoteSaveRef.current) {
      clearTimeout(sharedNoteSaveRef.current);
    }

    sharedNoteSaveRef.current = setTimeout(() => {
      if (value === (sharedNoteMeta?.noteText || "")) {
        return;
      }
      saveSharedNote(value);
    }, 600);
  }, [canEdit, saveSharedNote, sharedNoteMeta?.noteText]);

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
  const redIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "red");
  const amberIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "amber");
  const greyIssues = jobVhcChecks.filter((check) => resolveVhcSeverity(check) === "grey");
  const vhcSummaryCounts = {
    total: jobVhcChecks.length,
    red: redIssues.length,
    amber: amberIssues.length,
    grey: greyIssues.length
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
    { id: "vhc", label: "VHC", badge: vhcTabBadge},
    { id: "warranty", label: "Warranty"},
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
              Back
            </button>
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
            </div>
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
            <ContactTab
              jobData={jobData}
              canEdit={canEdit}
              onSaveCustomerDetails={handleCustomerDetailsSave}
              customerSaving={customerSaving}
            />
          )}

          {/* Scheduling Tab */}
          {activeTab === "scheduling" && (
            <SchedulingTab
              jobData={jobData}
              canEdit={canEdit}
              onWaitingStatusChange={handleWaitingStatusChange}
              waitingStatusSaving={waitingStatusSaving}
              onAppointmentSave={handleAppointmentSave}
              appointmentSaving={appointmentSaving}
            />
          )}

          {/* Service History Tab */}
          {activeTab === "service-history" && (
            <ServiceHistoryTab 
              vehicleJobHistory={vehicleJobHistory}
            />
          )}

          {/* Parts Tab */}
          {activeTab === "parts" && (
            <PartsTab jobData={jobData} canEdit={canEdit} />
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <NotesTab 
              value={sharedNote}
              onChange={handleSharedNoteChange}
              canEdit={canEdit}
              saving={sharedNoteSaving}
              meta={sharedNoteMeta}
            />
          )}

          {/* VHC Tab */}
          {activeTab === "vhc" && (
            <VHCTab jobNumber={jobNumber} jobData={jobData} />
          )}

          {/* Warranty Tab */}
          {activeTab === "warranty" && (
            <WarrantyTab
              jobData={jobData}
              canEdit={canEdit}
              onLinkComplete={() => fetchJobData({ silent: true })}
            />
          )}

          {/* Messages Tab */}
          {activeTab === "messages" && (
            <MessagesTab
              thread={jobData.messagingThread}
              jobNumber={jobData.jobNumber}
              customerEmail={jobData.customerEmail}
            />
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <DocumentsTab
              documents={jobDocuments}
              canUpload={canEdit}
              uploading={documentUploading}
              onUpload={handleDocumentUpload}
              canDelete={canManageDocuments}
              onDelete={handleDeleteDocument}
            />
          )}
        </div>

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
    .map((check) => ({ check, severity: resolveVhcSeverity(check) }))
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
              backgroundColor: "#ef4444",
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
            Add Request
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
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "999px",
                backgroundColor: "#f3f4f6",
                color: "#4b5563",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                Grey: {vhcSummary.grey}
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
function ContactTab({ jobData, canEdit, onSaveCustomerDetails, customerSaving }) {
  const [editing, setEditing] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [formState, setFormState] = useState({
    firstName: jobData.customerFirstName || "",
    lastName: jobData.customerLastName || "",
    email: jobData.customerEmail || "",
    mobile: jobData.customerMobile || jobData.customerPhone || "",
    telephone: jobData.customerTelephone || "",
    address: jobData.customerAddress || "",
    postcode: jobData.customerPostcode || "",
    contactPreference: jobData.customerContactPreference || "Email"
  });
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!editing) {
      setFormState({
        firstName: jobData.customerFirstName || "",
        lastName: jobData.customerLastName || "",
        email: jobData.customerEmail || "",
        mobile: jobData.customerMobile || jobData.customerPhone || "",
        telephone: jobData.customerTelephone || "",
        address: jobData.customerAddress || "",
        postcode: jobData.customerPostcode || "",
        contactPreference: jobData.customerContactPreference || "Email"
      });
      setSaveError("");
      setApprovalChecked(false);
    }
  }, [jobData, editing]);

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const startEditing = () => {
    setEditing(true);
    setApprovalChecked(false);
    setSaveError("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setApprovalChecked(false);
  };

  const handleSave = async () => {
    if (!approvalChecked || !onSaveCustomerDetails) return;
    setSaveError("");
    const result = await onSaveCustomerDetails(formState);
    if (result?.success) {
      alert("✅ Customer details updated");
      setEditing(false);
      setApprovalChecked(false);
    } else if (result?.error?.message) {
      setSaveError(result.error.message);
    }
  };

  const contactOptions = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];

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
          {editing ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="First name"
                value={formState.firstName}
                onChange={(e) => handleFieldChange("firstName", e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
                disabled={customerSaving}
              />
              <input
                type="text"
                placeholder="Last name"
                value={formState.lastName}
                onChange={(e) => handleFieldChange("lastName", e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
                disabled={customerSaving}
              />
            </div>
          ) : (
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
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            EMAIL ADDRESS
          </label>
          {editing ? (
            <input
              type="email"
              value={formState.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
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
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            MOBILE PHONE
          </label>
          {editing ? (
            <input
              type="tel"
              value={formState.mobile}
              onChange={(e) => handleFieldChange("mobile", e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#333",
              fontWeight: "500"
            }}>
              {jobData.customerMobile || jobData.customerPhone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            LANDLINE PHONE
          </label>
          {editing ? (
            <input
              type="tel"
              value={formState.telephone}
              onChange={(e) => handleFieldChange("telephone", e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#333",
              fontWeight: "500"
            }}>
              {jobData.customerTelephone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            CONTACT PREFERENCE
          </label>
          {editing ? (
            <select
              value={formState.contactPreference}
              onChange={(e) => handleFieldChange("contactPreference", e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            >
              {contactOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
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
          )}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            ADDRESS
          </label>
          {editing ? (
            <textarea
              value={formState.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                resize: "vertical"
              }}
              disabled={customerSaving}
            />
          ) : (
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
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "8px", fontWeight: "600" }}>
            POSTCODE
          </label>
          {editing ? (
            <input
              type="text"
              value={formState.postcode}
              onChange={(e) => handleFieldChange("postcode", e.target.value.toUpperCase())}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#333",
              fontWeight: "500"
            }}>
              {jobData.customerPostcode || "N/A"}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: approvalChecked ? "#ecfdf5" : "#fff7ed",
          borderRadius: "8px",
          border: `1px solid ${approvalChecked ? "#10b981" : "#f97316"}`
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", color: "#374151" }}>
            <input
              type="checkbox"
              checked={approvalChecked}
              onChange={(e) => setApprovalChecked(e.target.checked)}
              disabled={customerSaving}
              style={{ width: "16px", height: "16px" }}
            />
            Customer has approved updated details
          </label>
          <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
            Regulatory requirement: customer confirmation must be recorded before saving.
          </p>
        </div>
      )}

      {saveError && (
        <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: "13px" }}>
          {saveError}
        </div>
      )}

      {canEdit && (
        <div style={{ marginTop: "24px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          {editing ? (
            <>
              {approvalChecked && (
                <button
                  onClick={handleSave}
                  disabled={customerSaving}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: customerSaving ? "#9ca3af" : "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: customerSaving ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  {customerSaving ? "Saving..." : "Save"}
                </button>
              )}
              <button
                onClick={cancelEditing}
                disabled={customerSaving}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: customerSaving ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              style={{
                padding: "10px 20px",
                backgroundColor: "#ef4444",
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
          )}
          <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>
            Note: Changes to customer records sync to appointments, job list, VHC, and messaging.
          </p>
        </div>
      )}
    </div>
  );
}

// ✅ Scheduling Tab
function SchedulingTab({
  jobData,
  canEdit,
  onWaitingStatusChange = () => {},
  waitingStatusSaving = false,
  onAppointmentSave = () => {},
  appointmentSaving = false
}) {
  const router = useRouter();
  const waitingOptions = ["Waiting", "Loan Car", "Collection", "Neither"];
  const [appointmentForm, setAppointmentForm] = useState({
    date: jobData.appointment?.date || "",
    time: jobData.appointment?.time || "",
    status: jobData.appointment?.status || "booked",
    notes: jobData.appointment?.notes || ""
  });
  const [appointmentDirty, setAppointmentDirty] = useState(false);
  const [appointmentMessage, setAppointmentMessage] = useState("");

  useEffect(() => {
    setAppointmentForm({
      date: jobData.appointment?.date || "",
      time: jobData.appointment?.time || "",
      status: jobData.appointment?.status || "booked",
      notes: jobData.appointment?.notes || ""
    });
    setAppointmentDirty(false);
    setAppointmentMessage("");
  }, [jobData.appointment]);

  const handleWaitingSelect = async (value) => {
    if (!canEdit || value === jobData.waitingStatus) return;
    await onWaitingStatusChange(value);
  };

  const handleAppointmentFieldChange = (field, value) => {
    setAppointmentForm((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
    setAppointmentDirty(true);
    setAppointmentMessage("");
  };

  const handleAppointmentSubmit = async () => {
    if (!appointmentDirty || !canEdit) return;
    const result = await onAppointmentSave(appointmentForm);
    if (result?.success) {
      setAppointmentDirty(false);
      setAppointmentMessage("Appointment saved");
      setTimeout(() => setAppointmentMessage(""), 3000);
    }
  };

  const appointmentCreatedAt = jobData.appointment?.createdAt
    ? new Date(jobData.appointment.createdAt).toLocaleString()
    : "Not created yet";

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Scheduling Information
      </h2>

      <div style={{
        padding: "20px",
        backgroundColor: "white",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        marginBottom: "24px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827" }}>Customer Status</h3>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "13px" }}>
              Waiting area vs loan car vs collection requirements
            </p>
          </div>
          {waitingStatusSaving && (
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>Updating...</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {waitingOptions.map((option) => {
            const isActive = jobData.waitingStatus === option || (!jobData.waitingStatus && option === "Neither");
            return (
              <button
                key={option}
                onClick={() => handleWaitingSelect(option)}
                disabled={!canEdit || waitingStatusSaving}
                style={{
                  flex: "1 1 180px",
                  minWidth: "140px",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: `2px solid ${isActive ? "#d10000" : "#e5e7eb"}`,
                  backgroundColor: isActive ? "rgba(209,0,0,0.08)" : "white",
                  color: isActive ? "#b91c1c" : "#374151",
                  fontWeight: "600",
                  cursor: canEdit ? "pointer" : "default",
                  transition: "all 0.2s"
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        padding: "20px",
        backgroundColor: "white",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        marginBottom: "24px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827" }}>
              Appointment Information
            </h3>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "13px" }}>
              Adjust booking times directly from the job card
            </p>
          </div>
          <button
            onClick={() => router.push(`/appointments?job=${jobData.jobNumber}`)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
              color: "#111827",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Open Appointment Calendar
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "6px" }}>
              Date
            </label>
            <input
              type="date"
              value={appointmentForm.date}
              onChange={(e) => handleAppointmentFieldChange("date", e.target.value)}
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "6px" }}>
              Time
            </label>
            <input
              type="time"
              value={appointmentForm.time}
              onChange={(e) => handleAppointmentFieldChange("time", e.target.value)}
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "6px" }}>
              Status
            </label>
            <select
              value={appointmentForm.status}
              onChange={(e) => handleAppointmentFieldChange("status", e.target.value)}
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
            >
              <option value="booked">Booked</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "6px" }}>
            Notes
          </label>
          <textarea
            value={appointmentForm.notes}
            onChange={(e) => handleAppointmentFieldChange("notes", e.target.value)}
            rows={3}
            disabled={!canEdit || appointmentSaving}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              resize: "vertical"
            }}
          />
        </div>

        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          {canEdit && (
            <button
              onClick={handleAppointmentSubmit}
              disabled={!appointmentDirty || appointmentSaving}
              style={{
                padding: "10px 20px",
                backgroundColor: appointmentDirty ? "#10b981" : "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: appointmentDirty && !appointmentSaving ? "pointer" : "not-allowed"
              }}
            >
              {appointmentSaving ? "Saving..." : jobData.appointment ? "Update Appointment" : "Schedule Appointment"}
            </button>
          )}
          {appointmentMessage && (
            <span style={{ fontSize: "13px", color: "#16a34a" }}>{appointmentMessage}</span>
          )}
        </div>

        <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px", fontSize: "13px", color: "#4b5563" }}>
          Appointment created: <strong>{appointmentCreatedAt}</strong>
        </div>
      </div>
    </div>
  );
}

// ✅ Service History Tab
function ServiceHistoryTab({ vehicleJobHistory }) {
  const history = Array.isArray(vehicleJobHistory)
    ? vehicleJobHistory
    : [];

  const handleInvoiceOpen = (job) => {
    if (job.invoiceAvailable && job.invoiceUrl) {
      window.open(job.invoiceUrl, "_blank");
    } else {
      alert("No invoice document stored for this job yet.");
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Service History (Same Vehicle)
      </h2>

      {history.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {history.map((job) => (
            <div
              key={job.id}
              onClick={() => handleInvoiceOpen(job)}
              style={{
                padding: "16px",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                cursor: job.invoiceAvailable ? "pointer" : "default",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f9fafb";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "600", color: "#d10000" }}>
                    Job #{job.jobNumber}
                  </span>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#4b5563"
                  }}>
                    {job.serviceDateFormatted}
                  </span>
                </div>
                {job.invoiceAvailable ? (
                  <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>
                    Invoice Available
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "600" }}>
                    No Invoice
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#4b5563" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong>Mileage:</strong>
                  <span>{job.mileage ? `${job.mileage} miles` : "Not recorded"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong>Requests:</strong>
                  <span>{job.requests.length}</span>
                </div>
              </div>

              {job.requests.length > 0 && (
                <ul style={{ margin: "12px 0 0 0", paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
                  {job.requests.slice(0, 3).map((req, index) => (
                    <li key={`${job.id}-req-${index}`}>
                      {req.text || req.description || "Request"}
                    </li>
                  ))}
                  {job.requests.length > 3 && (
                    <li style={{ listStyle: "none", color: "#6b7280" }}>
                      +{job.requests.length - 3} more request{job.requests.length - 3 === 1 ? "" : "s"}
                    </li>
                  )}
                </ul>
              )}
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
            No previous service history for this vehicle
          </p>
        </div>
      )}
    </div>
  );
}

// ✅ Parts Tab (TODO)
const normalizePartStatus = (status = "") => {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (["pending"].includes(normalized)) return "pending";
  if (["priced"].includes(normalized)) return "priced";
  if (["pre_pick", "pre-pick", "picked"].includes(normalized)) return "pre_pick";
  if (["on_order", "on-order", "awaiting_stock"].includes(normalized)) return "on_order";
  if (["stock", "allocated", "fitted"].includes(normalized)) return "stock";
  return "pending";
};

const PART_STATUS_META = {
  pending: { label: "Pending", color: "#92400e", background: "#fef3c7" },
  priced: { label: "Priced", color: "#3730a3", background: "#eef2ff" },
  pre_pick: { label: "Pre Pick", color: "#15803d", background: "#dcfce7" },
  on_order: { label: "On Order", color: "#d97706", background: "#fefce8" },
  stock: { label: "Stock", color: "#1d4ed8", background: "#dbeafe" },
};

const getPartStatusMeta = (status) => {
  const normalized = normalizePartStatus(status || "pending");
  return PART_STATUS_META[normalized] || PART_STATUS_META.pending;
};

const formatDateTime = (value) => {
  if (!value) return "Not recorded";
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return value;
  }
};

function PartsTab({ jobData }) {
  const vhcParts = (Array.isArray(jobData.partsAllocations) ? jobData.partsAllocations : []).map((item) => ({
    id: item.id,
    partNumber: item.part?.partNumber || "N/A",
    name: item.part?.name || "Part",
    description: item.part?.description || "",
    status: item.status || "pending",
    quantityRequested: item.quantityRequested ?? 0,
    quantityAllocated: item.quantityAllocated ?? 0,
    quantityFitted: item.quantityFitted ?? 0,
    source: item.origin && item.origin.toLowerCase() === "vhc" ? "VHC" : "Manual",
    prePickLocation: item.prePickLocation || "Not assigned",
    storageLocation: item.storageLocation || "Not assigned",
    notes: item.requestNotes || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  const manualRequests = (Array.isArray(jobData.partsRequests) ? jobData.partsRequests : []).map((request) => ({
    requestId: request.requestId,
    partNumber: request.part?.partNumber || "Custom",
    name: request.part?.name || request.description || "Part",
    description: request.description || "",
    status: request.status || "pending",
    quantity: request.quantity ?? 0,
    requestedBy: request.requestedBy || "Technician",
    approvedBy: request.approvedBy || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  }));

  const hasParts = vhcParts.length > 0 || manualRequests.length > 0;

  if (!hasParts) {
    return (
      <div>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
          Parts Overview
        </h2>
        <div style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#f9fafb",
          borderRadius: "12px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧰</div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
            No Parts Linked
          </h3>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>
            VHC authorizations and manual write-up requests will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600", color: "#1f2937" }}>
          VHC Linked Parts
        </h2>
        {vhcParts.length === 0 ? (
          <div style={{
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#fcfcfd",
            fontSize: "14px",
            color: "#6b7280"
          }}>
            No VHC items have been converted into parts for this job yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {vhcParts.map((part) => {
              const statusMeta = getPartStatusMeta(part.status);
              return (
                <div
                  key={part.id}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{part.partNumber}</div>
                      <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                        {part.name}
                      </h3>
                      {part.description && (
                        <p style={{ margin: 0, fontSize: "13px", color: "#4b5563" }}>{part.description}</p>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: statusMeta.color,
                        backgroundColor: statusMeta.background
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                    gap: "12px",
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#374151"
                  }}>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Qty Requested</strong>
                      <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityRequested}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Qty Allocated</strong>
                      <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityAllocated}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Qty Fitted</strong>
                      <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityFitted}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Source</strong>
                      <div>{part.source}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Pre Pick Location</strong>
                      <div>{part.prePickLocation}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Storage</strong>
                      <div>{part.storageLocation}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "20px", fontSize: "12px", color: "#6b7280" }}>
                    <span>Created: {formatDateTime(part.createdAt)}</span>
                    <span>Updated: {formatDateTime(part.updatedAt)}</span>
                  </div>

                  {part.notes && (
                    <div style={{
                      marginTop: "12px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      fontSize: "13px"
                    }}>
                      <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>Technician Note:</strong>
                      <div>{part.notes}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ margin: "12px 0", fontSize: "18px", fontWeight: "600", color: "#1f2937" }}>
          Manual Requests (Write-up)
        </h2>
        {manualRequests.length === 0 ? (
          <div style={{
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#fcfcfd",
            fontSize: "14px",
            color: "#6b7280"
          }}>
            No manual part requests have been logged.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {manualRequests.map((request) => {
              const statusMeta = getPartStatusMeta(request.status);
              return (
                <div
                  key={request.requestId}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{request.partNumber}</div>
                      <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                        {request.name}
                      </h3>
                      {request.description && (
                        <p style={{ margin: 0, fontSize: "13px", color: "#4b5563" }}>{request.description}</p>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: statusMeta.color,
                        backgroundColor: statusMeta.background
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                    gap: "12px",
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#374151"
                  }}>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Quantity</strong>
                      <div style={{ fontWeight: "700", fontSize: "16px" }}>{request.quantity}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Requested By</strong>
                      <div>{request.requestedBy}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Approved By</strong>
                      <div>{request.approvedBy || "Awaiting approval"}</div>
                    </div>
                    <div>
                      <strong style={{ color: "#6b7280", fontSize: "12px" }}>Created</strong>
                      <div>{formatDateTime(request.createdAt)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ marginTop: "4px", color: "#9ca3af", fontSize: "12px" }}>
        All data shown is read-only. Updates must be made from the VHC parts workflow or technician write-up form.
      </p>
    </div>
  );
}

// ✅ Notes Tab
function NotesTab({ value, onChange, canEdit, saving, meta }) {
  const lastUpdated =
    meta?.updatedAt || meta?.createdAt
      ? new Date(meta?.updatedAt || meta?.createdAt).toLocaleString()
      : null;
  const updatedBy = meta?.createdBy || "Unassigned";

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Job Notes
      </h2>

      <div style={{
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={!canEdit}
          placeholder="Type job notes here. Changes are saved automatically."
          style={{
            width: "100%",
            minHeight: "280px",
            padding: "16px",
            borderRadius: "12px",
            border: canEdit ? "1px solid #d1d5db" : "1px solid #e5e7eb",
            fontSize: "15px",
            lineHeight: 1.5,
            resize: "vertical",
            backgroundColor: canEdit ? "#ffffff" : "#f9fafb",
            color: "#1f2937"
          }}
        />
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "#6b7280" }}>
          <div>
            {lastUpdated ? (
              <>
                Last updated by <strong style={{ color: "#111827" }}>{updatedBy}</strong> on{" "}
                <strong style={{ color: "#111827" }}>{lastUpdated}</strong>
              </>
            ) : (
              "No notes recorded yet."
            )}
          </div>
          <div style={{ fontSize: "12px", color: saving ? "#d97706" : "#9ca3af" }}>
            {saving ? "Saving…" : "Synced"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ VHC Tab
function VHCTab({ jobNumber, jobData }) {
  const router = useRouter();
  if (!jobData) {
    return (
      <div>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
          Vehicle Health Check
        </h2>
        <p style={{ color: "#6b7280" }}>VHC data is still loading.</p>
      </div>
    );
  }
  const vhcChecks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
  const groupedIssues = { red: [], amber: [], grey: [] };

  vhcChecks.forEach((check) => {
    const severity = resolveVhcSeverity(check);
    if (!groupedIssues[severity]) {
      groupedIssues[severity] = [];
    }
    groupedIssues[severity].push(check);
  });

  const vhcParts = (Array.isArray(jobData?.partsAllocations) ? jobData.partsAllocations : []).filter(
    (item) => (item.origin || "").toLowerCase() === "vhc"
  );
  const totalPartsRequested = vhcParts.reduce(
    (sum, part) => sum + (part.quantityRequested ?? part.quantityAllocated ?? 0),
    0
  );

  const authorizations = Array.isArray(jobData?.vhcAuthorizations)
    ? jobData.vhcAuthorizations
    : [];
  const latestAuthorization = authorizations[0] || null;

  let approvalLabel = "Awaiting VHC";
  let approvalDescription = "Technicians are still completing the VHC on this job.";

  if (!jobData?.vhcRequired) {
    approvalLabel = "VHC Not Required";
    approvalDescription = "This job has been marked as not requiring a VHC.";
  } else if (latestAuthorization) {
    approvalLabel = "Customer Approved";
    approvalDescription = `Authorized by ${latestAuthorization.authorizedBy} on ${new Date(
      latestAuthorization.authorizedAt || latestAuthorization.createdAt
    ).toLocaleString()}`;
    if (latestAuthorization.customerNotes) {
      approvalDescription += ` — "${latestAuthorization.customerNotes}"`;
    }
  } else if (groupedIssues.red.length || groupedIssues.amber.length) {
    approvalLabel = "Pending Customer Approval";
    approvalDescription = "Red or amber items need customer authorization before work can proceed.";
  } else if (vhcChecks.length > 0) {
    approvalLabel = "No Authorization Needed";
    approvalDescription = "No red or amber items have been flagged.";
  }

  const renderIssueList = (title, color, items) => (
    <div style={{
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      backgroundColor: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      flex: 1,
      minWidth: "240px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color }}>{title}</h3>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>
      {items.length === 0 ? (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "#9ca3af" }}>No items logged.</p>
      ) : (
        <ul style={{ margin: "12px 0 0 0", paddingLeft: "16px", color: "#374151", fontSize: "13px", lineHeight: 1.5 }}>
          {items.slice(0, 4).map((issue) => (
            <li key={issue.vhc_id}>
              <strong>{issue.issue_title || issue.section || "VHC Item"}</strong>
              {issue.issue_description && (
                <span style={{ display: "block", color: "#6b7280" }}>{issue.issue_description}</span>
              )}
            </li>
          ))}
          {items.length > 4 && (
            <li style={{ listStyle: "none", color: "#6b7280", marginTop: "6px" }}>
              +{items.length - 4} more item{items.length - 4 === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Vehicle Health Check
      </h2>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
          Read-only snapshot of the VHC. Use the VHC page to make changes.
        </p>
        <button
          onClick={() => router.push(`/vhc/details/${jobNumber}`)}
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
          🔍 Open VHC Page
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: "12px",
        marginBottom: "24px"
      }}>
        {[
          { label: "Red Items", count: groupedIssues.red.length, color: "#dc2626" },
          { label: "Amber Items", count: groupedIssues.amber.length, color: "#d97706" },
          { label: "Grey Items", count: groupedIssues.grey.length, color: "#6b7280" },
          { label: "Parts Required", count: vhcParts.length, color: "#0ea5e9", sub: `${totalPartsRequested} total qty` }
        ].map((card) => (
          <div key={card.label} style={{
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>{card.label}</p>
            <div style={{ fontSize: "28px", fontWeight: "700", color: card.color }}>
              {card.count}
            </div>
            {card.sub && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#9ca3af" }}>{card.sub}</p>}
          </div>
        ))}
        <div style={{
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
        }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Customer Approval</p>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", marginTop: "4px" }}>
            {approvalLabel}
          </div>
          <p style={{ margin: "6px 0 0 0", color: "#6b7280", fontSize: "13px" }}>{approvalDescription}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        {renderIssueList("Red Items", "#dc2626", groupedIssues.red)}
        {renderIssueList("Amber Items", "#d97706", groupedIssues.amber)}
        {renderIssueList("Grey Items", "#6b7280", groupedIssues.grey)}
      </div>

      <div style={{
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1f2937" }}>Parts Required</h3>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>{vhcParts.length} linked part{vhcParts.length === 1 ? "" : "s"}</span>
        </div>
        {vhcParts.length === 0 ? (
          <p style={{ marginTop: "12px", fontSize: "14px", color: "#9ca3af" }}>
            No VHC-derived parts have been requested for this job yet.
          </p>
        ) : (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {vhcParts.slice(0, 4).map((part) => (
              <div key={part.id} style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>{part.part?.partNumber || "Custom Part"}</div>
                    <strong style={{ color: "#111827" }}>{part.part?.name || "Unnamed Part"}</strong>
                  </div>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    Qty: {part.quantityRequested ?? part.quantityAllocated ?? 0}
                  </span>
                </div>
                {part.requestNotes && (
                  <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
                    {part.requestNotes}
                  </p>
                )}
              </div>
            ))}
            {vhcParts.length > 4 && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                +{vhcParts.length - 4} more linked part{vhcParts.length - 4 === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ marginTop: "16px", fontSize: "13px", color: "#9ca3af" }}>
        Editing is disabled here. Use the dedicated VHC page to update findings, approvals, and parts.
      </p>
    </div>
  );
}

// ✅ Messages Tab
function MessagesTab({ thread, jobNumber, customerEmail }) {
  const router = useRouter();
  const members = Array.isArray(thread?.participants) ? thread.participants : [];
  const customerMember = members.find((member) =>
    (member.role || "").toLowerCase().includes("customer")
  );
  const staffMembers = members.filter(
    (member) => !(member.role || "").toLowerCase().includes("customer")
  );
  const customerLinked = Boolean(customerEmail && customerMember);
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];

  const handleOpenMessagingHub = () => {
    router.push("/messages");
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}>
        Messages
      </h2>
      <p style={{ margin: "0 0 20px 0", color: "#6b7280", fontSize: "14px" }}>
        Conversations between service, workshop, after-sales, and the customer. Replying is available
        from the Messaging hub.
      </p>

      {!thread ? (
        <div style={{
          padding: "28px",
          borderRadius: "12px",
          border: "1px dashed #fecaca",
          backgroundColor: "#fff8f8",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "600", color: "#b91c1c" }}>
            No conversation linked yet
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6b7280" }}>
            Open the Messaging hub to start a thread for Job #{jobNumber}. Customers see the thread
            once their email is on file and they are added as a participant.
          </p>
          <button
            onClick={handleOpenMessagingHub}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#d10000",
              color: "white",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Open Messaging Hub
          </button>
        </div>
      ) : (
        <>
          <div style={{
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            marginBottom: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", letterSpacing: "0.2em" }}>
                  Thread
                </p>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "17px", fontWeight: "600", color: "#111827" }}>
                  {thread.title}
                </h3>
              </div>
              <button
                onClick={handleOpenMessagingHub}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Open in Messaging Hub
              </button>
            </div>
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {staffMembers.map((member, index) => (
                <span
                  key={member.userId || `staff-${index}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    backgroundColor: "#f3f4f6",
                    color: "#374151"
                  }}
                >
                  {member.name} · {member.role || "Team"}
                </span>
              ))}
              {customerMember && (
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    backgroundColor: "#dbeafe",
                    color: "#1d4ed8"
                  }}
                >
                  {customerMember.name || "Customer"} · Customer
                </span>
              )}
            </div>
          </div>

          <div style={{
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            marginBottom: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111827" }}>
              Customer delivery status
            </h4>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
              {customerEmail
                ? customerLinked
                  ? `Messages are shared with ${customerEmail}.`
                  : `Email on file (${customerEmail}) is not yet linked to this thread. Add them in Messaging to share updates.`
                : "No customer email is linked yet. Add one to start messaging the customer."}
            </p>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#9ca3af" }}>
              Staff-only messages remain hidden from the customer portal.
            </p>
          </div>

          <div style={{
            padding: "0 0 4px 0",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            maxHeight: "360px",
            overflowY: "auto",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}>
            {messages.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
                No messages have been posted in this thread yet.
              </div>
            ) : (
              messages.map((message) => {
                const isStaffOnly = message.customerVisible === false || message.audience === "staff";
                return (
                  <div
                    key={message.id || `${message.createdAt}-${message.content.slice(0, 20)}`}
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid #f3f4f6",
                      backgroundColor: isStaffOnly ? "#fff8f8" : "#f8fafc"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#111827", fontSize: "14px" }}>
                          {message.sender?.name || "Team Member"}
                        </strong>
                        {message.sender?.role && (
                          <span style={{ marginLeft: "8px", fontSize: "12px", color: "#9ca3af" }}>
                            {message.sender.role}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <p style={{ margin: "8px 0 0 0", color: "#374151", fontSize: "14px", whiteSpace: "pre-wrap" }}>
                      {message.content}
                    </p>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: isStaffOnly ? "#b91c1c" : "#047857",
                          backgroundColor: isStaffOnly ? "#fee2e2" : "#d1fae5"
                        }}
                      >
                        {isStaffOnly ? "Internal only" : "Shared with customer"}
                      </span>
                      {message.metadata?.jobNumber && (
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          Linked job #{message.metadata.jobNumber}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

const DOCUMENT_CATEGORY_CONFIG = [
  {
    id: "check-sheets",
    label: "Check-Sheets",
    description: "Technician check sheets, inspection reports, and paper service checklists.",
    icon: "📋",
    accent: "#fb923c",
    hints: ["check", "sheet", "inspection", "checklist"],
    emptyState: "No check-sheets have been uploaded yet."
  },
  {
    id: "vhc",
    label: "VHC Reports",
    description: "Exports from the Vehicle Health Check system and annotated VHC PDFs.",
    icon: "🩺",
    accent: "#f87171",
    hints: ["vhc", "health", "traffic", "vhcreport", "vhc-report", "vhc_report"],
    emptyState: "No VHC reports have been uploaded for this job."
  },
  {
    id: "vehicle",
    label: "Vehicle Documents",
    description: "V5, warranty packs, loan agreements, and other vehicle-specific paperwork.",
    icon: "🚗",
    accent: "#38bdf8",
    hints: ["vehicle", "v5", "logbook", "warranty", "vehicle-doc", "vehicledoc"],
    emptyState: "No vehicle documents are stored yet."
  },
  {
    id: "customer",
    label: "Customer Uploads",
    description: "Documents or photos supplied by the customer (portal or email).",
    icon: "👤",
    accent: "#34d399",
    hints: ["customer", "client", "cust", "customer-upload", "customer_upload"],
    emptyState: "No customer uploads have been linked yet."
  },
  {
    id: "service",
    label: "Service Forms",
    description: "Signed invoices, service authorisations, and mandatory service paperwork.",
    icon: "🧾",
    accent: "#c084fc",
    hints: ["service", "form", "authorisation", "authorization", "service-form"],
    emptyState: "No service forms have been uploaded yet."
  },
  {
    id: "general",
    label: "General Attachments",
    description: "Any other supporting photos, notes, or files.",
    icon: "📎",
    accent: "#94a3b8",
    hints: [],
    emptyState: "No attachments stored yet."
  }
];

const determineDocumentCategory = (record = {}) => {
  const folder = (record.folder || "").toLowerCase();
  const name = (record.name || "").toLowerCase();
  const type = (record.type || "").toLowerCase();
  const searchable = `${folder} ${name} ${type}`;

  for (const category of DOCUMENT_CATEGORY_CONFIG) {
    if (category.id === "general") {
      continue;
    }
    if (category.hints.some((hint) => hint && searchable.includes(hint))) {
      return category.id;
    }
  }

  if (folder && folder !== "general") {
    return folder;
  }

  return "general";
};

function WarrantyTab({ jobData, canEdit, onLinkComplete = () => {} }) {
  const router = useRouter();
  const [linkMode, setLinkMode] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const linkedJob = jobData?.linkedWarrantyJob || null;
  const sharedVhcJobNumber =
    jobData?.warrantyVhcMasterJobNumber || jobData?.jobNumber;
  const isLinked = Boolean(jobData?.linkedWarrantyJobId);

  const loadWarrantyJobs = useCallback(async () => {
    if (!canEdit) return;
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, status, job_source, vehicle_reg, vehicle_make_model, warranty_linked_job_id"
        )
        .eq("job_source", "Warranty")
        .neq("id", jobData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      const filtered = (data || []).filter(
        (record) =>
          !record.warranty_linked_job_id ||
          record.warranty_linked_job_id === jobData.id
      );
      setAvailableJobs(filtered);
      setLinkError(
        filtered.length ? "" : "No warranty jobs are available to link right now."
      );
    } catch (err) {
      console.error("❌ Failed to load warranty jobs:", err);
      setLinkError(err?.message || "Failed to load warranty jobs.");
    } finally {
      setLoadingJobs(false);
    }
  }, [canEdit, jobData?.id]);

  useEffect(() => {
    if (linkMode) {
      loadWarrantyJobs();
    } else {
      setAvailableJobs([]);
      setSelectedJobId("");
      setLinkError("");
    }
  }, [linkMode, loadWarrantyJobs]);

  const handleLinkJob = async () => {
    if (!selectedJobId) {
      setLinkError("Select a warranty job card to link.");
      return;
    }

    const numericJobId = Number(selectedJobId);
    if (Number.isNaN(numericJobId)) {
      setLinkError("Invalid job selection.");
      return;
    }

    const targetJob =
      availableJobs.find((job) => job.id === numericJobId) || null;

    if (!targetJob) {
      setLinkError("Selected warranty job is no longer available.");
      return;
    }

    const targetIsWarranty =
      (targetJob.job_source || "").toLowerCase() === "warranty";
    const currentIsWarranty =
      (jobData?.jobSource || "").toLowerCase() === "warranty";

    const masterJobId =
      !currentIsWarranty && targetIsWarranty
        ? jobData.id
        : currentIsWarranty && !targetIsWarranty
        ? targetJob.id
        : jobData.id;

    setLinking(true);
    setLinkError("");

    const currentUpdate = await updateJob(jobData.id, {
      warranty_linked_job_id: numericJobId,
      warranty_vhc_master_job_id: masterJobId
    });

    if (!currentUpdate?.success) {
      setLinkError(
        currentUpdate?.error?.message || "Failed to update primary job."
      );
      setLinking(false);
      return;
    }

    const targetUpdate = await updateJob(numericJobId, {
      warranty_linked_job_id: jobData.id,
      warranty_vhc_master_job_id: masterJobId,
      status: jobData.status
    });

    if (!targetUpdate?.success) {
      await updateJob(jobData.id, {
        warranty_linked_job_id: null,
        warranty_vhc_master_job_id: null
      });
      setLinkError(
        targetUpdate?.error?.message || "Failed to update warranty job."
      );
      setLinking(false);
      return;
    }

    alert("✅ Warranty job card linked successfully.");
    setLinkMode(false);
    setSelectedJobId("");
    setAvailableJobs([]);
    setLinking(false);
    if (typeof onLinkComplete === "function") {
      onLinkComplete();
    }
  };

  const handleOpenLinkedJob = () => {
    if (!linkedJob?.jobNumber) return;
    router.push(`/job-cards/${linkedJob.jobNumber}`);
  };

  const renderLinkControls = () => {
    if (!canEdit) {
      return null;
    }

    if (!linkMode) {
      return (
        <button
          type="button"
          onClick={() => setLinkMode(true)}
          style={{
            marginTop: "16px",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "#d10000",
            color: "white",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          {isLinked ? "Change Linked Warranty Job" : "Link Warranty Job Card"}
        </button>
      );
    }

    return (
      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#fff7ed",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              color: "#374151",
              fontWeight: "600",
              marginBottom: "6px"
            }}
          >
            Select Warranty Job
          </label>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
            disabled={loadingJobs || linking}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              backgroundColor: "white"
            }}
          >
            <option value="">
              {loadingJobs
                ? "Loading warranty jobs..."
                : "Choose a warranty job number"}
            </option>
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_number} · {job.vehicle_reg || "No Reg"} ·{" "}
                {job.vehicle_make_model || "Warranty Job"}
              </option>
            ))}
          </select>
          {linkError && (
            <p style={{ marginTop: "6px", fontSize: "12px", color: "#b91c1c" }}>
              {linkError}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={handleLinkJob}
            disabled={linking || !selectedJobId}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: linking ? "#cbd5f5" : "#10b981",
              color: "white",
              fontWeight: "600",
              cursor: linking ? "not-allowed" : "pointer",
              minWidth: "140px"
            }}
          >
            {linking ? "Linking..." : "Link Job"}
          </button>
          <button
            type="button"
            onClick={() => setLinkMode(false)}
            disabled={linking}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              fontWeight: "600",
              cursor: linking ? "not-allowed" : "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2
        style={{
          margin: "0 0 12px 0",
          fontSize: "20px",
          fontWeight: "600",
          color: "#1a1a1a"
        }}
      >
        Warranty Linking
      </h2>
      <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 18px 0" }}>
        Link this job card with a warranty counterpart to mirror progress and
        share the same Vehicle Health Check. Clocking and labour capture remain
        independent for each job.
      </p>

      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          marginBottom: "16px"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#0f172a" }}>
          Linked Warranty Job
        </h3>
        {linkedJob ? (
          <>
            <p style={{ margin: 0, color: "#374151", fontSize: "14px" }}>
              Linked to Job #{linkedJob.jobNumber} ({linkedJob.status || "Open"})
            </p>
            <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleOpenLinkedJob}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px"
                }}
              >
                View Linked Job
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px" }}>
            No warranty job card is linked yet.
          </p>
        )}
      </div>

      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid #e0f2fe",
          backgroundColor: "#eff6ff"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#0f172a" }}>
          Shared VHC Source
        </h3>
        <p style={{ margin: "0 0 6px 0", color: "#1e3a8a", fontSize: "14px" }}>
          VHC checklist hosted on Job #{sharedVhcJobNumber}
        </p>
        <p style={{ margin: 0, color: "#475569", fontSize: "13px" }}>
          Any VHC updates, approvals, or parts raised on the master job instantly
          reflect on both job cards. Clocking, labour, and invoicing remain
          separate per job.
        </p>
      </div>

      {renderLinkControls()}
    </div>
  );
}

function DocumentsTab({
  documents = [],
  canUpload,
  uploading,
  onUpload,
  canDelete,
  onDelete
}) {
  const [selectedCategory, setSelectedCategory] = useState(
    DOCUMENT_CATEGORY_CONFIG[0].id
  );
  const fileInputRef = useRef(null);

  const groupedDocuments = useMemo(() => {
    const buckets = DOCUMENT_CATEGORY_CONFIG.reduce((acc, category) => {
      acc[category.id] = [];
      return acc;
    }, {});

    (documents || []).forEach((doc = {}) => {
      const categoryId = determineDocumentCategory(doc);
      const resolved = buckets[categoryId] ? categoryId : "general";
      buckets[resolved].push(doc);
    });

    return buckets;
  }, [documents]);

  const selectedCategoryMeta =
    DOCUMENT_CATEGORY_CONFIG.find((category) => category.id === selectedCategory) ||
    DOCUMENT_CATEGORY_CONFIG[0];

  const categoryDocuments = groupedDocuments[selectedCategory] || [];
  const totalDocuments = documents?.length || 0;

  const handleFileInputChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0 && typeof onUpload === "function") {
      onUpload(files, selectedCategory);
    }
    event.target.value = "";
  };

  const handleUploadClick = () => {
    if (!canUpload || !fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handlePreview = (doc) => {
    if (!doc?.url) return;
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const formatTimestamp = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Unknown";
    }
    return parsed.toLocaleString();
  };

  const renderDocumentCard = (doc) => {
    const isImage = (doc.type || "").toLowerCase().startsWith("image/");
    const fallbackLabel = (doc.type || "").split("/").pop() || "FILE";
    const ext =
      doc.name && doc.name.includes(".")
        ? doc.name.split(".").pop().toUpperCase()
        : fallbackLabel.toUpperCase();

    return (
      <div
        key={doc.id || doc.url}
        style={{
          display: "flex",
          gap: "16px",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
        }}
      >
        <div
          style={{
            width: "84px",
            height: "84px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {isImage ? (
            <img
              src={doc.url}
              alt={doc.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "4px" }}>📄</div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#475569" }}>
                {ext}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#111827" }}>
                {doc.name || "Document"}
              </h4>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                Folder: {(doc.folder || "general").replace(/-/g, " ")} · {doc.type || "Unknown type"}
              </p>
              <p style={{ margin: "6px 0 0 0", color: "#9ca3af", fontSize: "12px" }}>
                Uploaded {formatTimestamp(doc.uploadedAt)} by {doc.uploadedBy || "System"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handlePreview(doc)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Preview
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => typeof onDelete === "function" && onDelete(doc)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2
        style={{
          margin: "0 0 8px 0",
          fontSize: "20px",
          fontWeight: "600",
          color: "#1a1a1a"
        }}
      >
        Documents & Attachments
      </h2>
      <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 20px 0" }}>
        Centralised storage for check-sheets, VHC exports, customer uploads, vehicle documents, and
        service paperwork. {totalDocuments} file{totalDocuments === 1 ? "" : "s"} stored for this job.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "20px"
        }}
      >
        {DOCUMENT_CATEGORY_CONFIG.map((category) => {
          const docsInCategory = groupedDocuments[category.id] || [];
          const isActive = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "16px",
                borderRadius: "12px",
                border: isActive ? `2px solid ${category.accent}` : "1px solid #e5e7eb",
                backgroundColor: isActive ? "rgba(209,0,0,0.05)" : "white",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: isActive ? "0 4px 12px rgba(209,0,0,0.12)" : "none"
              }}
            >
              <span style={{ fontSize: "18px" }}>{category.icon}</span>
              <strong style={{ fontSize: "14px", color: "#111827" }}>
                {category.label}
              </strong>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                {docsInCategory.length} file{docsInCategory.length === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {canUpload && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            borderRadius: "12px",
            border: "1px dashed #cbd5f5",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#0f172a", fontWeight: "600" }}>
              Upload to {selectedCategoryMeta.label}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              You can select multiple images or documents. Files instantly sync to all job card
              surfaces and technician views.
            </p>
            {uploading && (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#0f172a", fontWeight: "600" }}>
                Uploading… please keep this tab open.
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: uploading ? "#cbd5f5" : "#d10000",
                color: "white",
                fontWeight: "600",
                cursor: uploading ? "not-allowed" : "pointer",
                minWidth: "140px"
              }}
            >
              {uploading ? "Uploading…" : "Upload Files"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#0f172a" }}>
          {selectedCategoryMeta.label}
        </h3>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
          {selectedCategoryMeta.description}
        </p>
        {!canDelete && (
          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Only workshop/service managers can delete files. Contact management if a document needs to
            be removed.
          </p>
        )}
        {canDelete && (
          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Delete removes the Supabase storage file and the job file record.
          </p>
        )}
      </div>

      {categoryDocuments.length === 0 ? (
        <div
          style={{
            padding: "28px",
            borderRadius: "12px",
            border: "1px dashed #e5e7eb",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "14px"
          }}
        >
          {selectedCategoryMeta.emptyState}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          {categoryDocuments.map((doc) => renderDocumentCard(doc))}
        </div>
      )}
    </div>
  );
}
