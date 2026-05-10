// file location: src/pages/api/website/auth/logout.js
// Clears the customer session cookie.

import { buildCustomerCookie } from "@/lib/auth/customerSession";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  res.setHeader("Set-Cookie", buildCustomerCookie("", { remove: true }));
  return res.status(200).json({ success: true });
}
