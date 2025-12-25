"use client"; // file location: src/components/Invoices/InvoiceSection.js // indicate component path and mark client-side module

import React from "react"; // import React for rendering JSX
import InvoiceDetailSection from "@/features/invoices/components/InvoiceDetailSection"; // import shared invoice detail wrapper

export default function InvoiceSection({ jobData }) { // export component used inside job card invoice tab
  const jobNumber = jobData?.jobNumber || jobData?.job_number || ""; // derive job number from job data payload

  if (!jobNumber) { // handle missing job number edge case
    return (
      <p style={{ color: "var(--danger-dark)" }}> {/* // render warning message */}
        Job number missing — unable to load invoice overview.
      </p>
    ); // end warning
  }

  return <InvoiceDetailSection jobNumber={jobNumber} />; // delegate rendering to shared invoice section
} // end InvoiceSection component
