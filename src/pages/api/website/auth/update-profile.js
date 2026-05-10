// file location: src/pages/api/website/auth/update-profile.js
// Lets a logged-in customer edit their own personal details on the
// public profile page. Whitelists the fields they can change so they
// can't escalate by setting role columns or other sensitive data.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { updateCustomerProfile } from "@/lib/database/customerAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }
  const body = req.body || {};
  const patch = {
    firstname: body.firstname,
    lastname: body.lastname,
    mobile: body.mobile,
    telephone: body.telephone,
    address: body.address,
    postcode: body.postcode,
    contact_preference: body.contact_preference,
  };
  const updated = await updateCustomerProfile(session.customerId, patch);
  if (!updated) {
    return res
      .status(500)
      .json({ success: false, message: "Could not update profile." });
  }
  return res.status(200).json({ success: true, customer: updated });
}
