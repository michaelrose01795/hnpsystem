// file location: src/pages/accounts/create.js // header comment for clarity
import React, { useState } from "react"; // import React hook for state handling
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountForm from "@/components/accounts/AccountForm";
import { DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts";
const CREATE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];
export default function CreateAccountPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const handleSubmit = async (values) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to create account");
      }
      setMessage("Account created successfully.");
      router.push(`/accounts/view/${payload.data?.account_id || ""}`);
    } catch (error) {
      console.error("Failed to create account", error);
      setMessage(error.message || "Unable to create account");
    } finally {
      setSaving(false);
    }
  };
  return (
    <ProtectedRoute allowedRoles={CREATE_ROLES}>
      <Layout>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "2rem" }}>Create Account</h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Add a new customer account with billing details, terms, and limits.</p>
          </div>
          {message && (
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("success") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("success") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div>
          )}
          <AccountForm initialValues={DEFAULT_ACCOUNT_FORM_VALUES} onSubmit={handleSubmit} isSubmitting={saving} onCancel={() => router.push("/accounts")} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
