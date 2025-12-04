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
  externalInspection: "External",
  internalElectrics: "Internal",
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
  const embedModeParam = typeof router.query?.embed === "string" ? router.query.embed : null;
  const isEmbeddedView = Boolean(embedModeParam);
  const isEmbed = router?.query?.embed === "1";

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

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showGreenSummary, setShowGreenSummary] = useState(false);

  const concernSummary = useMemo(() => {
    const items = [];

    const getSectionLabel = (sectionKey) => SECTION_TITLES[sectionKey] || sectionKey;

    const collectConcerns = (sectionKey, value, pathLabel = "") => {
      if (!value || typeof value !== "object") return;
      const label = pathLabel || getSectionLabel(sectionKey);
      if (Array.isArray(value.concerns)) {
        value.concerns.forEach((concern, index) => {
          items.push({
            section: label,
            status: (concern.status || "").toLowerCase(),
            text: concern.text || concern.issue || `Concern ${index + 1}`,
          });
        });
      }
      Object.entries(value).forEach(([key, nested]) => {
        if (!nested || typeof nested !== "object" || Array.isArray(nested)) return;
        collectConcerns(sectionKey, nested, `${label} - ${key}`);
      });
    };

    Object.entries(vhcData || {}).forEach(([sectionKey, value]) => {
      if (value && typeof value === "object") {
        collectConcerns(sectionKey, value);
      }
    });

    return items;
  }, [vhcData]);

  const summaryBuckets = useMemo(() => {
    const buckets = { red: [], amber: [], green: [] };
    concernSummary.forEach((item) => {
      const status = item.status || "green";
      if (status.includes("red")) buckets.red.push(item);
      else if (status.includes("amber")) buckets.amber.push(item);
      else buckets.green.push(item);
    });
    return buckets;
  }, [concernSummary]);

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
            color: "var(--info)",
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
                  border: "6px solid var(--danger-surface)",
                  borderTopColor: "var(--primary)",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ color: "var(--info)", fontSize: "15px", fontWeight: "600" }}>
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

  const pageContent = (
    <div style={styles.page}>
        <div style={styles.headerCard}>
          <div style={styles.headerTopRow}>
            <div style={styles.headerTitleBlock}>
              <p style={styles.headerSubtitle}>Vehicle Health Check Workspace</p>
              <h1 style={styles.headerTitle}>
                Job {jobMeta.jobNumber || jobNumber || "Loading..."}
              </h1>
            </div>
            <div style={styles.progressWrapper}>
              <span style={styles.progressLabel}>
                {completedMandatorySections}/{totalMandatorySections} mandatory sections complete
              </span>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: progressWidth }} />
            </div>
            {!isEmbeddedView && (
              <button
                type="button"
                onClick={() => setShowSummaryModal(true)}
                style={{
                  marginTop: "10px",
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                  background: "var(--surface)",
                  color: themeConfig.palette.accent,
                  fontWeight: 700,
                  fontSize: "12px",
                  boxShadow: "0 6px 14px rgba(var(--shadow-rgb),0.06)",
                  cursor: "pointer",
                }}
              >
                Summary
              </button>
            )}
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

        {!isEmbeddedView && showSummaryModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(var(--shadow-rgb),0.55)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: "16px",
            }}
          >
            <div
              style={{
                width: "min(720px, 100%)",
                maxHeight: "90vh",
                overflow: "hidden",
                background: "var(--surface)",
                borderRadius: "20px",
                border: "1px solid var(--accent-purple-surface)",
                boxShadow: "0 20px 50px rgba(var(--shadow-rgb),0.18)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--accent-purple-surface)",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--accent-purple)" }}>Concern Summary</h3>
                  <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>
                    Quick snapshot of reported issues across the VHC.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(false)}
                  style={{
                    border: "none",
                    background: "var(--info-surface)",
                    color: "var(--accent-purple)",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--accent-purple-surface)", display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--info-dark)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showGreenSummary}
                    onChange={(e) => setShowGreenSummary(e.target.checked)}
                  />
                  Show green items
                </label>
              </div>

              <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                {["red", "amber", "green"].map((statusKey) => {
                  if (statusKey === "green" && !showGreenSummary) return null;
                  const items = summaryBuckets[statusKey] || [];
                  const colors =
                    statusKey === "red"
                      ? { bg: "var(--danger-surface)", text: "var(--danger)", badge: "var(--danger-surface)" }
                      : statusKey === "amber"
                      ? { bg: "var(--warning-surface)", text: "var(--danger-dark)", badge: "var(--warning-surface)" }
                      : { bg: "var(--success-surface)", text: "var(--info-dark)", badge: "var(--success)" };
                  return (
                    <div key={statusKey} style={{ background: colors.bg, borderRadius: "14px", border: `1px solid ${colors.badge}`, padding: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "999px",
                            background: colors.badge,
                            color: colors.text,
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {statusKey.toUpperCase()} ({items.length})
                        </span>
                      </div>
                      {items.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>No items.</p>
                      ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                          {items.map((item, idx) => (
                            <li
                              key={`${statusKey}-${idx}`}
                              style={{
                                background: "var(--surface)",
                                border: "1px solid var(--accent-purple-surface)",
                                borderRadius: "12px",
                                padding: "10px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)" }}>
                                  {item.section}
                                </span>
                              </div>
                              <span style={{ color: "var(--info-dark)", fontSize: "13px" }}>{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
            onClose={(draft) => handleSectionDismiss("externalInspection", draft)}
            onComplete={(data) => handleSectionComplete("externalInspection", data)}
          />
        )}
        {activeSection === "internalElectrics" && (
          <InternalElectricsDetailsModal
            isOpen
            initialData={vhcData.internalElectrics}
            onClose={(draft) => handleSectionDismiss("internalElectrics", draft)}
            onComplete={(data) => handleSectionComplete("internalElectrics", data)}
          />
        )}
        {activeSection === "underside" && (
          <UndersideDetailsModal
            isOpen
            initialData={vhcData.underside}
            onClose={(draft) => handleSectionDismiss("underside", draft)}
            onComplete={(data) => handleSectionComplete("underside", data)}
          />
        )}
    </div>
  );

  const wrappedContent = (
    <div
      style={{
        padding: isEmbeddedView ? "16px" : "0",
        background: isEmbeddedView ? "var(--info-surface)" : "transparent",
        minHeight: isEmbeddedView ? "100vh" : "auto",
      }}
    >
      {pageContent}
    </div>
  );

  if (isEmbeddedView) {
    return wrappedContent;
  }

  return <Layout>{pageContent}</Layout>;
}
