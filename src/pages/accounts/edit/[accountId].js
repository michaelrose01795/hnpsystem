// file location: src/pages/accounts/edit/[accountId].js // header comment for file clarity
import React, { useEffect, useState } from "react"; // import React hooks for managing state and lifecycle
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AccountForm from "@/components/accounts/AccountForm";
const EDIT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER"];
export default function EditAccountPage() {
  const router = useRouter();
  const { accountId } = router.query;
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    const loadAccount = async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load account");
        }
        setAccount(payload.data || null);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load account", error);
        setMessage(error.message || "Unable to load account");
      } finally {
        setLoading(false);
      }
    };
    loadAccount();
    return () => controller.abort();
  }, [accountId]);
  const handleSubmit = async (values) => {
    if (!accountId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/accounts/${accountId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update account");
      }
      setMessage("Account updated successfully.");
      setAccount(payload.data || values);
      router.push(`/accounts/view/${accountId}`);
    } catch (error) {
      console.error("Failed to update account", error);
      setMessage(error.message || "Unable to update account");
    } finally {
      setSaving(false);
    }
  };
  return (
    <ProtectedRoute allowedRoles={EDIT_ROLES}>
      <Layout>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Edit Account</h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Update billing details, limits, or status for this account.</p>
          </div>
          {message && (
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("successfully") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("successfully") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div>
          )}
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading account…</p>}
          {!loading && account && (
            <AccountForm initialValues={account} onSubmit={handleSubmit} isSubmitting={saving} onCancel={() => router.push(`/accounts/view/${accountId}`)} />
          )}
          {!loading && !account && <p style={{ color: "var(--danger)" }}>Account not found.</p>}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
