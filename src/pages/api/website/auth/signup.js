// file location: src/pages/api/website/auth/signup.js
// Customer-facing signup for the /website area.
// Links to an existing customers row (by email) or creates a new one.

import {
  hashPassword,
  isStrongEnough,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/passwords";
import {
  getCustomerAuthByEmail,
  findCustomerByEmail,
  createCustomerRow,
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
  const firstname = String(req.body?.firstname ?? "").trim();
  const lastname = String(req.body?.lastname ?? "").trim();
  const mobile = String(req.body?.mobile ?? "").trim();
  const telephone = String(req.body?.telephone ?? "").trim();
  const postcode = String(req.body?.postcode ?? "").trim().toUpperCase();
  const address = String(req.body?.address ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email." });
  }
  if (!isStrongEnough(password)) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (!firstname || !lastname || !mobile || !postcode || !address) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, mobile, postcode and address are required.",
    });
  }

  const existing = await getCustomerAuthByEmail(email);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists. Try logging in.",
    });
  }

  // Match an existing customers row by email; if none, create one.
  let customer = await findCustomerByEmail(email);
  if (!customer) {
    customer = await createCustomerRow({
      firstname,
      lastname,
      email,
      mobile,
      telephone,
      address,
      postcode,
    });
    if (!customer) {
      return res.status(500).json({
        success: false,
        message: "Could not create your account. Please try again.",
      });
    }
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
      message: "Could not create your account. Please try again.",
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
