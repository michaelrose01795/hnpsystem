// file location: src/pages/api/website/auth/email-check.js
// Step 1 of the unified login flow: classify an email so the UI knows
// whether to show the sign-in password field, the "set a password for
// your existing customer record" field, or the full signup form.

import {
  getCustomerAuthByEmail,
  findCustomerByEmail,
} from "@/lib/database/customerAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email." });
  }

  const auth = await getCustomerAuthByEmail(email);
  if (auth) {
    return res.status(200).json({ success: true, state: "has_account" });
  }

  const customer = await findCustomerByEmail(email);
  if (customer) {
    return res.status(200).json({
      success: true,
      state: "customer_no_password",
      customer: {
        firstname: customer.firstname || "",
        lastname: customer.lastname || "",
      },
    });
  }

  return res.status(200).json({ success: true, state: "new" });
}
