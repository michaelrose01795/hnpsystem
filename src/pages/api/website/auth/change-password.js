// file location: src/pages/api/website/auth/change-password.js
// Lets a logged-in customer rotate their password. Requires the
// current password as re-auth so a stolen session cookie can't be
// used to lock the customer out.

import {
  hashPassword,
  verifyPassword,
  isStrongEnough,
  PASSWORD_MIN_LENGTH,
  ALGO_BCRYPT,
} from "@/lib/auth/passwords";
import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { getCustomerAuthById } from "@/lib/database/customerAuth";
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

  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Current and new password are required." });
  }
  if (!isStrongEnough(newPassword)) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from the current one.",
    });
  }

  const auth = session.authId
    ? await getCustomerAuthById(session.authId)
    : null;
  if (!auth) {
    return res.status(404).json({
      success: false,
      message: "Account not found. Please sign in again.",
    });
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

  const newHash = await hashPassword(newPassword);
  const { error } = await db()
    .from("customer_auth")
    .update({
      password_hash: newHash,
      password_algo: ALGO_BCRYPT,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.id);
  if (error) {
    console.error("change-password:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not update password." });
  }
  return res.status(200).json({ success: true });
}
