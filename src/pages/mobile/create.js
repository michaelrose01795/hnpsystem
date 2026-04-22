// file location: src/pages/mobile/create.js
// Dedicated mobile-job creation screen. Posts to /api/jobcards/create with serviceMode='mobile'
// plus on-site visit fields. Used by service advisors and managers to schedule mobile visits
// without touching the existing workshop create page.

import React, { useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { showAlert } from "@/lib/notifications/alertBus";
import PageUi from "@/components/page-ui/mobile/mobile-create-ui"; // Extracted presentation layer.

const pageStyle = { padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px" };
const cardStyle = {
  backgroundColor: "var(--section-card-bg, #fff)",
  borderRadius: "var(--section-card-radius, 12px)",
  padding: "16px",
  border: "var(--section-card-border, 1px solid rgba(15,23,42,0.08))",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const labelStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.9rem" };
const inputStyle = { padding: "10px", border: "1px solid var(--border-subtle, #cbd5e1)", borderRadius: "8px" };

function MobileCreateInner() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerFirst: "",
    customerLast: "",
    customerMobile: "",
    customerEmail: "",
    address: "",
    postcode: "",
    contactPhone: "",
    vehicleReg: "",
    vehicleMakeModel: "",
    serviceType: "Service",
    description: "",
    hours: "",
    accessNotes: "",
    windowStart: "",
    windowEnd: ""
  });

  function update(k, v) {setForm((f) => ({ ...f, [k]: v }));}

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        serviceMode: "mobile",
        vehicle: { reg: form.vehicleReg, makeModel: form.vehicleMakeModel },
        customer: {
          firstName: form.customerFirst,
          lastName: form.customerLast,
          email: form.customerEmail,
          mobile: form.customerMobile,
          address: form.address,
          postcode: form.postcode
        },
        requests: [{ description: form.description, time: form.hours, paymentType: "Customer" }],
        jobSource: "Mobile",
        jobDivision: "Retail",
        mobileDetails: {
          address: form.address,
          postcode: form.postcode,
          contactName: `${form.customerFirst} ${form.customerLast}`.trim(),
          contactPhone: form.contactPhone || form.customerMobile,
          windowStart: form.windowStart ? new Date(form.windowStart).toISOString() : null,
          windowEnd: form.windowEnd ? new Date(form.windowEnd).toISOString() : null,
          accessNotes: form.accessNotes
        }
      };
      const res = await fetch("/api/jobcards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed");
      showAlert(`Mobile job ${body.jobCard?.jobNumber} created`, "success");
      router.push(`/mobile/jobs/${encodeURIComponent(body.jobCard?.jobNumber)}`);
    } catch (err) {
      showAlert(err.message || "Failed to create mobile job", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form style={pageStyle} onSubmit={submit}>
      <h1 style={{ margin: 0 }}>New Mobile Job</h1>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>Customer</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <label style={labelStyle}>First name<input style={inputStyle} value={form.customerFirst} onChange={(e) => update("customerFirst", e.target.value)} required /></label>
          <label style={labelStyle}>Last name<input style={inputStyle} value={form.customerLast} onChange={(e) => update("customerLast", e.target.value)} required /></label>
          <label style={labelStyle}>Mobile<input style={inputStyle} value={form.customerMobile} onChange={(e) => update("customerMobile", e.target.value)} required /></label>
          <label style={labelStyle}>Email<input style={inputStyle} type="email" value={form.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} /></label>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>On-site visit</h2>
        <label style={labelStyle}>Address<input style={inputStyle} value={form.address} onChange={(e) => update("address", e.target.value)} required /></label>
        <label style={labelStyle}>Postcode<input style={inputStyle} value={form.postcode} onChange={(e) => update("postcode", e.target.value)} required /></label>
        <label style={labelStyle}>Contact number on site<input style={inputStyle} value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="Defaults to customer mobile" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <label style={labelStyle}>Window start<input style={inputStyle} type="datetime-local" value={form.windowStart} onChange={(e) => update("windowStart", e.target.value)} /></label>
          <label style={labelStyle}>Window end<input style={inputStyle} type="datetime-local" value={form.windowEnd} onChange={(e) => update("windowEnd", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Access notes<textarea style={inputStyle} rows={3} value={form.accessNotes} onChange={(e) => update("accessNotes", e.target.value)} placeholder="e.g. gate code, parking, dog on site" /></label>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>Vehicle & work</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <label style={labelStyle}>Reg<input style={inputStyle} value={form.vehicleReg} onChange={(e) => update("vehicleReg", e.target.value.toUpperCase())} required /></label>
          <label style={labelStyle}>Make & model<input style={inputStyle} value={form.vehicleMakeModel} onChange={(e) => update("vehicleMakeModel", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Service type
          <select style={inputStyle} value={form.serviceType} onChange={(e) => update("serviceType", e.target.value)}>
            <option>Service</option>
            <option>Repair</option>
            <option>Diagnostic</option>
            <option>MOT Prep</option>
          </select>
        </label>
        <label style={labelStyle}>Description of work<textarea style={inputStyle} rows={3} required value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
        <label style={labelStyle}>Estimated hours<input style={inputStyle} type="number" step="0.25" value={form.hours} onChange={(e) => update("hours", e.target.value)} /></label>
      </section>

      <button
        type="submit"
        disabled={submitting}
        style={{ padding: "12px", borderRadius: "8px", background: "var(--primary, #2563eb)", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}>
        
        {submitting ? "Creating…" : "Create mobile job"}
      </button>
    </form>);

}

export default function Page() {
  return <PageUi view="section1" MobileCreateInner={MobileCreateInner} ProtectedRoute={ProtectedRoute} />;




}
