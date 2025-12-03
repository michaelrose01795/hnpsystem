// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/pages/job-cards/[jobNumber]/vhc.js
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import themeConfig, {
  vhcLayoutStyles,
  createVhcButtonStyle,
  vhcCardStates,
} from "@/styles/appTheme";

// 🧩 Import database helper
import { getJobByNumberOrReg, saveChecksheet } from "@/lib/database/jobs";

// 🧩 Import section modals
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";

// Section labels
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator & Under Bonnet",
  externalInspection: "External / Drive-in Inspection",
  internalElectrics: "Internal / Lamps / Electrics",
  underside: "Underside",
};

const MANDATORY_SECTION_KEYS = ["wheelsTyres", "brakesHubs", "serviceIndicator"];
const trackedSectionKeys = new Set(MANDATORY_SECTION_KEYS);

const createDefaultSectionStatus = () =>
  MANDATORY_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = "pending";
    return acc;
  }, {});

const hasServiceIndicatorEntries = (indicator = {}) =>
  Boolean(indicator?.serviceChoice) ||
  Boolean(indicator?.oilStatus) ||
  (Array.isArray(indicator?.concerns) && indicator.concerns.length > 0);

const deriveSectionStatusFromSavedData = (savedData = {}) => {
  const derived = createDefaultSectionStatus();
  if (savedData.wheelsTyres && typeof savedData.wheelsTyres === "object") {
    derived.wheelsTyres = "complete";
  }
  const brakesData = savedData.brakesHubs;
  const hasBrakesContent =
    brakesData &&
    typeof brakesData === "object" &&
    Object.keys(brakesData).length > 0;
  if (hasBrakesContent) {
    derived.brakesHubs = "complete";
  }
  if (hasServiceIndicatorEntries(savedData.serviceIndicator || {})) {
    derived.serviceIndicator = "complete";
  }
  return derived;
};

// 🎨 Shared VHC design tokens so dashboard + tech view stay aligned
const styles = vhcLayoutStyles;

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // ✅ Initial VHC data structure
  const [jobInfo, setJobInfo] = useState(null);
  const [vhcData, setVhcData] = useState({
    wheelsTyres: null,
    brakesHubs: [],
    serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [] },
    externalInspection: [],
    internalElectrics: {
      "Lights Front": { concerns: [] },
      "Lights Rear": { concerns: [] },
      "Lights Interior": { concerns: [] },
      "Horn/Washers/Wipers": { concerns: [] },
      "Air Con/Heating/Ventilation": { concerns: [] },
      "Warning Lamps": { concerns: [] },
      Seatbelt: { concerns: [] },
      Miscellaneous: { concerns: [] },
    },
    underside: {
      "Exhaust System/Catalyst": { concerns: [] },
      Steering: { concerns: [] },
      "Front Suspension": { concerns: [] },
      "Rear Suspension": { concerns: [] },
      "Driveshafts/Oil Leaks": { concerns: [] },
      Miscellaneous: { concerns: [] },
    },
  });
  const [sectionStatus, setSectionStatus] = useState(createDefaultSectionStatus);

  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimeoutRef = useRef(null);

  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);

  const markSectionState = useCallback((sectionKey, nextState) => {
    if (!trackedSectionKeys.has(sectionKey)) return;
    setSectionStatus((prev) => {
      const current = prev[sectionKey] || "pending";
      if (current === nextState) return prev;
      if (nextState === "inProgress" && current === "complete") {
        return prev;
      }
      return { ...prev, [sectionKey]: nextState };
    });
  }, []);

  const openSection = useCallback(
    (sectionKey) => {
      markSectionState(sectionKey, "inProgress");
      setActiveSection(sectionKey);
    },
    [markSectionState]
  );

  /* ============================================
     LOAD EXISTING VHC DATA IF IT EXISTS
  ============================================= */
  useEffect(() => {
    if (!jobNumber) return;
    const loadVhc = async () => {
      try {
        setLoading(true);
        const job = await getJobByNumberOrReg(jobNumber);
        if (job) {
          setJobInfo(job);
        }
        if (job?.vhcChecks?.length > 0 && job.vhcChecks[0].data) {
          setVhcData((prev) => ({
            ...prev,
            ...job.vhcChecks[0].data,
            serviceIndicator:
              job.vhcChecks[0].data.serviceIndicator || prev.serviceIndicator,
          }));
          setSectionStatus(deriveSectionStatusFromSavedData(job.vhcChecks[0].data));
        } else {
          setSectionStatus(createDefaultSectionStatus());
        }
      } catch (err) {
        console.error("❌ Error loading VHC:", err);
      } finally {
        setLoading(false);
      }
    };
    loadVhc();
  }, [jobNumber]);

  /* ============================================
     SAVE VHC DATA TO DATABASE
  ============================================= */
  const persistVhcData = useCallback(
    async (payload, { quiet = false } = {}) => {
      if (!jobNumber) return false;
      try {
        setSaveStatus("saving");
        setSaveError("");
        const result = await saveChecksheet(jobNumber, payload);
        if (result.success) {
          setLastSavedAt(new Date());
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          if (quiet) {
            setSaveStatus("idle");
          } else {
            setSaveStatus("saved");
            saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
          }
          return true;
        }
        setSaveStatus("error");
        setSaveError(result.error?.message || "Failed to save VHC data.");
        return false;
      } catch (err) {
        console.error("❌ Error saving VHC:", err);
        setSaveStatus("error");
        setSaveError(err.message || "Unexpected error saving VHC data.");
        return false;
      }
    },
    [jobNumber]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /* ============================================
     BUTTON HANDLERS
  ============================================= */
  const handleBack = async () => {
    const success = await persistVhcData(vhcData, { quiet: true });
    if (!success) {
      alert("Unable to save your VHC progress. Please try again before leaving.");
      return;
    }
    const targetJobNumber = jobInfo?.jobNumber || jobNumber;
    router.push(
      targetJobNumber ? `/job-cards/myjobs/${targetJobNumber}` : "/job-cards/myjobs"
    );
  };

  const handleComplete = async () => {
    if (!mandatoryComplete) return;
    const success = await persistVhcData(vhcData);
    if (!success) {
      alert("We couldn't save your VHC data. Please try again.");
      return;
    }
    const targetJobNumber = jobInfo?.jobNumber || jobNumber;
    router.push(
      targetJobNumber ? `/job-cards/myjobs/${targetJobNumber}` : "/job-cards/myjobs"
    );
  };

  const mandatoryStates = MANDATORY_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = sectionStatus[key] === "complete";
    return acc;
  }, {});

  const totalMandatorySections = MANDATORY_SECTION_KEYS.length;
  const completedMandatorySections = Object.values(mandatoryStates).filter(Boolean).length;
  const mandatoryComplete = completedMandatorySections === totalMandatorySections;
  const mandatoryProgress = Math.round(
    (completedMandatorySections / totalMandatorySections) * 100
  );

  const optionalKeys = ["externalInspection", "internalElectrics", "underside"];

  const tyreConcernTotals = useMemo(() => {
    const tyres = vhcData?.wheelsTyres;
    if (!tyres || typeof tyres !== "object") {
      return { total: 0, amber: 0, red: 0 };
    }
    let amber = 0;
    let red = 0;
    Object.values(tyres).forEach((entry) => {
      const concerns = Array.isArray(entry?.concerns) ? entry.concerns : [];
      concerns.forEach((concern) => {
        const status = (concern?.status || "").toString().trim().toLowerCase();
        if (status === "amber") amber += 1;
        if (status === "red") red += 1;
      });
    });
    return { total: amber + red, amber, red };
  }, [vhcData?.wheelsTyres]);

  const getOptionalCount = (section) => {
    const value = vhcData[section];
    if (!value) return 0;
    if (Array.isArray(value)) return value.length;
    return Object.values(value).reduce(
      (sum, entry) => sum + (entry?.concerns?.length || 0),
      0
    );
  };

  const getBadgeState = (stateKey) =>
    vhcCardStates[stateKey] || vhcCardStates.pending;

  const handleSectionComplete = async (sectionKey, sectionData, options = {}) => {
    const next = { ...vhcData, [sectionKey]: sectionData };
    setVhcData(next);
    setActiveSection(null);
    const success = await persistVhcData(next, { quiet: true, ...options });
    if (success) {
      markSectionState(sectionKey, "complete");
    }
    return success;
  };

  const handleSectionDismiss = (sectionKey, draftData) => {
    setActiveSection(null);
    if (!draftData) return;
    setVhcData((prev) => ({ ...prev, [sectionKey]: draftData }));
  };

  const SectionCard = ({ title, badgeState, onClick }) => {
    const badgeStyles = {
      ...styles.badge,
      backgroundColor: badgeState.background,
      color: badgeState.color,
      borderColor: badgeState.border,
    };

    return (
      <button
        type="button"
        onClick={onClick}
        style={styles.sectionCard}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, styles.sectionCardHover);
        }}
        onMouseLeave={(e) => {
          Object.keys(styles.sectionCardHover).forEach(
            (key) => (e.currentTarget.style[key] = "")
          );
        }}
      >
        <span style={badgeStyles}>{badgeState.label}</span>
        <div>
          <p style={styles.cardTitle}>{title}</p>
        </div>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "18px",
            color: "#d1d5db",
          }}
        >
          →
        </span>
      </button>
    );
  };

  const buttonStyle = (variant = "primary", disabled = false) =>
    createVhcButtonStyle(variant, { disabled });

  if (loading) {
    return (
      <Layout>
        <div style={styles.page}>
          <div style={styles.mainCard}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  border: "6px solid #fde8e8",
                  borderTopColor: "#d10000",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ color: "#6b7280", fontSize: "15px", fontWeight: "600" }}>
                Loading VHC workspace...
              </p>
            </div>
            <style jsx>{`
              @keyframes spin {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </div>
        </div>
      </Layout>
    );
  }

  const progressWidth = `${Math.min(100, Math.max(0, mandatoryProgress))}%`;
  const jobMeta = jobInfo || {};
  const customerName =
    typeof jobMeta.customer === "string"
      ? jobMeta.customer
      : `${jobMeta.customer?.firstName || ""} ${jobMeta.customer?.lastName || ""}`.trim();
  const vehicleLabel =
    jobMeta.makeModel ||
    [jobMeta.make, jobMeta.model].filter(Boolean).join(" ").trim() ||
    "N/A";

  const saveStatusMessage = (() => {
    if (saveStatus === "saving") return "Saving progress…";
    if (saveStatus === "saved") {
      if (!lastSavedAt) return "Saved";
      return `Saved ${lastSavedAt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    if (saveStatus === "error") {
      return saveError || "Failed to save";
    }
    return "";
  })();

  const saveStatusColor =
    saveStatus === "error"
      ? themeConfig.palette.danger
      : saveStatus === "saving"
      ? themeConfig.palette.accent
      : themeConfig.palette.textMuted;

  return (
    <Layout>
      <div style={styles.page}>
        <div style={styles.headerCard}>
          <div style={styles.headerTopRow}>
            <div style={styles.headerTitleBlock}>
              <p style={styles.headerSubtitle}>Vehicle Health Check Workspace</p>
              <h1 style={styles.headerTitle}>
                Job {jobMeta.jobNumber || jobNumber || "Loading..."}
              </h1>
              <p style={styles.headerSubtitle}>
                Complete each mandatory section before handing back to the service advisor.
              </p>
            </div>
            <div style={styles.progressWrapper}>
              <span style={styles.progressLabel}>
                {completedMandatorySections}/{totalMandatorySections} mandatory sections complete
              </span>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: progressWidth }} />
            </div>
            {saveStatusMessage && (
              <span
                style={{
                  fontSize: "12px",
                  color: saveStatusColor,
                  fontWeight: saveStatus === "error" ? "600" : "500",
                }}
              >
                {saveStatusMessage}
              </span>
            )}
          </div>
          </div>

          <div style={styles.metaRow}>
            {[
              { label: "Job Number", value: jobMeta.jobNumber || jobNumber || "N/A" },
              { label: "Registration", value: jobMeta.reg || "N/A" },
              { label: "Customer", value: customerName || "N/A" },
              { label: "Vehicle", value: vehicleLabel || "N/A" },
            ].map(({ label, value }) => (
              <div key={label} style={styles.metaItem}>
                <span style={styles.metaLabel}>{label}</span>
                <span style={styles.metaValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.mainCard}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Mandatory Sections</h2>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Tyre concerns</p>
            <strong style={{ fontSize: "16px", color: "#111827" }}>
              {tyreConcernTotals.total
                ? `${tyreConcernTotals.total} amber/red concern${tyreConcernTotals.total === 1 ? "" : "s"}`
                : "No amber/red concerns recorded"}
            </strong>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <span
              style={{
                background: "#fee2e2",
                color: themeConfig.palette.danger,
                padding: "6px 12px",
                borderRadius: "999px",
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              Red {tyreConcernTotals.red}
            </span>
            <span
              style={{
                background: "#fef3c7",
                color: themeConfig.palette.warning,
                padding: "6px 12px",
                borderRadius: "999px",
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              Amber {tyreConcernTotals.amber}
            </span>
          </div>
        </div>
          <div style={styles.sectionsGrid}>
            {MANDATORY_SECTION_KEYS.map((key) => (
              <SectionCard
                key={key}
                title={SECTION_TITLES[key]}
                badgeState={getBadgeState(sectionStatus[key] || "pending")}
                onClick={() => openSection(key)}
              />
            ))}
          </div>

        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Additional Checks</h2>
        </div>
          <div style={styles.sectionsGrid}>
            {optionalKeys.map((key) => {
              const count = getOptionalCount(key);
              return (
                <SectionCard
                  key={key}
                  title={SECTION_TITLES[key]}
                  badgeState={getBadgeState(count > 0 ? "inProgress" : "pending")}
                  onClick={() => openSection(key)}
                />
              );
            })}
          </div>

          <div style={styles.actionBar}>
            <button
              type="button"
              onClick={handleBack}
              style={buttonStyle("secondary")}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Save & Exit
            </button>
            <button
              type="button"
              onClick={handleComplete}
              disabled={!mandatoryComplete}
              style={buttonStyle("primary", !mandatoryComplete)}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Complete VHC
            </button>
          </div>
        </div>

        {activeSection === "wheelsTyres" && (
          <WheelsTyresDetailsModal
            isOpen
            initialData={vhcData.wheelsTyres}
            onClose={(draft) => handleSectionDismiss("wheelsTyres", draft)}
            onComplete={(data) => handleSectionComplete("wheelsTyres", data)}
          />
        )}
        {activeSection === "brakesHubs" && (
          <BrakesHubsDetailsModal
            isOpen
            initialData={vhcData.brakesHubs}
            onClose={(draft) => handleSectionDismiss("brakesHubs", draft)}
            onComplete={(data) => handleSectionComplete("brakesHubs", data)}
          />
        )}
        {activeSection === "serviceIndicator" && (
          <ServiceIndicatorDetailsModal
            isOpen
            initialData={vhcData.serviceIndicator}
            onClose={(draft) => handleSectionDismiss("serviceIndicator", draft)}
            onComplete={(data) => handleSectionComplete("serviceIndicator", data)}
          />
        )}
        {activeSection === "externalInspection" && (
          <ExternalDetailsModal
            isOpen
            initialData={vhcData.externalInspection}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => handleSectionComplete("externalInspection", data)}
          />
        )}
        {activeSection === "internalElectrics" && (
          <InternalElectricsDetailsModal
            isOpen
            initialData={vhcData.internalElectrics}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => handleSectionComplete("internalElectrics", data)}
          />
        )}
        {activeSection === "underside" && (
          <UndersideDetailsModal
            isOpen
            initialData={vhcData.underside}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => handleSectionComplete("underside", data)}
          />
        )}
      </div>
    </Layout>
  );
}
