// file location: src/pages/api/website/auth/change-email.js
// Lets a logged-in customer change their login email. Requires the
// current password as re-auth and refuses if the new email is
// already taken by another customer_auth row.

import { verifyPassword } from "@/lib/auth/passwords";
import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import {
  getCustomerAuthById,
  getCustomerAuthByEmail,
} from "@/lib/database/customerAuth";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const newEmail = String(req.body?.newEmail ?? "").trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword ?? "");
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ success: false, message: "Enter a valid email." });
  }
  if (!currentPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Enter your current password." });
  }

  const auth = session.authId
    ? await getCustomerAuthById(session.authId)
    : null;
  if (!auth) {
    return res
      .status(404)
      .json({ success: false, message: "Account not found." });
  }

  const matched = await verifyPassword({
    submitted: currentPassword,
    stored: auth.password_hash || "",
    algo: auth.password_algo || "bcrypt",
  });
  if (!matched) {
    return res
      .status(400)
      .json({ success: false, message: "Current password is incorrect." });
  }

  const conflicting = await getCustomerAuthByEmail(newEmail);
  if (conflicting && conflicting.id !== auth.id) {
    return res
      .status(409)
      .json({ success: false, message: "That email is already in use." });
  }

  const now = new Date().toISOString();
  const client = db();
  const { error: authError } = await client
    .from("customer_auth")
    .update({ email: newEmail, updated_at: now })
    .eq("id", auth.id);
  if (authError) {
    console.error("change-email auth:", authError.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not update email." });
  }
  // Mirror the change onto the customers row so staff see it too.
  await client
    .from("customers")
    .update({ email: newEmail, updated_at: now })
    .eq("id", session.customerId);

  return res.status(200).json({ success: true, email: newEmail });
}
