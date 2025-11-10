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
  connector: "#c00000",
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "-- -- --";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
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
          const connectorColor = COLORS.connector;
          const performer =
            item?.user ||
            item?.userName ||
            item?.performedBy ||
            item?.userId ||
            "System";
          const secondaryLine = item?.description || item?.notes || item?.department;

          return (
            <div
              key={`${item?.status || item?.label || "status"}-${index}`}
              style={{
                position: "relative",
                paddingLeft: "48px",
                marginBottom: "12px",
              }}
            >
              {/* Dot + connector */}
              <span
                style={{
                  position: "absolute",
                  left: "18px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  backgroundColor: nodeColor,
                  border: "2px solid #fff",
                  boxShadow: isCurrent
                    ? "0 0 14px rgba(192,0,0,0.35)"
                    : "0 0 8px rgba(192,0,0,0.15)",
                  zIndex: 2,
                }}
              />
              {index < orderedStatuses.length - 1 && (
                <span
                  style={{
                    position: "absolute",
                    left: "24px",
                    top: "50%",
                    width: "2px",
                    height: "calc(100% + 16px)",
                    backgroundColor: connectorColor,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Status detail card */}
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
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontFamily: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  minHeight: "96px",
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
                      fontSize: "16px",
                      fontWeight: 700,
                      color: COLORS.textDark,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayLabel}
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "13px",
                      color: COLORS.textMuted,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{performer}</span>
                    <span>{formatTimestamp(item?.timestamp)}</span>
                  </div>
                  {secondaryLine && (
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "13px",
                        color: COLORS.textMuted,
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {secondaryLine}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
