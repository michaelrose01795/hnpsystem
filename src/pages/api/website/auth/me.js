// file location: src/pages/api/website/auth/me.js
// Returns the currently logged-in customer (or 401 if not signed in).

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { getCustomerById } from "@/lib/database/customers";

export default async function handler(req, res) {
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, authenticated: false });
  }
  const customer = await getCustomerById(session.customerId);
  if (!customer) {
    return res.status(404).json({
      success: false,
      authenticated: true,
      message: "Customer record not found.",
    });
  }
  return res
    .status(200)
    .json({ success: true, authenticated: true, customer });
}
