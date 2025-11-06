// ✅ File location: src/pages/job-cards/[jobNumber]/vhc.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

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

// 🎨 Shared VHC design tokens so dashboard + tech view stay aligned
const styles = {
  page: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "12px 16px",
    gap: "16px",
    background: "linear-gradient(to bottom right, #ffffff, #fff5f5, #ffecec)",
  },
  headerCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #ffe0e0",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 18px rgba(209,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  headerTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
  },
  headerTitleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  headerTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#d10000",
    margin: 0,
  },
  headerSubtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  progressWrapper: {
    minWidth: "220px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  progressLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#6b7280",
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    backgroundColor: "#fee2e2",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #d10000, #f97316)",
    transition: "width 0.3s ease",
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
  },
  metaItem: {
    backgroundColor: "#fff5f5",
    borderRadius: "12px",
    padding: "12px",
    border: "1px solid #ffd6d6",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  metaLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#b91c1c",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1f2937",
  },
  mainCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "24px",
    borderRadius: "24px",
    border: "1px solid #ffe0e0",
    background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
    boxShadow: "0 6px 24px rgba(209,0,0,0.08)",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#d10000",
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: "13px",
    color: "#6b7280",
    margin: 0,
  },
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  sectionCard: {
    position: "relative",
    textAlign: "left",
    border: "1px solid #ffe0e0",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(209,0,0,0.08)",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionCardHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 8px 20px rgba(209,0,0,0.16)",
    borderColor: "#ffb3b3",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1f2937",
    margin: 0,
  },
  cardSubtitle: {
    fontSize: "13px",
    color: "#6b7280",
    margin: 0,
    lineHeight: 1.4,
  },
  badge: {
    alignSelf: "flex-start",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    border: "1px solid transparent",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "flex-end",
    paddingTop: "12px",
    borderTop: "2px solid #ffd6d6",
  },
};

const CARD_STATES = {
  complete: {
    label: "Complete",
    background: "#dcfce7",
    color: "#047857",
    border: "#bbf7d0",
  },
  inProgress: {
    label: "In Progress",
    background: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
  },
  pending: {
    label: "Not Started",
    background: "#f3f4f6",
    color: "#4b5563",
    border: "#e5e7eb",
  },
};

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // ✅ Initial VHC data structure
  const [jobInfo, setJobInfo] = useState(null);
  const [vhcData, setVhcData] = useState({
    wheelsTyres: null,
    brakesHubs: [],
    serviceIndicator: [],
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

  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);

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
          setVhcData(job.vhcChecks[0].data);
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
  const saveVhcData = async () => {
    if (!jobNumber) return;
    try {
      const result = await saveChecksheet(jobNumber, vhcData);
      if (!result.success) console.error("❌ Failed to save VHC:", result.error);
    } catch (err) {
      console.error("❌ Error saving VHC:", err);
    }
  };

  /* ============================================
     BUTTON HANDLERS
  ============================================= */
  const handleBack = async () => {
    await saveVhcData();
    const targetJobNumber = jobInfo?.jobNumber || jobNumber;
    if (targetJobNumber) {
      router.push(`/job-cards/myjobs/${targetJobNumber}`);
    } else {
      router.push("/job-cards/myjobs");
    }
  };

  const handleComplete = async () => {
    if (!mandatoryComplete) return;
    await saveVhcData();
    router.push(`/job-cards/${jobNumber}`);
  };

  const mandatoryStates = {
    wheelsTyres: Boolean(vhcData.wheelsTyres),
    brakesHubs: vhcData.brakesHubs.length > 0,
    serviceIndicator: vhcData.serviceIndicator.length > 0,
  };

  const totalMandatorySections = Object.keys(mandatoryStates).length;
  const completedMandatorySections = Object.values(mandatoryStates).filter(Boolean).length;
  const mandatoryComplete = completedMandatorySections === totalMandatorySections;
  const mandatoryProgress = Math.round(
    (completedMandatorySections / totalMandatorySections) * 100
  );

  const optionalKeys = ["externalInspection", "internalElectrics", "underside"];

  const getOptionalCount = (section) => {
    const value = vhcData[section];
    if (!value) return 0;
    if (Array.isArray(value)) return value.length;
    return Object.values(value).reduce(
      (sum, entry) => sum + (entry?.concerns?.length || 0),
      0
    );
  };

  const getMandatorySubtitle = (key) => {
    switch (key) {
      case "wheelsTyres":
        return vhcData.wheelsTyres ? "Details captured" : "Awaiting inspection";
      case "brakesHubs":
        return `${vhcData.brakesHubs.length} checks recorded`;
      case "serviceIndicator":
        return `${vhcData.serviceIndicator.length} checks recorded`;
      default:
        return "";
    }
  };

  const getOptionalSubtitle = (key) => {
    const count = getOptionalCount(key);
    if (count === 0) return "No concerns logged yet";
    if (count === 1) return "1 concern recorded";
    return `${count} concerns recorded`;
  };

  const getBadgeState = (stateKey) => CARD_STATES[stateKey] || CARD_STATES.pending;

  const SectionCard = ({ title, subtitle, badgeState, onClick }) => {
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
          <p style={styles.cardSubtitle}>{subtitle}</p>
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

  const buttonStyle = (variant = "primary", disabled = false) => {
    const base = {
      padding: "12px 24px",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
    };

    if (variant === "secondary") {
      return {
        ...base,
        backgroundColor: "#ffffff",
        color: "#d10000",
        border: "1px solid #d10000",
        boxShadow: disabled ? "none" : "0 4px 12px rgba(209,0,0,0.08)",
      };
    }

    return {
      ...base,
      backgroundColor: disabled ? "#f3f4f6" : "#d10000",
      color: disabled ? "#9ca3af" : "#ffffff",
      boxShadow: disabled ? "none" : "0 6px 16px rgba(209,0,0,0.18)",
    };
  };

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
            <p style={styles.sectionSubtitle}>
              These must be filled out before you can complete the VHC.
            </p>
          </div>
          <div style={styles.sectionsGrid}>
            {Object.keys(mandatoryStates).map((key) => (
              <SectionCard
                key={key}
                title={SECTION_TITLES[key]}
                subtitle={getMandatorySubtitle(key)}
                badgeState={getBadgeState(mandatoryStates[key] ? "complete" : "pending")}
                onClick={() => setActiveSection(key)}
              />
            ))}
          </div>

          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Additional Checks</h2>
            <p style={styles.sectionSubtitle}>
              Optional sections help highlight advisory work and follow-up opportunities.
            </p>
          </div>
          <div style={styles.sectionsGrid}>
            {optionalKeys.map((key) => {
              const count = getOptionalCount(key);
              return (
                <SectionCard
                  key={key}
                  title={SECTION_TITLES[key]}
                  subtitle={getOptionalSubtitle(key)}
                  badgeState={getBadgeState(count > 0 ? "inProgress" : "pending")}
                  onClick={() => setActiveSection(key)}
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
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, wheelsTyres: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "brakesHubs" && (
          <BrakesHubsDetailsModal
            isOpen
            initialData={vhcData.brakesHubs}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, brakesHubs: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "serviceIndicator" && (
          <ServiceIndicatorDetailsModal
            isOpen
            initialData={vhcData.serviceIndicator}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, serviceIndicator: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "externalInspection" && (
          <ExternalDetailsModal
            isOpen
            initialData={vhcData.externalInspection}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, externalInspection: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "internalElectrics" && (
          <InternalElectricsDetailsModal
            isOpen
            initialData={vhcData.internalElectrics}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, internalElectrics: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "underside" && (
          <UndersideDetailsModal
            isOpen
            initialData={vhcData.underside}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, underside: data }));
              setActiveSection(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
