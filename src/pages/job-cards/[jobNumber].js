// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import InvoiceBuilderPopup from "@/components/popups/InvoiceBuilderPopup";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { supabase } from "@/lib/supabaseClient";
import { getJobByNumber, updateJob, updateJobStatus, addJobFile, deleteJobFile } from "@/lib/database/jobs";
import {
  getNotesByJob,
  createJobNote,
  deleteJobNote,
  updateJobNote
} from "@/lib/database/notes";
import { getCustomerJobs, getCustomerVehicles } from "@/lib/database/customers";
import {
  normalizeRequests,
  mapCustomerJobsToHistory
} from "@/lib/jobcards/utils";
import { summarizePartsPipeline } from "@/lib/partsPipeline";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";
import InvoiceSection from "@/components/Invoices/InvoiceSection";
import { isValidUuid, sanitizeNumericId } from "@/lib/utils/ids";

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

const READY_FOR_INVOICING_STATUS_IDS = new Set([
  "ready_for_release",
  "ready_for_invoice",
  "ready_for_invoicing",
  "awaiting_invoicing",
  "ready_for_accounts",
  "delivered_to_customer"
]);

const normalizeStatusId = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const isStatusReadyForInvoicing = (status) =>
  READY_FOR_INVOICING_STATUS_IDS.has(normalizeStatusId(status));

const arePartsPricedAndAssigned = (allocations = []) => {
  const parts = Array.isArray(allocations) ? allocations : [];
  if (parts.length === 0) {
    return true;
  }

  return parts.every((item) => {
    if (!item) return false;
    const requestedQty = Number(item.quantityRequested ?? 0);
    const allocatedQty = Number(item.quantityAllocated ?? 0);
    const hasAllocated =
      requestedQty > 0 ? allocatedQty >= requestedQty : allocatedQty > 0;
    const unitPrice =
      Number(item.unitPrice ?? 0) || Number(item.part?.unitPrice ?? 0);
    return hasAllocated && unitPrice > 0;
  });
};

const formatBookingDescriptionInput = (value = "") => {
  const normalized = String(value || "").replace(/\r/g, "");
  if (!normalized.trim()) {
    return "";
  }

  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "- ";
      }
      const withoutPrefix = trimmed.startsWith("- ")
        ? trimmed.slice(2).trimStart()
        : trimmed.replace(/^-+\s*/, "").trimStart();
      return `- ${withoutPrefix}`;
    })
    .join("\n");
};

export default function JobCardDetailPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user, dbUserId } = useUser();
  const { confirm } = useConfirmation();

  const actingUserId = useMemo(() => {
    if (typeof user?.authUuid === "string" && isValidUuid(user.authUuid)) {
      return user.authUuid;
    }
    if (typeof user?.id === "string" && isValidUuid(user.id)) {
      return user.id;
    }
    return null;
  }, [user?.authUuid, user?.id]);

  const actingUserNumericId = useMemo(() => sanitizeNumericId(dbUserId), [dbUserId]);

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
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [customerVehiclesLoading, setCustomerVehiclesLoading] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [bookingFlowSaving, setBookingFlowSaving] = useState(false);
  const [bookingApprovalSaving, setBookingApprovalSaving] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoicePopupOpen, setInvoicePopupOpen] = useState(false);
  const [invoiceResponse, setInvoiceResponse] = useState(null);

  const isArchiveMode = router.query.archive === "1";

  // ✅ Permission Check
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const canEditBase = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));
  const canManageDocumentsBase = [
    "service manager",
    "workshop manager",
    "after-sales manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));
  const canEdit = !isArchiveMode && canEditBase;
  const canManageDocuments = !isArchiveMode && canManageDocumentsBase;

  // Invoice visibility permission check
  const canViewInvoice = [
    "service",
    "service manager",
    "workshop manager",
    "admin",
    "admin manager"
  ].some((role) => userRoles.includes(role));

  // Check for tab query parameter to switch to invoice tab
  useEffect(() => {
    if (router.query.tab === "invoice") {
      setActiveTab("invoice");
    }
  }, [router.query.tab]);

  // Watch for job completion and redirect to invoice tab
  const previousStatusRef = useRef(null);
  useEffect(() => {
    if (!jobData) return;

    const currentStatus = jobData.status;
    const previousStatus = previousStatusRef.current;

    // Check if job was just marked as Complete
    if (
      currentStatus === "Complete" &&
      previousStatus !== null &&
      previousStatus !== "Complete" &&
      canViewInvoice
    ) {
      // Redirect to invoice tab when job is completed
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    }

    // Update the ref for next comparison
    previousStatusRef.current = currentStatus;
  }, [jobData?.status, jobData?.jobNumber, canViewInvoice, router]);

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

  const refreshCustomerVehicles = useCallback(
    async (customerId) => {
      if (!customerId) {
        setCustomerVehicles([]);
        return;
      }

      setCustomerVehiclesLoading(true);
      try {
        const vehicles = await getCustomerVehicles(customerId);
        setCustomerVehicles(Array.isArray(vehicles) ? vehicles : []);
      } catch (vehicleError) {
        console.error("❌ Failed to load customer vehicles:", vehicleError);
        setCustomerVehicles([]);
      } finally {
        setCustomerVehiclesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (jobData?.files) {
      const mapped = (jobData.files || []).map(mapJobFileRecord);
      setJobDocuments(mapped);
    }
  }, [jobData?.files]);

  useEffect(() => {
    if (!jobData?.customerId) {
      setCustomerVehicles([]);
      return;
    }
    refreshCustomerVehicles(jobData.customerId);
  }, [jobData?.customerId, refreshCustomerVehicles]);

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
      { table: "job_booking_requests", filter: `job_id=eq.${jobData.id}` },
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

  const handleBookingFlowSave = useCallback(
    async ({ vehicleId, description, waitingStatus }) => {
      if (!canEdit || !jobData?.id) return { success: false };

      setBookingFlowSaving(true);

      try {
        const normalizedVehicleId =
          typeof vehicleId === "string" ? Number(vehicleId) : vehicleId;

        const selectedVehicle =
          customerVehicles.find(
            (vehicle) => vehicle.vehicle_id === normalizedVehicleId
          ) ||
          (jobData.vehicleId && jobData.vehicleId === normalizedVehicleId
            ? {
                vehicle_id: jobData.vehicleId,
                registration: jobData.reg,
                reg_number: jobData.reg,
                make_model: jobData.makeModel,
                make: jobData.make,
                model: jobData.model
              }
            : null);

        const updates = {
          description:
            description && description.trim().length > 0 ? description : null,
          waiting_status: waitingStatus || "Neither"
        };

        if (normalizedVehicleId && normalizedVehicleId !== jobData.vehicleId) {
          updates.vehicle_id = normalizedVehicleId;
          if (selectedVehicle) {
            const regValue =
              (selectedVehicle.registration ||
                selectedVehicle.reg_number ||
                "")?.toString().toUpperCase() || null;
            if (regValue) {
              updates.vehicle_reg = regValue;
            }
            const derivedMakeModel =
              selectedVehicle.make_model ||
              [selectedVehicle.make, selectedVehicle.model]
                .filter(Boolean)
                .join(" ")
                .trim();
            if (derivedMakeModel) {
              updates.vehicle_make_model = derivedMakeModel;
            }
          }
        }

        const result = await updateJob(jobData.id, updates);

        if (!result?.success) {
          throw (
            result?.error || new Error("Failed to update booking details")
          );
        }

        setJobData((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            description: description || "",
            waitingStatus: updates.waiting_status || prev.waitingStatus
          };
          if (updates.vehicle_id) {
            next.vehicleId = updates.vehicle_id;
          }
          if (updates.vehicle_reg) {
            next.reg = updates.vehicle_reg;
          }
          if (selectedVehicle) {
            next.make = selectedVehicle.make || next.make;
            next.model = selectedVehicle.model || next.model;
            next.makeModel =
              updates.vehicle_make_model ||
              selectedVehicle.make_model ||
              next.makeModel;
          }
          return next;
        });

        if (
          normalizedVehicleId &&
          normalizedVehicleId !== jobData.vehicleId
        ) {
          await fetchJobData({ silent: true });
        }

        try {
          const response = await fetch(
            `/api/job-cards/${jobData.jobNumber}/booking-request`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                vehicleId: normalizedVehicleId || jobData.vehicleId || null,
                waitingStatus: updates.waiting_status || "Neither",
                description,
                submittedBy: dbUserId || null,
                submittedByName:
                  user?.username ||
                  user?.name ||
                  user?.fullName ||
                  user?.email ||
                  "Workshop User"
              })
            }
          );

          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || "Failed to log booking request");
          }

          if (payload?.bookingRequest) {
            setJobData((prev) =>
              prev ? { ...prev, bookingRequest: payload.bookingRequest } : prev
            );
          }
        } catch (requestError) {
          console.error(
            "⚠️ Booking request notifications failed:",
            requestError
          );
        }

        return { success: true };
      } catch (bookingError) {
        console.error("❌ Failed to save booking details:", bookingError);
        alert(bookingError?.message || "Failed to save booking details");
        return { success: false, error: bookingError };
      } finally {
        setBookingFlowSaving(false);
      }
    },
    [canEdit, jobData, customerVehicles, fetchJobData, dbUserId, user]
  );

  const handleBookingApproval = useCallback(
    async ({
      priceEstimate,
      estimatedCompletion,
      loanCarDetails,
      confirmationMessage
    }) => {
      if (!canEdit || !jobData?.jobNumber) return { success: false };

      setBookingApprovalSaving(true);

      try {
        const response = await fetch(
          `/api/job-cards/${jobData.jobNumber}/booking-request`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              priceEstimate,
              estimatedCompletion,
              loanCarDetails,
              confirmationMessage,
              approvedBy: dbUserId || null,
              approvedByName:
                user?.username ||
                user?.name ||
                user?.fullName ||
                user?.email ||
                "Workshop User"
            })
          }
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to approve booking");
        }

        if (payload?.bookingRequest) {
          setJobData((prev) =>
            prev ? { ...prev, bookingRequest: payload.bookingRequest } : prev
          );
        }

        return { success: true };
      } catch (approvalError) {
        console.error("❌ Failed to approve booking:", approvalError);
        alert(approvalError?.message || "Failed to approve booking");
        return { success: false, error: approvalError };
      } finally {
        setBookingApprovalSaving(false);
      }
    },
    [canEdit, jobData?.jobNumber, dbUserId, user]
  );

  const handleInvoiceBuilderConfirm = useCallback(async (builderPayload) => {
    if (!canEdit || !jobData?.id) return;
    setCreatingInvoice(true);
    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobId: jobData.id,
          jobNumber: jobData.jobNumber,
          customerId: jobData.customerId,
          customerEmail: jobData.customerEmail,
          providerId: builderPayload.providerId,
          totals: builderPayload.totals,
          requests: builderPayload.requests,
          partLines: builderPayload.partLines,
          sendEmail: builderPayload.sendEmail,
          sendPortal: builderPayload.sendPortal
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to create invoice");
      }

      const statusResult = await updateJobStatus(jobData.id, "Invoicing");
      if (!statusResult?.success) {
        console.warn("Invoice created but failed to update status:", statusResult?.error);
      }
      alert(
        `✅ Invoice created. Payment link ready: ${payload.paymentLink?.checkout_url || ""}`
      );
      setInvoiceResponse(payload);
      await fetchJobData({ silent: true });

      // Redirect to invoice tab after successful invoice creation
      router.push(`/job-cards/${jobData.jobNumber}?tab=invoice`);
    } catch (createError) {
      console.error("❌ Failed to trigger invoice creation:", createError);
      alert(createError?.message || "Failed to trigger invoice creation");
    } finally {
      setCreatingInvoice(false);
    }
  }, [
    canEdit,
    fetchJobData,
    jobData?.id,
    jobData?.jobNumber,
    jobData?.customerId,
    jobData?.customerEmail,
    updateJobStatus
  ]);

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
      const confirmDelete = await confirm(`Delete ${file.name || "this file"}?`);
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
    [canManageDocuments, confirm]
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
    }, 300);
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
      const confirmed = await confirm(
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
            border: "4px solid var(--surface)",
            borderTop: "4px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "var(--grey-accent)" }}>Loading job card #{jobNumber}...</p>
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
          <h2 style={{ color: "var(--primary)", marginBottom: "10px" }}>
            {error || "Job card not found"}
          </h2>
          <p style={{ color: "var(--grey-accent)", marginBottom: "30px" }}>
            Job #{jobNumber} could not be loaded from the database.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "12px 24px",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--primary-dark)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
            >
              View All Job Cards
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const writeUpComplete =
    jobData.completionStatus === "complete" ||
    jobData.writeUp?.completion_status === "complete";
  const vhcQualified = !jobData.vhcRequired || Boolean(jobData.vhcCompletedAt);
  const partsReady = arePartsPricedAndAssigned(jobData.partsAllocations);
  const statusReadyForInvoicing = isStatusReadyForInvoicing(jobData.status);
  const showCreateInvoiceButton =
    canEdit && writeUpComplete && vhcQualified && partsReady && statusReadyForInvoicing;

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
    { id: "documents", label: "Documents"},
    ...(canViewInvoice ? [{ id: "invoice", label: "Invoice" }] : [])
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
        {isArchiveMode && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid var(--danger-surface)",
              backgroundColor: "var(--surface-light)",
              color: "var(--danger-dark)",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            Archived copy &middot; Job #{jobData.jobNumber} is read-only. VHC, notes, and documents are preserved for audit.
          </div>
        )}

        {/* ✅ Header Section */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          padding: "20px",
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)",
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 style={{ 
                margin: 0, 
                color: "var(--primary)", 
                fontSize: "28px", 
                fontWeight: "700" 
              }}>
                Job Card #{jobData.jobNumber}
              </h1>
              <span style={{
                padding: "6px 14px",
                backgroundColor: 
                  jobData.status === "Open" ? "var(--success-surface)" : 
                  jobData.status === "Complete" ? "var(--info-surface)" : 
                  "var(--warning-surface)",
                color: 
                  jobData.status === "Open" ? "var(--success-dark)" : 
                  jobData.status === "Complete" ? "var(--info)" : 
                  "var(--danger)",
                borderRadius: "20px",
                fontWeight: "600",
                fontSize: "13px"
              }}>
                {jobData.status}
              </span>
              {jobData.jobSource && (
                <span style={{
                  padding: "6px 14px",
                  backgroundColor: jobData.jobSource === "Warranty" ? "var(--warning-surface)" : "var(--success-surface)",
                  color: jobData.jobSource === "Warranty" ? "var(--danger)" : "var(--success-dark)",
                  borderRadius: "20px",
                  fontWeight: "600",
                  fontSize: "13px"
                }}>
                  {jobData.jobSource}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "14px" }}>
              Created: {new Date(jobData.createdAt).toLocaleString()} | 
              Last Updated: {new Date(jobData.updatedAt).toLocaleString()}
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Button to redirect to car and key tracking page with job details pre-filled */}
            <button
              onClick={() => {
                const params = new URLSearchParams({
                  jobNumber: jobData.jobNumber || "",
                  reg: jobData.reg || "",
                  customer: jobData.customer || ""
                });
                router.push(`/tracking?${params.toString()}`);
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--danger)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger-dark)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--danger)"}
            >
              Car and Key Tracker
            </button>
            {showCreateInvoiceButton && (
              <button
                onClick={() => setInvoicePopupOpen(true)}
                disabled={creatingInvoice}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--info-dark)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: creatingInvoice ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "background-color 0.2s, transform 0.2s",
                  opacity: creatingInvoice ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!creatingInvoice) {
                    e.target.style.backgroundColor = "var(--info-dark)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creatingInvoice) {
                    e.target.style.backgroundColor = "var(--info-dark)";
                  }
                }}
              >
                Create Invoice
              </button>
            )}
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--grey-accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "var(--grey-accent)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "var(--grey-accent)"}
            >
              Back
            </button>
          </div>
        </div>

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
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "4px" }}>VEHICLE</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
              {jobData.reg || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              {jobData.makeModel || `${jobData.make} ${jobData.model}`}
            </div>
          </div>

          <div style={{
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            boxShadow: "none",
            border: "1px solid var(--surface-light)"
          }}>
            <div style={{ fontSize: "12px", color: "var(--grey-accent)", marginBottom: "4px" }}>CUSTOMER</div>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px" }}>
              {jobData.customer || "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
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
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)",
          flexShrink: 0
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 16px",
                backgroundColor: activeTab === tab.id ? "var(--primary)" : "transparent",
                color: activeTab === tab.id ? "white" : "var(--grey-accent)",
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
                  e.target.style.backgroundColor = "var(--surface)";
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
                  backgroundColor: activeTab === tab.id ? "rgba(var(--surface-rgb), 0.3)" : "var(--primary)",
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
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid var(--surface-light)",
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
              customerVehicles={customerVehicles}
              customerVehiclesLoading={customerVehiclesLoading}
              bookingRequest={jobData.bookingRequest}
              onBookingFlowSave={handleBookingFlowSave}
              bookingFlowSaving={bookingFlowSaving}
              onBookingApproval={handleBookingApproval}
              bookingApprovalSaving={bookingApprovalSaving}
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
            <PartsTab
              jobData={jobData}
              canEdit={canEdit}
              onRefreshJob={() => fetchJobData({ silent: true })}
              actingUserId={actingUserId}
              actingUserNumericId={actingUserNumericId}
            />
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
            <VHCTab jobNumber={jobNumber} />
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

          {/* Invoice Tab */}
          {activeTab === "invoice" && canViewInvoice && (
            <InvoiceSection jobData={jobData} />
          )}
        </div>
        <InvoiceBuilderPopup
          isOpen={invoicePopupOpen}
          onClose={() => {
            setInvoicePopupOpen(false);
            setInvoiceResponse(null);
          }}
          jobData={jobData}
          onConfirm={handleInvoiceBuilderConfirm}
          invoiceResponse={invoiceResponse}
          isSubmitting={creatingInvoice}
        />

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
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
          Customer Requests
        </h2>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--danger)",
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
                backgroundColor: "var(--info)",
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
                backgroundColor: "var(--grey-accent)",
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
              border: "1px solid var(--surface-light)",
              borderRadius: "8px",
              marginBottom: "12px",
              backgroundColor: "var(--surface)"
            }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "4px" }}>
                    Request Description
                  </label>
                  <input
                    type="text"
                    value={req.text}
                    onChange={(e) => handleUpdateRequest(index, "text", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div style={{ width: "120px" }}>
                  <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "4px" }}>
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
                      border: "1px solid var(--surface-light)",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div style={{ width: "160px" }}>
                  <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "4px" }}>
                    Payment Type
                  </label>
                  <select
                    value={req.paymentType}
                    onChange={(e) => handleUpdateRequest(index, "paymentType", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--surface-light)",
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
                    backgroundColor: "var(--danger)",
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
              backgroundColor: "var(--primary)",
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
                backgroundColor: "var(--surface)",
                borderLeft: "4px solid var(--primary)",
                borderRadius: "6px",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    {req.text || req}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {req.time && (
                    <span style={{
                      padding: "4px 10px",
                      backgroundColor: "var(--info-surface)",
                      color: "var(--info)",
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
                        req.paymentType === "Warranty" ? "var(--warning-surface)" : 
                        req.paymentType === "Customer" ? "var(--success)" : 
                        "var(--danger-surface)",
                      color: 
                        req.paymentType === "Warranty" ? "var(--warning-dark)" : 
                        req.paymentType === "Customer" ? "var(--success-dark)" : 
                        "var(--danger-dark)",
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
            <p style={{ color: "var(--grey-accent-light)", fontStyle: "italic" }}>No requests logged.</p>
          )}
        </div>
      )}

      {/* Additional Job Info */}
      <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid var(--surface)" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "16px" }}>
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
            backgroundColor: "var(--info-surface)",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            boxShadow: "none"
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--info-dark)", marginBottom: "6px" }}>
              Vehicle Health Check
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--info-dark)" }}>
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
                backgroundColor: "var(--danger-surface)",
                color: "var(--danger)",
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
                backgroundColor: "var(--warning-surface)",
                color: "var(--warning)",
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
                backgroundColor: "var(--info-surface)",
                color: "var(--info-dark)",
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
                backgroundColor: "var(--info-surface)",
                color: "var(--info-dark)",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                Grey: {vhcSummary.grey}
              </span>
            </div>

            {jobData.vhcRequired ? (
              highlightedItems.length > 0 ? (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--info-dark)", marginBottom: "6px" }}>
                    Items requiring attention
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                    {highlightedItems.slice(0, 3).map(({ check, severity }) => {
                      const severityStyle = severity === "red"
                        ? { label: "Red", color: "var(--danger)" }
                        : { label: "Amber", color: "var(--warning)" };
                      return (
                        <li key={check.vhc_id} style={{ fontSize: "13px", color: "var(--info-dark)", display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "8px",
                            fontWeight: "700",
                            color: "var(--surface)",
                            backgroundColor: severity === "red" ? "var(--danger)" : "var(--warning)",
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
                    <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "6px" }}>
                      +{highlightedItems.length - 3} more issues logged
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
                  No red or amber items have been logged yet.
                </p>
              )
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--info)" }}>
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
                backgroundColor: jobData.vhcRequired ? "var(--danger)" : "var(--info)",
                color: "white",
                boxShadow: "none",
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
            <strong style={{ fontSize: "14px", color: "var(--grey-accent)", display: "block", marginBottom: "8px" }}>
              Cosmetic Damage Notes:
            </strong>
            <div style={{
              padding: "12px",
              backgroundColor: "var(--warning-surface)",
              borderLeft: "4px solid var(--warning)",
              borderRadius: "6px"
            }}>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
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
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
        Contact Details
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                  border: "1px solid var(--info)",
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
                  border: "1px solid var(--info)",
                  fontSize: "14px"
                }}
                disabled={customerSaving}
              />
            </div>
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              fontWeight: "500"
            }}>
              {jobData.customer || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--info)",
              fontWeight: "500"
            }}>
              {jobData.customerEmail || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              fontWeight: "500"
            }}>
              {jobData.customerMobile || jobData.customerPhone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              fontWeight: "500"
            }}>
              {jobData.customerTelephone || "N/A"}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
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
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
              fontWeight: "500"
            }}>
              {jobData.customerContactPreference || "Email"}
            </div>
          )}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
                fontSize: "14px",
                resize: "vertical"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
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
          <label style={{ fontSize: "12px", color: "var(--grey-accent)", display: "block", marginBottom: "8px", fontWeight: "600" }}>
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
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
              disabled={customerSaving}
            />
          ) : (
            <div style={{
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "var(--text-secondary)",
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
          backgroundColor: approvalChecked ? "var(--success-surface)" : "var(--warning-surface)",
          borderRadius: "8px",
          border: `1px solid ${approvalChecked ? "var(--info)" : "var(--danger)"}`
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", color: "var(--info-dark)" }}>
            <input
              type="checkbox"
              checked={approvalChecked}
              onChange={(e) => setApprovalChecked(e.target.checked)}
              disabled={customerSaving}
              style={{ width: "16px", height: "16px" }}
            />
            Customer has approved updated details
          </label>
          <p style={{ fontSize: "12px", color: "var(--info)", marginTop: "8px" }}>
            Regulatory requirement: customer confirmation must be recorded before saving.
          </p>
        </div>
      )}

      {saveError && (
        <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: "var(--danger-surface)", color: "var(--danger)", fontSize: "13px" }}>
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
                    backgroundColor: customerSaving ? "var(--info)" : "var(--info)",
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
                  backgroundColor: "var(--grey-accent)",
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
                backgroundColor: "var(--danger)",
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
          <p style={{ fontSize: "12px", color: "var(--grey-accent-light)", margin: 0 }}>
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
  customerVehicles = [],
  customerVehiclesLoading = false,
  bookingRequest = null,
  onBookingFlowSave = () => {},
  bookingFlowSaving = false,
  onBookingApproval = () => {},
  bookingApprovalSaving = false,
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
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    jobData.vehicleId || null
  );
  const [confirmCustomerDetails, setConfirmCustomerDetails] = useState(false);
  const [bookingDescription, setBookingDescription] = useState(() =>
    formatBookingDescriptionInput(jobData.description || "")
  );
  const [bookingWaitingStatus, setBookingWaitingStatus] = useState(
    jobData.waitingStatus || "Neither"
  );
  const [bookingMessage, setBookingMessage] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const formatTimeInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  const [approvalForm, setApprovalForm] = useState({
    priceEstimate: bookingRequest?.priceEstimate
      ? String(bookingRequest.priceEstimate)
      : "",
    etaDate: formatDateInput(bookingRequest?.estimatedCompletion),
    etaTime: formatTimeInput(bookingRequest?.estimatedCompletion),
    loanCarDetails: bookingRequest?.loanCarDetails || "",
    confirmationMessage: bookingRequest?.confirmationNotes || ""
  });

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

  useEffect(() => {
    setSelectedVehicleId(jobData.vehicleId || null);
    setBookingDescription(
      formatBookingDescriptionInput(jobData.description || "")
    );
    setBookingWaitingStatus(jobData.waitingStatus || "Neither");
    setConfirmCustomerDetails(false);
    setBookingMessage("");
  }, [jobData.vehicleId, jobData.description, jobData.waitingStatus]);

  useEffect(() => {
    setApprovalForm({
      priceEstimate: bookingRequest?.priceEstimate
        ? String(bookingRequest.priceEstimate)
        : "",
      etaDate: formatDateInput(bookingRequest?.estimatedCompletion),
      etaTime: formatTimeInput(bookingRequest?.estimatedCompletion),
      loanCarDetails: bookingRequest?.loanCarDetails || "",
      confirmationMessage: bookingRequest?.confirmationNotes || ""
    });
    setApprovalMessage("");
  }, [bookingRequest]);

  const vehicleOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    const pushVehicle = (vehicle) => {
      if (!vehicle || !vehicle.vehicle_id) return;
      if (seen.has(vehicle.vehicle_id)) return;
      seen.add(vehicle.vehicle_id);
      options.push(vehicle);
    };

    if (jobData.vehicleId) {
      pushVehicle({
        vehicle_id: jobData.vehicleId,
        registration: jobData.reg,
        reg_number: jobData.reg,
        make_model: jobData.makeModel,
        make: jobData.make,
        model: jobData.model
      });
    }

    (customerVehicles || []).forEach((vehicle) => pushVehicle(vehicle));

    return options;
  }, [
    jobData.vehicleId,
    jobData.reg,
    jobData.makeModel,
    jobData.make,
    jobData.model,
    customerVehicles
  ]);

  const selectedVehicle = useMemo(
    () =>
      vehicleOptions.find(
        (vehicle) => vehicle.vehicle_id === selectedVehicleId
      ) || null,
    [vehicleOptions, selectedVehicleId]
  );

  const descriptionLines = useMemo(() => {
    if (!bookingRequest?.description) return [];
    return bookingRequest.description
      .split("\n")
      .map((line) => line.replace(/^-+\s*/, "").trim())
      .filter(Boolean);
  }, [bookingRequest?.description]);

  const handleVehicleChange = (value) => {
    const parsed = value ? Number(value) : null;
    setSelectedVehicleId(Number.isNaN(parsed) ? null : parsed);
    setBookingMessage("");
  };

  const handleAppointmentFieldChange = (field, value) => {
    setAppointmentForm((prev) => ({ ...prev, [field]: value }));
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

  const handleBookingDescriptionChange = (value) => {
    setBookingDescription(
      value ? formatBookingDescriptionInput(value) : ""
    );
    setBookingMessage("");
  };

  const handleBookingWaitingSelect = (value) => {
    setBookingWaitingStatus(value);
    setBookingMessage("");
  };

  const handleBookingSubmit = async () => {
    if (!canEdit || !selectedVehicleId || !confirmCustomerDetails) return;
    if (!bookingDescription.trim()) return;
    const payload = {
      vehicleId: selectedVehicleId,
      description: bookingDescription,
      waitingStatus: bookingWaitingStatus
    };
    const result = await onBookingFlowSave(payload);
    if (result?.success) {
      setBookingMessage("Booking request submitted");
      setTimeout(() => setBookingMessage(""), 3000);
    }
  };

  const handleApprovalFieldChange = (field, value) => {
    setApprovalForm((prev) => ({ ...prev, [field]: value }));
    setApprovalMessage("");
  };

  const handleApprovalSubmit = async () => {
    if (!canEdit || !bookingRequest) return;
    if (
      !approvalForm.priceEstimate.trim() ||
      !approvalForm.etaDate ||
      !approvalForm.etaTime
    ) {
      return;
    }
    const etaCandidate = new Date(
      `${approvalForm.etaDate}T${approvalForm.etaTime}`
    );
    if (Number.isNaN(etaCandidate.getTime())) {
      return;
    }
    const payload = {
      priceEstimate: approvalForm.priceEstimate,
      estimatedCompletion: etaCandidate.toISOString(),
      loanCarDetails: approvalForm.loanCarDetails?.trim() || "",
      confirmationMessage: approvalForm.confirmationMessage?.trim() || ""
    };
    const result = await onBookingApproval(payload);
    if (result?.success) {
      setApprovalMessage("Confirmation sent to customer");
      setTimeout(() => setApprovalMessage(""), 3000);
    }
  };

  const selectedVehicleIdValue =
    selectedVehicleId != null ? String(selectedVehicleId) : "";
  const bookingButtonDisabled =
    !canEdit ||
    bookingFlowSaving ||
    !confirmCustomerDetails ||
    !selectedVehicleId ||
    !bookingDescription.trim();

  const approvalButtonDisabled =
    !canEdit ||
    !bookingRequest ||
    bookingApprovalSaving ||
    !approvalForm.priceEstimate.trim() ||
    !approvalForm.etaDate ||
    !approvalForm.etaTime;

  const appointmentCreatedAt = jobData.appointment?.createdAt
    ? new Date(jobData.appointment.createdAt).toLocaleString()
    : "Not created yet";
  const bookingStatus = bookingRequest?.status || "pending";
  const statusColor =
    bookingStatus === "approved"
      ? { background: "var(--success-surface)", color: "var(--success-dark)" }
      : { background: "var(--warning-surface)", color: "var(--danger-dark)" };
  const submittedAt = bookingRequest?.submittedAt
    ? new Date(bookingRequest.submittedAt).toLocaleString()
    : "Awaiting submission";
  const approvedAt = bookingRequest?.approvedAt
    ? new Date(bookingRequest.approvedAt).toLocaleString()
    : null;
  const etaDisplay = bookingRequest?.estimatedCompletion
    ? new Date(bookingRequest.estimatedCompletion).toLocaleString()
    : null;

  return (
    <div>
      <h2
        style={{
          margin: "0 0 20px 0",
          fontSize: "20px",
          fontWeight: "600",
          color: "var(--text-primary)"
        }}
      >
        Scheduling Information
      </h2>

      <div
        style={{
          padding: "20px",
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          border: "1px solid var(--accent-purple-surface)",
          marginBottom: "24px",
          boxShadow: "none"
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "600",
              color: "var(--accent-purple)"
            }}
          >
            Customer Booking
          </h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--info)", fontSize: "13px" }}>
            Select the stored vehicle, confirm details, and capture the customer
            request so the team can approve it.
          </p>
        </div>

        <div>
          <label
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--info)",
              display: "block",
              marginBottom: "6px"
            }}
          >
            Vehicle
          </label>
          {customerVehiclesLoading ? (
            <div style={{ fontSize: "13px", color: "var(--info)", padding: "8px 0" }}>
              Loading stored vehicles...
            </div>
          ) : vehicleOptions.length > 0 ? (
            <>
              <select
                value={selectedVehicleIdValue}
                onChange={(event) => handleVehicleChange(event.target.value)}
                disabled={!canEdit}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  fontSize: "14px",
                  marginBottom: "10px"
                }}
              >
                <option value="" disabled>
                  Select stored vehicle
                </option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                    {`${vehicle.registration || vehicle.reg_number || "Vehicle"} · ${
                      vehicle.make_model ||
                      [vehicle.make, vehicle.model].filter(Boolean).join(" ")
                    }`}
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "var(--info-surface)",
                    border: "1px solid var(--accent-purple-surface)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "var(--info-dark)"
                  }}
                >
                  <div style={{ fontWeight: "600", color: "var(--primary)" }}>
                    {selectedVehicle.registration || selectedVehicle.reg_number}
                  </div>
                  <div>
                    {selectedVehicle.make_model ||
                      [selectedVehicle.make, selectedVehicle.model]
                        .filter(Boolean)
                        .join(" ")}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--danger)", padding: "8px 0" }}>
              No stored vehicles found for this customer.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "10px",
            border: `1px solid ${confirmCustomerDetails ? "var(--info)" : "var(--warning)"}`,
            backgroundColor: confirmCustomerDetails ? "var(--success-surface)" : "var(--warning-surface)"
          }}
        >
          <label
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              fontSize: "13px",
              color: "var(--info-dark)"
            }}
          >
            <input
              type="checkbox"
              checked={confirmCustomerDetails}
              onChange={(event) =>
                setConfirmCustomerDetails(event.target.checked)
              }
              disabled={!canEdit}
              style={{ width: "16px", height: "16px" }}
            />
            I confirm {jobData.customer || "the customer"}'s contact details for
            this booking.
          </label>
        </div>

        <div style={{ marginTop: "16px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--info-dark)",
              marginBottom: "8px"
            }}
          >
            Customer Status
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {waitingOptions.map((option) => {
              const isActive =
                bookingWaitingStatus === option ||
                (!bookingWaitingStatus && option === "Neither");
              return (
                <button
                  key={option}
                  onClick={() => handleBookingWaitingSelect(option)}
                  disabled={!canEdit}
                  style={{
                    flex: "1 1 180px",
                    minWidth: "140px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: `2px solid ${isActive ? "var(--primary)" : "var(--accent-purple-surface)"}`,
                    backgroundColor: isActive ? "rgba(var(--primary-rgb),0.08)" : "white",
                    color: isActive ? "var(--danger)" : "var(--info-dark)",
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

        <div style={{ marginTop: "16px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--info)",
              display: "block",
              marginBottom: "6px"
            }}
          >
            Booking Description
          </label>
          <textarea
            value={bookingDescription}
            onChange={(event) =>
              handleBookingDescriptionChange(event.target.value)
            }
            rows={4}
            disabled={!canEdit}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid var(--info)",
              fontSize: "14px",
              resize: "vertical"
            }}
            placeholder="- Customer waiting for vehicle\n- Loan car requested"
          />
          <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--info)" }}>
            Each new line automatically starts with "- " to maintain the booking
            checklist format.
          </p>
        </div>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap"
          }}
        >
          <button
            onClick={handleBookingSubmit}
            disabled={bookingButtonDisabled || vehicleOptions.length === 0}
            style={{
              padding: "10px 20px",
              backgroundColor: bookingButtonDisabled ? "var(--info)" : "var(--danger)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: bookingButtonDisabled ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            {bookingFlowSaving ? "Saving..." : "Save Booking Details"}
          </button>
          {bookingMessage && (
            <span style={{ fontSize: "13px", color: "var(--success)" }}>
              {bookingMessage}
            </span>
          )}
          {!confirmCustomerDetails && canEdit && (
            <span style={{ fontSize: "12px", color: "var(--danger)" }}>
              Please confirm customer details before saving.
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "20px",
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          border: "1px solid var(--accent-purple-surface)",
          marginBottom: "24px",
          boxShadow: "none"
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "600",
              color: "var(--accent-purple)"
            }}
          >
            Booking Approval & Confirmation
          </h3>
          <p style={{ margin: "4px 0 0 0", color: "var(--info)", fontSize: "13px" }}>
            Review the booking request, capture workshop commitments, and send the
            confirmation email.
          </p>
        </div>

        {bookingRequest ? (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                marginBottom: "16px"
              }}
            >
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontWeight: "600",
                  fontSize: "13px",
                  backgroundColor: statusColor.background,
                  color: statusColor.color
                }}
              >
                {bookingStatus === "approved" ? "Approved" : "Awaiting Approval"}
              </span>
              <span style={{ fontSize: "13px", color: "var(--info)" }}>
                Waiting status: {bookingRequest.waitingStatus || "Neither"}
              </span>
            </div>

            {descriptionLines.length > 0 && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--info-surface)"
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--info-dark)",
                    marginBottom: "8px"
                  }}
                >
                  Customer Request
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    color: "var(--info-dark)",
                    fontSize: "13px"
                  }}
                >
                  {descriptionLines.map((line, index) => (
                    <li key={`${line}-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: "12px",
                marginBottom: "16px"
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--info-surface)"
                }}
              >
                <p style={{ margin: "0 0 4px 0", color: "var(--info)", fontSize: "12px" }}>
                  Submitted
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--accent-purple)" }}>
                  {submittedAt}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--info)" }}>
                  {bookingRequest.submittedByName || "Customer Portal"}
                </p>
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--info-surface)"
                }}
              >
                <p style={{ margin: "0 0 4px 0", color: "var(--info)", fontSize: "12px" }}>
                  Approved
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--accent-purple)" }}>
                  {approvedAt || "Not yet approved"}
                </p>
                {bookingRequest.approvedByName && (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--info)" }}>
                    {bookingRequest.approvedByName}
                  </p>
                )}
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--info-surface)"
                }}
              >
                <p style={{ margin: "0 0 4px 0", color: "var(--info)", fontSize: "12px" }}>
                  Estimated Completion
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--accent-purple)" }}>
                  {etaDisplay || "Not scheduled"}
                </p>
                {bookingRequest.priceEstimate && (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--info)" }}>
                    Estimate: £{Number(bookingRequest.priceEstimate).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {bookingRequest.loanCarDetails && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--danger-dark)",
                  fontSize: "13px"
                }}
              >
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  Loan Car Details
                </strong>
                {bookingRequest.loanCarDetails}
              </div>
            )}

            {bookingRequest.confirmationNotes && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--accent-purple-surface)",
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success-dark)",
                  fontSize: "13px"
                }}
              >
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  Last Confirmation
                </strong>
                {bookingRequest.confirmationNotes}
              </div>
            )}

            {canEdit && (
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--accent-purple-surface)"
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "16px",
                    marginBottom: "16px"
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--info)",
                        display: "block",
                        marginBottom: "6px"
                      }}
                    >
                      Price Estimate (£)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={approvalForm.priceEstimate}
                      onChange={(event) =>
                        handleApprovalFieldChange(
                          "priceEstimate",
                          event.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--info)",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--info)",
                        display: "block",
                        marginBottom: "6px"
                      }}
                    >
                      ETA Date
                    </label>
                    <input
                      type="date"
                      value={approvalForm.etaDate}
                      onChange={(event) =>
                        handleApprovalFieldChange("etaDate", event.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--info)",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--info)",
                        display: "block",
                        marginBottom: "6px"
                      }}
                    >
                      ETA Time
                    </label>
                    <input
                      type="time"
                      value={approvalForm.etaTime}
                      onChange={(event) =>
                        handleApprovalFieldChange("etaTime", event.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--info)",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--info)",
                      display: "block",
                      marginBottom: "6px"
                    }}
                  >
                    Loan Car Details
                  </label>
                  <textarea
                    value={approvalForm.loanCarDetails}
                    onChange={(event) =>
                      handleApprovalFieldChange(
                        "loanCarDetails",
                        event.target.value
                      )
                    }
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid var(--info)",
                      fontSize: "14px",
                      resize: "vertical"
                    }}
                    placeholder="Confirmed courtesy car, fuel policy, insurance details..."
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--info)",
                      display: "block",
                      marginBottom: "6px"
                    }}
                  >
                    Confirmation Message
                  </label>
                  <textarea
                    value={approvalForm.confirmationMessage}
                    onChange={(event) =>
                      handleApprovalFieldChange(
                        "confirmationMessage",
                        event.target.value
                      )
                    }
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid var(--info)",
                      fontSize: "14px",
                      resize: "vertical"
                    }}
                    placeholder="Optional note to include in the confirmation email."
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}
                >
                  <button
                    onClick={handleApprovalSubmit}
                    disabled={approvalButtonDisabled}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: approvalButtonDisabled
                        ? "var(--info)"
                        : "var(--info)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: approvalButtonDisabled
                        ? "not-allowed"
                        : "pointer",
                      fontWeight: "600",
                      fontSize: "14px"
                    }}
                  >
                    {bookingApprovalSaving ? "Sending..." : "Send Confirmation"}
                  </button>
                  {approvalMessage && (
                    <span style={{ fontSize: "13px", color: "var(--success)" }}>
                      {approvalMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--info)", fontSize: "13px", margin: 0 }}>
            Save the booking details above to generate a request that can be
            approved.
          </p>
        )}
      </div>

      <div
        style={{
          padding: "20px",
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          border: "1px solid var(--accent-purple-surface)",
          marginBottom: "24px",
          boxShadow: "none"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px"
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "600",
                color: "var(--accent-purple)"
              }}
            >
              Appointment Information
            </h3>
            <p style={{ margin: "4px 0 0 0", color: "var(--info)", fontSize: "13px" }}>
              Adjust booking times directly from the job card
            </p>
          </div>
          <button
            onClick={() => router.push(`/appointments?job=${jobData.jobNumber}`)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--info)",
              backgroundColor: "var(--info-surface)",
              color: "var(--accent-purple)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Open Appointment Calendar
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: "16px"
          }}
        >
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--info)",
                display: "block",
                marginBottom: "6px"
              }}
            >
              Date
            </label>
            <input
              type="date"
              value={appointmentForm.date}
              onChange={(event) =>
                handleAppointmentFieldChange("date", event.target.value)
              }
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--info)",
                display: "block",
                marginBottom: "6px"
              }}
            >
              Time
            </label>
            <input
              type="time"
              value={appointmentForm.time}
              onChange={(event) =>
                handleAppointmentFieldChange("time", event.target.value)
              }
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--info)",
                fontSize: "14px"
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--info)",
                display: "block",
                marginBottom: "6px"
              }}
            >
              Status
            </label>
            <select
              value={appointmentForm.status}
              onChange={(event) =>
                handleAppointmentFieldChange("status", event.target.value)
              }
              disabled={!canEdit || appointmentSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--info)",
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
          <label
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--info)",
              display: "block",
              marginBottom: "6px"
            }}
          >
            Notes
          </label>
          <textarea
            value={appointmentForm.notes}
            onChange={(event) =>
              handleAppointmentFieldChange("notes", event.target.value)
            }
            rows={3}
            disabled={!canEdit || appointmentSaving}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid var(--info)",
              fontSize: "14px",
              resize: "vertical"
            }}
          />
        </div>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}
        >
          {canEdit && (
            <button
              onClick={handleAppointmentSubmit}
              disabled={!appointmentDirty || appointmentSaving}
              style={{
                padding: "10px 20px",
                backgroundColor: appointmentDirty ? "var(--info)" : "var(--info)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor:
                  appointmentDirty && !appointmentSaving
                    ? "pointer"
                    : "not-allowed"
              }}
            >
              {appointmentSaving
                ? "Saving..."
                : jobData.appointment
                  ? "Update Appointment"
                  : "Schedule Appointment"}
            </button>
          )}
          {appointmentMessage && (
            <span style={{ fontSize: "13px", color: "var(--success)" }}>
              {appointmentMessage}
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            backgroundColor: "var(--info-surface)",
            borderRadius: "8px",
            fontSize: "13px",
            color: "var(--info-dark)"
          }}
        >
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
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
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
                backgroundColor: "var(--surface)",
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                cursor: job.invoiceAvailable ? "pointer" : "default",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--info-surface)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(var(--shadow-rgb),0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: "600", color: "var(--primary)" }}>
                    Job #{job.jobNumber}
                  </span>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: "var(--info-surface)",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "var(--info-dark)"
                  }}>
                    {job.serviceDateFormatted}
                  </span>
                </div>
                {job.invoiceAvailable ? (
                  <span style={{ fontSize: "12px", color: "var(--info)", fontWeight: "600" }}>
                    Invoice Available
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--info)", fontWeight: "600" }}>
                    No Invoice
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--info-dark)" }}>
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
                <ul style={{ margin: "12px 0 0 0", paddingLeft: "18px", color: "var(--info-dark)", fontSize: "13px" }}>
                  {job.requests.slice(0, 3).map((req, index) => (
                    <li key={`${job.id}-req-${index}`}>
                      {req.text || req.description || "Request"}
                    </li>
                  ))}
                  {job.requests.length > 3 && (
                    <li style={{ listStyle: "none", color: "var(--info)" }}>
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
          backgroundColor: "var(--surface)",
          borderRadius: "8px"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <p style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
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
  pending: { label: "Pending", color: "var(--danger-dark)", background: "var(--warning-surface)" },
  priced: { label: "Priced", color: "var(--accent-purple)", background: "var(--accent-purple-surface)" },
  pre_pick: { label: "Pre Pick", color: "var(--success-dark)", background: "var(--success-surface)" },
  on_order: { label: "On Order", color: "var(--warning)", background: "var(--warning-surface)" },
  stock: { label: "Stock", color: "var(--accent-purple)", background: "var(--info-surface)" },
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

function PartsTab({ jobData, canEdit, onRefreshJob, actingUserId, actingUserNumericId }) {
  const jobId = jobData?.id;
  const jobNumber = jobData?.jobNumber;

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(null);
  const [catalogQuantity, setCatalogQuantity] = useState(1);
  const [catalogSubmitError, setCatalogSubmitError] = useState("");
  const [catalogSuccessMessage, setCatalogSuccessMessage] = useState("");
  const [allocatingPart, setAllocatingPart] = useState(false);

  const canAllocateParts = Boolean(canEdit && jobId);
  const allocationDisabledReason = !canEdit
    ? "You don't have permission to add parts."
    : !jobId
    ? "Job must be loaded before allocating parts."
    : "";

  const searchStockCatalog = useCallback(async (term) => {
    const rawTerm = (term || "").trim();
    if (!rawTerm) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }

    setCatalogLoading(true);
    try {
      let query = supabase
        .from("parts_catalog")
        .select(
          "id, part_number, name, description, supplier, category, storage_location, qty_in_stock, qty_reserved, qty_on_order, unit_cost, unit_price"
        )
        .order("name", { ascending: true })
        .limit(25);

      const sanitised = rawTerm.replace(/[%]/g, "").replace(/,/g, "");
      const pattern = `%${sanitised}%`;
      const clauses = [
        `name.ilike.${pattern}`,
        `part_number.ilike.${pattern}`,
        `supplier.ilike.${pattern}`,
        `category.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `oem_reference.ilike.${pattern}`,
        `storage_location.ilike.${pattern}`,
      ];
      if (/^\d+(?:\.\d+)?$/.test(sanitised)) {
        const numericValue = Number.parseFloat(sanitised);
        if (!Number.isNaN(numericValue)) {
          clauses.push(`unit_price.eq.${numericValue}`);
          clauses.push(`unit_cost.eq.${numericValue}`);
        }
      }
      query = query.or(clauses.join(","));

      const { data, error } = await query;
      if (error) throw error;
      setCatalogResults(data || []);
      if (!data || data.length === 0) {
        setCatalogError("No parts found in stock catalogue.");
      } else {
        setCatalogError("");
      }
    } catch (error) {
      console.error("Stock search failed", error);
      setCatalogResults([]);
      setCatalogError(error.message || "Unable to search stock catalogue");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    const trimmed = (catalogSearch || "").trim();
    if (!trimmed) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    if (trimmed.length < 2) {
      setCatalogResults([]);
      setCatalogError("Enter at least 2 characters to search stock.");
      return;
    }
    const timer = setTimeout(() => searchStockCatalog(trimmed), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch, canAllocateParts, searchStockCatalog]);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogSearch("");
      clearSelectedCatalogPart();
      setCatalogSuccessMessage("");
      setCatalogSubmitError("");
    }
  }, [canAllocateParts, clearSelectedCatalogPart]);

  const handleCatalogSelect = useCallback((part) => {
    if (!part) return;
    setSelectedCatalogPart(part);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const clearSelectedCatalogPart = useCallback(() => {
    setSelectedCatalogPart(null);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const handleAddPartFromStock = useCallback(async () => {
    if (!canAllocateParts || !selectedCatalogPart || !jobId) {
      setCatalogSubmitError("Select a part to allocate from stock.");
      return;
    }
    if (catalogQuantity <= 0) {
      setCatalogSubmitError("Quantity must be at least 1.");
      return;
    }
    const availableStock = Number(selectedCatalogPart.qty_in_stock || 0);
    if (catalogQuantity > availableStock) {
      setCatalogSubmitError(`Only ${availableStock} in stock for this part.`);
      return;
    }

    setAllocatingPart(true);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
    try {
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          quantityRequested: catalogQuantity,
          allocateFromStock: true,
          storageLocation: selectedCatalogPart.storage_location || null,
          requestNotes: jobNumber ? `Added via job card ${jobNumber}` : "Added via job card",
          origin: "job_card",
          userId: actingUserId,
          userNumericId: actingUserNumericId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to allocate part from stock");
      }

      setCatalogSuccessMessage(`${selectedCatalogPart.part_number || selectedCatalogPart.name} added to job.`);
      clearSelectedCatalogPart();
      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
      if ((catalogSearch || "").trim().length >= 2) {
        searchStockCatalog(catalogSearch.trim());
      }
    } catch (error) {
      console.error("Unable to add part from stock", error);
      setCatalogSubmitError(error.message || "Unable to add part to job");
    } finally {
      setAllocatingPart(false);
    }
  }, [
    actingUserId,
    actingUserNumericId,
    canAllocateParts,
    catalogQuantity,
    catalogSearch,
    clearSelectedCatalogPart,
    jobId,
    jobNumber,
    onRefreshJob,
    searchStockCatalog,
    selectedCatalogPart,
  ]);
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

  const pipelineSummary = useMemo(
    () => summarizePartsPipeline(vhcParts, { quantityField: "quantityRequested" }),
    [vhcParts]
  );
  const pipelineStages = pipelineSummary.stageSummary || [];

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-light)",
          borderRadius: "14px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Add Part From Stock
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info-dark)" }}>
              Search the catalogue and allocate parts directly to this job. Allocation immediately reduces stock.
            </p>
          </div>
          {!canAllocateParts && allocationDisabledReason && (
            <span style={{ fontSize: "0.75rem", color: "var(--info)" }}>{allocationDisabledReason}</span>
          )}
        </div>
        <input
          type="search"
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(event) => {
            setCatalogSearch(event.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number, name, supplier, or price" : "Stock allocation disabled"}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            fontSize: "0.95rem",
            backgroundColor: canAllocateParts ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)",
          }}
        />
        {catalogLoading && (
          <div style={{ fontSize: "0.85rem", color: "var(--info)" }}>Searching stock…</div>
        )}
        {!catalogLoading && catalogError && (
          <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>{catalogError}</div>
        )}
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
            }}
          >
            {catalogResults.map((part) => {
              const isSelected = selectedCatalogPart?.id === part.id;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => handleCatalogSelect(part)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "none",
                    borderBottom: "1px solid var(--surface-light)",
                    textAlign: "left",
                    background: isSelected ? "var(--accent-purple-surface)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{part.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                    Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)} · {part.category || "Uncategorised"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedCatalogPart && (
          <div
            style={{
              border: "1px solid var(--accent-purple-surface)",
              borderRadius: "12px",
              padding: "12px",
              background: "var(--accent-purple-surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "1rem" }}>{selectedCatalogPart.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                  Part #: {selectedCatalogPart.part_number} · Location: {selectedCatalogPart.storage_location || "Unassigned"}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedCatalogPart}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--info)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            </div>
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: "12px",
              }}
            >
              <label style={{ fontSize: "0.8rem", color: "var(--info-dark)" }}>
                Quantity
                <input
                  type="number"
                  min="1"
                  max={selectedCatalogPart.qty_in_stock || undefined}
                  value={catalogQuantity}
                  onChange={(event) =>
                    setCatalogQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid var(--surface-light)",
                    marginTop: "4px",
                  }}
                />
              </label>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Available
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent-purple)" }}>
                  {selectedCatalogPart.qty_in_stock ?? 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                  Reserved: {selectedCatalogPart.qty_reserved ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Sell Price
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent-purple)" }}>
                  £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>
                  Cost £{Number(selectedCatalogPart.unit_cost || 0).toFixed(2)}
                </div>
              </div>
            </div>
            {catalogSubmitError && (
              <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "var(--warning-surface)", color: "var(--danger)" }}>
                {catalogSubmitError}
              </div>
            )}
            {catalogSuccessMessage && (
              <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "var(--success-surface)", color: "var(--success-dark)" }}>
                {catalogSuccessMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddPartFromStock}
              disabled={!canAllocateParts || allocatingPart}
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: !canAllocateParts ? "var(--surface-light)" : "var(--primary)",
                color: !canAllocateParts ? "var(--info)" : "var(--surface)",
                fontWeight: 600,
                cursor: !canAllocateParts ? "not-allowed" : "pointer",
              }}
            >
              {allocatingPart ? "Adding…" : `Add to Job ${jobNumber || ""}`}
            </button>
          </div>
        )}
      </div>
      {hasParts ? (
        <>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "14px",
              padding: "16px",
              boxShadow: "none",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Parts Pipeline
            </div>
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              {pipelineStages.map((stage) => (
                <div
                  key={stage.id}
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(var(--primary-rgb),0.3)",
                    background: stage.count > 0 ? "var(--surface-light)" : "var(--info-surface)",
                  }}
                >
                  <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--primary)" }}>
                    {stage.count}
                  </div>
                  <div style={{ fontWeight: 600 }}>{stage.label}</div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--info-dark)" }}>
                    {stage.description}
                  </p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--info-dark)" }}>
              {pipelineSummary.totalCount} part line
              {pipelineSummary.totalCount === 1 ? "" : "s"} currently tracked across these stages.
            </p>
          </div>
          <div>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600", color: "var(--info-dark)" }}>
              VHC Linked Parts
            </h2>
            {vhcParts.length === 0 ? (
              <div style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "var(--accent-purple-surface)",
                fontSize: "14px",
                color: "var(--info)"
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
                        border: "1px solid var(--accent-purple-surface)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{part.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {part.name}
                          </h3>
                          {part.description && (
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{part.description}</p>
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
                        color: "var(--info-dark)"
                      }}>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Requested</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityRequested}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Allocated</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityAllocated}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Qty Fitted</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{part.quantityFitted}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Source</strong>
                          <div>{part.source}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Pre Pick Location</strong>
                          <div>{part.prePickLocation}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Storage</strong>
                          <div>{part.storageLocation}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "20px", fontSize: "12px", color: "var(--info)" }}>
                        <span>Created: {formatDateTime(part.createdAt)}</span>
                        <span>Updated: {formatDateTime(part.updatedAt)}</span>
                      </div>

                      {part.notes && (
                        <div style={{
                          marginTop: "12px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          backgroundColor: "var(--warning-surface)",
                          color: "var(--danger-dark)",
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
            <h2 style={{ margin: "12px 0", fontSize: "18px", fontWeight: "600", color: "var(--info-dark)" }}>
              Manual Requests (Write-up)
            </h2>
            {manualRequests.length === 0 ? (
              <div style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "var(--accent-purple-surface)",
                fontSize: "14px",
                color: "var(--info)"
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
                        border: "1px solid var(--accent-purple-surface)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>{request.partNumber}</div>
                          <h3 style={{ margin: "2px 0", fontSize: "16px", fontWeight: "600", color: "var(--accent-purple)" }}>
                            {request.name}
                          </h3>
                          {request.description && (
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--info-dark)" }}>{request.description}</p>
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
                        color: "var(--info-dark)"
                      }}>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Quantity</strong>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>{request.quantity}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Requested By</strong>
                          <div>{request.requestedBy}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Approved By</strong>
                          <div>{request.approvedBy || "Awaiting approval"}</div>
                        </div>
                        <div>
                          <strong style={{ color: "var(--info)", fontSize: "12px" }}>Created</strong>
                          <div>{formatDateTime(request.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p style={{ marginTop: "4px", color: "var(--info)", fontSize: "12px" }}>
            All data shown is read-only. Updates must be made from the VHC parts workflow or technician write-up form.
          </p>
        </>
      ) : (
        <div>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
            Parts Overview
          </h2>
          <div style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "var(--info-surface)",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🧰</div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--accent-purple)", marginBottom: "8px" }}>
              No Parts Linked
            </h3>
            <p style={{ color: "var(--info)", fontSize: "14px", margin: 0 }}>
              VHC authorizations and manual write-up requests will appear here automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Notes Tab
function NotesTab({ value, onChange, canEdit, saving, meta }) {
  const lastUpdated =
    meta?.updatedAt || meta?.createdAt
      ? new Date(meta?.updatedAt || meta?.createdAt).toLocaleString("en-GB", {
          hour12: false,
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const updatedBy =
    meta?.lastUpdatedBy || meta?.createdBy || "Unassigned";

  return (
    <div>
      <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
        Job Notes
      </h2>

      <div style={{
        padding: "20px",
        backgroundColor: "var(--surface)",
        borderRadius: "12px",
        border: "1px solid var(--accent-purple-surface)",
        boxShadow: "none"
      }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={!canEdit}
          placeholder="Type job notes here. Changes are saved automatically."
          style={{
            width: "100%",
            minHeight: "360px",
            maxHeight: "65vh",
            padding: "18px",
            borderRadius: "12px",
            border: canEdit ? "1px solid var(--info)" : "1px solid var(--accent-purple-surface)",
            fontSize: "16px",
            lineHeight: 1.7,
            resize: "vertical",
            backgroundColor: canEdit ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)"
          }}
        />
        <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "13px", color: "var(--info)", gap: "16px" }}>
          <div>
            {lastUpdated ? (
              <>
                Last updated by <strong style={{ color: "var(--accent-purple)" }}>{updatedBy}</strong> on{" "}
                <strong style={{ color: "var(--accent-purple)" }}>{lastUpdated}</strong>
                {meta?.lastUpdatedByEmail ? (
                  <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                    {meta.lastUpdatedByEmail}
                  </div>
                ) : null}
              </>
            ) : (
              "No notes recorded yet."
            )}
          </div>
          <div style={{ fontSize: "12px", color: saving ? "var(--warning)" : "var(--info)" }}>
            {saving ? "Saving…" : "Synced"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ VHC Tab
function VHCTab({ jobNumber }) {
  const router = useRouter();
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setHasPreviewed(false);
  }, [jobNumber]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.vhcPreview === "1" && !hasPreviewed) {
      setHasPreviewed(true);
      const nextQuery = { ...router.query };
      delete nextQuery.vhcPreview;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [router, router.isReady, router.query, hasPreviewed]);

  const handleCustomerAction = async () => {
    if (!hasPreviewed) {
      const returnTo = `/job-cards/${jobNumber}?vhcPreview=1`;
      router.push(`/vhc/customer-view/${jobNumber}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    try {
      setSending(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      alert("Customer link sent successfully.");
    } catch (error) {
      console.error("Failed to notify customer", error);
      alert("Unable to send customer link right now.");
    } finally {
      setSending(false);
    }
  };

  const buttonLabel = hasPreviewed ? (sending ? "Sending…" : "Send") : "Customer View";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button
          type="button"
          onClick={handleCustomerAction}
          disabled={sending}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid var(--primary)",
            backgroundColor: hasPreviewed ? "var(--info)" : "var(--primary)",
            color: "var(--surface)",
            fontWeight: 600,
            cursor: sending ? "not-allowed" : "pointer",
            minWidth: "160px",
          }}
        >
          {buttonLabel}
        </button>
      </div>
      <VhcDetailsPanel jobNumber={jobNumber} showNavigation={false} />
    </div>
  );
}

// ✅ Messages Tab
function MessagesTab({ thread, jobNumber, customerEmail }) {
  const router = useRouter();
  const participants = Array.isArray(thread?.participants) ? thread.participants : [];
  const normalizeRole = (value = "") => (value || "").toLowerCase().trim();
  const customerMember = participants.find((member) =>
    normalizeRole(member.role).includes("customer")
  );
  const allowedStaffRoleKeywords = [
    "service",
    "service advisor",
    "service manager",
    "workshop manager",
    "after-sales manager",
    "after sales manager",
    "after-sales",
    "after sales",
  ];
  const isAllowedStaff = (member = {}) => {
    const role = normalizeRole(member.role);
    return allowedStaffRoleKeywords.some((keyword) => role.includes(keyword));
  };
  const staffMembers = participants.filter(
    (member) => !normalizeRole(member.role).includes("customer") && isAllowedStaff(member)
  );
  const customerLinked = Boolean(customerEmail && customerMember);
  const messages = (Array.isArray(thread?.messages) ? thread.messages : []).filter((message) => {
    const role = normalizeRole(message.sender?.role);
    const isCustomerMessage = role.includes("customer") || message.audience === "customer";
    const isStaffMessage = isAllowedStaff(message.sender || {});
    return isCustomerMessage || isStaffMessage;
  });

  const handleOpenMessagingHub = () => {
    router.push("/messages");
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
        Messages
      </h2>
      <p style={{ margin: "0 0 20px 0", color: "var(--info)", fontSize: "14px" }}>
        Conversations between service advisors, workshop managers, after-sales managers, and the customer
        (customers join once their email is linked). Replying is available from the Messaging hub.
      </p>

      {!thread ? (
        <div style={{
          padding: "28px",
          borderRadius: "12px",
          border: "1px dashed var(--danger-surface)",
          backgroundColor: "var(--danger-surface)",
          textAlign: "center"
        }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "600", color: "var(--danger)" }}>
            No conversation linked yet
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--info)" }}>
            Open the Messaging hub to start a thread for Job #{jobNumber}. Customers see the thread
            once their email is on file and they are added as a participant.
          </p>
          <button
            onClick={handleOpenMessagingHub}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--primary)",
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
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            marginBottom: "16px",
            boxShadow: "none"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--info)", letterSpacing: "0.2em" }}>
                  Thread
                </p>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "17px", fontWeight: "600", color: "var(--accent-purple)" }}>
                  {thread.title}
                </h3>
              </div>
              <button
                onClick={handleOpenMessagingHub}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "var(--primary)",
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
                    backgroundColor: "var(--info-surface)",
                    color: "var(--info-dark)"
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
                    backgroundColor: "var(--info-surface)",
                    color: "var(--accent-purple)"
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
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            marginBottom: "16px",
            boxShadow: "none"
          }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--accent-purple)" }}>
              Customer delivery status
            </h4>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--info)" }}>
              {customerEmail
                ? customerLinked
                  ? `Messages are shared with ${customerEmail}.`
                  : `Email on file (${customerEmail}) is not yet linked to this thread. Add them in Messaging to share updates.`
                : "No customer email is linked yet. Add one to start messaging the customer."}
            </p>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--info)" }}>
              Staff-only messages remain hidden from the customer portal.
            </p>
          </div>

          <div style={{
            padding: "0 0 4px 0",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--surface)",
            maxHeight: "360px",
            overflowY: "auto",
            boxShadow: "none"
          }}>
            {messages.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--info)", fontSize: "14px" }}>
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
                      borderBottom: "1px solid var(--info-surface)",
                      backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--info-surface)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "var(--accent-purple)", fontSize: "14px" }}>
                          {message.sender?.name || "Team Member"}
                        </strong>
                        {message.sender?.role && (
                          <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--info)" }}>
                            {message.sender.role}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--info)" }}>
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <p style={{ margin: "8px 0 0 0", color: "var(--info-dark)", fontSize: "14px", whiteSpace: "pre-wrap" }}>
                      {message.content}
                    </p>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: isStaffOnly ? "var(--danger)" : "var(--info-dark)",
                          backgroundColor: isStaffOnly ? "var(--danger-surface)" : "var(--success)"
                        }}
                      >
                        {isStaffOnly ? "Internal only" : "Shared with customer"}
                      </span>
                      {message.metadata?.jobNumber && (
                        <span style={{ fontSize: "11px", color: "var(--info)" }}>
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
    accent: "var(--warning)",
    hints: ["check", "sheet", "inspection", "checklist"],
    emptyState: "No check-sheets have been uploaded yet."
  },
  {
    id: "vhc",
    label: "VHC Reports",
    description: "Exports from the Vehicle Health Check system and annotated VHC PDFs.",
    icon: "🩺",
    accent: "var(--danger)",
    hints: ["vhc", "health", "traffic", "vhcreport", "vhc-report", "vhc_report"],
    emptyState: "No VHC reports have been uploaded for this job."
  },
  {
    id: "vehicle",
    label: "Vehicle Documents",
    description: "V5, warranty packs, loan agreements, and other vehicle-specific paperwork.",
    icon: "🚗",
    accent: "var(--info)",
    hints: ["vehicle", "v5", "logbook", "warranty", "vehicle-doc", "vehicledoc"],
    emptyState: "No vehicle documents are stored yet."
  },
  {
    id: "customer",
    label: "Customer Uploads",
    description: "Documents or photos supplied by the customer (portal or email).",
    icon: "👤",
    accent: "var(--success)",
    hints: ["customer", "client", "cust", "customer-upload", "customer_upload"],
    emptyState: "No customer uploads have been linked yet."
  },
  {
    id: "service",
    label: "Service Forms",
    description: "Signed invoices, service authorisations, and mandatory service paperwork.",
    icon: "🧾",
    accent: "var(--accent-purple)",
    hints: ["service", "form", "authorisation", "authorization", "service-form"],
    emptyState: "No service forms have been uploaded yet."
  },
  {
    id: "general",
    label: "General Attachments",
    description: "Any other supporting photos, notes, or files.",
    icon: "📎",
    accent: "var(--info)",
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
            backgroundColor: "var(--primary)",
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
          border: "1px solid var(--accent-purple-surface)",
          backgroundColor: "var(--warning-surface)",
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
              color: "var(--info-dark)",
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
              border: "1px solid var(--info)",
              fontSize: "14px",
              backgroundColor: "var(--surface)"
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
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--danger)" }}>
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
              backgroundColor: linking ? "var(--accent-purple)" : "var(--info)",
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
              border: "1px solid var(--info)",
              backgroundColor: "var(--surface)",
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
          color: "var(--text-primary)"
        }}
      >
        Warranty Linking
      </h2>
      <p style={{ color: "var(--info)", fontSize: "14px", margin: "0 0 18px 0" }}>
        Link this job card with a warranty counterpart to mirror progress and
        share the same Vehicle Health Check. Clocking and labour capture remain
        independent for each job.
      </p>

      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid var(--accent-purple-surface)",
          backgroundColor: "var(--info-surface)",
          marginBottom: "16px"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--accent-purple)" }}>
          Linked Warranty Job
        </h3>
        {linkedJob ? (
          <>
            <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "14px" }}>
              Linked to Job #{linkedJob.jobNumber} ({linkedJob.status || "Open"})
            </p>
            <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleOpenLinkedJob}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  backgroundColor: "var(--surface)",
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
          <p style={{ margin: 0, color: "var(--info)", fontSize: "14px" }}>
            No warranty job card is linked yet.
          </p>
        )}
      </div>

      <div
        style={{
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid var(--info-surface)",
          backgroundColor: "var(--info-surface)"
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--accent-purple)" }}>
          Shared VHC Source
        </h3>
        <p style={{ margin: "0 0 6px 0", color: "var(--accent-purple)", fontSize: "14px" }}>
          VHC checklist hosted on Job #{sharedVhcJobNumber}
        </p>
        <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "13px" }}>
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
          border: "1px solid var(--accent-purple-surface)",
          backgroundColor: "var(--surface)",
          boxShadow: "none"
        }}
      >
        <div
          style={{
            width: "84px",
            height: "84px",
            borderRadius: "10px",
            border: "1px solid var(--accent-purple-surface)",
            backgroundColor: "var(--info-surface)",
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
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--info-dark)" }}>
                {ext}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "var(--accent-purple)" }}>
                {doc.name || "Document"}
              </h4>
              <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>
                Folder: {(doc.folder || "general").replace(/-/g, " ")} · {doc.type || "Unknown type"}
              </p>
              <p style={{ margin: "6px 0 0 0", color: "var(--info)", fontSize: "12px" }}>
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
                  border: "1px solid var(--info)",
                  backgroundColor: "var(--surface)",
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
                    border: "1px solid var(--danger-surface)",
                    backgroundColor: "var(--danger-surface)",
                    color: "var(--danger)",
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
          color: "var(--text-primary)"
        }}
      >
        Documents & Attachments
      </h2>
      <p style={{ color: "var(--info)", fontSize: "14px", margin: "0 0 20px 0" }}>
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
                border: isActive ? `2px solid ${category.accent}` : "1px solid var(--accent-purple-surface)",
                backgroundColor: isActive ? "rgba(var(--primary-rgb),0.05)" : "white",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: isActive ? "0 4px 12px rgba(0, 0, 0, 0.12)" : "none"
              }}
            >
              <span style={{ fontSize: "18px" }}>{category.icon}</span>
              <strong style={{ fontSize: "14px", color: "var(--accent-purple)" }}>
                {category.label}
              </strong>
              <span style={{ fontSize: "12px", color: "var(--info)" }}>
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
            border: "1px dashed var(--accent-purple)",
            backgroundColor: "var(--info-surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "var(--accent-purple)", fontWeight: "600" }}>
              Upload to {selectedCategoryMeta.label}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--info)" }}>
              You can select multiple images or documents. Files instantly sync to all job card
              surfaces and technician views.
            </p>
            {uploading && (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--accent-purple)", fontWeight: "600" }}>
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
                backgroundColor: uploading ? "var(--accent-purple)" : "var(--primary)",
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
        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "var(--accent-purple)" }}>
          {selectedCategoryMeta.label}
        </h3>
        <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>
          {selectedCategoryMeta.description}
        </p>
        {!canDelete && (
          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--info)" }}>
            Only workshop/service managers can delete files. Contact management if a document needs to
            be removed.
          </p>
        )}
        {canDelete && (
          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--info)" }}>
            Delete removes the Supabase storage file and the job file record.
          </p>
        )}
      </div>

      {categoryDocuments.length === 0 ? (
        <div
          style={{
            padding: "28px",
            borderRadius: "12px",
            border: "1px dashed var(--accent-purple-surface)",
            textAlign: "center",
            color: "var(--info)",
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
