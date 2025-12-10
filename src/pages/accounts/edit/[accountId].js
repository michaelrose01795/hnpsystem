// file location: src/pages/accounts/edit/[accountId].js // header comment for file clarity
import React, { useEffect, useState } from "react"; // import React hooks for managing state and lifecycle
import { useRouter } from "next/router"; // import router to access dynamic route params and navigation
import Layout from "@/components/Layout"; // import shared layout for consistent chrome
import ProtectedRoute from "@/components/ProtectedRoute"; // import auth guard enforcing Keycloak roles
import AccountForm from "@/components/accounts/AccountForm"; // import reusable form component
const EDIT_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER", "GENERAL MANAGER", "SERVICE MANAGER"]; // allowed roles for editing accounts
export default function EditAccountPage() { // component definition for account edit screen
  const router = useRouter(); // instantiate router
  const { accountId } = router.query; // read dynamic route param from query object
  const [account, setAccount] = useState(null); // store fetched account data for editing
  const [loading, setLoading] = useState(true); // track loading state while fetching account
  const [saving, setSaving] = useState(false); // track saving state while submitting form
  const [message, setMessage] = useState(""); // hold success or error message for banner
  useEffect(() => { // effect to fetch account data whenever accountId changes
    if (!accountId) return; // guard when router param not ready
    const controller = new AbortController(); // create abort controller for cleanup
    const loadAccount = async () => { // async loader function
      setLoading(true); // show spinner while fetching
      setMessage(""); // clear stale messages
      try { // wrap fetch in try/catch block
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal }); // call GET endpoint for account
        const payload = await response.json(); // parse JSON payload
        if (!response.ok) { // handle HTTP errors
          throw new Error(payload?.message || "Failed to load account"); // throw to trigger catch branch
        } // close guard
        setAccount(payload.data || null); // store account data in state
      } catch (error) { // handle fetch errors
        if (error.name === "AbortError") return; // exit silently on abort
        console.error("Failed to load account", error); // log for debugging
        setMessage(error.message || "Unable to load account"); // surface error to UI
      } finally { // cleanup block executed in both success/failure cases
        setLoading(false); // hide loading indicator
      } // close finally
    }; // close loadAccount definition
    loadAccount(); // call load function
    return () => controller.abort(); // abort fetch on cleanup
  }, [accountId]); // re-run effect when accountId changes
  const handleSubmit = async (values) => { // form submission handler for PUT updates
    if (!accountId) return; // guard missing id
    setSaving(true); // show saving state
    setMessage(""); // clear old messages
    try { // wrap API call in try/catch
      const response = await fetch(`/api/accounts/${accountId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); // send update request with JSON payload
      const payload = await response.json(); // parse JSON response
      if (!response.ok) { // check HTTP status
        throw new Error(payload?.message || "Failed to update account"); // throw error for catch block
      } // close guard
      setMessage("Account updated successfully."); // show success message
      setAccount(payload.data || values); // refresh account state with response data when available
      router.push(`/accounts/view/${accountId}`); // navigate back to view page after save
    } catch (error) { // catch errors thrown by fetch
      console.error("Failed to update account", error); // log error
      setMessage(error.message || "Unable to update account"); // show error message
    } finally { // cleanup branch to run regardless of success/failure
      setSaving(false); // hide saving state
    } // close finally block
  }; // close handleSubmit function
  return ( // render edit page content
    <ProtectedRoute allowedRoles={EDIT_ROLES}> // wrap page with auth guard
      <Layout> // wrap content inside layout
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}> // container that centers form card
          <div> // heading container above form
            <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--primary)" }}>Edit Account</h1> // page title text
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Update billing details, limits, or status for this account.</p> // subtitle text for context
          </div>
          {message && ( // show status banner when message string not empty
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("successfully") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("successfully") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div> // message alert styled differently for success vs error
          )}
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading account…</p>} // display loading text while fetch in progress
          {!loading && account && ( // show form once account data available
            <AccountForm initialValues={account} onSubmit={handleSubmit} isSubmitting={saving} onCancel={() => router.push(`/accounts/view/${accountId}`)} /> // render form with initial values plus cancel navigation
          )}
          {!loading && !account && <p style={{ color: "var(--danger)" }}>Account not found.</p>} // show error when no account record retrieved
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close render tree
} // close EditAccountPage definition
