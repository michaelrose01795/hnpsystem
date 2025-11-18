"use client";

import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { listConsumablesForTracker } from "@/lib/database/consumables";

const containerStyle = {
  flex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  padding: "8px 16px",
  overflow: "hidden",
};

const workspaceShellStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  border: "1px solid #ffe5e5",
  background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
  padding: "24px",
  minHeight: 0,
  overflow: "hidden",
};

const mainColumnStyle = {
  flex: 3,
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  minHeight: 0,
  minWidth: 0,
  overflowY: "auto",
  paddingRight: "8px",
};

const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 18px 30px rgba(209,0,0,0.12)",
  border: "1px solid #ffe3e3",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "#b10000",
  marginBottom: "12px",
};

const badgeBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const budgetInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ffb3b3",
  fontSize: "0.95rem",
};

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "—";
  }

  return `£${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getConsumableStatus({ nextEstimatedOrderDate, isRequired }) {
  if (isRequired === false) {
    return { label: "Not Required", tone: "safe" };
  }

  if (!nextEstimatedOrderDate) {
    return { label: "Coming Up", tone: "warning" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(nextEstimatedOrderDate);
  nextDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(nextDate.getTime())) {
    return { label: "Coming Up", tone: "warning" };
  }

  if (today > nextDate) {
    return { label: "Overdue", tone: "danger" };
  }

  return { label: "Coming Up", tone: "warning" };
}

function toneToStyles(tone) {
  if (tone === "danger") {
    return {
      ...badgeBaseStyle,
      backgroundColor: "rgba(209,0,0,0.12)",
      color: "#a00000",
      border: "1px solid rgba(209,0,0,0.35)",
    };
  }
  if (tone === "warning") {
    return {
      ...badgeBaseStyle,
      backgroundColor: "rgba(255,172,0,0.16)",
      color: "#b06000",
      border: "1px solid rgba(255,172,0,0.35)",
    };
  }

  return {
    ...badgeBaseStyle,
    backgroundColor: "rgba(0,176,112,0.12)",
    color: "#007a4e",
    border: "1px solid rgba(0,176,112,0.35)",
  };
}

function ConsumablesTrackerPage() {
  const { user } = useUser();
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const isWorkshopManager = userRoles.includes("workshop manager");
  const [monthlyBudget, setMonthlyBudget] = useState(2500);
  const [consumables, setConsumables] = useState([]);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [consumablesError, setConsumablesError] = useState("");

  useEffect(() => {
    if (!isWorkshopManager) {
      return;
    }

    let isMounted = true;

    const fetchConsumables = async () => {
      setLoadingConsumables(true);

      try {
        const rows = await listConsumablesForTracker();
        if (!isMounted) {
          return;
        }

        setConsumables(rows);
        setConsumablesError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("❌ Failed to load consumables", error);
        setConsumables([]);
        setConsumablesError(error?.message || "Unable to load consumables.");
      } finally {
        if (isMounted) {
          setLoadingConsumables(false);
        }
      }
    };

    fetchConsumables();

    return () => {
      isMounted = false;
    };
  }, [isWorkshopManager]);

  const handleBudgetChange = (event) => {
    setMonthlyBudget(Number(event.target.value) || 0);
  };

  const totals = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const monthSpend = consumables.reduce((acc, item) => {
      if (!item.lastOrderDate) {
        return acc;
      }
      const lastOrder = new Date(item.lastOrderDate);
      if (
        lastOrder.getMonth() === currentMonth &&
        lastOrder.getFullYear() === currentYear
      ) {
        acc += item.lastOrderTotalValue ?? item.unitCost * (item.lastOrderQuantity || 0);
      }
      return acc;
    }, 0);

    const projectedSpend = consumables.reduce((acc, item) => {
      const qty = item.estimatedQuantity || 0;
      acc += (item.unitCost || 0) * qty;
      return acc;
    }, 0);

    return { monthSpend, projectedSpend };
  }, [consumables]);

  if (!isWorkshopManager) {
    return (
      <Layout>
        <div style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <h1 style={{ color: "#a00000", marginBottom: "16px" }}>
              Workshop Manager Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: "#444" }}>
              This consumables tracker is limited to workshop management roles. If
              you believe you should have access please contact the systems
              administrator.
            </p>
            <Link
              href="/dashboard"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #d10000, #940000)",
                color: "#ffffff",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Return to dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={containerStyle}>
        <div style={workspaceShellStyle}>
          <div style={mainColumnStyle}>
            <div style={{ ...cardStyle }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#b10000" }}>
                    Workshop Consumables Tracker
                  </h1>
                  <p style={{ marginTop: "6px", color: "#666" }}>
                    Monitor consumable spend, reorder schedules, and supplier summaries.
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
                    Monthly Budget
                  </p>
                  <strong style={{ fontSize: "1.4rem", color: "#b10000" }}>
                    {formatCurrency(monthlyBudget)}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    This Month's Spend
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "#b10000",
                    }}
                  >
                    {formatCurrency(totals.monthSpend)}
                  </h2>
                </div>
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    Projected Spend (All Scheduled Orders)
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "#b10000",
                    }}
                  >
                    {formatCurrency(totals.projectedSpend)}
                  </h2>
                </div>
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    Budget Remaining
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: totals.monthSpend > monthlyBudget ? "#a00000" : "#007a4e",
                    }}
                  >
                    {formatCurrency(
                      Math.max(monthlyBudget - totals.monthSpend, -999999)
                    )}
                  </h2>
                </div>
              </div>

              <div style={{ marginTop: "20px" }}>
                <label
                  htmlFor="monthlyBudget"
                  style={{
                    fontWeight: 600,
                    color: "#b10000",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Adjust Monthly Consumables Budget
                </label>
                <input
                  id="monthlyBudget"
                  type="number"
                  min="0"
                  step="50"
                  value={monthlyBudget}
                  onChange={handleBudgetChange}
                  style={budgetInputStyle}
                />
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <h2 style={sectionTitleStyle}>Scheduled Consumables</h2>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 12px",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        color: "#a00000",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Item</th>
                      <th style={{ padding: "8px" }}>Last Ordered</th>
                      <th style={{ padding: "8px" }}>Next Estimated</th>
                      <th style={{ padding: "8px" }}>Estimated Qty</th>
                      <th style={{ padding: "8px" }}>Supplier</th>
                      <th style={{ padding: "8px" }}>Unit Cost</th>
                      <th style={{ padding: "8px" }}>Last Order Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingConsumables ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px", color: "#6b7280" }}>
                          Loading consumable data…
                        </td>
                      </tr>
                    ) : consumablesError ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px", color: "#a00000" }}>
                          {consumablesError}
                        </td>
                      </tr>
                    ) : consumables.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: "14px", color: "#6b7280" }}
                        >
                          No consumable records found.
                        </td>
                      </tr>
                    ) : (
                      consumables.map((item) => {
                        const status = getConsumableStatus(item);
                        const icon =
                          status.label === "Overdue"
                            ? "⚠️"
                            : status.label === "Not Required"
                            ? "ℹ️"
                            : "⏰";

                        return (
                          <tr
                            key={item.id}
                            style={{
                              background: "#fff7f7",
                              borderRadius: "12px",
                            }}
                          >
                            <td style={{ padding: "12px" }}>
                              <span style={toneToStyles(status.tone)}>
                                {icon}
                                {status.label}
                              </span>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <strong
                                style={{ display: "block", color: "#b10000" }}
                              >
                                {item.name}
                              </strong>
                              {item.partNumber && (
                                <span style={{ fontSize: "0.8rem", color: "#888" }}>
                                  {item.partNumber}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {formatDate(item.lastOrderDate)}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {formatDate(item.nextEstimatedOrderDate)}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {item.estimatedQuantity
                                ? item.estimatedQuantity.toLocaleString()
                                : "—"}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {item.supplier || "—"}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {formatCurrency(item.unitCost)}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {formatCurrency(item.lastOrderTotalValue)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ConsumablesTrackerPage;
