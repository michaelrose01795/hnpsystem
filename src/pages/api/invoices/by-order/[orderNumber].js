// file location: src/pages/api/invoices/by-order/[orderNumber].js // identify API file path
import { getInvoiceDetailPayload } from "@/lib/invoices/detailService"; // import shared invoice detail builder

export default async function handler(req, res) { // handler for /api/invoices/by-order/[orderNumber]
  if (req.method !== "GET") { // allow only GET
    res.setHeader("Allow", "GET"); // advertise allowed method
    res.status(405).json({ success: false, message: "Method not allowed" }); // respond error
    return; // exit handler
  }

  const { orderNumber } = req.query; // read dynamic segment
  if (!orderNumber || typeof orderNumber !== "string") { // validate parameter
    res.status(400).json({ success: false, message: "Order number is required" }); // send bad request
    return; // exit handler
  }

  try { // try building payload
    const data = await getInvoiceDetailPayload({ orderNumber }); // request invoice detail for order
    res.status(200).json({ success: true, data }); // return JSON payload
  } catch (error) { // catch errors
    if (error.status === 404 || error.message === "NOT_FOUND") { // map missing invoice
      res.status(404).json({ success: false, message: "Invoice not found for order" }); // respond 404
      return; // exit handler
    }
    console.error("Invoice detail by order failed:", error); // log unexpected issues
    console.error("Error details:", { // log additional context
      message: error.message,
      stack: error.stack,
      orderNumber
    });
    res.status(500).json({ success: false, message: error.message || "Unable to load invoice details" }); // respond 500 with actual error message
  }
} // end handler
