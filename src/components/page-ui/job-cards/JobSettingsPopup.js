// file location: src/components/page-ui/job-cards/JobSettingsPopup.js
//
// Job Card Settings — the control centre opened from the settings symbol in the
// job card header (/job-cards/[jobNumber]).
//
// Sections (one file each under ./jobSettings/): General, Assignment,
// Scheduling, Tracking, Workflow, Audit and Danger zone. Each section reuses the
// job card's existing save paths where one exists (appointment, mileage,
// vehicle / waiting status, key and car location, loan cars, Link Job,
// archive) and /api/job-cards/[jobNumber]/settings for the rest; after any
// successful change the page reloads the card, its status snapshot and its
// linked group, so every tab reflects it without a manual reload.
//
// Nothing here paints anything. It is the staffglobal.css settings popup
// convention: PopupModal's .popup-card with .app-settings-popup-card,
// .app-settings-popup content, the compact header with the active section's
// Save immediately left of Close, and .app-settings-popup__layout for the
// section nav (the shared TabGroup strip) beside the scrolling panel. Cards are
// LayerTheme on the popup's own --surface. Inline styles are layout only.

import React, { useCallback, useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { useConfirmation } from "@/context/ConfirmationContext";
import { useJobSettings } from "@/hooks/useJobSettings";
import GeneralSection from "@/components/page-ui/job-cards/jobSettings/GeneralSection";
import AssignmentSection from "@/components/page-ui/job-cards/jobSettings/AssignmentSection";
import SchedulingSection from "@/components/page-ui/job-cards/jobSettings/SchedulingSection";
import TrackingSection from "@/components/page-ui/job-cards/jobSettings/TrackingSection";
import WorkflowSection from "@/components/page-ui/job-cards/jobSettings/WorkflowSection";
import AuditSection from "@/components/page-ui/job-cards/jobSettings/AuditSection";
import DangerZoneSection from "@/components/page-ui/job-cards/jobSettings/DangerZoneSection";

const SECTIONS = [
  { value: "general", label: "General", Component: GeneralSection },
  { value: "assignment", label: "Assignment", Component: AssignmentSection },
  { value: "scheduling", label: "Scheduling", Component: SchedulingSection },
  { value: "tracking", label: "Tracking", Component: TrackingSection },
  { value: "workflow", label: "Workflow", Component: WorkflowSection },
  { value: "audit", label: "Audit", Component: AuditSection },
  { value: "danger", label: "Danger zone", tone: "danger", Component: DangerZoneSection },
];

// Sections that need the settings read before they can show anything useful.
const NEEDS_SETTINGS = new Set(["general", "assignment", "scheduling", "workflow", "danger"]);

export default function JobSettingsPopup({
  isOpen,
  onClose,
  initialSection = "general",
  jobData,
  permissions,
  isArchiveMode = false,
  statusLabel = "",
  statusTimeline = [],
  trackerEntry = null,
  canEditTrackingLocations = false,
  customerVehicles = [],
  handlers = {},
  onChanged,
  linking = {},
}) {
  const { confirm } = useConfirmation();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [headerAction, setHeaderAction] = useState(null);
  const [childPopupOpen, setChildPopupOpen] = useState(false);
  const settings = useJobSettings(jobData?.jobNumber, { enabled: Boolean(isOpen && jobData), jobId: jobData?.id ?? null });

  useEffect(() => {
    if (isOpen) setActiveSection(initialSection);
  }, [isOpen, initialSection]);

  const isDirty = Boolean(headerAction?.dirty);

  const confirmDiscard = useCallback(async () => {
    if (!isDirty) return true;
    return confirm({
      title: null,
      message: "Discard unsaved changes?",
      description: "The changes in this section have not been saved.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
    });
  }, [confirm, isDirty]);

  const goToSection = useCallback(
    async (section) => {
      if (section === activeSection) return;
      if (!(await confirmDiscard())) return;
      setActiveSection(section);
    },
    [activeSection, confirmDiscard]
  );

  const requestClose = useCallback(async () => {
    if (headerAction?.busy) return;
    if (!(await confirmDiscard())) return;
    onClose?.();
  }, [confirmDiscard, headerAction?.busy, onClose]);

  const handleChanged = useCallback(async () => {
    await onChanged?.();
  }, [onChanged]);

  if (!isOpen || !jobData) return null;

  const section = SECTIONS.find((item) => item.value === activeSection) || SECTIONS[0];
  const SectionComponent = section.Component;
  const waitingForSettings = NEEDS_SETTINGS.has(section.value) && settings.isLoading && !settings.settings;

  const ctx = {
    jobData,
    permissions: permissions || {},
    isArchiveMode,
    statusLabel,
    statusTimeline,
    trackerEntry,
    canEditTrackingLocations,
    customerVehicles,
    handlers,
    linking,
    settings,
    registerSave: setHeaderAction,
    onChanged: handleChanged,
    goToSection,
    onChildPopupChange: setChildPopupOpen,
  };

  return (
    <PopupModal
      isOpen
      onClose={requestClose}
      closeOnBackdrop={!isDirty && !childPopupOpen}
      closeOnEscape={!childPopupOpen}
      ariaLabel={`Job ${jobData.jobNumber} settings`}
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(1120px, 100%)", padding: "var(--page-card-padding)", overflow: "hidden" }}
    >
      <div
        className="app-settings-popup"
        style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", minWidth: 0 }}
      >
        <header className="app-popup-compact-header">
          <h2>Job #{jobData.jobNumber} settings</h2>
          <div className="app-popup-compact-header__actions">
            {headerAction ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                busy={headerAction.busy}
                disabled={!headerAction.dirty || headerAction.busy || headerAction.disabled}
                onClick={headerAction.onSave}
              >
                {headerAction.label || "Save changes"}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" disabled={Boolean(headerAction?.busy)} onClick={requestClose}>
              Close
            </Button>
          </div>
        </header>

        <div className="app-settings-popup__layout">
          <TabGroup
            items={SECTIONS.map(({ value, label, tone }) => ({ value, label, tone }))}
            value={section.value}
            onChange={(value) => goToSection(value)}
            ariaLabel="Job settings sections"
            className="app-settings-popup__nav"
            devSectionKey="jobcard-settings-nav"
          />

          <div className="app-settings-popup__panel" role="tabpanel" aria-label={section.label}>
            {settings.error && NEEDS_SETTINGS.has(section.value) ? (
              <StatusMessage tone="danger">
                {`Some settings could not be loaded (${settings.error.message}). Fields that depend on them are disabled.`}
              </StatusMessage>
            ) : null}
            {waitingForSettings ? (
              <>
                <SkeletonKeyframes />
                <SkeletonBlock height="220px" />
              </>
            ) : (
              <SectionComponent key={section.value} ctx={ctx} />
            )}
          </div>
        </div>
      </div>
    </PopupModal>
  );
}
