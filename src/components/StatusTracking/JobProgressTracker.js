// file location: src/components/StatusTracking/JobProgressTracker.js
// Displays a vertical job status timeline with a central connector.
// Enhanced with display titles, visual grouping, highlight tagging, and cleaner layout.

import React, { useMemo, useState, useCallback } from "react"; // React core + hooks
import { DropdownField } from "@/components/ui/dropdownAPI"; // Dropdown filter component
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const COLORS = {
  current: "var(--accentText)", // Current status node colour
  complete: "var(--text-1)", // Completed status node colour
  base: "var(--surface)", // Default node colour for unknown statuses
  textDark: "var(--text-1)", // Primary text colour
  textMuted: "var(--text-1)", // Muted/secondary text colour
  connector: "var(--accent-purple)", // Timeline connector line colour
};

// Format a raw timestamp to a compact en-GB display string.
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "-- -- --"; // Placeholder for missing timestamps
  const date = new Date(timestamp); // Parse the timestamp
  if (Number.isNaN(date.getTime())) return timestamp; // Return raw value if unparseable
  return date.toLocaleString("en-GB", {
    day: "2-digit", // Two-digit day
    month: "short", // Abbreviated month name
    hour: "2-digit", // Two-digit hour
    minute: "2-digit", // Two-digit minute
  });
};

// Resolve an entry's most-recent timestamp (ms). For groups, use the newest
// child so a phase group sorts by its latest activity, not its first.
const getEntryNewestTime = (item) => {
  const times = []; // Collected valid timestamps in ms
  const push = (value) => {
    const ms = new Date(value).getTime(); // Parse candidate timestamp
    if (!Number.isNaN(ms)) times.push(ms); // Keep only valid dates
  };
  if (item?.group?.items?.length) {
    item.group.items.forEach((child) => push(child?.timestamp)); // Consider every child
  }
  push(item?.timestamp); // Always consider the entry's own timestamp
  return times.length ? Math.max(...times) : 0; // Newest wins; 0 sinks undated entries
};

// Check if a status value represents tech/VHC completion.
const isTechCompleteStatus = (value) => {
  if (!value) return false; // Guard against null
  const normalized = String(value).toLowerCase(); // Normalise for comparison
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

// Normalise a performer label, returning null for numeric-only values.
const normalizePerformerLabel = (value) => {
  if (!value) return null; // Guard against null
  const text = String(value).trim(); // Trim whitespace
  if (!text) return null; // Empty string
  return /^\d+$/.test(text) ? null : text; // Reject pure numeric IDs
};

// Resolve the performer/actor name from an entry's various fields.
const resolvePerformer = (item) => {
  if (!item) return "System"; // Default for null items
  const rawUser = item.user; // Check embedded user object
  if (rawUser) {
    if (typeof rawUser === "string") {
      const label = normalizePerformerLabel(rawUser); // String user value
      if (label) return label;
    } else if (typeof rawUser === "object") {
      const first = rawUser.first_name || rawUser.firstName || ""; // First name
      const last = rawUser.last_name || rawUser.lastName || ""; // Last name
      const fullName = [first, last].filter(Boolean).join(" ").trim(); // Combined full name
      const label =
        normalizePerformerLabel(fullName) ||
        normalizePerformerLabel(rawUser.name) ||
        normalizePerformerLabel(rawUser.email); // Fall through name fields
      if (label) return label;
    }
  }
  return (
    normalizePerformerLabel(item.userName) || // userName field
    normalizePerformerLabel(item.performedBy) || // performedBy field
    normalizePerformerLabel(item.meta?.userName) || // meta.userName field
    "System" // Last resort fallback
  );
};

// Resolve a filter key for the action dropdown from an entry.
const resolveActionKey = (item) => {
  if (item?.kind === "event") {
    return item?.eventType || item?.label || "Event"; // Event entries use eventType
  }
  return item?.status || item?.label || "Status"; // Status entries use status
};

// Flatten grouped entries for filtering, then re-apply filter results.
const flattenForFilter = (entries) => {
  const flat = []; // Flattened array of all individual entries
  entries.forEach((entry) => {
    if (entry.group && entry.group.items) {
      entry.group.items.forEach((child) => flat.push(child)); // Expand group children
    } else {
      flat.push(entry); // Individual entries pass through
    }
  });
  return flat;
};

// Map importance levels to opacity values for visual emphasis.
const IMPORTANCE_OPACITY = { 5: 1.0, 4: 1.0, 3: 0.9, 2: 0.7, 1: 0.5 }; // milestone/major/normal/minor/noise

// Render a single timeline entry card (used for both individual and group-child entries).
function TimelineCard({ item, isCompact, isEvent, isHighlighted, performer, isGroupChild }) {
  const isTechComplete = isTechCompleteStatus(item?.status) || isTechCompleteStatus(item?.label); // Check tech complete
  const displayTitle = item?.displayTitle || item?.label || item?.status || "Status"; // Use enhanced title
  const badgeLabel = item?.badgeLabel || (isEvent ? item?.department || "Action" : item?.department || "Status"); // Category badge
  const importance = item?.importance || 3; // Default to normal importance
  const isMilestone = importance >= 5; // Milestone entries get accent styling
  const explanation = item?.explanation || null; // Explanation text from explanationBuilder

  // Build contextual performer label.
  const performerLabel =
    item?.eventType === "clocking"
      ? `Technician: ${performer}` // Clocking entries prefix with "Technician:"
      : isTechComplete && performer
      ? `Completed by ${performer}` // Tech complete entries prefix with "Completed by"
      : performer; // Default performer name

  const primaryDetail =
    item?.description ||
    item?.meta?.notes ||
    (isTechComplete ? "Tech has completed all work on this job." : null) ||
    null; // Primary detail text

  // Importance-driven opacity: use importance score when available, fall back to highlight flag.
  const cardOpacity = item?.importance
    ? (IMPORTANCE_OPACITY[importance] || 0.9) // Score-based opacity
    : (isHighlighted === false ? 0.7 : 1); // Fallback to highlight-based

  return (
    <LayerSurface
      radius="var(--radius-xs)"
      padding="10px 12px"
      gap="6px"
      style={{
        width: "100%",
        boxShadow: isMilestone ? "inset 3px 0 0 0 var(--accent-purple)" : "none",
        fontFamily: "var(--font-family)",
        minHeight: isGroupChild ? "auto" : isCompact ? "52px" : "60px",
        opacity: cardOpacity,
        transition: "opacity 0.2s ease",
      }}
    >
      <div style={{ textAlign: "left", minWidth: 0 }}>
        {/* Title row: display title + category badge */}
        <div
          style={{
            fontSize: isGroupChild ? "13px" : isCompact ? "14px" : "15px", // Slightly reduced title size
            fontWeight: isMilestone ? 800 : 700, // Extra bold for milestones
            color: COLORS.textDark, // Primary text colour
            lineHeight: 1.25, // Tight line height
            display: "flex",
            justifyContent: "space-between",
            gap: isCompact ? "6px" : "8px", // Gap between title and badge
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {displayTitle}
          <span
            className={`app-badge ${isEvent ? "app-badge--accent-soft" : "app-badge--neutral"}`}
            style={{
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {badgeLabel}
          </span>
        </div>

        {/* Performer + timestamp on a single row with dot separator */}
        <div
          style={{
            fontSize: "12px",
            color: COLORS.textMuted,
            display: "flex",
            flexDirection: "row", // Horizontal layout
            alignItems: "center",
            gap: "6px",
            marginTop: "2px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>{performerLabel}</span>
          <span style={{ color: "var(--grey-accent-light)" }}>·</span>
          <span>{formatTimestamp(item?.timestamp)}</span>
        </div>

        {/* Explanation line — plain-English context for the event */}
        {explanation && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--grey-accent)",
              lineHeight: 1.4,
              marginTop: "3px",
              fontStyle: "italic",
            }}
          >
            {explanation}
          </div>
        )}

        {/* Detail block — subtler styling without heavy borders */}
        {primaryDetail && (
          <div
            style={{
              marginTop: "4px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: COLORS.textMuted,
                lineHeight: 1.4,
                whiteSpace: "normal",
                wordBreak: "break-word",
                backgroundColor: "var(--surface)", // Subtle inline highlight, not a surface wrapper
                borderRadius: "var(--radius-xs)",
                padding: "5px 8px", // Tighter padding
                display: "inline-block",
              }}
            >
              {primaryDetail}
            </span>
          </div>
        )}
      </div>
    </LayerSurface>
  );
}

// Render a collapsible group header with child entries.
function TimelineGroup({ entry, isCompact, isExpanded, onToggle, nodeColor, connectorColor, showTopConnector, showBottomConnector }) {
  const group = entry.group; // Group metadata
  if (!group) return null; // Guard against non-group entries

  return (
    <div
      style={{
        position: "relative",
        paddingLeft: isCompact ? "32px" : "42px", // Same indent as individual entries
        marginBottom: isCompact ? "4px" : "6px", // Tightened gap
      }}
    >
      {/* Connector line above */}
      {showTopConnector && (
        <span
          style={{
            position: "absolute",
            left: isCompact ? "17px" : "24px",
            top: 0,
            width: "2.5px", // Thicker connector
            height: "50%",
            backgroundColor: connectorColor,
            zIndex: 1,
          }}
        />
      )}

      {/* Group dot — timeline diagram primitive, exempt from border ban */}
      <span
        style={{
          position: "absolute",
          left: isCompact ? "11px" : "18px",
          top: "14px", // Position dot near the group header text
          width: isCompact ? "12px" : "14px",
          height: isCompact ? "12px" : "14px",
          borderRadius: "var(--radius-full)",
          backgroundColor: nodeColor,
          // timeline dot 2px halo — diagram primitive, not a surface border
          border: "2px solid var(--surface)",
          zIndex: 2,
        }}
      />

      {/* Connector line below */}
      {showBottomConnector && (
        <span
          style={{
            position: "absolute",
            left: isCompact ? "17px" : "24px",
            top: "50%",
            width: "2.5px", // Thicker connector
            height: "calc(100% + 8px)",
            backgroundColor: connectorColor,
            zIndex: 1,
          }}
        />
      )}

      {/* Group header — clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="app-btn app-btn--sm app-btn--secondary"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          boxShadow: group.phaseColor ? `inset 3px 0 0 0 ${group.phaseColor}` : "none",
          fontFamily: "var(--font-family)",
          textAlign: "left",
        }}
      >
        <span>{group.groupLabel}</span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--grey-accent)",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded group children */}
      {isExpanded && group.items && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginTop: "4px",
            paddingLeft: "8px", // Indent children slightly
          }}
        >
          {group.items.map((child, childIndex) => {
            const isEvent = child?.kind === "event"; // Check if child is an event
            const performer = resolvePerformer(child); // Resolve performer for child
            return (
              <TimelineCard
                key={`group-child-${child?.id || childIndex}`}
                item={child}
                isCompact={isCompact}
                isEvent={isEvent}
                isCurrent={false}
                isHighlighted={child.isHighlighted}
                performer={performer}
                isGroupChild={true}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function JobProgressTracker({
  statuses = [],
  currentStatus,
  currentStatusId = null,
  isCompact = false,
  flags = {},
}) {
  const [selectedUser, setSelectedUser] = useState("all"); // User filter state
  const [selectedAction, setSelectedAction] = useState("all"); // Action filter state
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // Track expanded group IDs

  const normalizedCurrent =
    typeof currentStatus === "string" ? currentStatus.toLowerCase() : currentStatusId || null; // Normalise current status for comparison
  const orderedStatuses = useMemo(() => (Array.isArray(statuses) ? statuses : []), [statuses]); // Guard against non-array input

  // Tag each entry with its chronological index for current/complete determination.
  const chronologicalStatuses = useMemo(
    () =>
      orderedStatuses.map((item, index) => ({
        ...item,
        __chronologicalIndex: index,
      })),
    [orderedStatuses]
  );

  // Find the index of the current status in the chronological array.
  const currentIndex = useMemo(() => {
    if (!normalizedCurrent) return -1; // No current status to find
    return chronologicalStatuses.findIndex((item) => {
      const candidate =
        item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || null; // Normalise candidate
      return candidate === normalizedCurrent; // Match against current
    });
  }, [normalizedCurrent, chronologicalStatuses]);

  // Build user filter options from all entries (including group children).
  const allFlatEntries = useMemo(() => flattenForFilter(chronologicalStatuses), [chronologicalStatuses]); // Flatten for filter option generation

  const userOptions = useMemo(() => {
    const unique = new Map(); // Deduplicate performers
    allFlatEntries.forEach((item) => {
      const performer = resolvePerformer(item); // Resolve performer name
      if (performer) unique.set(performer, performer); // Add to unique set
    });
    return [
      { value: "all", label: "All users" }, // Default option
      ...Array.from(unique.values()).map((value) => ({
        value,
        label: value,
      })),
    ];
  }, [allFlatEntries]);

  // Build action filter options from all entries.
  const actionOptions = useMemo(() => {
    const unique = new Map(); // Deduplicate actions
    allFlatEntries.forEach((item) => {
      const actionKey = resolveActionKey(item); // Resolve action key
      const label = typeof actionKey === "string" ? actionKey.replace(/_/g, " ") : actionKey; // Clean label
      if (actionKey) unique.set(actionKey, label); // Add to unique set
    });
    return [
      { value: "all", label: "All actions" }, // Default option
      ...Array.from(unique.entries()).map(([value, label]) => ({
        value,
        label,
      })),
    ];
  }, [allFlatEntries]);

  // Apply user/action filters to the enhanced entries (dedup already handled upstream).
  const filteredStatuses = useMemo(() => {
    return chronologicalStatuses.filter((item) => {
      // For grouped entries, check if any child matches the filter.
      if (item.group && item.group.items) {
        return item.group.items.some((child) => {
          const performer = resolvePerformer(child); // Resolve child performer
          const actionKey = resolveActionKey(child); // Resolve child action key
          const matchesUser = selectedUser === "all" || performer === selectedUser; // User filter check
          const matchesAction = selectedAction === "all" || actionKey === selectedAction; // Action filter check
          return matchesUser && matchesAction; // Both must match
        });
      }

      // Individual entries: check directly.
      const performer = resolvePerformer(item); // Resolve performer
      const actionKey = resolveActionKey(item); // Resolve action key
      const matchesUser = selectedUser === "all" || performer === selectedUser; // User filter check
      const matchesAction = selectedAction === "all" || actionKey === selectedAction; // Action filter check
      return matchesUser && matchesAction; // Both must match
    });
  }, [chronologicalStatuses, selectedUser, selectedAction]);

  // Newest-first display order: sort top-level entries by their most-recent
  // timestamp (descending) and reverse children inside groups too, so the
  // newest change is always at the top and the oldest at the bottom.
  const displayStatuses = useMemo(() => {
    const sorted = [...filteredStatuses].sort(
      (a, b) => getEntryNewestTime(b) - getEntryNewestTime(a)
    );
    return sorted.map((item) => {
      if (item.group && Array.isArray(item.group.items)) {
        return {
          ...item,
          group: {
            ...item.group,
            items: [...item.group.items].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ),
          },
        };
      }
      return item;
    });
  }, [filteredStatuses]);

  // Toggle a group's expanded/collapsed state.
  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev); // Clone the set
      if (next.has(groupId)) {
        next.delete(groupId); // Collapse if expanded
      } else {
        next.add(groupId); // Expand if collapsed
      }
      return next;
    });
  }, []);

  return (
    // Outer wrapper keeps the card styling consistent with the rest of the UI shell
    <LayerTheme
      radius="var(--radius-md)"
      padding={isCompact ? "var(--section-card-padding-sm, 16px)" : "12px"}
      gap="12px"
      style={{
        height: "auto",
        minHeight: 0,
      }}
    >
      {/* Header row: title with the user/action filters inline on the same row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: isCompact ? "8px" : "12px",
          alignItems: isCompact ? "stretch" : "center",
          flexDirection: isCompact ? "column" : "row",
          justifyContent: "space-between",
          marginBottom: isCompact ? "12px" : "14px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: isCompact ? "15px" : "16px",
            fontWeight: 700,
            color: COLORS.textDark,
          }}
        >
          Timeline
        </h3>

        {/* Compact filters — app-autowidth sizes each control to its longest
            option, and the menu grows to max-content so no option is clipped. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <DropdownField
            id="timeline-filter-user"
            label="Users"
            className="app-autowidth"
            options={userOptions}
            value={selectedUser}
            onChange={(event) => setSelectedUser(event.target.value)}
            size="sm"
            usePortal={false}
            style={{ width: "fit-content" }}
            menuStyle={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "auto",
              right: 0,
              minWidth: "max-content",
            }}
          />
          <DropdownField
            id="timeline-filter-action"
            label="Actions"
            className="app-autowidth"
            options={actionOptions}
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.target.value)}
            size="sm"
            usePortal={false}
            style={{ width: "fit-content" }}
            menuStyle={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: "auto",
              right: 0,
              minWidth: "max-content",
            }}
          />
        </div>
      </div>

      {/* Timeline content grows naturally; the Job Tracker sidebar owns scrolling. */}
      <div
        style={{
          position: "relative",
          flex: "0 0 auto",
          overflowY: "visible",
          overflowX: "hidden",
          padding: "0 4px 8px 4px",
          minHeight: 0,
        }}
      >
        {/* Render each status entry as a node + detail card or group */}
        {displayStatuses.map((item, index) => {
          const lowerStatus =
            item?.status?.toLowerCase?.() || item?.label?.toLowerCase?.() || ""; // Normalised status
          const isEvent = item?.kind === "event"; // Check if event type
          const isCurrent = normalizedCurrent
            ? lowerStatus === normalizedCurrent
            : item.__chronologicalIndex === chronologicalStatuses.length - 1; // Current status check
          const isComplete =
            currentIndex > -1 && item.__chronologicalIndex < currentIndex; // Completed status check
          const fallbackColor = isEvent ? "var(--accent-orange)" : COLORS.base; // Default node colour
          const resolvedColor = item?.color || fallbackColor; // Resolved colour from entry or fallback
          const nodeColor = isEvent
            ? resolvedColor
            : isCurrent
            ? COLORS.current
            : isComplete
            ? COLORS.complete
            : resolvedColor; // Final node colour
          const connectorColor = COLORS.connector; // Connector line colour
          const showTopConnector = index > 0; // Show top connector if not first entry
          const showBottomConnector = index < displayStatuses.length - 1; // Show bottom connector if not last entry

          // Grouped entries render as collapsible headers.
          if (item.group) {
            return (
              <TimelineGroup
                key={`group-${item.group.groupId || index}`}
                entry={item}
                isCompact={isCompact}
                isExpanded={expandedGroups.has(item.group.groupId)}
                onToggle={() => toggleGroup(item.group.groupId)}
                nodeColor={nodeColor}
                connectorColor={connectorColor}
                showTopConnector={showTopConnector}
                showBottomConnector={showBottomConnector}
              />
            );
          }

          // Individual entries render as a timeline node + card.
          const performer = resolvePerformer(item); // Resolve performer name

          return (
            <div
              key={`${item?.status || item?.label || "status"}-${index}`}
              style={{
                position: "relative",
                paddingLeft: isCompact ? "32px" : "42px", // Indent for timeline dot
                marginBottom: isCompact ? "4px" : "6px", // Tightened gap between entries
              }}
            >
              {/* Top connector line */}
              {showTopConnector && (
                <span
                  style={{
                    position: "absolute",
                    left: isCompact ? "17px" : "24px",
                    top: 0,
                    width: "2.5px", // Thicker connector line
                    height: "50%",
                    backgroundColor: connectorColor,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Timeline dot */}
              <span
                style={{
                  position: "absolute",
                  left: isCompact ? "11px" : "18px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: isCompact ? "12px" : "14px",
                  height: isCompact ? "12px" : "14px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: nodeColor,
                  // timeline dot 2px halo — diagram primitive, not a surface border
                  border: "2px solid var(--surface)",
                  boxShadow: isCurrent
                    ? "0 0 10px rgba(var(--danger-rgb), 0.3)" // Subtle glow for current status
                    : "none",
                  zIndex: 2,
                }}
              />

              {/* Bottom connector line */}
              {showBottomConnector && (
                <span
                  style={{
                    position: "absolute",
                    left: isCompact ? "17px" : "24px",
                    top: "50%",
                    width: "2.5px", // Thicker connector line
                    height: isCompact ? "calc(100% + 8px)" : "calc(100% + 10px)",
                    backgroundColor: connectorColor,
                    zIndex: 1,
                  }}
                />
              )}

              {/* Status detail card */}
              <TimelineCard
                item={item}
                isCompact={isCompact}
                isEvent={isEvent}
                isCurrent={isCurrent}
                isHighlighted={item.isHighlighted}
                performer={performer}
                isGroupChild={false}
              />
            </div>
          );
        })}
      </div>

      {/* Debug mode: show raw entry data */}
      {flags.debug_mode_enabled && (
        <LayerSurface
          radius="var(--radius-xs)"
          padding="8px"
          style={{
            marginTop: "12px",
            fontSize: "10px",
            fontFamily: "var(--font-family-mono)",
            maxHeight: "200px",
            overflowY: "auto",
            color: "var(--grey-accent)",
          }}
        >
          <strong>Debug: {displayStatuses.length} entries displayed</strong>
          <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              displayStatuses.map((item) => ({
                status: item.status,
                label: item.label,
                displayTitle: item.displayTitle,
                kind: item.kind,
                eventType: item.eventType,
                isHighlighted: item.isHighlighted,
                importance: item.importance,
                importanceLabel: item.importanceLabel,
                phase: item.phase,
                actorConfidence: item.actorConfidence,
                explanation: item.explanation,
                group: item.group ? item.group.groupLabel : null,
                phaseId: item.group?.phaseId || null,
              })),
              null,
              2
            )}
          </pre>
        </LayerSurface>
      )}
    </LayerTheme>
  );
}
