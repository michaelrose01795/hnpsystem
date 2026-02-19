// file location: src/components/VHC/useConcernLock.js
// Shared concern lock/authorization logic for VHC detail modals.
// Used by ExternalDetailsModal, UndersideDetailsModal, InternalElectricsDetailsModal.
import { useCallback } from "react";

export function useConcernLock(summaryItems = [], sectionName = "") {
  const findSummaryItemForConcern = useCallback(
    (category, concern) => {
      if (!concern || !category || !Array.isArray(summaryItems)) return null;
      const concernText = (concern.issue || concern.text || "").toLowerCase().trim();
      if (!concernText) return null;

      return summaryItems.find((item) => {
        if (item.sectionName !== sectionName) return false;
        if (item.label !== category) return false;
        const itemConcerns = item.concerns || [];
        return itemConcerns.some((c) => {
          const cText = (c.text || c.issue || "").toLowerCase().trim();
          return cText === concernText;
        });
      });
    },
    [summaryItems, sectionName]
  );

  const isConcernLocked = useCallback(
    (concern, category) => {
      if (!concern || typeof concern !== "object") return false;
      if (concern.locked === true) return true;
      if (concern.authorised === true || concern.authorized === true) return true;
      if (concern.declined === true) return true;
      const decision =
        concern.approvalStatus ||
        concern.decisionStatus ||
        concern.decisionKey ||
        concern.statusDecision ||
        "";
      const normalized = String(decision).toLowerCase();
      if (["authorized", "authorised", "declined", "completed"].includes(normalized)) return true;

      const summaryItem = findSummaryItemForConcern(category, concern);
      if (summaryItem) {
        const approvalStatus = (summaryItem.approvalStatus || "").toLowerCase();
        if (["authorized", "authorised", "declined", "completed"].includes(approvalStatus)) {
          return true;
        }
      }
      return false;
    },
    [findSummaryItemForConcern]
  );

  const getLockReason = useCallback(
    (concern, category) => {
      if (!concern || typeof concern !== "object") return null;
      if (concern.declined === true) return "declined";
      if (concern.authorised === true || concern.authorized === true) return "authorised";
      const decision =
        concern.approvalStatus ||
        concern.decisionStatus ||
        concern.decisionKey ||
        concern.statusDecision ||
        "";
      const normalized = String(decision).toLowerCase();
      if (normalized === "declined") return "declined";
      if (["authorized", "authorised", "completed"].includes(normalized)) return "authorised";
      if (concern.locked === true) return "authorised";

      const summaryItem = findSummaryItemForConcern(category, concern);
      if (summaryItem) {
        const approvalStatus = (summaryItem.approvalStatus || "").toLowerCase();
        if (approvalStatus === "declined") return "declined";
        if (["authorized", "authorised", "completed"].includes(approvalStatus)) return "authorised";
      }
      return null;
    },
    [findSummaryItemForConcern]
  );

  return { isConcernLocked, getLockReason };
}
