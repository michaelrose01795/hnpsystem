/**
 * Calculate VHC financial totals from vhc_checks and parts_job_items data
 * This allows totals to be displayed without loading the full VHC tab
 * Replicates the calculation logic from VhcDetailsPanel.js
 */

import { summariseTechnicianVhc } from './summary';

const LABOUR_RATE = 150; // £150 per hour

/**
 * Normalise colour values to standard severity levels
 */
function normaliseColour(value) {
  if (!value || typeof value !== 'string') return null;
  const lower = value.toLowerCase().trim();
  if (lower === 'red' || lower === 'critical' || lower === 'high') return 'red';
  if (lower === 'amber' || lower === 'warning' || lower === 'medium' || lower === 'yellow') return 'amber';
  if (lower === 'green' || lower === 'ok' || lower === 'low' || lower === 'good') return 'green';
  if (lower === 'authorized' || lower === 'approved') return 'authorized';
  if (lower === 'declined' || lower === 'rejected') return 'declined';
  return null;
}

/**
 * Parse JSON safely
 */
function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Calculate authorized and declined totals from vhc_checks and parts_job_items data
 * @param {Array} vhcChecks - Array of vhc_checks records from the database
 * @param {Array} partsJobItems - Array of parts_job_items records from the database
 * @returns {Object} - { authorized: number, declined: number }
 */
export function calculateVhcFinancialTotals(vhcChecks = [], partsJobItems = []) {
  const totals = {
    authorized: 0,
    declined: 0,
  };

  if (!Array.isArray(vhcChecks)) {
    return totals;
  }

  try {
    // Step 1: Find and parse the VHC builder data
    const builderRecord = vhcChecks.find(check => check.section === 'VHC_CHECKSHEET');
    if (!builderRecord) {
      // No VHC builder data found, return zero totals
      console.log('[VHC Totals] No VHC_CHECKSHEET record found');
      return totals;
    }

    const parsedPayload = safeJsonParse(builderRecord.issue_description || builderRecord.data);
    if (!parsedPayload) {
      return totals;
    }

    // Step 2: Summarize the VHC data to get sections
    const builderSummary = summariseTechnicianVhc(parsedPayload);
    const sections = builderSummary?.sections || [];

    // Step 3: Build approval lookup from vhc_checks
    const approvalLookup = new Map();
    vhcChecks.forEach((check) => {
      if (check.vhc_id) {
        approvalLookup.set(String(check.vhc_id), {
          approvalStatus: check.approval_status || 'pending',
          displayStatus: check.display_status || null,
          labourHours: check.labour_hours,
          partsCost: check.parts_cost,
        });
      }
    });

    // Step 4: Build parts cost map by VHC item ID
    const partsCostByVhcItem = new Map();
    if (Array.isArray(partsJobItems)) {
      partsJobItems.forEach((part) => {
        if (!part?.vhc_item_id) return;
        const key = String(part.vhc_item_id);
        const qtyValue = Number(part.quantity_requested);
        const resolvedQty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
        const unitPriceValue = Number(part.unit_price ?? part.part?.unit_price ?? part.parts_catalog?.unit_price ?? 0);
        if (!Number.isFinite(unitPriceValue)) return;
        const subtotal = resolvedQty * unitPriceValue;
        partsCostByVhcItem.set(key, (partsCostByVhcItem.get(key) || 0) + subtotal);
      });
    }

    // Step 5: Build labour hours map by VHC item ID
    const labourHoursByVhcItem = new Map();
    vhcChecks.forEach((check) => {
      if (!check?.vhc_id) return;
      const hours = Number(check.labour_hours);
      if (!Number.isFinite(hours) || hours < 0) return;
      labourHoursByVhcItem.set(String(check.vhc_id), hours);
    });

    if (Array.isArray(partsJobItems)) {
      partsJobItems.forEach((part) => {
        if (!part?.vhc_item_id) return;
        const hours = Number(part.labour_hours);
        if (!Number.isFinite(hours) || hours < 0) return;
        const key = String(part.vhc_item_id);
        const current = labourHoursByVhcItem.get(key) || 0;
        labourHoursByVhcItem.set(key, Math.max(current, hours));
      });
    }

    // Step 6: Extract summary items (red/amber items from VHC builder)
    const summaryItems = [];
    sections.forEach((section) => {
      const sectionName = section.name || section.title || 'Vehicle Health Check';
      (section.items || []).forEach((item, index) => {
        const severity = normaliseColour(item.colour || item.status || section.colour);
        if (!severity || (severity !== 'red' && severity !== 'amber')) {
          return; // Only process red/amber items
        }
        const id = item.vhc_id || `${sectionName}-${index}`;
        const approvalData = approvalLookup.get(String(id)) || {};

        summaryItems.push({
          id: String(id),
          rawSeverity: severity,
          displayStatus: approvalData.displayStatus,
          approvalStatus: approvalData.approvalStatus || 'pending',
        });
      });
    });

    // Step 7: Build severity lists (mimics VhcDetailsPanel logic)
    const severityLists = { red: [], amber: [], authorized: [], declined: [] };
    summaryItems.forEach((item) => {
      // Use display_status if available, otherwise use original severity
      const displaySeverity = item.displayStatus || item.rawSeverity;
      if (severityLists[displaySeverity]) {
        severityLists[displaySeverity].push(item);
      }
    });

    // Step 8: Calculate totals by accumulating from severity lists
    const calculateRowTotal = (itemId) => {
      const vhcId = String(itemId);
      const partsCost = partsCostByVhcItem.get(vhcId) || 0;
      const labourHours = labourHoursByVhcItem.get(vhcId) || 0;
      const labourCost = labourHours * LABOUR_RATE;
      const total = partsCost + labourCost;
      return total > 0 ? total : null;
    };

    const accumulate = (items, severity) => {
      items.forEach((item) => {
        const rowTotal = calculateRowTotal(item.id);
        if (!rowTotal) return;

        // Add to severity total
        if (severity === 'authorized') {
          totals.authorized += rowTotal;
        } else if (severity === 'declined') {
          totals.declined += rowTotal;
        }

        // Also check approval status for red/amber items
        if ((severity === 'red' || severity === 'amber') && item.approvalStatus === 'authorized') {
          totals.authorized += rowTotal;
        } else if ((severity === 'red' || severity === 'amber') && item.approvalStatus === 'declined') {
          totals.declined += rowTotal;
        }
      });
    };

    accumulate(severityLists.red, 'red');
    accumulate(severityLists.amber, 'amber');
    accumulate(severityLists.authorized, 'authorized');
    accumulate(severityLists.declined, 'declined');

    // Debug logging (can be removed in production)
    if (totals.authorized > 0 || totals.declined > 0) {
      console.log('[VHC Totals Calculation]', {
        authorized: totals.authorized,
        declined: totals.declined,
        summaryItemsCount: summaryItems.length,
        severityListCounts: {
          red: severityLists.red.length,
          amber: severityLists.amber.length,
          authorized: severityLists.authorized.length,
          declined: severityLists.declined.length,
        }
      });
    }

    return totals;
  } catch (error) {
    console.error('[VHC Totals Calculation Error]', error);
    return { authorized: 0, declined: 0 };
  }
}
