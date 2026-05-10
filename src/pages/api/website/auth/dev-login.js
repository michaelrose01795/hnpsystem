// file location: src/pages/api/website/auth/dev-login.js
// Dev-only impersonation: signs a customer session cookie for any
// customer in the database without requiring a password. Gated by
// canShowDevLogin(). Strictly for testing the customer-facing portal
// in the same way an end customer would experience it.

import { canShowDevLogin } from "@/lib/dev-tools/config";
import { getCustomerById } from "@/lib/database/customers";
import { getCustomerAuthByEmail } from "@/lib/database/customerAuth";
import {
  signCustomerToken,
  buildCustomerCookie,
} from "@/lib/auth/customerSession";

export default async function handler(req, res) {
  if (!canShowDevLogin()) {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const customerId = String(req.body?.customerId ?? "").trim();
  if (!customerId) {
    return res.status(400).json({ success: false, message: "customerId is required." });
  }
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found." });
  }
  // If the customer has an auth row use its id; otherwise the dev session
  // simply carries customerId (the rest of the portal only ever reads
  // customerId from the cookie).
  let authId = null;
  if (customer.email) {
    const auth = await getCustomerAuthByEmail(customer.email);
    if (auth) authId = auth.id;
  }
  const token = signCustomerToken({ authId, customerId: customer.id });
  res.setHeader("Set-Cookie", buildCustomerCookie(token));
  return res.status(200).json({ success: true });
}
