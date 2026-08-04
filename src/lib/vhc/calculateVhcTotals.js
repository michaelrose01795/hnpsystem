/**
 * Calculate the authorised and declined VHC totals without rendering the VHC panel.
 * The quote-line model is authoritative so row totals, header totals and persisted
 * checksheet totals all apply the same parts + labour / manual override rules.
 */

import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { DEFAULT_LABOUR_RATE_GBP } from "@/lib/vhc/shared";

const EMPTY_TOTALS = Object.freeze({ authorized: 0, declined: 0 });

const safeJsonParse = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export function calculateVhcFinancialTotals(
  vhcChecks = [],
  partsJobItems = [],
  { forceRecalculate = false } = {}
) {
  if (!Array.isArray(vhcChecks)) return { ...EMPTY_TOTALS };

  try {
    const builderRecord = vhcChecks.find((check) => {
      const section = String(check?.section || "").trim();
      return section === "VHC_CHECKSHEET" || section === "VHC Checksheet";
    });
    if (!builderRecord) return { ...EMPTY_TOTALS };

    const storedAuthorized = Number(builderRecord.authorized_total_gbp);
    const storedDeclined = Number(builderRecord.declined_total_gbp);
    const hasStoredAuthorized = Number.isFinite(storedAuthorized) && storedAuthorized >= 0;
    const hasStoredDeclined = Number.isFinite(storedDeclined) && storedDeclined >= 0;
    const hasStoredTotals =
      (hasStoredAuthorized && storedAuthorized > 0) ||
      (hasStoredDeclined && storedDeclined > 0);

    if (hasStoredTotals && !forceRecalculate) {
      return {
        authorized: hasStoredAuthorized ? storedAuthorized : 0,
        declined: hasStoredDeclined ? storedDeclined : 0,
      };
    }

    const parsedPayload = safeJsonParse(builderRecord.issue_description || builderRecord.data);
    if (!parsedPayload) return { ...EMPTY_TOTALS };

    const sections = summariseTechnicianVhc(parsedPayload)?.sections || [];
    const quoteModel = buildVhcQuoteLinesModel({
      sections,
      vhcChecksData: vhcChecks,
      partsJobItems: Array.isArray(partsJobItems) ? partsJobItems : [],
      labourRate: DEFAULT_LABOUR_RATE_GBP,
      mode: "withPlaceholders",
    });

    return {
      authorized:
        Number(quoteModel?.totals?.authorized || 0) +
        Number(quoteModel?.totals?.completed || 0),
      declined: Number(quoteModel?.totals?.declined || 0),
    };
  } catch (error) {
    console.error("[VHC Totals Calculation Error]", error);
    return { ...EMPTY_TOTALS };
  }
}
