// file location: src/components/Invoices/InvoiceSection.js
"use client";

import React, { useMemo } from "react";
import { useUser } from "@/context/UserContext";

/**
 * InvoiceSection Component
 * Displays comprehensive invoice details for a completed job including:
 * - Job details
 * - Labour breakdown
 * - Parts used
 * - Consumables/Sundries
 * - Total calculation with VAT
 */
export default function InvoiceSection({ jobData }) {
  const { user } = useUser();

  // Permission check - only Admin and Manager can edit labour rates
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const canEditLabourRates = ["admin", "admin manager", "service manager", "workshop manager"].some(
    (role) => userRoles.includes(role)
  );

  // TODO: Fetch labour rate from settings table or company config
  const DEFAULT_LABOUR_RATE = 85.0; // £85 per hour
  const VAT_RATE = 0.2; // 20%

  // ========== JOB DETAILS ==========
  const jobDetails = useMemo(() => {
    if (!jobData) return null;

    return {
      jobNumber: jobData.jobNumber || jobData.job_number || "N/A",
      registration: jobData.reg || jobData.vehicle?.registration || "N/A",
      customerName: jobData.customer ||
        `${jobData.customerFirstname || ""} ${jobData.customerLastname || ""}`.trim() || "N/A",
      jobType: jobData.jobSource || jobData.job_source || "Retail",
      dateBookedIn: jobData.createdAt || jobData.created_at || null,
      dateCompleted: jobData.completedAt || jobData.completed_at || jobData.updatedAt || null,
      // TODO: Need to determine which technician completed the job from job_clocking table
      technicianCompleted: "TODO: Query job_clocking table",
    };
  }, [jobData]);

  // ========== LABOUR CALCULATION ==========
  const labourData = useMemo(() => {
    if (!jobData?.clockingEntries || jobData.clockingEntries.length === 0) {
      return {
        totalHours: 0,
        labourRate: DEFAULT_LABOUR_RATE,
        labourTotal: 0,
        entries: [],
      };
    }

    // Calculate total hours from clocking entries
    const totalHours = jobData.clockingEntries.reduce((sum, entry) => {
      return sum + (entry.hoursWorked || 0);
    }, 0);

    const labourRate = DEFAULT_LABOUR_RATE;
    const labourTotal = totalHours * labourRate;

    return {
      totalHours: totalHours.toFixed(2),
      labourRate,
      labourTotal: labourTotal.toFixed(2),
      entries: jobData.clockingEntries,
    };
  }, [jobData]);

  // ========== PARTS CALCULATION ==========
  const partsData = useMemo(() => {
    // TODO: Pull from parts_job_items table where job_id matches and authorised = true
    // For now, use existing partsAllocations if available
    const parts = jobData?.partsAllocations || jobData?.parts_job_items || [];

    const partsWithCalculations = parts
      .filter(item => item.authorised !== false) // Only include authorized parts
      .map((item) => {
        const qty = Number(item.quantityAllocated || item.quantity_allocated || item.quantity || 0);
        const unitCost = Number(item.unitCost || item.unit_cost || 0);
        const unitPrice = Number(item.unitPrice || item.unit_price || unitCost * 1.3); // 30% markup default
        const lineTotal = qty * unitPrice;

        return {
          partName: item.part?.name || item.partName || item.name || "Unknown Part",
          partNumber: item.part?.part_number || item.partNumber || item.part_number || "N/A",
          quantity: qty,
          unitCost: unitCost.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          storageLocation: item.storage_location || item.storageLocation || item.part?.storage_location || "N/A",
          stockStatus: item.stock_status || item.stockStatus || "in_stock",
          isOnOrder: (item.stock_status || item.stockStatus) === "back_order" ||
                     (item.stock_status || item.stockStatus) === "no_stock",
        };
      });

    const partsSubtotal = partsWithCalculations.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );

    return {
      items: partsWithCalculations,
      subtotal: partsSubtotal.toFixed(2),
    };
  }, [jobData]);

  // ========== CONSUMABLES CALCULATION ==========
  const consumablesData = useMemo(() => {
    // TODO: Query workshop_consumable_orders table filtered by job_id
    // For now, return empty array as placeholder
    const consumables = jobData?.consumables || [];

    const consumablesWithCalculations = consumables.map((item) => {
      const qty = Number(item.quantity || 0);
      const unitCost = Number(item.unit_cost || item.unitCost || 0);
      const lineTotal = qty * unitCost;

      return {
        name: item.item_name || item.name || "Unknown Consumable",
        quantity: qty,
        unitCost: unitCost.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      };
    });

    const consumablesSubtotal = consumablesWithCalculations.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );

    return {
      items: consumablesWithCalculations,
      subtotal: consumablesSubtotal.toFixed(2),
    };
  }, [jobData]);

  // ========== TOTALS CALCULATION ==========
  const totals = useMemo(() => {
    const labourSubtotal = Number(labourData.labourTotal);
    const partsSubtotal = Number(partsData.subtotal);
    const consumablesSubtotal = Number(consumablesData.subtotal);

    const subtotalBeforeVAT = labourSubtotal + partsSubtotal + consumablesSubtotal;
    const vatAmount = subtotalBeforeVAT * VAT_RATE;
    const grandTotal = subtotalBeforeVAT + vatAmount;

    return {
      labourSubtotal: labourSubtotal.toFixed(2),
      partsSubtotal: partsSubtotal.toFixed(2),
      consumablesSubtotal: consumablesSubtotal.toFixed(2),
      subtotalBeforeVAT: subtotalBeforeVAT.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    };
  }, [labourData, partsData, consumablesData]);

  if (!jobData) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--grey-accent)" }}>
        No job data available
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      {/* TODO Comments for Missing Fields */}
      {/* TODO: Query job_clocking table to get technician who completed the job */}
      {/* TODO: Query workshop_consumable_orders table for consumables used on this job */}
      {/* TODO: Fetch VAT rate from company settings table */}
      {/* TODO: Fetch labour rate from settings table */}
      {/* TODO: Implement "Generate Invoice PDF" button functionality */}

      <h2 style={{
        marginTop: 0,
        marginBottom: "24px",
        color: "var(--primary)",
        fontSize: "24px",
        fontWeight: "700"
      }}>
        Invoice Summary
      </h2>

      {/* ========== JOB DETAILS SECTION ========== */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{
          color: "var(--danger)",
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          borderBottom: "2px solid var(--danger)",
          paddingBottom: "8px"
        }}>
          Job Details
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "12px",
          backgroundColor: "var(--surface-light)",
          padding: "16px",
          borderRadius: "8px"
        }}>
          <DetailRow label="Job Number" value={jobDetails?.jobNumber} />
          <DetailRow label="Registration" value={jobDetails?.registration} />
          <DetailRow label="Customer Name" value={jobDetails?.customerName} />
          <DetailRow label="Job Type" value={jobDetails?.jobType} />
          <DetailRow
            label="Date Booked In"
            value={jobDetails?.dateBookedIn ? new Date(jobDetails.dateBookedIn).toLocaleDateString() : "N/A"}
          />
          <DetailRow
            label="Date Completed"
            value={jobDetails?.dateCompleted ? new Date(jobDetails.dateCompleted).toLocaleDateString() : "N/A"}
          />
          <DetailRow
            label="Technician"
            value={jobDetails?.technicianCompleted}
            isWarning={jobDetails?.technicianCompleted?.includes("TODO")}
          />
          <DetailRow
            label="Total Job Time"
            value={`${labourData.totalHours} hours`}
          />
        </div>
      </section>

      {/* ========== LABOUR SECTION ========== */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{
          color: "var(--danger)",
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          borderBottom: "2px solid var(--danger)",
          paddingBottom: "8px"
        }}>
          Labour
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "var(--surface-light)",
            borderRadius: "8px",
            overflow: "hidden"
          }}>
            <thead>
              <tr style={{ backgroundColor: "var(--danger)", color: "white" }}>
                <th style={tableHeaderStyle}>Job Description</th>
                <th style={tableHeaderStyle}>Labour Time (hrs)</th>
                <th style={tableHeaderStyle}>
                  Labour Rate (£/hr)
                  {!canEditLabourRates && (
                    <span style={{ fontSize: "11px", fontWeight: "400", marginLeft: "4px" }}>
                      (Admin only)
                    </span>
                  )}
                </th>
                <th style={tableHeaderStyle}>Total Labour Cost (£)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableCellStyle}>
                  {jobData.bookingDescription || jobData.booking_description || "General Service Work"}
                </td>
                <td style={tableCellStyle}>{labourData.totalHours}</td>
                <td style={tableCellStyle}>
                  {canEditLabourRates ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={labourData.labourRate}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid var(--surface-light)",
                        borderRadius: "4px",
                        width: "100px",
                        textAlign: "right"
                      }}
                      // TODO: Implement onChange handler to update labour rate
                    />
                  ) : (
                    `£${labourData.labourRate.toFixed(2)}`
                  )}
                </td>
                <td style={{ ...tableCellStyle, fontWeight: "600", color: "var(--danger)" }}>
                  £{labourData.labourTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========== PARTS USED SECTION ========== */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{
          color: "var(--danger)",
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          borderBottom: "2px solid var(--danger)",
          paddingBottom: "8px"
        }}>
          Parts Used
        </h3>
        {partsData.items.length === 0 ? (
          <div style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--grey-accent)",
            backgroundColor: "var(--surface-light)",
            borderRadius: "8px"
          }}>
            No parts have been authorized or allocated for this job
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              backgroundColor: "var(--surface-light)",
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <thead>
                <tr style={{ backgroundColor: "var(--danger)", color: "white" }}>
                  <th style={tableHeaderStyle}>Part Name</th>
                  <th style={tableHeaderStyle}>Part Number</th>
                  <th style={tableHeaderStyle}>Qty</th>
                  <th style={tableHeaderStyle}>Cost Price (£)</th>
                  <th style={tableHeaderStyle}>Customer Price (£)</th>
                  <th style={tableHeaderStyle}>Line Total (£)</th>
                  <th style={tableHeaderStyle}>Stock Location</th>
                  <th style={tableHeaderStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {partsData.items.map((part, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid var(--surface)" }}>
                    <td style={tableCellStyle}>{part.partName}</td>
                    <td style={tableCellStyle}>{part.partNumber}</td>
                    <td style={tableCellStyle}>{part.quantity}</td>
                    <td style={tableCellStyle}>£{part.unitCost}</td>
                    <td style={tableCellStyle}>£{part.unitPrice}</td>
                    <td style={{ ...tableCellStyle, fontWeight: "600" }}>£{part.lineTotal}</td>
                    <td style={tableCellStyle}>{part.storageLocation}</td>
                    <td style={tableCellStyle}>
                      {part.isOnOrder ? (
                        <span style={{
                          padding: "4px 8px",
                          backgroundColor: "var(--warning-surface)",
                          color: "var(--danger)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          On Order
                        </span>
                      ) : (
                        <span style={{
                          padding: "4px 8px",
                          backgroundColor: "var(--success-surface)",
                          color: "var(--success-dark)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== CONSUMABLES / SUNDRIES SECTION ========== */}
      <section style={{ marginBottom: "32px" }}>
        <h3 style={{
          color: "var(--danger)",
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          borderBottom: "2px solid var(--danger)",
          paddingBottom: "8px"
        }}>
          Consumables / Sundries
        </h3>
        {consumablesData.items.length === 0 ? (
          <div style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--grey-accent)",
            backgroundColor: "var(--surface-light)",
            borderRadius: "8px"
          }}>
            No consumables have been recorded for this job
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              backgroundColor: "var(--surface-light)",
              borderRadius: "8px",
              overflow: "hidden"
            }}>
              <thead>
                <tr style={{ backgroundColor: "var(--danger)", color: "white" }}>
                  <th style={tableHeaderStyle}>Consumable Name</th>
                  <th style={tableHeaderStyle}>Qty</th>
                  <th style={tableHeaderStyle}>Unit Cost (£)</th>
                  <th style={tableHeaderStyle}>Total Cost (£)</th>
                </tr>
              </thead>
              <tbody>
                {consumablesData.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid var(--surface)" }}>
                    <td style={tableCellStyle}>{item.name}</td>
                    <td style={tableCellStyle}>{item.quantity}</td>
                    <td style={tableCellStyle}>£{item.unitCost}</td>
                    <td style={{ ...tableCellStyle, fontWeight: "600" }}>£{item.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== TOTALS SECTION ========== */}
      <section style={{ marginBottom: "32px" }}>
        <div style={{
          maxWidth: "500px",
          marginLeft: "auto",
          backgroundColor: "var(--surface-light)",
          border: "2px solid var(--danger)",
          borderRadius: "12px",
          padding: "20px"
        }}>
          <h3 style={{
            color: "var(--danger)",
            fontSize: "20px",
            fontWeight: "700",
            marginBottom: "16px",
            textAlign: "center"
          }}>
            Invoice Totals
          </h3>

          <TotalRow label="Labour Subtotal" value={`£${totals.labourSubtotal}`} />
          <TotalRow label="Parts Subtotal" value={`£${totals.partsSubtotal}`} />
          <TotalRow label="Consumables Subtotal" value={`£${totals.consumablesSubtotal}`} />

          <div style={{
            borderTop: "2px solid var(--surface)",
            margin: "12px 0",
            paddingTop: "12px"
          }}>
            <TotalRow label="Subtotal (before VAT)" value={`£${totals.subtotalBeforeVAT}`} bold />
            <TotalRow label="VAT (20%)" value={`£${totals.vatAmount}`} />
          </div>

          <div style={{
            borderTop: "3px solid var(--danger)",
            marginTop: "12px",
            paddingTop: "12px"
          }}>
            <TotalRow
              label="GRAND TOTAL"
              value={`£${totals.grandTotal}`}
              bold
              large
              color="var(--danger)"
            />
          </div>
        </div>
      </section>

      {/* ========== ACTIONS SECTION ========== */}
      <section style={{ textAlign: "center", marginTop: "32px" }}>
        <button
          onClick={() => {
            // TODO: Implement Generate Invoice PDF functionality
            alert("TODO: Generate Invoice PDF functionality to be implemented");
          }}
          style={{
            padding: "14px 32px",
            backgroundColor: "var(--danger)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "16px",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "var(--danger-dark)"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "var(--danger)"}
        >
          Generate Invoice PDF
        </button>
      </section>
    </div>
  );
}

// ========== HELPER COMPONENTS ==========

function DetailRow({ label, value, isWarning = false }) {
  return (
    <div>
      <div style={{
        fontSize: "12px",
        color: "var(--grey-accent)",
        fontWeight: "500",
        marginBottom: "4px"
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "14px",
        fontWeight: "600",
        color: isWarning ? "var(--warning)" : "var(--text-primary)"
      }}>
        {value || "N/A"}
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold = false, large = false, color = null }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "8px",
      fontSize: large ? "20px" : "16px",
      fontWeight: bold || large ? "700" : "500",
      color: color || "var(--text-primary)"
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ========== TABLE STYLES ==========
const tableHeaderStyle = {
  padding: "12px",
  textAlign: "left",
  fontWeight: "600",
  fontSize: "14px"
};

const tableCellStyle = {
  padding: "12px",
  fontSize: "14px",
  color: "var(--text-primary)"
};
