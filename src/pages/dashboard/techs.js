// ✅ Imports converted to use absolute alias "@/"
import React, { useMemo } from "react";
import Layout from "@/components/Layout";
import dayjs from "dayjs";

const mockCurrentJob = {
  jobNumber: "JC1442",
  reg: "HN70 PWR",
  make: "Audi",
  model: "A4 Avant",
  advisor: "Nicola",
  promisedTime: "15:30",
  status: "In Progress",
  tasks: [
    { label: "Oil & filter", duration: "0.6h", done: true },
    { label: "Front brake pads", duration: "0.9h", done: false },
    { label: "Software update", duration: "0.3h", done: false },
  ],
};

const todaysQueue = [
  { jobNumber: "JC1445", reg: "KN19 RST", concern: "Rear tyres", eta: "09:30", bay: "Bay 3" },
  { jobNumber: "JC1448", reg: "NA70 VHC", concern: "MOT", eta: "10:15", bay: "MOT" },
  { jobNumber: "JC1451", reg: "GF18 ZED", concern: "Timing belt", eta: "11:45", bay: "Bay 1" },
  { jobNumber: "JC1454", reg: "KP67 HNP", concern: "Wheel alignment", eta: "13:00", bay: "Fast-fit" },
];

const kpiSummary = [
  { label: "Jobs completed", value: 2, helper: "Target 5" },
  { label: "Hours booked", value: "3.4h", helper: "of 7.5h" },
  { label: "Efficiency", value: "91%", helper: "+4% vs yesterday" },
  { label: "VHC upsell", value: "£320", helper: "Awaiting auth" },
];

const consumables = [
  { name: "Brake cleaner", level: 35, status: "Healthy" },
  { name: "Gloves", level: 18, status: "Low" },
  { name: "Cable ties", level: 52, status: "Healthy" },
];

const partsStatus = [
  { part: "Front brake pads", jobNumber: "JC1445", status: "Picked", eta: "On site" },
  { part: "Pollen filter", jobNumber: "JC1442", status: "Awaiting", eta: "11:00" },
  { part: "Timing belt kit", jobNumber: "JC1451", status: "Courier", eta: "13:20" },
];

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

export default function TechsDashboard() {
  const today = dayjs().format("dddd D MMM");
  const outstandingTasks = useMemo(
    () => mockCurrentJob.tasks.filter((task) => !task.done),
    []
  );

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
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Hi, ready for your next job?</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            View your assignments, parts status, and consumables at a glance.
          </p>
        </header>

        <Section title="Current job" subtitle={`${mockCurrentJob.make} ${mockCurrentJob.model} • ${mockCurrentJob.reg}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ flex: "1 1 220px" }}>
              <p style={{ margin: 0, color: "#374151" }}><strong>Job</strong> {mockCurrentJob.jobNumber}</p>
              <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Service Advisor: {mockCurrentJob.advisor}</p>
              <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Promised: {mockCurrentJob.promisedTime}</p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: "#fff1f1",
                  color: "#a00000",
                  marginTop: "8px",
                  fontWeight: 600,
                }}
              >
                {mockCurrentJob.status}
              </span>
            </div>
            <div style={{ flex: "1 1 280px" }}>
              <p style={{ margin: 0, color: "#374151", fontWeight: 600 }}>Tasks</p>
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {mockCurrentJob.tasks.map((task) => (
                  <li
                    key={task.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      background: task.done ? "#f0fdf4" : "#fff7f7",
                      border: `1px solid ${task.done ? "#bbf7d0" : "#ffe0e0"}`,
                    }}
                  >
                    <span style={{ color: "#374151" }}>{task.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <small style={{ color: "#6b7280" }}>{task.duration}</small>
                      <span role="img" aria-label={task.done ? "done" : "pending"}>
                        {task.done ? "✅" : "⏳"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Today's KPIs">
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
            {todaysQueue.map((job) => (
              <div
                key={job.jobNumber}
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
                  <p style={{ margin: 0, color: "#374151" }}>{job.concern}</p>
                  <small style={{ color: "#6b7280" }}>Bay: {job.bay}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, color: "#374151" }}>Arrival {job.eta}</p>
                  <span style={{ color: "#6b7280" }}>Prep ramp + parts</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
          <Section title="Open tasks" subtitle="Finish before handover">
            <ul style={{ listStyle: "disc", paddingLeft: "18px", margin: 0, color: "#374151", display: "flex", flexDirection: "column", gap: "6px" }}>
              {outstandingTasks.map((task) => (
                <li key={task.label}>{task.label} · {task.duration}</li>
              ))}
            </ul>
          </Section>

          <Section title="Consumables" subtitle="Workshop stock near your bay">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {consumables.map((item) => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              {partsStatus.map((part) => (
                <div
                  key={part.part}
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
                  <strong style={{ color: "#a00000" }}>{part.part}</strong>
                  <span style={{ color: "#374151" }}>Job {part.jobNumber}</span>
                  <small style={{ color: "#6b7280" }}>{part.status} · ETA {part.eta}</small>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
