// file location: src/components/HR/HrTabLoadingSkeleton.js
import React from "react";
import { SkeletonBlock, SkeletonKeyframes, SkeletonMetricCard } from "@/components/ui/LoadingSkeleton";

function SkeletonPanel({ titleWidth = "180px", subtitleWidth = "260px", children }) {
  return (
    <div
      style={{
        background: "var(--section-card-bg, var(--surface))",
        borderRadius: "var(--radius-md)",
        padding: "var(--section-card-padding, 18px)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <SkeletonBlock width={titleWidth} height="18px" borderRadius="8px" />
        <SkeletonBlock width={subtitleWidth} height="12px" borderRadius="6px" />
      </div>
      {children}
    </div>
  );
}

function TableRows({ rows = 6, cols = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: "10px",
            padding: "12px 0",
            borderTop: rowIndex === 0 ? "none" : "1px solid rgba(var(--primary-rgb), 0.08)",
          }}
        >
          {Array.from({ length: cols }).map((__, colIndex) => (
            <SkeletonBlock
              key={colIndex}
              width={colIndex === 0 ? "74%" : colIndex === cols - 1 ? "56%" : "64%"}
              height="12px"
              borderRadius="6px"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRows({ rows = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingBottom: "12px",
            borderBottom: index === rows - 1 ? "none" : "1px solid rgba(var(--primary-rgb), 0.08)",
          }}
        >
          <SkeletonBlock width="42%" height="14px" borderRadius="6px" />
          <SkeletonBlock width="68%" height="12px" borderRadius="6px" />
          <SkeletonBlock width="54%" height="12px" borderRadius="6px" />
        </div>
      ))}
    </div>
  );
}

function DashboardVariant() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonMetricCard key={index} />
        ))}
      </div>

      <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "2fr 1.2fr" }}>
        <SkeletonPanel titleWidth="210px" subtitleWidth="300px">
          <TableRows rows={5} cols={4} />
        </SkeletonPanel>
        <SkeletonPanel titleWidth="150px" subtitleWidth="240px">
          <ListRows rows={4} />
        </SkeletonPanel>
      </div>

      <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "1.4fr 1fr" }}>
        <SkeletonPanel titleWidth="220px" subtitleWidth="280px">
          <TableRows rows={4} cols={4} />
        </SkeletonPanel>
        <SkeletonPanel titleWidth="150px" subtitleWidth="220px">
          <ListRows rows={4} />
        </SkeletonPanel>
      </div>
    </div>
  );
}

function EmployeesVariant() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <SkeletonBlock width="132px" height="38px" borderRadius="12px" />
      </div>

      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "minmax(340px, 1.1fr) minmax(320px, 1fr)" }}>
        <SkeletonPanel titleWidth="180px" subtitleWidth="250px">
          <div style={{ display: "grid", gap: "12px" }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "46px 1fr 24px",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <SkeletonBlock width="46px" height="46px" borderRadius="999px" />
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <SkeletonBlock width="58%" height="12px" borderRadius="6px" />
                  <SkeletonBlock width="42%" height="10px" borderRadius="6px" />
                  <SkeletonBlock width="50%" height="10px" borderRadius="6px" />
                </div>
                <SkeletonBlock width="12px" height="12px" borderRadius="6px" />
              </div>
            ))}
          </div>
        </SkeletonPanel>

        <SkeletonPanel titleWidth="190px" subtitleWidth="260px">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SkeletonBlock width="40%" height="12px" borderRadius="999px" />
            <SkeletonBlock width="56%" height="28px" borderRadius="8px" />
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    background: "rgba(var(--primary-rgb), 0.08)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                  }}
                >
                  <SkeletonBlock width="46%" height="10px" borderRadius="6px" />
                  <SkeletonBlock width="74%" height="14px" borderRadius="6px" />
                  <SkeletonBlock width="58%" height="10px" borderRadius="6px" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonPanel>
      </div>
    </div>
  );
}

function StandardVariant() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "1.5fr 1fr" }}>
        <SkeletonPanel titleWidth="200px" subtitleWidth="280px">
          <TableRows rows={6} cols={4} />
        </SkeletonPanel>
        <SkeletonPanel titleWidth="150px" subtitleWidth="210px">
          <ListRows rows={5} />
        </SkeletonPanel>
      </div>

      <SkeletonPanel titleWidth="190px" subtitleWidth="260px">
        <TableRows rows={5} cols={5} />
      </SkeletonPanel>
    </div>
  );
}

export default function HrTabLoadingSkeleton({ variant = "standard" }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" style={{ padding: "8px 8px 32px" }}>
      <SkeletonKeyframes />
      {variant === "dashboard" ? (
        <DashboardVariant />
      ) : variant === "employees" ? (
        <EmployeesVariant />
      ) : (
        <StandardVariant />
      )}
    </div>
  );
}
