// file location: src/pages/workshop/consumables-tracker.js

"use client"; // Enable client-side interactivity for this page

import React, { useMemo, useState } from "react"; // Import React hooks for state and memoization
import Layout from "../../components/Layout"; // Import shared layout wrapper
import { useUser } from "../../context/UserContext"; // Import user context for role-based access
import Link from "next/link"; // Import Link for navigation shortcuts
import { consumableOrderHistory } from "../../lib/data/consumablesSample"; // Shared seed data for consumables

const containerStyle = {
  padding: "24px", // Provide roomy spacing around the page
  maxWidth: "1400px", // Limit page width for readability
  margin: "0 auto", // Center the content on large displays
  display: "flex", // Use flex layout to position columns
  gap: "24px", // Maintain comfortable distance between sections
};

const mainColumnStyle = {
  flex: 3, // Allocate more space to the tracker content
  display: "flex", // Stack children vertically
  flexDirection: "column", // Arrange sections in a column
  gap: "20px", // Space out sections evenly
};

const sideColumnStyle = {
  flex: 1.2, // Narrower column for reminders and notes
  display: "flex", // Stack panels vertically
  flexDirection: "column", // Arrange panels from top to bottom
  gap: "20px", // Add consistent spacing between panels
};

const cardStyle = {
  backgroundColor: "#ffffff", // White background for clarity
  borderRadius: "16px", // Smooth rounded corners
  padding: "20px", // Comfortable interior spacing
  boxShadow: "0 18px 30px rgba(209,0,0,0.12)", // Soft red-accented shadow for depth
  border: "1px solid #ffe3e3", // Faint red border for branding
};

const sectionTitleStyle = {
  fontSize: "1.1rem", // Emphasise titles slightly
  fontWeight: 700, // Bold titles for hierarchy
  color: "#b10000", // Use on-brand deep red for headings
  marginBottom: "12px", // Space below titles
};

const badgeBaseStyle = {
  display: "inline-flex", // Align icon and text horizontally
  alignItems: "center", // Vertically center badge contents
  gap: "6px", // Space icon from text
  padding: "4px 10px", // Compact pill appearance
  borderRadius: "999px", // Fully rounded pill edges
  fontSize: "0.75rem", // Small badge text
  fontWeight: 600, // Semi-bold for emphasis
};

const budgetInputStyle = {
  width: "100%", // Stretch across parent container
  padding: "10px 12px", // Comfortable input padding
  borderRadius: "10px", // Rounded corners to match cards
  border: "1px solid #ffb3b3", // Light red border for theming
  fontSize: "0.95rem", // Legible input text
};

function formatCurrency(value) {
  const numeric = Number(value) || 0; // Coerce value to number safely
  return `£${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; // Return formatted GBP string
}

function addDays(dateString, days) {
  const baseDate = new Date(dateString); // Convert string to Date
  baseDate.setDate(baseDate.getDate() + days); // Advance date by provided days
  return baseDate.toISOString().split("T")[0]; // Return ISO date string without time
}

function calculateReminderDate(reorderDate) {
  return addDays(reorderDate, -7); // Reminder should appear one week prior to reorder date
}

function getStatus(reminderDate, reorderDate) {
  const today = new Date().setHours(0, 0, 0, 0); // Normalise to midnight for comparisons
  const reminder = new Date(reminderDate).setHours(0, 0, 0, 0); // Reminder timestamp
  const reorder = new Date(reorderDate).setHours(0, 0, 0, 0); // Reorder timestamp

  if (today > reorder) return { label: "Overdue", tone: "danger" }; // Reorder date passed
  if (today >= reminder) return { label: "Due Soon", tone: "warning" }; // Within reminder window
  return { label: "On Track", tone: "safe" }; // No immediate action required
}

function toneToStyles(tone) {
  if (tone === "danger") {
    return {
      ...badgeBaseStyle, // Reuse base badge appearance
      backgroundColor: "rgba(209,0,0,0.12)", // Light red fill for danger
      color: "#a00000", // Deep red text
      border: "1px solid rgba(209,0,0,0.35)", // Slightly stronger border
    };
  }
  if (tone === "warning") {
    return {
      ...badgeBaseStyle, // Base pill styling
      backgroundColor: "rgba(255,172,0,0.16)", // Amber warning background
      color: "#b06000", // Warm amber text tone
      border: "1px solid rgba(255,172,0,0.35)", // Amber border
    };
  }
  return {
    ...badgeBaseStyle, // Base pill styling
    backgroundColor: "rgba(0,176,112,0.12)", // Calm green background for OK state
    color: "#007a4e", // Dark green text tone
    border: "1px solid rgba(0,176,112,0.35)", // Green border accent
  };
}

function ConsumablesTrackerPage() {
  const { user } = useUser(); // Access the active user profile
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // Normalise role strings for comparisons
  const isWorkshopManager = userRoles.includes("workshop manager"); // Determine if user can access this page

  const todayIso = new Date().toISOString().split("T")[0]; // Today's date for default form values

  const [monthlyBudget, setMonthlyBudget] = useState(2500); // Store monthly spending limit
  const [newConsumable, setNewConsumable] = useState({
    partNumber: "", // Track part number input
    name: "", // Track consumable description input
    reorderFrequencyDays: 30, // Default reorder cadence in days
    nextReorderDate: addDays(todayIso, 14), // Default next reorder date
    quantityPerOrder: 50, // Default quantity ordered each time
    unitCost: 10, // Default cost per unit
    supplier: "", // Track supplier input
    notes: "", // Track additional notes
  });

  const [consumables, setConsumables] = useState(() =>
    consumableOrderHistory.map((item) => ({ ...item }))
  ); // Seed data to illustrate tracker behaviour

  const handleBudgetChange = (event) => {
    setMonthlyBudget(Number(event.target.value) || 0); // Update monthly budget when input changes
  };

  const handleNewConsumableChange = (event) => {
    const { name, value } = event.target; // Extract input field name and value
    setNewConsumable((previous) => ({ ...previous, [name]: value })); // Update the corresponding field while preserving others
  };

  const handleAddConsumable = (event) => {
    event.preventDefault(); // Prevent page reload on submit

    if (!newConsumable.partNumber.trim() || !newConsumable.name.trim()) {
      alert("Please provide both a part number and a name for the consumable."); // Ensure required fields are provided
      return; // Stop submission if validation fails
    }

    const identifier = `${newConsumable.partNumber}-${Date.now()}`; // Generate unique ID combining part number and timestamp

    const preparedConsumable = {
      id: identifier, // Unique ID for lists
      partNumber: newConsumable.partNumber.trim(), // Store cleaned part number
      name: newConsumable.name.trim(), // Store cleaned item name
      category: "Custom", // Default category for new items
      lastOrderedDate: todayIso, // Assume newly added items were last ordered today
      reorderFrequencyDays: Number(newConsumable.reorderFrequencyDays) || 30, // Store reorder cadence
      nextReorderDate: newConsumable.nextReorderDate || addDays(todayIso, 30), // Save reorder date fallback
      quantityPerOrder: Number(newConsumable.quantityPerOrder) || 1, // Save quantity per order
      unitCost: Number(newConsumable.unitCost) || 0, // Save unit cost as number
      supplier: newConsumable.supplier.trim(), // Save supplier detail
      notes: newConsumable.notes.trim(), // Save notes field
    }; // Build consumable object ready for state update

    setConsumables((previous) => [preparedConsumable, ...previous]); // Prepend new consumable to tracker list

    setNewConsumable({
      partNumber: "", // Reset form part number
      name: "", // Reset name field
      reorderFrequencyDays: 30, // Reset reorder cadence
      nextReorderDate: addDays(todayIso, 30), // Reset reorder date
      quantityPerOrder: 1, // Reset quantity field
      unitCost: 0, // Reset cost field
      supplier: "", // Reset supplier field
      notes: "", // Reset notes field
    }); // Clear form ready for next entry
  };

  const handleLogOrder = (consumableId) => {
    setConsumables((previous) =>
      previous.map((item) => {
        if (item.id !== consumableId) return item; // Skip unaffected items
        const updatedLastOrdered = todayIso; // Use today as new last order date
        const updatedNextReorder = addDays(updatedLastOrdered, item.reorderFrequencyDays); // Calculate new reorder date
        return {
          ...item, // Preserve existing properties
          lastOrderedDate: updatedLastOrdered, // Update last ordered date
          nextReorderDate: updatedNextReorder, // Schedule next reorder
        }; // Return updated consumable record
      })
    );
  };

  const reminderEntries = useMemo(() => {
    return consumables
      .map((item) => {
        const reminderDate = calculateReminderDate(item.nextReorderDate); // Determine reminder date for item
        const status = getStatus(reminderDate, item.nextReorderDate); // Determine reminder status tone
        return { ...item, reminderDate, status }; // Build enriched record for reminder list
      })
      .filter((item) => item.status.tone !== "safe") // Only show items that are due soon or overdue
      .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate)); // Sort by reminder date ascending
  }, [consumables]);

  const totals = useMemo(() => {
    const currentDate = new Date(); // Reference date for monthly calculations
    const currentMonth = currentDate.getMonth(); // Month index 0-11
    const currentYear = currentDate.getFullYear(); // Current year for matching

    let monthSpend = 0; // Track monthly spend
    let projectedSpend = 0; // Track total value of upcoming orders

    consumables.forEach((item) => {
      const lastOrder = new Date(item.lastOrderedDate); // Parse last order date
      if (
        lastOrder.getMonth() === currentMonth && // Check same month
        lastOrder.getFullYear() === currentYear // Check same year
      ) {
        monthSpend += item.unitCost * item.quantityPerOrder; // Add to monthly spend when last order falls within month
      }

      projectedSpend += item.unitCost * item.quantityPerOrder; // Always add to projected spend for monthly planning
    });

    return { monthSpend, projectedSpend }; // Return aggregated totals
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
        <div style={mainColumnStyle}>
          <div style={{ ...cardStyle }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#b10000" }}>
                  Workshop Consumables Tracker
                </h1>
                <p style={{ marginTop: "6px", color: "#666" }}>
                  Monitor consumable spend, reorder schedules, and supplier details
                  in one place.
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

            <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ ...cardStyle, padding: "16px", boxShadow: "none", border: "1px dashed #ffd0d0" }}>
                <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>
                  This Month's Spend
                </p>
                <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", color: "#b10000" }}>
                  {formatCurrency(totals.monthSpend)}
                </h2>
              </div>
              <div style={{ ...cardStyle, padding: "16px", boxShadow: "none", border: "1px dashed #ffd0d0" }}>
                <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>
                  Projected Spend (All Scheduled Orders)
                </p>
                <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", color: "#b10000" }}>
                  {formatCurrency(totals.projectedSpend)}
                </h2>
              </div>
              <div style={{ ...cardStyle, padding: "16px", boxShadow: "none", border: "1px dashed #ffd0d0" }}>
                <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>
                  Budget Remaining
                </p>
                <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", color: totals.monthSpend > monthlyBudget ? "#a00000" : "#007a4e" }}>
                  {formatCurrency(Math.max(monthlyBudget - totals.monthSpend, -999999))}
                </h2>
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <label htmlFor="monthlyBudget" style={{ fontWeight: 600, color: "#b10000", display: "block", marginBottom: "6px" }}>
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
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Part Number</th>
                    <th style={{ padding: "8px" }}>Item</th>
                    <th style={{ padding: "8px" }}>Last Ordered</th>
                    <th style={{ padding: "8px" }}>Next Reorder</th>
                    <th style={{ padding: "8px" }}>Reminder</th>
                    <th style={{ padding: "8px" }}>Quantity</th>
                    <th style={{ padding: "8px" }}>Unit Cost</th>
                    <th style={{ padding: "8px" }}>Last Order Value</th>
                    <th style={{ padding: "8px" }}>Supplier</th>
                    <th style={{ padding: "8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((item) => {
                    const reminderDate = calculateReminderDate(item.nextReorderDate); // Calculate reminder date per row
                    const status = getStatus(reminderDate, item.nextReorderDate); // Determine status tone per row
                    return (
                      <tr key={item.id} style={{ background: "#fff7f7", borderRadius: "12px" }}>
                        <td style={{ padding: "12px" }}>
                          <span style={toneToStyles(status.tone)}>
                            {status.tone === "danger" ? "⚠️" : status.tone === "warning" ? "⏰" : "✅"}
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontWeight: 600, color: "#333" }}>{item.partNumber}</td>
                        <td style={{ padding: "12px", color: "#555" }}>
                          <strong style={{ display: "block", color: "#b10000" }}>{item.name}</strong>
                          <span style={{ fontSize: "0.8rem", color: "#888" }}>{item.category}</span>
                        </td>
                        <td style={{ padding: "12px", color: "#555" }}>{item.lastOrderedDate}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{item.nextReorderDate}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{reminderDate}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{item.quantityPerOrder}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{formatCurrency(item.unitCost)}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{formatCurrency(item.unitCost * item.quantityPerOrder)}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{item.supplier || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          <button
                            type="button"
                            onClick={() => handleLogOrder(item.id)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "none",
                              background: "linear-gradient(135deg, #d10000, #940000)",
                              color: "#ffffff",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: "0 10px 18px rgba(209,0,0,0.18)",
                            }}
                          >
                            Log Order Now
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <h2 style={sectionTitleStyle}>Add New Consumable</h2>
            <form onSubmit={handleAddConsumable} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="partNumber" style={{ fontWeight: 600, color: "#b10000" }}>
                  Part Number
                </label>
                <input
                  id="partNumber"
                  name="partNumber"
                  type="text"
                  value={newConsumable.partNumber}
                  onChange={handleNewConsumableChange}
                  placeholder="e.g. WIP-010"
                  style={budgetInputStyle}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="name" style={{ fontWeight: 600, color: "#b10000" }}>
                  Item Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={newConsumable.name}
                  onChange={handleNewConsumableChange}
                  placeholder="e.g. Brake Cleaner"
                  style={budgetInputStyle}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="reorderFrequencyDays" style={{ fontWeight: 600, color: "#b10000" }}>
                  Reorder Frequency (Days)
                </label>
                <input
                  id="reorderFrequencyDays"
                  name="reorderFrequencyDays"
                  type="number"
                  min="7"
                  step="1"
                  value={newConsumable.reorderFrequencyDays}
                  onChange={handleNewConsumableChange}
                  style={budgetInputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="nextReorderDate" style={{ fontWeight: 600, color: "#b10000" }}>
                  Next Reorder Date
                </label>
                <input
                  id="nextReorderDate"
                  name="nextReorderDate"
                  type="date"
                  value={newConsumable.nextReorderDate}
                  onChange={handleNewConsumableChange}
                  style={budgetInputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="quantityPerOrder" style={{ fontWeight: 600, color: "#b10000" }}>
                  Quantity Per Order
                </label>
                <input
                  id="quantityPerOrder"
                  name="quantityPerOrder"
                  type="number"
                  min="1"
                  step="1"
                  value={newConsumable.quantityPerOrder}
                  onChange={handleNewConsumableChange}
                  style={budgetInputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="unitCost" style={{ fontWeight: 600, color: "#b10000" }}>
                  Unit Cost (£)
                </label>
                <input
                  id="unitCost"
                  name="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newConsumable.unitCost}
                  onChange={handleNewConsumableChange}
                  style={budgetInputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="supplier" style={{ fontWeight: 600, color: "#b10000" }}>
                  Preferred Supplier
                </label>
                <input
                  id="supplier"
                  name="supplier"
                  type="text"
                  value={newConsumable.supplier}
                  onChange={handleNewConsumableChange}
                  placeholder="e.g. AutoChem"
                  style={budgetInputStyle}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="notes" style={{ fontWeight: 600, color: "#b10000" }}>
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={newConsumable.notes}
                  onChange={handleNewConsumableChange}
                  placeholder="Any usage notes or storage requirements"
                  style={{ ...budgetInputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  style={{
                    padding: "12px 20px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #d10000, #940000)",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 16px 26px rgba(209,0,0,0.22)",
                  }}
                >
                  Add Consumable to Tracker
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={sideColumnStyle}>
          <div style={{ ...cardStyle }}>
            <h2 style={sectionTitleStyle}>Reminders & Alerts</h2>
            {reminderEntries.length === 0 ? (
              <p style={{ color: "#555" }}>All consumables are currently on track.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {reminderEntries.map((item) => (
                  <li key={item.id} style={{ background: "#fff7f0", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#b10000" }}>{item.name}</strong>
                        <p style={{ margin: "4px 0 0", color: "#666", fontSize: "0.85rem" }}>
                          Order on {item.nextReorderDate} · Reminder {item.reminderDate}
                        </p>
                      </div>
                      <span style={toneToStyles(item.status.tone)}>{item.status.label}</span>
                    </div>
                    <p style={{ margin: "10px 0 0", color: "#777", fontSize: "0.8rem" }}>
                      Supplier: <strong>{item.supplier || "Not set"}</strong> ·
                      Last spend {formatCurrency(item.unitCost * item.quantityPerOrder)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...cardStyle }}>
            <h2 style={sectionTitleStyle}>Budget Notes</h2>
            <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: "12px" }}>
              Keep budget tracking accurate by logging orders as soon as they are
              placed. The tracker recalculates reminders automatically using the
              reorder frequency for each consumable.
            </p>
            <ul style={{ listStyle: "disc", paddingLeft: "20px", color: "#666", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>Use the "Log Order Now" button after placing supplier orders.</li>
              <li>Adjust the monthly budget when headcount or throughput changes.</li>
              <li>
                Capture any special pricing or supplier promotions in the notes
                field for quick reference.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ConsumablesTrackerPage; // Export page as default for Next.js routing
