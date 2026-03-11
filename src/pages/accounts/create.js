// file location: src/pages/accounts/create.js // header comment for clarity
import React, { useState } from "react"; // import React hook for state handling
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountForm from "@/components/accounts/AccountForm";
import { PageContainer, PageSection, StatusMessage } from "@/components/ui";
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
        <PageContainer style={{ maxWidth: "var(--page-width-form)", margin: "0 auto" }}>
          <PageSection>
            <div className="app-page-intro">
              <h1 className="app-page-title">Create Account</h1>
              <p className="app-page-copy">Add a new customer account with billing details, terms, and limits.</p>
            </div>
            {message && (
              <StatusMessage tone={message.includes("success") ? "success" : "danger"}>{message}</StatusMessage>
            )}
            <AccountForm initialValues={DEFAULT_ACCOUNT_FORM_VALUES} onSubmit={handleSubmit} isSubmitting={saving} onCancel={() => router.push("/accounts")} />
          </PageSection>
        </PageContainer>
      </Layout>
    </ProtectedRoute>
  );
}
