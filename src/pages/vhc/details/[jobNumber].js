// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/vhc/details/[jobNumber].js
"use client"; // enables client-side rendering for Next.js

import React, { useEffect, useState } from "react"; // import React and hooks
import Link from "next/link"; // for linking back to job card
import { useRouter } from "next/router"; // for getting URL params and navigation
import { supabase } from "@/lib/supabaseClient"; // import Supabase client
import Layout from "@/components/Layout"; // import layout wrapper
import { useMemo } from "react";

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
const VAT_RATE = 0.2; // 20% VAT
const HOURLY_LABOUR_RATE = 125; // hourly labour rate (ex VAT) -> £150 inc VAT

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
const defaultPartsForm = {
  search: "",
  selectedPart: null,
  costToOrder: "",
  customerCost: "",
  quantity: 1,
  backOrder: false,
}; // default modal form
const [partsModal, setPartsModal] = useState({ open: false, itemId: null }); // track active parts modal
const [partsForm, setPartsForm] = useState(defaultPartsForm); // store modal form fields
const [partsDrafts, setPartsDrafts] = useState({}); // cache unsaved modal entries by item id
const [partsSearchResults, setPartsSearchResults] = useState([]); // store search results from parts catalog

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

    const sumGross = (filterFn) => {
      const net = vhcData.vhc_items
        .filter(filterFn)
        .reduce((sum, item) => item.part_not_required ? sum : sum + parseFloat(item.total_price || 0), 0);
      return net * (1 + VAT_RATE);
    };

    const redTotal = sumGross(item => item.status === "Red" && !item.authorized && !item.declined);
    const amberTotal = sumGross(item => item.status === "Amber" && !item.authorized && !item.declined);
    const authorizedTotal = sumGross(item => item.authorized);
    const declinedTotal = sumGross(item => item.declined);

    setVhcData(prev => ({
      ...prev,
      red_work: redTotal.toFixed(2),
      amber_work: amberTotal.toFixed(2),
      authorized: authorizedTotal.toFixed(2),
      declined_work: declinedTotal.toFixed(2)
    }));
  }, [vhcData?.vhc_items]);

  const computedTotals = useMemo(() => {
    const partsNet = (vhcData?.vhc_items || []).reduce((sum, item) => {
      if (item.part_not_required) return sum;
      return sum + (parseFloat(item.parts_price) || 0);
    }, 0);
    const labourNet = (vhcData?.vhc_items || []).reduce((sum, item) => {
      if (item.part_not_required) return sum;
      return sum + (parseFloat(item.labor_cost) || 0);
    }, 0);
    const net = partsNet + labourNet;
    const vat = net * VAT_RATE;
    const gross = net + vat;
    return {
      partsNet,
      labourNet,
      net,
      vat,
      gross,
    };
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
  const handleAuthorizeSelected = (targetIds = selectedItems) => {
    if (!targetIds.length) return;
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item =>
        targetIds.includes(item.id)
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
    setSelectedItems(prev => prev.filter(id => !targetIds.includes(id))); // clear only ids we handled
  };

  // ✅ Handle decline selected items
  const handleDeclineSelected = (targetIds = selectedItems) => {
    if (!targetIds.length) return;
    if (!declineReason || declineReason === DECLINE_REASON_OPTIONS[0]) {
      alert("Please select a reason for declining before applying the change."); // prompt user to choose a reason
      return;
    }

    const reminderValue = parseInt(declineReminderMonths, 10) || null; // parse reminder value from dropdown

    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item =>
        targetIds.includes(item.id)
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
    setSelectedItems(prev => prev.filter(id => !targetIds.includes(id))); // clear only ids we handled
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
    const parsedHours = parseFloat(hours) || 0;
    const labourCostNet = parsedHours * HOURLY_LABOUR_RATE;
    setVhcData(prev => ({
      ...prev,
      vhc_items: prev.vhc_items.map(item => {
        if (item.id === itemId) {
          const partsCost = parseFloat(item.parts_price) || 0;
          const newTotal = partsCost + labourCostNet;
          return { 
            ...item, 
            labor_hours: parsedHours, 
            labor_cost: labourCostNet.toFixed(2),
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

// ✅ Money helpers
const calculateTotals = (items) => {
  const net = items.reduce(
    (sum, item) =>
      item.part_not_required ? sum : sum + parseFloat(item.total_price || 0),
    0,
  );
  const vat = net * VAT_RATE;
  return { net, vat, gross: net + vat };
};

const formatMoney = (value = 0) => Number.parseFloat(value || 0).toFixed(2);

  const calculateSelectedTotal = (items) =>
    items.reduce(
      (sum, item) =>
        selectedItems.includes(item.id)
          ? sum + parseFloat(item.total_price || 0)
          : sum,
      0
    );

  const handleOpenPartsModal = (item) => {
    const existing = item.part_selection || {};
    const draft = partsDrafts[item.id];
    setPartsForm({
      search: draft?.search || "",
      selectedPart: draft?.selectedPart || existing.selectedPart || null,
      costToOrder: draft?.costToOrder !== undefined ? draft.costToOrder : existing.costToOrder ? existing.costToOrder.toString() : "",
      customerCost: draft?.customerCost !== undefined ? draft.customerCost : existing.customerCost ? existing.customerCost.toString() : "",
      quantity: draft?.quantity !== undefined ? draft.quantity : existing.quantity || 1,
      backOrder: draft?.backOrder !== undefined ? draft.backOrder : !!existing.backOrder,
    });
    setPartsModal({ open: true, itemId: item.id });
  };

  const handleClosePartsModal = ({ resetForm = false, clearDraft = false } = {}) => {
    if (partsModal.itemId) {
      setPartsDrafts((prev) => {
        if (clearDraft) {
          const next = { ...prev };
          delete next[partsModal.itemId];
          return next;
        }
        return {
          ...prev,
          [partsModal.itemId]: partsForm,
        };
      });
    }
    setPartsModal({ open: false, itemId: null });
    if (resetForm) {
      setPartsForm(defaultPartsForm);
      setPartsSearchResults([]);
    }
  };

  const handlePartsSearch = async (term) => {
    setPartsForm((prev) => ({ ...prev, search: term }));
    const queryText = term?.trim();
    if (!queryText) {
      setPartsSearchResults([]);
      return;
    }
    const { data, error } = await supabase
      .from("parts_catalog")
      .select("id, part_number, name, unit_cost, unit_price, supplier, qty_in_stock, qty_on_order")
      .or(`part_number.ilike.%${queryText}%,name.ilike.%${queryText}%`)
      .limit(10);

    if (error) {
      console.error("❌ Parts search error:", error.message);
      setPartsSearchResults([]);
      return;
    }
    setPartsSearchResults(data || []);
  };

  const handleSelectPart = (part) => {
    setPartsForm((prev) => ({
      ...prev,
      selectedPart: part,
      search: part.part_number,
      customerCost: part.unit_price?.toString() || prev.customerCost,
      costToOrder: part.unit_cost?.toString() || prev.costToOrder,
    }));
  };

  const updateItemPricing = (item, nextPartsPrice) => {
    const currentParts = Number.parseFloat(item.parts_price || 0) || 0;
    const baseOther = Math.max(0, Number.parseFloat(item.total_price || 0) - currentParts);
    const partsPrice = Number.isFinite(nextPartsPrice) ? nextPartsPrice : 0;
    const totalPrice = baseOther + partsPrice;
    return { parts_price: partsPrice.toFixed(2), total_price: totalPrice.toFixed(2) };
  };

  const handleSavePartsSelection = () => {
    if (!partsModal.itemId) return;
    const qty = Math.max(1, parseInt(partsForm.quantity, 10) || 1);
    const customerCost = Number.parseFloat(partsForm.customerCost || 0) || 0;
    const costToOrder = Number.parseFloat(partsForm.costToOrder || 0) || 0;
    const partsPrice = customerCost * qty;

    setVhcData((prev) => ({
      ...prev,
      vhc_items: prev.vhc_items.map((item) => {
        if (item.id !== partsModal.itemId) return item;
        const prc = updateItemPricing(item, partsPrice);
        return {
          ...item,
          ...prc,
          part_selection: {
            selectedPart: partsForm.selectedPart,
            costToOrder,
            customerCost,
            quantity: qty,
            backOrder: partsForm.backOrder,
          },
          part_not_required: false,
        };
      }),
    }));
    setPartsDrafts((prev) => {
      const next = { ...prev };
      delete next[partsModal.itemId];
      return next;
    });
    handleClosePartsModal({ resetForm: true, clearDraft: true });
  };

  const handleClearPartsSelection = () => {
    if (!partsModal.itemId) return;
    setVhcData((prev) => ({
      ...prev,
      vhc_items: prev.vhc_items.map((item) => {
        if (item.id !== partsModal.itemId) return item;
        const prc = updateItemPricing(item, 0);
        return {
          ...item,
          ...prc,
          part_selection: null,
        };
      }),
    }));
    setPartsDrafts((prev) => {
      const next = { ...prev };
      delete next[partsModal.itemId];
      return next;
    });
    handleClosePartsModal({ resetForm: true, clearDraft: true });
  };

  const handlePartsNotRequired = async () => {
    if (!partsModal.itemId) return;
    const targetId = partsModal.itemId;
    setVhcData((prev) => ({
      ...prev,
      vhc_items: prev.vhc_items.map((item) => {
        if (item.id !== targetId) return item;
        const prc = updateItemPricing(item, 0);
        return {
          ...item,
          ...prc,
          part_selection: null,
          part_not_required: true,
        };
      }),
    }));
    try {
      await supabase
        .from("vhc_checks")
        .update({
          issue_description: "PARTS_NOT_REQUIRED",
          updated_at: new Date().toISOString(),
        })
        .eq("vhc_id", targetId);
    } catch (error) {
      console.error("❌ Failed to persist parts not required:", error);
    }
    setPartsDrafts((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    handleClosePartsModal({ resetForm: true, clearDraft: true });
  };

  // ✅ Shared layout for decline reason dropdowns and bulk action buttons
  const renderBulkActionControls = (items = []) => {
    const sectionSelectedIds = selectedItems.filter((id) =>
      items.some((item) => item.id === id)
    );
    const hasSelection = sectionSelectedIds.length > 0;
    const declineDisabled = !hasSelection; // disable when nothing selected in this section
    const authorizeDisabled = !hasSelection;

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
            onClick={() => handleDeclineSelected(sectionSelectedIds)}
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
            onClick={() => handleAuthorizeSelected(sectionSelectedIds)}
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
              gap: "8px",
              color: "#000000"
            }}
          >
            ← Back
          </button>
          
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a" }}>
            VHC Details -{" "}
            <Link
              href={`/job-cards/${vhcData.job_number}`}
              style={{
                color: "#d10000",
                textDecoration: "none",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              {vhcData.job_number}
            </Link>
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
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Red Work (incl VAT)</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#ef4444" }}>
                £{formatMoney(vhcData.red_work)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Amber Work (incl VAT)</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#fbbf24" }}>
                £{formatMoney(vhcData.amber_work)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Authorized (incl VAT)</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#10b981" }}>
                £{formatMoney(vhcData.authorized)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Declined (incl VAT)</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#ef4444" }}>
                £{formatMoney(vhcData.declined_work)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Parts Total (net)</p>
              <p style={{ fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
                £{formatMoney(computedTotals.partsNet)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Labour Total (net)</p>
              <p style={{ fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
                £{formatMoney(computedTotals.labourNet)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Combined (net)</p>
              <p style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
                £{formatMoney(computedTotals.net)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>VAT</p>
              <p style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
                £{formatMoney(computedTotals.vat)}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>Grand Total (incl VAT)</p>
              <p style={{ fontSize: "22px", fontWeight: "700", color: "#111827" }}>
                £{formatMoney(computedTotals.gross)}
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
                      Total: £{formatMoney(calculateTotals(authorizedItems).gross)}
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
                        Red - Immediate Attention Required
                      </h3>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "20px", fontWeight: "700", color: "#ef4444" }}>
                        Section Total: £{formatMoney(calculateTotals(redItems).gross)}
                      </p>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#991b1b" }}>
                        Selected Total: £{calculateSelectedTotal(redItems).toFixed(2)}
                      </p>
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={allRedSelected}
                        onChange={() => handleToggleSelectAll(redItems)}
                        title="Select all red items"
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                    </div>
                  </div>

                  {/* Red Items */}
                  {redItems.map(item => {
                    const partsCost = parseFloat(item.parts_price) || 0;
                    const laborCostGross = (parseFloat(item.labor_hours) || 0) * HOURLY_LABOUR_RATE * (1 + VAT_RATE);
                    
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
                            £{laborCostGross.toFixed(2)}
                          </p>
                          <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
                            TODO: auto-calc labour time from parts in future
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
                  {renderBulkActionControls(redItems)}
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
                        Amber - Not Urgent
                      </h3>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "20px", fontWeight: "700", color: "#fbbf24" }}>
                        Section Total: £{formatMoney(calculateTotals(amberItems).gross)}
                      </p>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#92400e" }}>
                        Selected Total: £{calculateSelectedTotal(amberItems).toFixed(2)}
                      </p>
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input
                        type="checkbox"
                        checked={allAmberSelected}
                        onChange={() => handleToggleSelectAll(amberItems)}
                        title="Select all amber items"
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                    </div>
                  </div>

                  {/* Amber Items */}
                  {amberItems.map(item => {
                    const partsCost = parseFloat(item.parts_price) || 0;
                    const laborCostGross = (parseFloat(item.labor_hours) || 0) * HOURLY_LABOUR_RATE * (1 + VAT_RATE);
                    
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
                            £{laborCostGross.toFixed(2)}
                          </p>
                          <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
                            TODO: auto-calc labour time from parts in future
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
                  {renderBulkActionControls(amberItems)}
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
                      Total: £{formatMoney(calculateTotals(declinedItems).gross)}
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
                Parts Needed
              </h3>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
                Select a VHC item to search stock, price parts, and push the figures into the summary.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vhcData.vhc_items
                  .filter(item => (item.status === "Red" || item.status === "Amber") && !item.declined && !item.part_not_required)
                  .map(item => {
                    const selection = item.part_selection;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleOpenPartsModal(item)}
                        style={{
                          border: "1px solid #e0e0e0",
                          borderRadius: "10px",
                          padding: "12px",
                          textAlign: "left",
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr",
                          gap: "12px",
                          alignItems: "center",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{
                              backgroundColor: STATUS_COLORS[item.status] || "#9ca3af",
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700"
                            }}>
                              {item.status}
                            </span>
                            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                              {item.category} - {item.item}
                            </p>
                          </div>
                          <p style={{ fontSize: "12px", color: "#666" }}>{item.notes}</p>
                        </div>
                        <div style={{ fontSize: "13px", color: "#555" }}>
                          {selection?.selectedPart ? (
                            <>
                              <div><strong>Part:</strong> {selection.selectedPart.part_number}</div>
                              <div><strong>Qty:</strong> {selection.quantity}</div>
                            </>
                          ) : (
                            <span style={{ color: "#d10000", fontWeight: "600" }}>Select part</span>
                          )}
                        </div>
                        <div style={{ textAlign: "right", fontSize: "13px", color: "#444" }}>
                          <div><strong>Cost:</strong> £{selection?.customerCost ? (selection.customerCost * (selection.quantity || 1)).toFixed(2) : "0.00"}</div>
                          <div><strong>Back Order:</strong> {selection?.backOrder ? "Yes" : "No"}</div>
                        </div>
                      </button>
                    );
                  })}
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

        {/* Parts Modal */}
        {partsModal.open && vhcData?.vhc_items && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
              padding: "20px",
            }}
            onClick={handleClosePartsModal}
          >
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                width: "520px",
                maxHeight: "90vh",
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const item = vhcData.vhc_items.find((entry) => entry.id === partsModal.itemId);
                if (!item) return null;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111" }}>
                        Parts for {item.category} - {item.item}
                      </h3>
                      <button
                        onClick={handleClosePartsModal}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontSize: "16px",
                          cursor: "pointer",
                          color: "#666",
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: "600", color: "#444" }}>Search part number or name</label>
                        <input
                          type="text"
                          value={partsForm.search}
                          onChange={(e) => handlePartsSearch(e.target.value)}
                          placeholder="Type to search parts catalog"
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid #e5e5e5",
                            marginTop: "6px",
                          }}
                        />
                        {partsSearchResults.length > 0 && (
                          <div style={{ marginTop: "8px", border: "1px solid #e5e5e5", borderRadius: "8px", maxHeight: "160px", overflowY: "auto" }}>
                            {partsSearchResults.map((part) => (
                              <button
                                key={part.id}
                                onClick={() => handleSelectPart(part)}
                                style={{
                                  display: "flex",
                                  width: "100%",
                                  padding: "10px",
                                  border: "none",
                                  borderBottom: "1px solid #f0f0f0",
                                  background: partsForm.selectedPart?.id === part.id ? "#fef2f2" : "white",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  gap: "8px",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: "700", fontSize: "13px" }}>{part.part_number}</div>
                                  <div style={{ fontSize: "12px", color: "#555" }}>{part.name}</div>
                                </div>
                                <div style={{ fontSize: "12px", color: "#444" }}>
                                  <div>Cost: £{part.unit_cost ?? "0.00"}</div>
                                  <div>Sell: £{part.unit_price ?? "0.00"}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {partsForm.selectedPart && (
                        <div style={{ padding: "10px", borderRadius: "8px", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                          <div style={{ fontSize: "13px", fontWeight: "700" }}>
                            Selected: {partsForm.selectedPart.part_number} — {partsForm.selectedPart.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#555" }}>
                            Supplier: {partsForm.selectedPart.supplier || "N/A"} | In stock: {partsForm.selectedPart.qty_in_stock ?? 0} | On order: {partsForm.selectedPart.qty_on_order ?? 0}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "#444" }}>Cost to order</label>
                          <input
                            type="number"
                            step="0.01"
                            value={partsForm.costToOrder}
                            onChange={(e) => setPartsForm((prev) => ({ ...prev, costToOrder: e.target.value }))}
                            placeholder="0.00"
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e5e5", marginTop: "6px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "#444" }}>Customer cost</label>
                          <input
                            type="number"
                            step="0.01"
                            value={partsForm.customerCost}
                            onChange={(e) => setPartsForm((prev) => ({ ...prev, customerCost: e.target.value }))}
                            placeholder="0.00"
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e5e5", marginTop: "6px" }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "#444" }}>Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={partsForm.quantity}
                            onChange={(e) => setPartsForm((prev) => ({ ...prev, quantity: e.target.value }))}
                            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e5e5", marginTop: "6px" }}
                          />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "18px", fontSize: "13px", color: "#444" }}>
                          <input
                            type="checkbox"
                            checked={partsForm.backOrder}
                            onChange={(e) => setPartsForm((prev) => ({ ...prev, backOrder: e.target.checked }))}
                          />
                          Back order this part
                        </label>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          onClick={handleSavePartsSelection}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            backgroundColor: "#d10000",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: "700",
                            cursor: "pointer",
                            minWidth: "120px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleClearPartsSelection}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            backgroundColor: "#f3f4f6",
                            color: "#1f2937",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            fontWeight: "700",
                            cursor: "pointer",
                            minWidth: "120px",
                          }}
                        >
                          Clear
                        </button>
                        <button
                          onClick={handlePartsNotRequired}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            border: "1px solid #fcd34d",
                            borderRadius: "8px",
                            fontWeight: "700",
                            cursor: "pointer",
                            minWidth: "160px",
                          }}
                        >
                          Parts Not Required
                        </button>
                        <button
                          onClick={handleClosePartsModal}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            backgroundColor: "white",
                            color: "#374151",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            fontWeight: "700",
                            cursor: "pointer",
                            minWidth: "120px",
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
