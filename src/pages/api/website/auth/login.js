// file location: src/pages/api/website/auth/login.js
// Customer-facing login for the /website area.

import { verifyPassword } from "@/lib/auth/passwords";
import {
  getCustomerAuthByEmail,
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

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Enter your email and password.",
    });
  }

  const auth = await getCustomerAuthByEmail(email);
  if (!auth) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid email or password." });
  }

  const matched = await verifyPassword({
    submitted: password,
    stored: auth.password_hash || "",
    algo: auth.password_algo || "bcrypt",
  });
  if (!matched) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid email or password." });
  }

  await updateCustomerLastLogin(auth.id);
  const token = signCustomerToken({
    authId: auth.id,
    customerId: auth.customer_id,
  });
  res.setHeader("Set-Cookie", buildCustomerCookie(token));
  return res.status(200).json({ success: true });
}
