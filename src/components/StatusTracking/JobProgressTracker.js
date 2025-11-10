// file location: src/components/StatusTracking/JobProgressTracker.js
// Displays a vertical job status timeline with a central connector

import React, { useMemo } from "react";

const COLORS = {
  current: "#c00000",
  complete: "#c00000",
  base: "#e0e0e0",
  panelBg: "#fff",
  textDark: "#1f2933",
  textMuted: "#6b7280",
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function JobProgressTracker({ statuses = [], currentStatus }) {
  const normalizedCurrent = currentStatus?.toLowerCase() || null;
  const orderedStatuses = Array.isArray(statuses) ? statuses : [];

  const currentIndex = useMemo(() => {
    if (!normalizedCurrent) return -1;
    return orderedStatuses.findIndex((item) => {
      const candidate =
        item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || null;
      return candidate === normalizedCurrent;
    });
  }, [normalizedCurrent, orderedStatuses]);

  return (
    // Outer wrapper keeps the card styling consistent with the rest of the UI shell
    <div
      style={{
        backgroundColor: COLORS.panelBg,
        borderRadius: "16px",
        border: "1px solid #ffe0e0",
        padding: "16px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Section label keeps consistent naming requested by spec */}
      <h3
        style={{
          margin: 0,
          marginBottom: "16px",
          fontSize: "16px",
          fontWeight: 700,
          color: COLORS.textDark,
        }}
      >
        Timeline Overview
      </h3>

      {/* Scrollable area so long timelines remain accessible */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 8px 12px 8px",
          minHeight: 0,
        }}
      >
        {/* Central spine for the vertical process flow */}
        <div
          style={{
            position: "absolute",
            left: "34px",
            top: "16px",
            bottom: "16px",
            width: "2px",
            background: "linear-gradient(180deg, #fbe1e1, #f9b0b0)",
            pointerEvents: "none",
          }}
        />

        {/* Each status entry renders a node + detail card */}
        {orderedStatuses.map((item, index) => {
          const lowerStatus =
            item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || "";
          const displayLabel = item?.label || item?.status || "Status";
          const isCurrent = normalizedCurrent
            ? lowerStatus === normalizedCurrent
            : index === orderedStatuses.length - 1;
          const isComplete = currentIndex > -1 && index < currentIndex;
          const nodeColor = isCurrent
            ? COLORS.current
            : isComplete
            ? COLORS.complete
            : COLORS.base;
          const connectorColor = isComplete ? COLORS.complete : COLORS.base;

          return (
            <div
              key={`${item?.status || item?.label || "status"}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "68px 1fr",
                alignItems: "start",
                gap: "16px",
                padding: "12px 0",
              }}
            >
              {/* Connector column: circle node + connecting line */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "column",
                  minHeight: "100%",
                }}
              >
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: nodeColor,
                    boxShadow: isCurrent
                      ? "0 0 14px rgba(192,0,0,0.4)"
                      : "0 0 8px rgba(224,224,224,0.8)",
                    border: isCurrent ? "2px solid #fff" : "2px solid #fef2f2",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
                {index < orderedStatuses.length - 1 && (
                  <span
                    style={{
                      flex: 1,
                      width: "2px",
                      backgroundColor: connectorColor,
                      marginTop: "4px",
                    }}
                  />
                )}
              </div>

              {/* Status detail card with label + timestamp */}
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  border: isCurrent
                    ? "1px solid rgba(192,0,0,0.35)"
                    : "1px solid rgba(224,224,224,0.8)",
                  boxShadow: isCurrent
                    ? "0 8px 20px rgba(192,0,0,0.15)"
                    : "0 4px 12px rgba(15,23,42,0.08)",
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  fontFamily: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = isCurrent
                    ? "0 10px 24px rgba(192,0,0,0.25)"
                    : "0 8px 18px rgba(15,23,42,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = isCurrent
                    ? "0 8px 20px rgba(192,0,0,0.15)"
                    : "0 4px 12px rgba(15,23,42,0.08)";
                }}
              >
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: isCurrent ? COLORS.current : COLORS.textDark,
                      textTransform: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayLabel}
                  </div>
                  {item?.department && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: COLORS.textMuted,
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.department}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: COLORS.textMuted,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTimestamp(item?.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
