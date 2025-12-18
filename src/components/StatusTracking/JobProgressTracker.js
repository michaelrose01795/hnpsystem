// file location: src/components/StatusTracking/JobProgressTracker.js
// Displays a vertical job status timeline with a central connector

import React, { useMemo } from "react";

const COLORS = {
  current: "var(--danger)",
  complete: "var(--danger)",
  base: "var(--surface-light)",
  panelBg: "var(--surface)",
  textDark: "var(--info-dark)",
  textMuted: "var(--info)",
  connector: "var(--danger)",
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
        border: "1px solid var(--surface-light)",
        padding: "16px",
        boxShadow: "none",
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
        Timeline
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
          const isEvent = item?.kind === "event";
          const isCurrent = normalizedCurrent
            ? lowerStatus === normalizedCurrent
            : index === orderedStatuses.length - 1;
          const isComplete = currentIndex > -1 && index < currentIndex;
          const fallbackColor = isEvent
            ? "var(--accent-orange)"
            : COLORS.base;
          const resolvedColor = item?.color || fallbackColor;
          const nodeColor = isEvent
            ? resolvedColor
            : isCurrent
            ? COLORS.current
            : isComplete
            ? COLORS.complete
            : resolvedColor;
          const connectorColor = COLORS.connector;
          const performer =
            item?.user ||
            item?.userName ||
            item?.performedBy ||
            item?.meta?.userName ||
            (item?.userId ? `User #${item.userId}` : null) ||
            "System";
          const secondaryLine =
            item?.description ||
            item?.notes ||
            item?.department ||
            item?.meta?.location ||
            null;
          const badgeLabel = isEvent
            ? (item?.eventType || "Action").replace(/_/g, " ")
            : item?.department || "Status";
          const showTopConnector = index > 0;
          const showBottomConnector =
            index < orderedStatuses.length - 1 && index > 0;

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
              {showTopConnector && (
                <span
                  style={{
                    position: "absolute",
                    left: "24px",
                    top: "-calc(50% + 12px)",
                    width: "2px",
                    height: "calc(50% + 12px)",
                    backgroundColor: connectorColor,
                    zIndex: 1,
                  }}
                />
              )}
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
                  border: "2px solid var(--surface)",
                  boxShadow: "none"
                    ? "0 0 14px rgba(var(--danger-rgb), 0.35)"
                    : "0 0 8px rgba(var(--danger-rgb), 0.15)",
                  zIndex: 2,
                }}
              />
              {showBottomConnector && (
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
                  backgroundColor: "var(--surface)",
                  borderRadius: "12px",
                  border: isCurrent
                    ? "1px solid rgba(var(--danger-rgb), 0.35)"
                    : "1px solid rgba(var(--background-rgb), 0.8)",
                  boxShadow: "none",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontFamily: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",
                  transition: "transform 0.2s ease",
                  minHeight: "96px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
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
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    {displayLabel}
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        backgroundColor: "var(--surface-light)",
                        borderRadius: "999px",
                        padding: "2px 8px",
                        color: isEvent ? "var(--accent-orange)" : "var(--grey-accent)",
                        border: "1px solid rgba(var(--grey-accent-rgb),0.3)",
                      }}
                    >
                      {badgeLabel}
                    </span>
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
