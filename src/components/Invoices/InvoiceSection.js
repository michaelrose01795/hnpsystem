"use client";

import React from "react";
import InvoiceDetailSection from "@/features/invoices/components/InvoiceDetailSection";

export default function InvoiceSection({ jobData }) {
  const jobNumber = jobData?.jobNumber || jobData?.job_number || "";

  if (!jobNumber) {
    return (
      <p style={{ color: "var(--danger-dark)" }}>
        Job number missing — unable to load invoice overview.
      </p>
    );
  }

  return (
    <InvoiceDetailSection
      jobNumber={jobNumber}
      customerEmail={jobData?.customerEmail}
      jobId={jobData?.id}
    />
  );
}
