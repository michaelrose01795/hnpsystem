// file location: src/features/invoices/components/InvoiceDetailSection.js // identify file path for reusable section
import React, { useEffect, useState, useCallback } from "react"; // import React hooks for data fetching lifecycle
import InvoiceDetail from "@/features/invoices/components/InvoiceDetail"; // import layout component
import styles from "@/features/invoices/styles/invoice.module.css"; // import shared styles for loading/error states

const InvoiceSkeleton = () => { // lightweight skeleton component for loading state
  return ( // render skeleton markup
    <div className={`${styles.invoiceShell} ${styles.skeleton}`}> {/* // add skeleton modifier */}
      {Array.from({ length: 6 }).map((_, index) => ( // repeat placeholder rows
        <div key={index} className={styles.skeletonRow} /> // render animated shimmer row
      ))} {/* // end skeleton rows */}
    </div> // end skeleton container
  ); // end return
}; // end InvoiceSkeleton

export default function InvoiceDetailSection({ jobNumber, orderNumber }) { // export reusable fetch/render component
  const [loading, setLoading] = useState(true); // track loading state
  const [error, setError] = useState(""); // hold error messages
  const [data, setData] = useState(null); // store invoice payload
  const [notice, setNotice] = useState(""); // friendly info messages (e.g. fallback)

  const identifier = jobNumber || orderNumber || ""; // compute identifier for memoization

  const fetchInvoice = useCallback(async () => { // memoized fetch function
    if (!identifier) { // guard when missing identifier
      setError("Provide a job number or order number to view invoice."); // set helpful message
      setData(null); // reset data
      setLoading(false); // stop spinner
      setNotice(""); // no info banner needed
      return; // exit early
    }
    setLoading(true); // start loading state
    setError(""); // clear previous errors
    setNotice(""); // clear info banner
    try { // run fetch
      const endpoint = jobNumber
        ? `/api/invoices/by-job/${encodeURIComponent(jobNumber)}`
        : `/api/invoices/by-order/${encodeURIComponent(orderNumber)}`; // choose API route
      const response = await fetch(endpoint, { credentials: "include" }); // call API with cookies for auth
      const payload = await response.json(); // parse JSON
      if (response.status === 401) { // handle auth errors with friendly guidance
        throw new Error("Authentication required to view invoices. Please sign in again."); // throw descriptive error
      }
      if (!response.ok || !payload?.success) { // handle API failure
        throw new Error(payload?.message || "Unable to load invoice"); // throw descriptive error
      }
      setData(payload.data); // store invoice payload
      setNotice(payload.data?.meta?.notice || ""); // display meta notice when available
    } catch (err) { // catch errors
      console.error("Invoice fetch failed", err); // log for debugging
      setError(err.message || "Unable to load invoice"); // show user friendly message
      setData(null); // clear data
      setNotice(""); // clear notice on failure
    } finally {
      setLoading(false); // stop spinner
    }
  }, [identifier, jobNumber, orderNumber]); // dependencies for fetch callback

  useEffect(() => {
    fetchInvoice(); // fetch data on mount/identifier change
    return () => {}; // placeholder cleanup
  }, [fetchInvoice]); // rerun when fetch callback updates

  const handlePrint = useCallback(() => { // print handler
    if (typeof window !== "undefined") { // ensure client side
      window.print(); // trigger browser print dialog
    }
  }, []); // stable callback

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
      <InvoiceDetail data={data} onPrint={handlePrint} />
    </>
  );
} // end InvoiceDetailSection
