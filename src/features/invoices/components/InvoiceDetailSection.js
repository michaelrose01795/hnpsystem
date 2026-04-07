// file location: src/features/invoices/components/InvoiceDetailSection.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import InvoiceDetail from "@/features/invoices/components/InvoiceDetail";
import styles from "@/features/invoices/styles/invoice.module.css";
import { supabase } from "@/lib/supabaseClient";
import { getJobRequests } from "@/lib/canonical/fields";

const InvoiceSkeleton = () => {
  return (
    <div className={`${styles.invoiceShell} ${styles.skeleton}`}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
};

export default function InvoiceDetailSection({
  jobNumber,
  orderNumber,
  customerEmail,
  jobId,
  jobData = null,
  invoiceReady = false,
  onInvoiceStateChange = null,
  onPaymentCompleted = null,
  onReleaseRequested = null,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [emailStatus, setEmailStatus] = useState("");

  const identifier = jobNumber || orderNumber || "";

  const fetchInvoice = useCallback(async ({ silent = false } = {}) => {
    if (!identifier) {
      setError("Provide a job number or order number to view invoice.");
      setData(null);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const endpoint = jobNumber
        ? `/api/invoices/by-job/${encodeURIComponent(jobNumber)}`
        : `/api/invoices/by-order/${encodeURIComponent(orderNumber)}`;
      const response = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        throw new Error("Authentication required to view invoices. Please sign in again.");
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to load invoice");
      }
      setData(payload.data);
    } catch (err) {
      console.error("Invoice fetch failed", err);
      if (!silent) {
        setError(err.message || "Unable to load invoice");
        setData(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [identifier, jobNumber, orderNumber]);

  useEffect(() => {
    fetchInvoice();
    return () => {};
  }, [fetchInvoice]);

  useEffect(() => {
    if (!data || typeof onInvoiceStateChange !== "function") return;
    onInvoiceStateChange({
      exists: !Boolean(data?.meta?.isProforma),
      isProforma: Boolean(data?.meta?.isProforma),
      paymentStatus: data?.invoice?.payment_status || data?.meta?.paymentStatus || "",
      paymentCaptured:
        data?.invoice?.paid === true || Boolean(data?.meta?.paymentCaptured),
      invoiceId: data?.invoice?.id || null,
    });
  }, [data, onInvoiceStateChange]);

  const invoiceSyncSignature = useMemo(() => {
    if (!jobData || typeof jobData !== "object") return "";

    const requests = getJobRequests(jobData);
    const parts = Array.isArray(jobData.partsAllocations)
      ? jobData.partsAllocations
      : Array.isArray(jobData.parts_job_items)
      ? jobData.parts_job_items
      : [];
    const vhcChecks = Array.isArray(jobData.vhcChecks)
      ? jobData.vhcChecks
      : Array.isArray(jobData.vhc_checks)
      ? jobData.vhc_checks
      : [];
    const authorisedRows = Array.isArray(jobData.authorizedVhcItems)
      ? jobData.authorizedVhcItems
      : Array.isArray(jobData.authorisedVhcItems)
      ? jobData.authorisedVhcItems
      : [];

    const requestSig = requests
      .map((row) =>
        [
          row?.request_id ?? row?.requestId ?? "",
          row?.request_source ?? row?.requestSource ?? "",
          row?.job_type ?? row?.jobType ?? "",
          row?.request_status ?? row?.status ?? "",
          row?.updated_at ?? row?.updatedAt ?? "",
        ].join(":")
      )
      .sort()
      .join("|");

    const partsSig = parts
      .map((row) =>
        [
          row?.id ?? "",
          row?.allocated_to_request_id ?? row?.allocatedToRequestId ?? "",
          row?.vhc_item_id ?? row?.vhcItemId ?? "",
          row?.status ?? "",
          row?.quantity_allocated ?? row?.quantityAllocated ?? row?.qty ?? "",
          row?.unit_price ?? row?.unitPrice ?? "",
          row?.updated_at ?? row?.updatedAt ?? "",
        ].join(":")
      )
      .sort()
      .join("|");

    const vhcSig = vhcChecks
      .map((row) =>
        [
          row?.vhc_id ?? row?.vhcId ?? "",
          row?.request_id ?? row?.requestId ?? "",
          row?.approval_status ?? row?.approvalStatus ?? "",
          row?.authorization_state ?? row?.authorizationState ?? "",
          row?.display_status ?? row?.displayStatus ?? "",
          row?.Complete ?? row?.complete ?? "",
          row?.updated_at ?? row?.updatedAt ?? "",
        ].join(":")
      )
      .sort()
      .join("|");

    const authorisedSig = authorisedRows
      .map((row) =>
        [
          row?.request_id ?? row?.requestId ?? "",
          row?.vhc_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? "",
          row?.approval_status ?? row?.approvalStatus ?? "",
          row?.authorization_state ?? row?.authorizationState ?? "",
          row?.approved_at ?? row?.approvedAt ?? "",
          row?.updated_at ?? row?.updatedAt ?? "",
        ].join(":")
      )
      .sort()
      .join("|");

    return `${requestSig}__${partsSig}__${vhcSig}__${authorisedSig}`;
  }, [jobData]);

  useEffect(() => {
    if (!identifier || !invoiceSyncSignature) return;
    const timeout = setTimeout(() => {
      fetchInvoice({ silent: true });
    }, 250);
    return () => clearTimeout(timeout);
  }, [identifier, invoiceSyncSignature, fetchInvoice]);

  useEffect(() => {
    if (!jobId) return;

    let refreshTimeout = null;
    const queueRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        fetchInvoice({ silent: true });
      }, 120);
    };

    const channel = supabase.channel(`invoice-sync-${jobId}`);
    const tables = [
      "job_requests",
      "parts_job_items",
      "vhc_checks",
      "job_writeups",
      "invoice_requests",
      "invoice_request_items",
      "proforma_request_overrides",
      "invoices",
    ];

    tables.forEach((table) => {
      const filter =
        table === "invoices"
          ? jobNumber
            ? `job_number=eq.${jobNumber}`
            : `job_id=eq.${jobId}`
          : `job_id=eq.${jobId}`;
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => queueRefresh()
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchInvoice]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const handleDataPatch = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      if (typeof updater === "function") {
        const next = updater(prev);
        return next || prev;
      }
      return prev;
    });
  }, []);

  const handleEmail = useCallback(async () => {
    if (!customerEmail) {
      setEmailStatus("No customer email on file.");
      setTimeout(() => setEmailStatus(""), 4000);
      return;
    }
    if (!data) {
      setEmailStatus("No invoice data to send.");
      setTimeout(() => setEmailStatus(""), 4000);
      return;
    }

    setEmailStatus("Sending...");
    try {
      const response = await fetch("/api/invoices/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobNumber: jobNumber || data?.invoice?.job_number,
          jobId,
          customerEmail,
          invoiceData: data,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to send email");
      }
      setEmailStatus("Invoice emailed successfully!");
    } catch (err) {
      console.error("Email invoice failed:", err);
      setEmailStatus(err.message || "Failed to send email");
    }
    setTimeout(() => setEmailStatus(""), 5000);
  }, [customerEmail, data, jobNumber, jobId]);

  if (!identifier) {
    return (
      <div className={`${styles.statusMessage} ${styles.error}`}>
        Job number or order number is required to display invoice details.
      </div>
    );
  }

  if (loading) {
    return <InvoiceSkeleton />;
  }

  if (error) {
    return (
      <div className={`${styles.statusMessage} ${styles.error}`}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.statusMessage}>
        Invoice data not available for {jobNumber ? `job ${jobNumber}` : `order ${orderNumber}`}.
      </div>
    );
  }

  const isProforma = Boolean(data?.meta?.isProforma);
  const proformaNotice = isProforma
    ? invoiceReady
      ? "Proforma complete"
      : "Proforma"
    : "";

  return (
    <>
      {proformaNotice && (
        <div className={`${styles.statusMessage} ${styles.info}`}>
          {proformaNotice}
        </div>
      )}
      <InvoiceDetail
        data={data}
        onPrint={handlePrint}
        onEmail={handleEmail}
        emailStatus={emailStatus}
        customerEmail={customerEmail}
        jobData={jobData}
        onDataRefresh={fetchInvoice}
        onDataPatch={handleDataPatch}
        onPaymentCompleted={onPaymentCompleted}
        onReleaseRequested={onReleaseRequested}
      />
    </>
  );
}
