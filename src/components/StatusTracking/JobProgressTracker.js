// file location: src/components/StatusTracking/JobProgressTracker.js
// Displays a vertical job status timeline with a central connector

import React, { useMemo, useState } from "react";
import { DropdownField } from "@/components/dropdownAPI";

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

const isTechCompleteStatus = (value) => {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return (
    normalized === "tech complete" ||
    normalized === "tech_complete" ||
    normalized === "vhc complete" ||
    normalized === "vhc_complete" ||
    normalized === "vhc completed" ||
    normalized === "vhc_completed" ||
    normalized === "technician work completed" ||
    normalized === "technician_work_completed"
  );
};

export default function JobProgressTracker({
  statuses = [],
  currentStatus,
  currentStatusId = null,
  currentStatusMeta = null,
  isWide = false,
}) {
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const normalizedCurrent =
    typeof currentStatus === "string" ? currentStatus.toLowerCase() : currentStatusId || null;
  const orderedStatuses = Array.isArray(statuses) ? statuses : [];

  const chronologicalStatuses = useMemo(
    () =>
      orderedStatuses.map((item, index) => ({
        ...item,
        __chronologicalIndex: index,
      })),
    [orderedStatuses]
  );

  const currentIndex = useMemo(() => {
    if (!normalizedCurrent) return -1;
    return chronologicalStatuses.findIndex((item) => {
      const candidate =
        item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || null;
      return candidate === normalizedCurrent;
    });
  }, [normalizedCurrent, chronologicalStatuses]);

  const normalizePerformerLabel = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    return /^\d+$/.test(text) ? null : text;
  };

  const resolvePerformer = (item) => {
    if (!item) return "System";
    const rawUser = item.user;
    if (rawUser) {
      if (typeof rawUser === "string") {
        const label = normalizePerformerLabel(rawUser);
        if (label) return label;
      } else if (typeof rawUser === "object") {
        const first = rawUser.first_name || rawUser.firstName || "";
        const last = rawUser.last_name || rawUser.lastName || "";
        const fullName = [first, last].filter(Boolean).join(" ").trim();
        const label =
          normalizePerformerLabel(fullName) ||
          normalizePerformerLabel(rawUser.name) ||
          normalizePerformerLabel(rawUser.email);
        if (label) return label;
      }
    }
    return (
      normalizePerformerLabel(item.userName) ||
      normalizePerformerLabel(item.performedBy) ||
      normalizePerformerLabel(item.meta?.userName) ||
      "System"
    );
  };

  const resolveActionKey = (item) => {
    if (item?.kind === "event") {
      return item?.eventType || item?.label || "Event";
    }
    return item?.status || item?.label || "Status";
  };

  const userOptions = useMemo(() => {
    const unique = new Map();
    chronologicalStatuses.forEach((item) => {
      const performer = resolvePerformer(item);
      if (performer) {
        unique.set(performer, performer);
      }
    });
    return [
      { value: "all", label: "All users" },
      ...Array.from(unique.values()).map((value) => ({
        value,
        label: value,
      })),
    ];
  }, [chronologicalStatuses]);

  const actionOptions = useMemo(() => {
    const unique = new Map();
    chronologicalStatuses.forEach((item) => {
      const actionKey = resolveActionKey(item);
      const label =
        typeof actionKey === "string" ? actionKey.replace(/_/g, " ") : actionKey;
      if (actionKey) {
        unique.set(actionKey, label);
      }
    });
    return [
      { value: "all", label: "All actions" },
      ...Array.from(unique.entries()).map(([value, label]) => ({
        value,
        label,
      })),
    ];
  }, [chronologicalStatuses]);

  const filteredStatuses = useMemo(() => {
    return chronologicalStatuses.filter((item) => {
      const performer = resolvePerformer(item);
      const actionKey = resolveActionKey(item);
      const matchesUser = selectedUser === "all" || performer === selectedUser;
      const matchesAction = selectedAction === "all" || actionKey === selectedAction;
      return matchesUser && matchesAction;
    });
  }, [chronologicalStatuses, selectedUser, selectedAction]);

  const displayStatuses = useMemo(
    () => [...filteredStatuses].reverse(),
    [filteredStatuses]
  );

  return (
    // Outer wrapper keeps the card styling consistent with the rest of the UI shell
    <div
      style={{
        backgroundColor: COLORS.panelBg,
        borderRadius: "16px",
        border: "1px solid var(--surface-light)",
        padding: "12px",
        boxShadow: "none",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 700,
            color: COLORS.textDark,
          }}
        >
          Timeline
        </h3>
        {currentStatusMeta && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--surface)",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              padding: "8px 12px",
              minWidth: isWide ? "240px" : "100%",
            }}
          >
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "999px",
                backgroundColor: currentStatusMeta?.color || COLORS.base,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: COLORS.textDark }}>
                Current Status
              </span>
              <span style={{ fontSize: "13px", color: COLORS.textMuted }}>
                {currentStatusMeta?.label || currentStatus || "Unknown"}
                {currentStatusMeta?.department ? ` · ${currentStatusMeta.department}` : ""}
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isWide ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gap: "10px",
          marginBottom: "14px",
          padding: "12px",
          borderRadius: "12px",
          border: "1px solid var(--surface-light)",
          backgroundColor: "var(--surface)",
        }}
      >
        <DropdownField
          id="timeline-filter-user"
          label="Users"
          options={userOptions}
          value={selectedUser}
          onChange={(event) => setSelectedUser(event.target.value)}
          size="sm"
        />
        <DropdownField
          id="timeline-filter-action"
          label="Actions"
          options={actionOptions}
          value={selectedAction}
          onChange={(event) => setSelectedAction(event.target.value)}
          size="sm"
        />
      </div>

      {/* Scrollable area so long timelines remain accessible */}
      <div
        style={{
          position: "relative",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 4px 8px 4px",
          minHeight: 0,
        }}
      >
        {/* Each status entry renders a node + detail card */}
        {displayStatuses.map((item, index) => {
          const lowerStatus =
            item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || "";
          const displayLabel = item?.label || item?.status || "Status";
          const isEvent = item?.kind === "event";
          const isCurrent = normalizedCurrent
            ? lowerStatus === normalizedCurrent
            : item.__chronologicalIndex === chronologicalStatuses.length - 1;
          const isComplete =
            currentIndex > -1 && item.__chronologicalIndex < currentIndex;
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
          const performer = resolvePerformer(item);
          const isTechComplete =
            isTechCompleteStatus(item?.status) || isTechCompleteStatus(item?.label);
          const performerLabel =
            isTechComplete && performer ? `Tech complete by ${performer}` : performer;
          const secondaryLine =
            item?.description ||
            item?.notes ||
            (isTechComplete ? "Tech has completed all work on this job." : null) ||
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
                paddingLeft: "42px",
                marginBottom: "10px",
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
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontFamily: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",
                  transition: "transform 0.2s ease",
                  minHeight: "72px",
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
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
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
                      fontSize: "12px",
                      color: COLORS.textMuted,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{performerLabel}</span>
                    <span>{formatTimestamp(item?.timestamp)}</span>
                  </div>
                  {secondaryLine && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        color: COLORS.textMuted,
                        lineHeight: 1.4,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
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
