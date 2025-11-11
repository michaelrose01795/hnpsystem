// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getAllJobs } from "@/lib/database/jobs";
import { supabase } from "@/lib/supabaseClient";

const Section = ({ title, children, subtitle }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "20px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 12px 30px rgba(209,0,0,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const normalizeName = (value = "") => String(value).trim().toLowerCase();

const mapTasksFromJob = (job) => {
  if (!job) return [];
  const source = Array.isArray(job.requests)
    ? job.requests
    : typeof job.requests === "string"
    ? job.requests.split(/\r?\n+/)
    : job.description
    ? job.description.split(",")
    : [];

  return source
    .map((entry) => {
      if (!entry) return null;
      const label = typeof entry === "string" ? entry.trim() : entry?.label || entry?.description;
      if (!label) return null;
      return {
        label,
        duration: entry?.duration || "—",
      };
    })
    .filter(Boolean);
};

const mapConsumables = (parts = []) =>
  parts.map((part) => {
    const maxQty = Math.max(part.qty_in_stock || 0, (part.qty_on_order || 0) + 5, 20);
    const level = Math.min(100, Math.round(((part.qty_in_stock || 0) / maxQty) * 100));
    const status = level < 25 ? "Low" : level < 50 ? "Monitor" : "Healthy";
    return {
      id: part.id,
      name: part.name || part.part_number || "Part",
      level,
      status,
    };
  });

export default function TechsDashboard() {
  const today = dayjs().format("dddd D MMM");
  const { user } = useUser();
  const [jobs, setJobs] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  const [partsStock, setPartsStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJobs = async () => {
      if (!user?.username) return;
      setLoading(true);
      try {
        const allJobs = await getAllJobs();
        setJobs(allJobs);
        const normalizedUsername = normalizeName(user.username);
        const assigned = allJobs.filter((job) => {
          const assignedName =
            job.assignedTech?.name || job.technician || job.assignedTo || job.assigned_to || "";
          return normalizeName(assignedName) === normalizedUsername;
        });
        setAssignedJobs(assigned);
        setCurrentJob(assigned[0] || null);
      } catch (error) {
        console.error("❌ Failed to load technician jobs", error);
        setJobs([]);
        setAssignedJobs([]);
        setCurrentJob(null);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, [user?.username]);

  useEffect(() => {
    const loadConsumables = async () => {
      const { data, error } = await supabase
        .from("parts_catalog")
        .select("id, name, part_number, qty_in_stock, qty_on_order")
        .order("updated_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("❌ Failed to load consumables", error);
        setPartsStock([]);
        return;
      }
      setPartsStock(data || []);
    };

    loadConsumables();
  }, []);

  const kpiSummary = useMemo(() => {
    const completed = jobs.filter((job) => ["Complete", "Completed"].includes(job.status)).length;
    const assigned = assignedJobs.length || 1;
    return [
      { label: "Jobs completed", value: completed, helper: `of ${assignedJobs.length} assigned` },
      { label: "Hours booked", value: `${(assignedJobs.length * 1.5).toFixed(1)}h`, helper: "estimate" },
      {
        label: "Efficiency",
        value: `${Math.min(100, Math.round((completed / assigned) * 100))}%`,
        helper: "vs target",
      },
      { label: "VHC upsell", value: `£${(completed * 120).toFixed(0)}`, helper: "Authorised" },
    ];
  }, [jobs, assignedJobs.length]);

  const outstandingTasks = useMemo(() => mapTasksFromJob(currentJob), [currentJob]);
  const queueJobs = assignedJobs.slice(0, 4);
  const consumables = useMemo(() => mapConsumables(partsStock), [partsStock]);
  const waitingForParts = jobs
    .filter((job) => (job.waitingStatus || job.waiting_status || "").toLowerCase().includes("part"))
    .slice(0, 4);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #ffeaea, #fff5f5)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 18px 35px rgba(209,0,0,0.1)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Technician workspace · {today}
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>
            {user?.username ? `Hi ${user.username}, ready for your next job?` : "Technician workspace"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            View your assignments, parts status, and consumables at a glance.
          </p>
        </header>

        {loading ? (
          <Section title="Loading assignments" subtitle="Fetching latest workshop jobs">
            <span style={{ color: "#6b7280" }}>Loading job data…</span>
          </Section>
        ) : null}

        <Section
          title={currentJob ? `Current job · ${currentJob.jobNumber}` : "No active job"}
          subtitle={currentJob ? `${currentJob.makeModel || currentJob.reg}` : "Clock onto a job to see details"}
        >
          {currentJob ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ flex: "1 1 220px" }}>
                <p style={{ margin: 0, color: "#374151" }}>
                  <strong>Vehicle</strong> {currentJob.make} {currentJob.model} ({currentJob.reg})
                </p>
                <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Status: {currentJob.status}</p>
                <p style={{ margin: "4px 0 0", color: "#6b7280" }}>
                  Waiting: {currentJob.waitingStatus || "In progress"}
                </p>
                <p style={{ margin: "4px 0 0", color: "#6b7280" }}>
                  Last update: {dayjs(currentJob.updatedAt || currentJob.updated_at).format("DD MMM HH:mm")}
                </p>
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <p style={{ margin: 0, color: "#374151", fontWeight: 600 }}>Tasks</p>
                {outstandingTasks.length ? (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "8px 0 0",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {outstandingTasks.map((task) => (
                      <li
                        key={task.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          background: "#fff7f7",
                          border: "1px solid #ffe0e0",
                        }}
                      >
                        <span style={{ color: "#374151" }}>{task.label}</span>
                        <small style={{ color: "#6b7280" }}>{task.duration}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: "#6b7280", marginTop: "8px" }}>No outstanding tasks logged.</p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>No job currently assigned.</div>
          )}
        </Section>

        <Section title="Today's KPIs" subtitle="Auto-calculated from your queue">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
            {kpiSummary.map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  borderRadius: "14px",
                  border: "1px solid #ffdede",
                  background: "#fff",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#9ca3af" }}>{kpi.label}</span>
                <strong style={{ fontSize: "1.4rem", color: "#a00000" }}>{kpi.value}</strong>
                <span style={{ color: "#6b7280" }}>{kpi.helper}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Upcoming queue" subtitle="Next promised jobs">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {queueJobs.length === 0 && <span style={{ color: "#6b7280" }}>No jobs assigned yet.</span>}
            {queueJobs.map((job) => (
              <div
                key={job.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid #ffe0e0",
                  background: "#fff7f7",
                }}
              >
                <div>
                  <strong style={{ color: "#a00000" }}>{job.jobNumber}</strong>
                  <p style={{ margin: "4px 0 0", color: "#374151" }}>{job.reg}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#374151" }}>{job.description || "No concern logged"}</p>
                  <small style={{ color: "#6b7280" }}>Status: {job.status}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: "#374151" }}>
                    Updated {dayjs(job.updatedAt || job.updated_at).format("HH:mm")}
                  </p>
                  <span style={{ color: "#6b7280" }}>Bay: {job.jobCategories?.[0] || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
          <Section title="Open tasks" subtitle="Finish before handover">
            <ul
              style={{
                listStyle: "disc",
                paddingLeft: "18px",
                margin: 0,
                color: "#374151",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {outstandingTasks.length === 0 && <li>No outstanding tasks logged.</li>}
              {outstandingTasks.map((task) => (
                <li key={task.label}>
                  {task.label} · {task.duration}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Consumables" subtitle="Workshop stock near your bay">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {consumables.length === 0 && <span style={{ color: "#6b7280" }}>No consumable data.</span>}
              {consumables.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#374151" }}>{item.name}</strong>
                    <p style={{ margin: 0, color: "#6b7280" }}>{item.status}</p>
                  </div>
                  <div style={{ minWidth: "120px" }}>
                    <div style={{ height: "10px", borderRadius: "999px", background: "#ffe0e0" }}>
                      <div
                        style={{
                          width: `${item.level}%`,
                          height: "10px",
                          borderRadius: "999px",
                          background: item.level < 25 ? "#f97316" : "#d10000",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Parts on the way" subtitle="Check before booking road test">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {waitingForParts.length === 0 && <span style={{ color: "#6b7280" }}>No parts awaited.</span>}
              {waitingForParts.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #ffe0e0",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    background: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <strong style={{ color: "#a00000" }}>{job.jobNumber}</strong>
                  <span style={{ color: "#374151" }}>{job.waitingStatus || "Awaiting parts"}</span>
                  <small style={{ color: "#6b7280" }}>
                    Updated {dayjs(job.updatedAt || job.updated_at).format("HH:mm")}
                  </small>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
