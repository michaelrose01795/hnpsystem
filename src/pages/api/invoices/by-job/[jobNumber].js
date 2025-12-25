// file location: src/pages/api/invoices/by-job/[jobNumber].js // identify API route path
import { getInvoiceDetailPayload } from "@/lib/invoices/detailService"; // import shared invoice detail builder

export default async function handler(req, res) { // main handler for /api/invoices/by-job/[jobNumber]
  if (req.method !== "GET") { // restrict to GET
    res.setHeader("Allow", "GET"); // advertise allowed method
    res.status(405).json({ success: false, message: "Method not allowed" }); // respond with error
    return; // exit handler
  }

  const { jobNumber } = req.query; // read job number from route
  if (!jobNumber || typeof jobNumber !== "string") { // validate parameter
    res.status(400).json({ success: false, message: "Job number is required" }); // send bad request
    return; // exit handler
  }

  try { // wrap DB logic
    const data = await getInvoiceDetailPayload({ jobNumber }); // build invoice detail payload
    res.status(200).json({ success: true, data }); // send success response
  } catch (error) { // handle errors
    if (error.status === 404 || error.message === "NOT_FOUND") { // handle missing invoice
      res.status(404).json({ success: false, message: "Invoice not found for job" }); // send not found
      return; // exit handler
    }
    console.error("Invoice detail by job failed:", error); // log unexpected errors
    res.status(500).json({ success: false, message: "Unable to load invoice details" }); // send server error
  }
} // end handler
