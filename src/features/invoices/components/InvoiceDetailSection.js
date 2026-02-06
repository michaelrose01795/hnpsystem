// file location: src/features/invoices/components/InvoiceDetailSection.js
import React, { useEffect, useState, useCallback } from "react";
import InvoiceDetail from "@/features/invoices/components/InvoiceDetail";
import styles from "@/features/invoices/styles/invoice.module.css";

const InvoiceSkeleton = () => {
  return (
    <div className={`${styles.invoiceShell} ${styles.skeleton}`}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
};

export default function InvoiceDetailSection({ jobNumber, orderNumber, customerEmail, jobId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState("");
  const [emailStatus, setEmailStatus] = useState("");

  const identifier = jobNumber || orderNumber || "";

  const fetchInvoice = useCallback(async () => {
    if (!identifier) {
      setError("Provide a job number or order number to view invoice.");
      setData(null);
      setLoading(false);
      setNotice("");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const endpoint = jobNumber
        ? `/api/invoices/by-job/${encodeURIComponent(jobNumber)}`
        : `/api/invoices/by-order/${encodeURIComponent(orderNumber)}`;
      const response = await fetch(endpoint, { credentials: "include" });
      const payload = await response.json();
      if (response.status === 401) {
        throw new Error("Authentication required to view invoices. Please sign in again.");
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to load invoice");
      }
      setData(payload.data);
      setNotice(payload.data?.meta?.notice || "");
    } catch (err) {
      console.error("Invoice fetch failed", err);
      setError(err.message || "Unable to load invoice");
      setData(null);
      setNotice("");
    } finally {
      setLoading(false);
    }
  }, [identifier, jobNumber, orderNumber]);

  useEffect(() => {
    fetchInvoice();
    return () => {};
  }, [fetchInvoice]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
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

  return (
    <>
      {notice && (
        <div className={`${styles.statusMessage} ${styles.info}`}>
          {notice}
        </div>
      )}
      <InvoiceDetail
        data={data}
        onPrint={handlePrint}
        onEmail={handleEmail}
        emailStatus={emailStatus}
        customerEmail={customerEmail}
      />
    </>
  );
}
