// file location: src/pages/accounts/create.js // header comment for clarity
import React, { useState } from "react"; // import React hook for state handling
import { useRouter } from "next/router"; // import router for navigation
import Layout from "@/components/Layout"; // import shared layout wrapper
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard component
import AccountForm from "@/components/accounts/AccountForm"; // import reusable account form component
import { DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts"; // import default values to seed form
const CREATE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"]; // restrict create access to finance leadership roles
export default function CreateAccountPage() { // component for creating new account records
  const router = useRouter(); // initialize router for navigation after save
  const [saving, setSaving] = useState(false); // track network request state
  const [message, setMessage] = useState(""); // store success or error messages for user feedback
  const handleSubmit = async (values) => { // handle form submission payload
    setSaving(true); // set loading state true before API call
    setMessage(""); // reset message area so stale alerts disappear
    try { // try/catch for API call
      const response = await fetch("/api/accounts", { // send POST request to accounts endpoint
        method: "POST", // HTTP verb for create
        headers: { "Content-Type": "application/json" }, // send JSON body header
        body: JSON.stringify(values), // send serialized form values
      }); // close fetch call
      const payload = await response.json(); // parse JSON response from API
      if (!response.ok) { // handle API errors
        throw new Error(payload?.message || "Failed to create account"); // throw descriptive error for catch block
      } // close error guard
      setMessage("Account created successfully."); // show success message on screen
      router.push(`/accounts/view/${payload.data?.account_id || ""}`); // navigate to new account view page if id provided
    } catch (error) { // catch errors thrown while saving
      console.error("Failed to create account", error); // log error for debugging
      setMessage(error.message || "Unable to create account"); // show error message to user
    } finally { // cleanup block executed regardless of success/failure
      setSaving(false); // reset loading state
    } // close finally block
  }; // close handleSubmit
  return ( // render create page with guard and layout
    <ProtectedRoute allowedRoles={CREATE_ROLES}> // only allow defined roles to reach this page
      <Layout> // wrap content in global layout
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}> // container that centers form
          <div> // header block above form
            <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "2rem" }}>Create Account</h1> // page title text
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Add a new customer account with billing details, terms, and limits.</p> // descriptive subtitle text
          </div>
          {message && ( // show feedback banner when message populated
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("success") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("success") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div> // message banner styled differently for success/error
          )}
          <AccountForm initialValues={DEFAULT_ACCOUNT_FORM_VALUES} onSubmit={handleSubmit} isSubmitting={saving} onCancel={() => router.push("/accounts")} /> // render form bound to handler and default values
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close render
} // close CreateAccountPage definition
