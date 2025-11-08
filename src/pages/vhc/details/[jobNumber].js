// file location: src/pages/vhc/details/[jobNumber].js
"use client"; // enables client-side rendering for Next.js

import React, { useEffect, useState } from "react"; // import React and hooks
import { useRouter } from "next/router"; // for getting URL params and navigation
import { supabase } from "../../../lib/supabaseClient"; // import Supabase client
import Layout from "../../../components/Layout"; // import layout wrapper

// ✅ Status color mapping (same as dashboard)
const STATUS_COLORS = {
  "Outstanding": "#9ca3af", // grey
  "Accepted": "#d10000", // red
  "In Progress": "#3b82f6", // blue
  "Awaiting Authorization": "#fbbf24", // yellow
  "Authorized": "#9333ea", // purple
  "Ready": "#10b981", // green
  "Carry Over": "#f97316", // orange
  "Complete": "#06b6d4", // cyan
  "Sent": "#8b5cf6", // purple for sent status
  "Viewed": "#06b6d4", // cyan for viewed status
};

// ✅ Dropdown options for decline reasons so managers can provide quick context
const DECLINE_REASON_OPTIONS = [
  "Select a decline reason", // placeholder option prompting user selection
  "Customer requested delay", // customer wants to postpone the work
  "Awaiting budget approval", // waiting for cost approval
  "Parts unavailable today", // parts not currently in stock
  "Schedule for next visit", // plan to revisit in future service
  "Other reason" // catch-all option for bespoke notes
];

// ✅ Month options for follow-up reminders so advisors can set revisit schedule
const DECLINE_REMINDER_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1); // builds 1-12 month values

// ✅ Generate dummy VHC detail data for testing
const generateDummyVHCDetail = (jobNumber) => {
  const statuses = ["Outstanding", "Accepted", "In Progress", "Awaiting Authorization", "Authorized", "Ready", "Carry Over", "Complete"];
  const makes = ["Ford", "BMW", "Mercedes", "Audi", "Toyota", "Honda", "Nissan", "Volkswagen"];
  const names = ["John Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson", "James Taylor"];
  const randomIndex = parseInt(jobNumber.replace("JOB", "")) % 10;

  return {
    id: `vhc-${randomIndex}`,
    job_number: jobNumber,
    reg: `AB${20 + randomIndex} CDE`,
    customer_name: names[randomIndex % names.length],
    customer_phone: `07${Math.floor(Math.random() * 1000000000).toString().padStart(9, "0")}`,
    customer_email: `${names[randomIndex % names.length].toLowerCase().replace(" ", ".")}@email.com`,
    vehicle_make: makes[randomIndex % makes.length],
    vehicle_model: "Model X",
    vehicle_year: 2015 + (randomIndex % 8),
    mileage: 15000 + (randomIndex * 5000),
    status: statuses[randomIndex % statuses.length],
    technician_name: "Tech A",
    service_advisor: "MR",
    technician: "SP",
    parts_person: "DS",
    location_person: "JK",
    admin_person: "LM",
    last_visit: randomIndex % 3 === 0 ? new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : "First visit",
    next_service: randomIndex % 4 === 0 ? new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : "Not scheduled",
    mot_expiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    red_work: "475.00",
    amber_work: "460.00",
    authorized: "200.00",
    declined_work: "0.00",
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    // VHC Check Items with all categories
    vhc_items: [
      { id: 1, category: "Brakes", item: "Front Brake Pads", status: "Red", notes: "Worn below minimum", estimated_cost: "150.00", labor_hours: 1, parts_price: "80.00", total_price: "230.00", authorized: false, declined: false },
      { id: 2, category: "Brakes", item: "Rear Brake Discs", status: "Amber", notes: "Some wear visible", estimated_cost: "200.00", labor_hours: 1.5, parts_price: "120.00", total_price: "345.00", authorized: false, declined: false },
      { id: 3, category: "Tyres", item: "Front Left Tyre", status: "Green", notes: "Good condition", estimated_cost: "0.00", labor_hours: 0, parts_price: "0.00", total_price: "0.00", authorized: false, declined: false },
      { id: 4, category: "Tyres", item: "Front Right Tyre", status: "Amber", notes: "Tread at 3mm", estimated_cost: "80.00", labor_hours: 0.5, parts_price: "60.00", total_price: "135.00", authorized: false, declined: false },
      { id: 5, category: "Lights", item: "Headlight Bulb", status: "Red", notes: "Not working", estimated_cost: "25.00", labor_hours: 0.25, parts_price: "15.00", total_price: "52.50", authorized: false, declined: false },
      { id: 6, category: "Fluid Levels", item: "Engine Oil", status: "Green", notes: "Topped up", estimated_cost: "0.00", labor_hours: 0, parts_price: "0.00", total_price: "0.00", authorized: false, declined: false },
      { id: 7, category: "Suspension", item: "Front Shock Absorbers", status: "Amber", notes: "Minor leak detected", estimated_cost: "180.00", labor_hours: 2, parts_price: "100.00", total_price: "400.00", authorized: false, declined: false },
      { id: 8, category: "Battery", item: "Battery Health", status: "Green", notes: "Good voltage", estimated_cost: "0.00", labor_hours: 0, parts_price: "0.00", total_price: "0.00", authorized: false, declined: false },
      { id: 9, category: "Wipers", item: "Wiper Blades", status: "Grey", notes: "Not checked yet", estimated_cost: "0.00", labor_hours: 0, parts_price: "0.00", total_price: "0.00", authorized: false, declined: false },
      { id: 10, category: "Air Filter", item: "Cabin Air Filter", status: "Amber", notes: "Dirty, needs replacement", estimated_cost: "45.00", labor_hours: 0.25, parts_price: "25.00", total_price: "62.50", authorized: false, declined: false },
      { id: 11, category: "Exhaust", item: "Exhaust System", status: "Red", notes: "Leak detected at manifold", estimated_cost: "300.00", labor_hours: 2.5, parts_price: "200.00", total_price: "575.00", authorized: false, declined: false },
      { id: 12, category: "Steering", item: "Power Steering Fluid", status: "Green", notes: "Level OK", estimated_cost: "0.00", labor_hours: 0, parts_price: "0.00", total_price: "0.00", authorized: false, declined: false },
    ],
    // Parts data
    parts_identified: [
      { id: 1, part_name: "Front Brake Pads Set", part_number: "BP-12345", supplier: "AutoParts Ltd", price: "80.00", quantity: 1, vhc_item_id: 1 },
      { id: 2, part_name: "Rear Brake Disc Pair", part_number: "BD-67890", supplier: "BrakeCo", price: "120.00", quantity: 1, vhc_item_id: 2 },
      { id: 3, part_name: "H7 Headlight Bulb", part_number: "HB-11111", supplier: "LightSource", price: "15.00", quantity: 1, vhc_item_id: 5 },
      { id: 4, part_name: "Front Shock Absorber Pair", part_number: "SA-22222", supplier: "SuspensionPro", price: "100.00", quantity: 1, vhc_item_id: 7 },
      { id: 5, part_name: "Tyre 205/55R16", part_number: "TY-33333", supplier: "TyreMart", price: "60.00", quantity: 1, vhc_item_id: 4 },
      { id: 6, part_name: "Cabin Air Filter", part_number: "AF-44444", supplier: "FilterWorld", price: "25.00", quantity: 1, vhc_item_id: 10 },
      { id: 7, part_name: "Exhaust Manifold Gasket", part_number: "EX-55555", supplier: "ExhaustCo", price: "200.00", quantity: 1, vhc_item_id: 11 },
    ],
    // Parts on order
    parts_on_order: [
      { id: 2, part_name: "Rear Brake Disc Pair", part_number: "BD-67890", supplier: "BrakeCo", expected_date: "2025-11-05", order_number: "ORD-12345" },
      { id: 7, part_name: "Exhaust Manifold Gasket", part_number: "EX-55555", supplier: "ExhaustCo", expected_date: "2025-11-08", order_number: "ORD-12346" },
    ],
    // Photos uploaded by tech
    photos: [
      { id: 1, url: "https://via.placeholder.com/400x300/ff0000/ffffff?text=Brake+Pads", caption: "Front brake pads worn", send_to_customer: false, vhc_item_id: 1 },
      { id: 2, url: "https://via.placeholder.com/400x300/fbbf24/ffffff?text=Brake+Discs", caption: "Rear brake disc wear", send_to_customer: false, vhc_item_id: 2 },
      { id: 3, url: "https://via.placeholder.com/400x300/ff0000/ffffff?text=Headlight", caption: "Headlight not working", send_to_customer: false, vhc_item_id: 5 },
      { id: 4, url: "https://via.placeholder.com/400x300/10b981/ffffff?text=Engine+Bay", caption: "General engine bay view", send_to_customer: false, vhc_item_id: null },
    ],
    // Videos uploaded by tech
    videos: [
      { id: 1, url: "https://www.w3schools.com/html/mov_bbb.mp4", caption: "Brake noise demonstration", send_to_customer: false, vhc_item_id: 1 },
      { id: 2, url: "https://www.w3schools.com/html/movie.mp4", caption: "Exhaust leak sound", send_to_customer: false, vhc_item_id: 11 },
    ],
    // Notes and comments
    technician_notes: "Customer reported squeaking noise from brakes. Inspection confirmed front pads need replacement urgently. Advised customer of amber items for next service.",
    customer_comments: "Please call me before doing any additional work. Available 9am-5pm weekdays.",
  };
};

// ✅ VHC Details Page Component
export default function VHCDetails() {
  const router = useRouter(); // router for navigation and params
  const { jobNumber } = router.query; // get job number from URL
  const [vhcData, setVhcData] = useState(null); // VHC job data
  const [loading, setLoading] = useState(true); // loading state
  const [activeTab, setActiveTab] = useState("summary"); // active tab state
  const [selectedItems, setSelectedItems] = useState([]); // selected items for authorization
  const [editingLabor, setEditingLabor] = useState({}); // track which labor fields are being edited
  const [declineReason, setDeclineReason] = useState(DECLINE_REASON_OPTIONS[0]); // default decline reason dropdown selection
  const [declineReminderMonths, setDeclineReminderMonths] = useState("3"); // default reminder period in months

  // ✅ Fetch VHC details from Supabase (or use dummy data)
  useEffect(() => {
    if (!jobNumber) return; // wait for jobNumber to be available

    const fetchVHCDetails = async () => {
      setLoading(true);

      // Try to fetch from Supabase
      const { data, error } = await supabase
        .from("vhc_checks")
        .select("*")
        .eq("job_number", jobNumber)
        .single(); // get single record

      if (error || !data) {
        console.log("Using dummy data for testing"); // log when using dummy data
        setVhcData(generateDummyVHCDetail(jobNumber)); // use dummy data
      } else {
        setVhcData(data); // use real data from database
      }

      setLoading(false);
    };

    fetchVHCDetails(); // call on load
  }, [jobNumber]);

  // ✅ Recalculate totals when vhcData changes
  useEffect(() => {
    if (!vhcData) return;

    // Calculate red work total (unactioned only)
    const redTotal = vhcData.vhc_items
      .filter(item => item.status === "Red" && !item.authorized && !item.declined)
      .reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    // Calculate amber work total (unactioned only)
    const amberTotal = vhcData.vhc_items
      .filter(item => item.status === "Amber" && !item.authorized && !item.declined)
      .reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    // Calculate authorized total
    const authorizedTotal = vhcData.vhc_items
      .filter(item => item.authorized)
      .reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    // Calculate declined total
    const declinedTotal = vhcData.vhc_items
      .filter(item => item.declined)
      .reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    // Update totals in vhcData
    setVhcData(prev => ({
      ...prev,
      red_work: redTotal.toFixed(2),
      amber_work: amberTotal.toFixed(2),
      authorized: authorizedTotal.toFixed(2),
      declined_work: declinedTotal.toFixed(2)
    }));
  }, [vhcData?.vhc_items]);

  // ✅ Handle checkbox selection
  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // ✅ Determine if every item in a section is currently selected for bulk actions
  const areAllSelected = (items = []) => items.every(item => selectedItems.includes(item.id));

  // ✅ Toggle select all / clear all behaviour for a given list of items
  const handleToggleSelectAll = (items = []) => {
    setSelectedItems(prev => {
      const targetIds = items.map(item => item.id); // capture ids for comparison
      const allAlreadySelected = targetIds.every(id => prev.includes(id)); // check existing selection
      if (allAlreadySelected) {
        return prev.filter(id => !targetIds.includes(id)); // remove section ids when already selected
      }
      return Array.from(new Set([...prev, ...targetIds])); // merge unique ids when adding selection
    });
  };

  // ✅ Handle authorize selected items
  const handleAuthorizeSelected = () => {
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item =>
        selectedItems.includes(item.id)
          ? {
              ...item,
              authorized: true,
              declined: false,
              decline_reason: null,
              decline_reminder_months: null
            }
          : item
      )
    }));
    setSelectedItems([]); // clear selection
  };

  // ✅ Handle decline selected items
  const handleDeclineSelected = () => {
    if (!declineReason || declineReason === DECLINE_REASON_OPTIONS[0]) {
      alert("Please select a reason for declining before applying the change."); // prompt user to choose a reason
      return;
    }

    const reminderValue = parseInt(declineReminderMonths, 10) || null; // parse reminder value from dropdown

    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item =>
        selectedItems.includes(item.id)
          ? {
              ...item,
              declined: true,
              authorized: false,
              decline_reason: declineReason,
              decline_reminder_months: reminderValue
            }
          : item
      )
    }));
    setSelectedItems([]); // clear selection
  };

  // ✅ Handle toggle authorize/decline for individual item
  const handleToggleAuthorize = (itemId) => {
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item => {
        if (item.id !== itemId) {
          return item; // leave other items unchanged
        }
        if (item.authorized) {
          return { ...item, authorized: false }; // simply un-authorize when currently authorized
        }
        return {
          ...item,
          authorized: true,
          declined: false,
          decline_reason: null,
          decline_reminder_months: null
        }; // set authorization and clear any decline metadata
      })
    }));
  };

  const handleToggleDecline = (itemId) => {
    setVhcData(prev => {
      const targetItem = prev.vhc_items.find(item => item.id === itemId); // grab item to check state
      if (!targetItem) {
        return prev; // no change if item not found
      }

      if (!targetItem.declined && (!declineReason || declineReason === DECLINE_REASON_OPTIONS[0])) {
        alert("Please select a reason before declining this work item."); // enforce reason selection on single toggle
        return prev; // exit without modification
      }

      const reminderValue = parseInt(declineReminderMonths, 10) || null; // convert reminder months for storage

      return {
        ...prev,
        vhc_items: prev.vhc_items.map(item => {
          if (item.id !== itemId) {
            return item; // leave other items untouched
          }
          if (item.declined) {
            return {
              ...item,
              declined: false,
              decline_reason: null,
              decline_reminder_months: null
            }; // clear decline metadata when undoing decline
          }
          return {
            ...item,
            declined: true,
            authorized: false,
            decline_reason: declineReason,
            decline_reminder_months: reminderValue
          }; // apply decline metadata when setting decline
        })
      };
    });
  };

  // ✅ Handle labor hours change
  const handleLaborChange = (itemId, hours) => {
    const laborCost = parseFloat(hours) * 150; // £150 per hour including VAT
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item => {
        if (item.id === itemId) {
          const partsCost = parseFloat(item.parts_price) || 0;
          const newTotal = partsCost + laborCost;
          return { 
            ...item, 
            labor_hours: parseFloat(hours) || 0, 
            labor_cost: laborCost.toFixed(2),
            total_price: newTotal.toFixed(2)
          };
        }
        return item;
      })
    }));
  };

  // ✅ Handle price change (manual override)
  const handlePriceChange = (itemId, price) => {
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item => 
        item.id === itemId 
          ? { ...item, total_price: parseFloat(price) || 0 }
          : item
      )
    }));
  };

  // ✅ Handle send VHC button
  const handleSendVHC = () => {
    // Check if all items have labor and parts
    const allItemsComplete = vhcData.vhc_items
      .filter(item => item.status === "Red" || item.status === "Amber")
      .every(item => item.labor_hours > 0 && item.parts_price > 0);

    if (!allItemsComplete) {
      alert("Please add labor time and parts to all red and amber items before sending VHC");
      return;
    }

    // Update status to "Sent"
    setVhcData(prev => ({ ...prev, status: "Sent" }));
    alert("VHC sent to customer!"); // TODO: Replace with proper notification and email system
  };

  // ✅ Toggle send to customer for photos/videos
  const handleToggleSendMedia = (type, mediaId) => {
    if (type === "photo") {
      setVhcData(prev => ({
        ...prev,
        photos: prev.photos.map(photo => 
          photo.id === mediaId 
            ? { ...photo, send_to_customer: !photo.send_to_customer }
            : photo
        )
      }));
    } else {
      setVhcData(prev => ({
        ...prev,
        videos: prev.videos.map(video => 
          video.id === mediaId 
            ? { ...video, send_to_customer: !video.send_to_customer }
            : video
        )
      }));
    }
  };

  // ✅ Calculate totals
  const calculateTotal = (items) => {
    return items.reduce((sum, item) => {
      return sum + parseFloat(item.total_price || 0);
    }, 0);
  };

  // ✅ Shared layout for decline reason dropdowns and bulk action buttons
  const renderBulkActionControls = () => {
    const declineDisabled = selectedItems.length === 0; // disable when nothing selected
    const authorizeDisabled = selectedItems.length === 0; // disable when nothing selected

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", fontWeight: "600", color: "#374151" }}>
            Decline reason
            <select
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                minWidth: "220px",
                fontSize: "14px",
                fontWeight: "500",
                color: declineReason === DECLINE_REASON_OPTIONS[0] ? "#9ca3af" : "#1f2937",
                backgroundColor: "white"
              }}
            >
              {DECLINE_REASON_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", fontWeight: "600", color: "#374151" }}>
            Reminder period
            <select
              value={declineReminderMonths}
              onChange={(e) => setDeclineReminderMonths(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                minWidth: "180px",
                fontSize: "14px",
                fontWeight: "500",
                backgroundColor: "white"
              }}
            >
              {DECLINE_REMINDER_MONTH_OPTIONS.map(month => (
                <option key={month} value={month.toString()}>
                  {month} {month === 1 ? "month" : "months"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            onClick={handleDeclineSelected}
            disabled={declineDisabled}
            style={{
              padding: "10px 20px",
              backgroundColor: declineDisabled ? "#ccc" : "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: declineDisabled ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              minWidth: "160px"
            }}
          >
            Decline Selected
          </button>
          <button
            onClick={handleAuthorizeSelected}
            disabled={authorizeDisabled}
            style={{
              padding: "10px 20px",
              backgroundColor: authorizeDisabled ? "#ccc" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: authorizeDisabled ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              minWidth: "160px"
            }}
          >
            Authorize Selected
          </button>
        </div>
      </div>
    );
  };

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          color: "#6B7280",
          fontSize: "16px"
        }}>
          Loading VHC details...
        </div>
      </Layout>
    );
  }

  // ✅ No data found
  if (!vhcData) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          gap: "16px"
        }}>
          <p style={{ color: "#6B7280", fontSize: "16px" }}>VHC record not found</p>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const statusColor = STATUS_COLORS[vhcData.status] || "#9ca3af";

  // Filter items by status (excluding authorized and declined for red/amber sections)
  const redItems = vhcData.vhc_items.filter(item => item.status === "Red" && !item.authorized && !item.declined);
  const amberItems = vhcData.vhc_items.filter(item => item.status === "Amber" && !item.authorized && !item.declined);
  const greenItems = vhcData.vhc_items.filter(item => item.status === "Green");
  const greyItems = vhcData.vhc_items.filter(item => item.status === "Grey");
  const authorizedItems = vhcData.vhc_items.filter(item => item.authorized);
  const declinedItems = vhcData.vhc_items.filter(item => item.declined);

  const allRedSelected = redItems.length > 0 && areAllSelected(redItems); // check whether every red item is selected
  const allAmberSelected = amberItems.length > 0 && areAllSelected(amberItems); // check whether every amber item is selected

  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        {/* ✅ Header with Back Button and Send VHC Button */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            ← Back
          </button>
          
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a" }}>
            VHC Details - {vhcData.job_number}
          </h1>
          
          <button
            onClick={handleSendVHC}
            style={{
              padding: "10px 20px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Send VHC
          </button>
        </div>

        {/* ✅ FIXED - Vehicle Info Card - Always Visible */}
        <div style={{
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          border: "1px solid #ffe5e5",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Left side - Vehicle details */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  backgroundColor: statusColor,
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  {vhcData.status}
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a" }}>
                  {vhcData.reg}
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  <strong>Make/Model:</strong> {vhcData.vehicle_make} {vhcData.vehicle_model} ({vhcData.vehicle_year})
                </p>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  <strong>Mileage:</strong> {vhcData.mileage.toLocaleString()} miles
                </p>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  <strong>Customer:</strong> {vhcData.customer_name}
                </p>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  <strong>Phone:</strong> {vhcData.customer_phone}
                </p>
                <p style={{ fontSize: "16px", color: "#666" }}>
                  <strong>Email:</strong> {vhcData.customer_email}
                </p>
              </div>
            </div>

            {/* Right side - Dates and team */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                <strong>Last Visit:</strong> {vhcData.last_visit}
              </p>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                <strong>Next Service:</strong> {vhcData.next_service}
              </p>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
                <strong>MOT Expiry:</strong> {vhcData.mot_expiry}
              </p>
              <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                {[
                  { letter: "S", initials: vhcData.service_advisor },
                  { letter: "T", initials: vhcData.technician },
                  { letter: "P", initials: vhcData.parts_person },
                  { letter: "L", initials: vhcData.location_person },
                  { letter: "A", initials: vhcData.admin_person }
                ].map((person, index) => (
                  <div
                    key={index}
                    style={{
                      width: "35px",
                      height: "35px",
                      borderRadius: "50%",
                      backgroundColor: person.initials ? "#d10000" : "transparent",
                      border: person.initials ? "none" : "2px solid #d10000",
                      color: person.initials ? "white" : "#d10000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: "600"
                    }}
                  >
                    {person.initials || person.letter}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Status and Cost Summary Bar - Updated Layout */}
        <div style={{
          background: "white",
          border: "1px solid #e0e0e0",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          {/* Left - VHC Status Badge */}
          <div style={{
            backgroundColor: statusColor,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600"
          }}>
            VHC Status: {vhcData.status}
          </div>

          {/* Right - Cost Summary - Spread Out More */}
          <div style={{ display: "flex", gap: "48px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Red Work</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#ef4444" }}>
                £{vhcData.red_work}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Amber Work</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#fbbf24" }}>
                £{vhcData.amber_work}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Authorized</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#10b981" }}>
                £{vhcData.authorized}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Declined</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#ef4444" }}>
                £{vhcData.declined_work}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ Tabs Navigation */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "2px solid #e0e0e0",
          flexShrink: 0
        }}>
          {["summary", "health-check", "parts-identified", "parts-authorized", "parts-on-order", "photos", "videos"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 20px",
                backgroundColor: activeTab === tab ? "#d10000" : "transparent",
                color: activeTab === tab ? "white" : "#666",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #d10000" : "3px solid transparent",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? "600" : "500",
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* ✅ Tab Content - Scrollable */}
        <div style={{ 
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          
          {/* ========== SUMMARY TAB ========== */}
          {activeTab === "summary" && (
            <>
              {/* Authorized Work Section */}
              {authorizedItems.length > 0 && (
                <div style={{
                  background: "white",
                  border: "2px solid #10b981",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#10b981" }}>
                      ✓ Authorized Work
                    </h3>
                    <p style={{ fontSize: "20px", fontWeight: "700", color: "#10b981" }}>
                      Total: £{calculateTotal(authorizedItems).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {authorizedItems.map(item => (
                      <div key={item.id} style={{
                        border: "1px solid #10b98130",
                        borderRadius: "8px",
                        padding: "12px",
                        backgroundColor: "#10b98110",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <div style={{
                              backgroundColor: item.status === "Red" ? "#ef4444" : "#fbbf24",
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: "600"
                            }}>
                              {item.status}
                            </div>
                            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                              {item.category} - {item.item}
                            </p>
                          </div>
                          <p style={{ fontSize: "13px", color: "#666" }}>
                            {item.notes}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleAuthorize(item.id)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          Unauthorize
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Red Work Section - Immediate Attention - Only show if items exist */}
              {redItems.length > 0 && (
                <div style={{
                  background: "white",
                  border: "2px solid #ef4444",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#ef4444" }}>
                        ⚠️ Red - Immediate Attention Required
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(redItems)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #ef4444",
                          backgroundColor: allRedSelected ? "#ef4444" : "white",
                          color: allRedSelected ? "white" : "#ef4444",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}
                      >
                        {allRedSelected ? "Clear Selection" : "Select All"}
                      </button>
                    </div>
                    <p style={{ fontSize: "20px", fontWeight: "700", color: "#ef4444" }}>
                      Total: £{calculateTotal(redItems).toFixed(2)}
                    </p>
                  </div>
                  
                  {/* Table Header */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 30px",
                    gap: "12px",
                    padding: "12px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    fontWeight: "600",
                    fontSize: "13px"
                  }}>
                    <div>Item Details</div>
                    <div style={{ textAlign: "center" }}>Parts</div>
                    <div style={{ textAlign: "center" }}>Labor</div>
                    <div style={{ textAlign: "center" }}>Price</div>
                    <div style={{ textAlign: "center" }}>Status</div>
                    <div></div>
                  </div>

                  {/* Red Items */}
                  {redItems.map(item => {
                    const partsCost = parseFloat(item.parts_price) || 0;
                    const laborCost = (parseFloat(item.labor_hours) || 0) * 150;
                    
                    return (
                      <div key={item.id} style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 30px",
                        gap: "12px",
                        padding: "12px",
                        border: "1px solid #ef444430",
                        borderRadius: "8px",
                        backgroundColor: "#ef444410",
                        marginBottom: "8px",
                        alignItems: "center"
                      }}>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                            {item.category} - {item.item}
                          </p>
                          <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                            {item.notes}
                          </p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "14px", fontWeight: "600" }}>£{item.parts_price}</p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.labor_hours || 0}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              handleLaborChange(item.id, value);
                            }}
                            style={{
                              width: "70px",
                              padding: "6px 10px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: "500"
                            }}
                          />
                          <p style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                            £{laborCost.toFixed(2)}
                          </p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.total_price || 0}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              handlePriceChange(item.id, value);
                            }}
                            style={{
                              width: "80px",
                              padding: "6px 10px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              textAlign: "center",
                              fontSize: "15px",
                              fontWeight: "700"
                            }}
                          />
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <div style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            backgroundColor: "#fbbf24",
                            margin: "0 auto"
                          }}></div>
                        </div>

                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                      </div>
                    );
                  })}

                  {/* Action controls with decline reason + reminder selections */}
                  {renderBulkActionControls()}
                </div>
              )}

              {/* Amber Work Section - Not Urgent - Only show if items exist */}
              {amberItems.length > 0 && (
                <div style={{
                  background: "white",
                  border: "2px solid #fbbf24",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#fbbf24" }}>
                        ⚡ Amber - Not Urgent (Recommended)
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(amberItems)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #f59e0b",
                          backgroundColor: allAmberSelected ? "#f59e0b" : "white",
                          color: allAmberSelected ? "white" : "#f59e0b",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}
                      >
                        {allAmberSelected ? "Clear Selection" : "Select All"}
                      </button>
                    </div>
                    <p style={{ fontSize: "20px", fontWeight: "700", color: "#fbbf24" }}>
                      Total: £{calculateTotal(amberItems).toFixed(2)}
                    </p>
                  </div>
                  
                  {/* Table Header */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 30px",
                    gap: "12px",
                    padding: "12px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    fontWeight: "600",
                    fontSize: "13px"
                  }}>
                    <div>Item Details</div>
                    <div style={{ textAlign: "center" }}>Parts</div>
                    <div style={{ textAlign: "center" }}>Labor</div>
                    <div style={{ textAlign: "center" }}>Price</div>
                    <div style={{ textAlign: "center" }}>Status</div>
                    <div></div>
                  </div>

                  {/* Amber Items */}
                  {amberItems.map(item => {
                    const partsCost = parseFloat(item.parts_price) || 0;
                    const laborCost = (parseFloat(item.labor_hours) || 0) * 150;
                    
                    return (
                      <div key={item.id} style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 30px",
                        gap: "12px",
                        padding: "12px",
                        border: "1px solid #fbbf2430",
                        borderRadius: "8px",
                        backgroundColor: "#fbbf2410",
                        marginBottom: "8px",
                        alignItems: "center"
                      }}>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                            {item.category} - {item.item}
                          </p>
                          <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                            {item.notes}
                          </p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "14px", fontWeight: "600" }}>£{item.parts_price}</p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.labor_hours || 0}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              handleLaborChange(item.id, value);
                            }}
                            style={{
                              width: "70px",
                              padding: "6px 10px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: "500"
                            }}
                          />
                          <p style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                            £{laborCost.toFixed(2)}
                          </p>
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.total_price || 0}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              handlePriceChange(item.id, value);
                            }}
                            style={{
                              width: "80px",
                              padding: "6px 10px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              textAlign: "center",
                              fontSize: "15px",
                              fontWeight: "700"
                            }}
                          />
                        </div>
                        
                        <div style={{ textAlign: "center" }}>
                          <div style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            backgroundColor: "#fbbf24",
                            margin: "0 auto"
                          }}></div>
                        </div>

                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                      </div>
                    );
                  })}

                  {/* Action controls with decline reason + reminder selections */}
                  {renderBulkActionControls()}
                </div>
              )}

              {/* Declined Work Section - Only show if items exist */}
              {declinedItems.length > 0 && (
                <div style={{
                  background: "white",
                  border: "2px solid #ef4444",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#ef4444" }}>
                      ✕ Declined Work
                    </h3>
                    <p style={{ fontSize: "20px", fontWeight: "700", color: "#ef4444" }}>
                      Total: £{calculateTotal(declinedItems).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {declinedItems.map(item => (
                      <div key={item.id} style={{
                        border: "1px solid #ef444430",
                        borderRadius: "8px",
                        padding: "12px",
                        backgroundColor: "#ef444410",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <div style={{
                              backgroundColor: item.status === "Red" ? "#ef4444" : "#fbbf24",
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: "600"
                            }}>
                              {item.status}
                            </div>
                            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                              {item.category} - {item.item}
                            </p>
                          </div>
                          <p style={{ fontSize: "13px", color: "#666" }}>
                            {item.notes}
                          </p>
                          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                            Decline reason: {item.decline_reason || "Not provided"}
                          </p>
                          <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                            Reminder set: {item.decline_reminder_months ? `${item.decline_reminder_months} ${item.decline_reminder_months === 1 ? "month" : "months"}` : "None"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleDecline(item.id)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          Undecline
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All VHC Items Grid - 4 columns */}
              <div style={{
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                  Full VHC Report
                </h3>
                
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "16px"
                }}>
                  {/* Red Items First (including all red, not just unactioned) */}
                  {vhcData.vhc_items.filter(item => item.status === "Red").map(item => (
                    <div key={item.id} style={{
                      border: "2px solid #ef4444",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#ef444410"
                    }}>
                      <div style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        display: "inline-block"
                      }}>
                        RED
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                        {item.category}
                      </p>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {item.item}
                      </p>
                      <p style={{ fontSize: "12px", color: "#999" }}>
                        {item.notes}
                      </p>
                    </div>
                  ))}
                  
                  {/* Amber Items (including all amber, not just unactioned) */}
                  {vhcData.vhc_items.filter(item => item.status === "Amber").map(item => (
                    <div key={item.id} style={{
                      border: "2px solid #fbbf24",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#fbbf2410"
                    }}>
                      <div style={{
                        backgroundColor: "#fbbf24",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        display: "inline-block"
                      }}>
                        AMBER
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                        {item.category}
                      </p>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {item.item}
                      </p>
                      <p style={{ fontSize: "12px", color: "#999" }}>
                        {item.notes}
                      </p>
                    </div>
                  ))}
                  
                  {/* Green Items */}
                  {greenItems.map(item => (
                    <div key={item.id} style={{
                      border: "2px solid #10b981",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#10b98110"
                    }}>
                      <div style={{
                        backgroundColor: "#10b981",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        display: "inline-block"
                      }}>
                        GREEN
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                        {item.category}
                      </p>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {item.item}
                      </p>
                      <p style={{ fontSize: "12px", color: "#999" }}>
                        {item.notes}
                      </p>
                    </div>
                  ))}
                  
                  {/* Grey Items */}
                  {greyItems.map(item => (
                    <div key={item.id} style={{
                      border: "2px solid #9ca3af",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#9ca3af10"
                    }}>
                      <div style={{
                        backgroundColor: "#9ca3af",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        display: "inline-block"
                      }}>
                        NOT CHECKED
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                        {item.category}
                      </p>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {item.item}
                      </p>
                      <p style={{ fontSize: "12px", color: "#999" }}>
                        {item.notes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========== HEALTH CHECK TAB ========== */}
          {activeTab === "health-check" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Vehicle Health Check - Technician View
              </h3>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
                This section will allow technicians to add/edit VHC items with popup modals.
              </p>
              {/* TODO: Add popup functionality for editing VHC items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vhcData.vhc_items.map(item => (
                  <div key={item.id} style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer"
                  }}
                  onClick={() => alert(`Edit popup for: ${item.item} - TODO: Implement modal`)}
                  >
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                        {item.category} - {item.item}
                      </p>
                      <p style={{ fontSize: "12px", color: "#666" }}>
                        Status: {item.status} | {item.notes}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: STATUS_COLORS[item.status] || "#9ca3af",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========== PARTS IDENTIFIED TAB ========== */}
          {activeTab === "parts-identified" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Parts Identified
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vhcData.parts_identified.map(part => (
                  <div key={part.id} style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    gap: "12px",
                    alignItems: "center"
                  }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                        {part.part_name}
                      </p>
                      <p style={{ fontSize: "12px", color: "#666" }}>
                        Part #: {part.part_number}
                      </p>
                    </div>
                    <p style={{ fontSize: "13px", color: "#666" }}>
                      {part.supplier}
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: "600", textAlign: "center" }}>
                      £{part.price}
                    </p>
                    <p style={{ fontSize: "13px", textAlign: "center" }}>
                      Qty: {part.quantity}
                    </p>
                    <button
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#d10000",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                      onClick={() => alert(`Order part: ${part.part_name} - TODO: Implement ordering`)}
                    >
                      Order
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========== PARTS AUTHORIZED TAB ========== */}
          {activeTab === "parts-authorized" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Parts Authorized
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vhcData.parts_identified
                  .filter(part => {
                    const vhcItem = vhcData.vhc_items.find(item => item.id === part.vhc_item_id);
                    return vhcItem && vhcItem.authorized;
                  })
                  .map(part => (
                    <div key={part.id} style={{
                      border: "1px solid #10b98130",
                      borderRadius: "8px",
                      padding: "12px",
                      backgroundColor: "#10b98110",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr",
                      gap: "12px",
                      alignItems: "center"
                    }}>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                          {part.part_name}
                        </p>
                        <p style={{ fontSize: "12px", color: "#666" }}>
                          Part #: {part.part_number}
                        </p>
                      </div>
                      <p style={{ fontSize: "13px", color: "#666" }}>
                        {part.supplier}
                      </p>
                      <p style={{ fontSize: "14px", fontWeight: "600", textAlign: "center" }}>
                        £{part.price}
                      </p>
                      <div style={{
                        backgroundColor: "#10b981",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textAlign: "center"
                      }}>
                        Authorized
                      </div>
                    </div>
                  ))}
                {vhcData.parts_identified.filter(part => {
                  const vhcItem = vhcData.vhc_items.find(item => item.id === part.vhc_item_id);
                  return vhcItem && vhcItem.authorized;
                }).length === 0 && (
                  <p style={{ textAlign: "center", color: "#999", padding: "20px" }}>
                    No parts have been authorized yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ========== PARTS ON ORDER TAB ========== */}
          {activeTab === "parts-on-order" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Parts On Order
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vhcData.parts_on_order.map(part => (
                  <div key={part.id} style={{
                    border: "1px solid #3b82f630",
                    borderRadius: "8px",
                    padding: "12px",
                    backgroundColor: "#3b82f610",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    gap: "12px",
                    alignItems: "center"
                  }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                        {part.part_name}
                      </p>
                      <p style={{ fontSize: "12px", color: "#666" }}>
                        Part #: {part.part_number}
                      </p>
                    </div>
                    <p style={{ fontSize: "13px", color: "#666" }}>
                      {part.supplier}
                    </p>
                    <p style={{ fontSize: "13px", color: "#666", textAlign: "center" }}>
                      Order #: {part.order_number}
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: "600", textAlign: "center" }}>
                      Expected: {part.expected_date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========== PHOTOS TAB ========== */}
          {activeTab === "photos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Photos
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px"
              }}>
                {vhcData.photos.map(photo => (
                  <div key={photo.id} style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}>
                    <img 
                      src={photo.url} 
                      alt={photo.caption}
                      style={{ width: "100%", height: "200px", objectFit: "cover" }}
                    />
                    <div style={{ padding: "12px" }}>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {photo.caption}
                      </p>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "6px"
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: "600" }}>
                          Send to Customer
                        </span>
                        <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={photo.send_to_customer}
                            onChange={() => handleToggleSendMedia("photo", photo.id)}
                            style={{ width: "18px", height: "18px" }}
                          />
                          <span style={{
                            fontSize: "12px",
                            color: photo.send_to_customer ? "#10b981" : "#999"
                          }}>
                            {photo.send_to_customer ? "Yes" : "No"}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========== VIDEOS TAB ========== */}
          {activeTab === "videos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>
                Videos
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                gap: "16px"
              }}>
                {vhcData.videos.map(video => (
                  <div key={video.id} style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}>
                    <video 
                      controls
                      style={{ width: "100%", height: "250px", backgroundColor: "#000" }}
                    >
                      <source src={video.url} type="video/mp4" />
                      Your browser does not support video playback.
                    </video>
                    <div style={{ padding: "12px" }}>
                      <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                        {video.caption}
                      </p>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "6px"
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: "600" }}>
                          Send to Customer
                        </span>
                        <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={video.send_to_customer}
                            onChange={() => handleToggleSendMedia("video", video.id)}
                            style={{ width: "18px", height: "18px" }}
                          />
                          <span style={{
                            fontSize: "12px",
                            color: video.send_to_customer ? "#10b981" : "#999"
                          }}>
                            {video.send_to_customer ? "Yes" : "No"}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}