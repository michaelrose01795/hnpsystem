"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid #ffe0e0",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 180,
      background: "#fff",
      boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

export default function AccountsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoicesRaised, setInvoicesRaised] = useState(0);
  const [invoicesPaid, setInvoicesPaid] = useState(0);
  const [outstandingJobs, setOutstandingJobs] = useState([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const [raisedRes, paidRes, outstandingRes] = await Promise.all([
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("status", "Invoiced"),
          supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("status", "Collected"),
          supabase
            .from("jobs")
            .select("id,job_number,vehicle_reg,status,customer_id,updated_at")
            .in("status", ["Complete", "Completed"])
            .order("updated_at", { ascending: false })
            .limit(6),
        ]);

        setInvoicesRaised(raisedRes.count || 0);
        setInvoicesPaid(paidRes.count || 0);
        setOutstandingJobs(outstandingRes.data || []);
      } catch (fetchError) {
        console.error("Failed to load accounts dashboard", fetchError);
        setError(fetchError.message || "Unable to load financial metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #f9f5ff, #fff)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #e9d6ff",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Accounts cockpit
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Invoice performance</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track invoices raised, items collected, and jobs awaiting billing.
          </p>
        </header>

        <Section title="Invoice stats">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading financial KPIs…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Invoices raised" value={invoicesRaised} helper="Status set to Invoiced" />
              <MetricCard label="Invoices paid" value={invoicesPaid} helper="Collected status" />
              <MetricCard
                label="Outstanding balances"
                value={outstandingJobs.length}
                helper="Jobs awaiting billing"
              />
            </div>
          )}
        </Section>

        <Section title="Outstanding jobs" subtitle="Most recent completions without invoice">
          {outstandingJobs.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No outstanding jobs right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {outstandingJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #ffe0e0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#a00000" }}>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      Vehicle {job.vehicle_reg || "TBC"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{job.status}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
