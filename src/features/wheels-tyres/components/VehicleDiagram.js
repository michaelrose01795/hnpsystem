import React, { useMemo } from "react";
import styles from "./VehicleDiagram.module.css";

const WHEEL_POSITIONS = [
  { key: "NSF", label: "NSF", ariaLabel: "Nearside Front wheel" },
  { key: "OSF", label: "OSF", ariaLabel: "Offside Front wheel" },
  { key: "NSR", label: "NSR", ariaLabel: "Nearside Rear wheel" },
  { key: "OSR", label: "OSR", ariaLabel: "Offside Rear wheel" },
];

const EDITABLE_ROLE_KEYWORDS = ["workshop", "technician", "tech", "service"];

function normalizeRoleList(roles = []) {
  return roles.map((role) => String(role || "").toLowerCase().trim()).filter(Boolean);
}

function resolveWheelData(entry = {}) {
  if (!entry || typeof entry !== "object") {
    return { treadDepth: "-", condition: "unknown", notes: "" };
  }

  const fallbackDepth = entry.depth ?? entry.readingText ?? entry.treadDepth ?? "-";
  return {
    treadDepth: fallbackDepth === "" || fallbackDepth == null ? "-" : String(fallbackDepth),
    condition: String(entry.condition ?? entry.severity ?? "unknown").toLowerCase(),
    notes: entry.notes ?? "",
  };
}

function getConditionClass(condition = "unknown") {
  if (condition === "danger" || condition === "red") return styles.conditionDanger;
  if (condition === "advisory" || condition === "amber" || condition === "warning") return styles.conditionAdvisory;
  if (condition === "good" || condition === "green") return styles.conditionGood;
  return styles.conditionUnknown;
}

export default function VehicleDiagram({
  selectedWheel = null,
  onWheelSelect,
  wheelData = {},
  userRoles = [],
  viewOnly = false,
}) {
  const normalizedRoles = useMemo(() => normalizeRoleList(userRoles), [userRoles]);
  const hasWorkshopRole = normalizedRoles.some((role) => EDITABLE_ROLE_KEYWORDS.some((keyword) => role.includes(keyword)));

  // If roles are provided and none are workshop-related, enforce view-only mode.
  const isViewOnly = Boolean(viewOnly || (normalizedRoles.length > 0 && !hasWorkshopRole));
  const selectedKey = String(selectedWheel || "").toUpperCase();

  return (
    <section className={styles.wrapper} aria-label="Wheels and tyres vehicle diagram">
      <div className={styles.canvas}>
        <div className={styles.vehicleShell} aria-hidden="true">
          <div className={styles.roofWindow} />
          <div className={styles.frontWindow} />
          <div className={styles.rearWindow} />
          <div className={styles.centerTunnel} />
          <div className={styles.frontArchLeft} />
          <div className={styles.frontArchRight} />
          <div className={styles.rearArchLeft} />
          <div className={styles.rearArchRight} />
        </div>

        {WHEEL_POSITIONS.map(({ key, label, ariaLabel }) => {
          const state = resolveWheelData(wheelData[key] || wheelData[key.toLowerCase()]);
          const isSelected = selectedKey === key;
          const wheelStateClass = getConditionClass(state.condition);

          return (
            <div key={key} className={`${styles.wheelSlot} ${styles[`slot${key}`]}`}>
              <button
                type="button"
                className={[
                  styles.wheelButton,
                  wheelStateClass,
                  isSelected ? styles.selectedWheel : "",
                  isViewOnly ? styles.viewOnlyWheel : "",
                ].join(" ")}
                onClick={() => {
                  if (!isViewOnly) onWheelSelect?.(key);
                }}
                aria-label={`${ariaLabel}. Tread ${state.treadDepth}. ${isViewOnly ? "View only" : "Selectable"}`}
                aria-pressed={isSelected}
                title={state.notes ? `${label}: ${state.notes}` : `${label}: No notes`}
              >
                <span className={styles.wheelValue}>{state.treadDepth}</span>
                <span className={styles.wheelLabel}>{label}</span>
              </button>
            </div>
          );
        })}

        <span className={styles.frontLabel}>FRONT</span>
      </div>

      {isViewOnly ? (
        <p className={styles.permissionHint}>View-only mode: only workshop roles can select wheels.</p>
      ) : null}
    </section>
  );
}
