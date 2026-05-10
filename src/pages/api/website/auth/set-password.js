// file location: src/pages/api/website/auth/set-password.js
// Used when an email matches an existing customers row but has no
// customer_auth entry yet — the customer is "claiming" their account by
// setting a password for the first time. Creates the auth row, signs
// the session cookie, and logs them in.

import {
  hashPassword,
  isStrongEnough,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/passwords";
import {
  getCustomerAuthByEmail,
  findCustomerByEmail,
  createCustomerAuth,
  updateCustomerLastLogin,
} from "@/lib/database/customerAuth";
import {
  signCustomerToken,
  buildCustomerCookie,
} from "@/lib/auth/customerSession";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email." });
  }
  if (!isStrongEnough(password)) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  const existing = await getCustomerAuthByEmail(email);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "An account already exists for this email. Please sign in.",
    });
  }

  const customer = await findCustomerByEmail(email);
  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "No customer record matches that email.",
    });
  }

  const passwordHash = await hashPassword(password);
  const { data: auth, error } = await createCustomerAuth({
    email,
    passwordHash,
    customerId: customer.id,
  });
  if (error || !auth) {
    return res.status(500).json({
      success: false,
      message: "Could not set your password. Please try again.",
    });
  }

  await updateCustomerLastLogin(auth.id);
  const token = signCustomerToken({
    authId: auth.id,
    customerId: customer.id,
  });
  res.setHeader("Set-Cookie", buildCustomerCookie(token));
  return res.status(200).json({ success: true });
}
