import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { popupCardStyles, popupOverlayStyles } from "@/styles/appTheme";
import { sanitizeNumericId } from "@/lib/utils/ids";
import { format, formatDistanceToNow } from "date-fns";
import { DropdownField } from "@/components/dropdownAPI";
import { CalendarField } from "@/components/calendarAPI";
import { ScrollArea } from "@/components/scrollAPI";

const PRICE_LEVEL_OPTIONS = [
  { value: "stock_order_rate", label: "Stock order rate" },
  { value: "retail", label: "Retail" },
  { value: "trade", label: "Trade" },
  { value: "other", label: "Other" },
];

const FRANCHISE_OPTIONS = ["Mitsubishi", "Suzuki", "Stock", "Tyre", "Consumables"];

const BIN_LOCATION_OPTIONS = (() => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const maxSlot = 10;
  const options = [];
  for (const letter of letters) {
    for (let slot = 1; slot <= maxSlot; slot += 1) {
      options.push(`${letter}${slot}`);
    }
  }
  return options;
})();

const VAT_RATE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "reduced", label: "Reduced" },
  { value: "zero", label: "Zero" },
  { value: "custom", label: "Custom" },
];

const ADVANCED_TABS = [
  { id: "global", label: "Global" },
  { id: "dealer", label: "Dealer" },
  { id: "stock", label: "Stock" },
  { id: "user", label: "User Defined" },
  { id: "links", label: "Links" },
  { id: "sales", label: "Sales History" },
  { id: "audi", label: "Audi" },
  { id: "additional", label: "Additional Fields" },
  { id: "online", label: "Online Store" },
];

const sectionCardStyle = {
  background: "var(--surface)",
  borderRadius: "20px",
  border: "1px solid var(--surface-light)",
  padding: "24px",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const labelStyle = {
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "var(--text-secondary)",
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  padding: "10px 12px",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  background: "var(--layer-section-level-1)",
  color: "var(--text-primary)",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "96px",
};

const autoExpandTextareaStyle = {
  ...inputStyle,
  minHeight: "40px",
  resize: "vertical",
  overflow: "auto",
};

const compactDropdownOverride = {
  ".dropdown-api__control": {
    minHeight: "40px",
    padding: "10px 40px 10px 12px",
    borderRadius: "10px",
  },
};

const primaryButtonStyle = (disabled = false) => ({
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled ? "var(--surface-light)" : "var(--primary)",
  color: disabled ? "var(--text-secondary)" : "white",
});

const secondaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid var(--primary)",
  fontWeight: 600,
  fontSize: "0.9rem",
  background: "transparent",
  color: "var(--primary)",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--danger)",
  fontWeight: 600,
  fontSize: "0.85rem",
  background: "transparent",
  color: "var(--danger)",
  cursor: "pointer",
};

const invoiceTableStyles = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
  tableLayout: "fixed",
};

const invoiceHeaderCellStyle = {
  padding: "12px 16px",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  background: "var(--layer-section-level-2)",
};

const invoiceCellStyle = {
  padding: "16px",
  fontSize: "0.95rem",
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const invoiceRowStyle = {
  background: "var(--layer-section-level-1)",
  borderRadius: "16px",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
};

const createDefaultInvoiceForm = (invoiceDate) => ({
  supplierAccountId: "",
  supplierName: "",
  supplierAddress: "",
  supplierContact: "",
  invoiceNumber: "",
  deliveryNoteNumber: "",
  invoiceDate,
  notes: "",
  priceLevel: "stock_order_rate",
});

const createDefaultPartForm = () => ({
  partId: null,
  partNumber: "",
  mainPartNumber: "",
  description: "",
  quantity: 1,
  binLocation: "",
  franchise: "Stock",
  retailPrice: "",
  costPrice: "",
  discountCode: "",
  surcharge: "",
  claimNumber: "",
  packSize: "",
  vatRate: "standard",
  vatRateCustomValue: "",
  salePrices: [
    { label: "Sale 1", price: "" },
    { label: "Sale 2", price: "" },
    { label: "Sale 3", price: "" },
    { label: "Sale 4", price: "" },
  ],
  purchaseDetails: { stockOrder: "", vorCost: "", localCost: "" },
  dealerDetails: { dealerCode: "", tier: "", notes: "" },
  stockDetails: { reorderPoint: "", binCapacity: "", alternateLocation: "" },
  userDefined: { field1: "", field2: "" },
  linkMetadata: [{ label: "Primary", url: "" }],
  salesHistory: { lastSoldOn: "", lastSoldPrice: "", lastSoldQty: "" },
  audiMetadata: { programme: "", reference: "", notes: "" },
  additionalFields: { warranty: "", logistics: "", internalTag: "" },
  onlineStore: { isListed: false, webTitle: "", webDescription: "", onlineSku: "" },
  customAttributes: {},
  notes: "",
});

const formatInvoiceDate = (value) => {
  if (!value) return "--";
  try {
    return format(new Date(value), "dd/MM/yy");
  } catch (error) {
    return value;
  }
};

const parseDocumentFields = (text = "") => {
  if (!text) return {};
  const invoiceMatch = text.match(/invoice\s*(?:no\.|number)?[:#]?\s*([A-Za-z0-9-]+)/i);
  const deliveryMatch = text.match(/delivery\s*(?:note|number|no\.)[:#]?\s*([A-Za-z0-9-]+)/i);
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  return {
    invoiceNumber: invoiceMatch?.[1] || "",
    deliveryNoteNumber: deliveryMatch?.[1] || "",
    invoiceDateGuess: dateMatch?.[1] || "",
  };
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatRelativeTime = (value) => {
  if (!value) return "recently";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch (error) {
    return "recently";
  }
};

function GoodsInPage() {
  const router = useRouter();
  const { user, dbUserId, authUserId } = useUser();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [invoiceForm, setInvoiceForm] = useState(() => createDefaultInvoiceForm(todayIso));
  const [invoiceScanPayload, setInvoiceScanPayload] = useState(null);
  const [goodsInRecord, setGoodsInRecord] = useState(null);
  const [goodsInItems, setGoodsInItems] = useState([]);
  const [loadingGoodsIn, setLoadingGoodsIn] = useState(false);
  const [savingPart, setSavingPart] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [partForm, setPartForm] = useState(() => createDefaultPartForm());
  const [activeTab, setActiveTab] = useState("global");
  const [isAdvancedPanelOpen, setIsAdvancedPanelOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [completionPromptOpen, setCompletionPromptOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [partError, setPartError] = useState("");
  const fileInputRef = useRef(null);

  const GOODS_IN_ROLES = useMemo(
    () =>
      new Set([
        "parts",
        "parts manager",
        "service",
        "service manager",
        "workshop manager",
        "after sales manager",
        "aftersales manager",
      ]),
    []
  );
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const hasGoodsInAccess = userRoles.some((role) => GOODS_IN_ROLES.has(role));
  const actingUserUuid = useMemo(() => {
    if (typeof authUserId === "string") return authUserId;
    if (typeof user?.authUuid === "string") return user.authUuid;
    if (typeof user?.id === "string") return user.id;
    return null;
  }, [authUserId, user?.authUuid, user?.id]);
  const actingUserNumeric = useMemo(() => sanitizeNumericId(dbUserId), [dbUserId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const preselectedGoodsIn = router.query?.goodsIn;
  useEffect(() => {
    if (!router.isReady || !preselectedGoodsIn) return;
    fetchGoodsIn(preselectedGoodsIn);
  }, [router.isReady, preselectedGoodsIn]);

  const fetchGoodsIn = useCallback(
    async (lookupValue) => {
      try {
        setLoadingGoodsIn(true);
        const params = new URLSearchParams({ includeItems: "true" });
        if (lookupValue && lookupValue.toString().startsWith("GIN-")) {
          params.set("goodsInNumber", lookupValue);
        } else {
          params.set("goodsInId", lookupValue);
        }
        const response = await fetch(`/api/parts/goods-in?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to load goods-in record");
        }
        setGoodsInRecord(payload.goodsIn);
        setGoodsInItems(payload.goodsIn?.items || []);
        setInvoiceForm((prev) => ({
          ...prev,
          supplierAccountId: payload.goodsIn?.supplier_account_id || "",
          supplierName: payload.goodsIn?.supplier_name || "",
          supplierAddress: payload.goodsIn?.supplier_address || "",
          invoiceNumber: payload.goodsIn?.invoice_number || "",
          deliveryNoteNumber: payload.goodsIn?.delivery_note_number || "",
          invoiceDate: payload.goodsIn?.invoice_date || todayIso,
          notes: payload.goodsIn?.notes || "",
          priceLevel: payload.goodsIn?.price_level || "stock_order_rate",
        }));
      } catch (error) {
        console.error(error);
        setToast({ type: "error", message: error.message });
      } finally {
        setLoadingGoodsIn(false);
      }
    },
    [todayIso]
  );

  const handleInvoiceChange = (field, value) => {
    if (partError) setPartError("");
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePartChange = (field, value) => {
    setPartError("");
    setPartForm((prev) => {
      const next = { ...prev, [field]: value };
      const isTyreFranchise = (next.franchise || "").toLowerCase() === "tyre" || (next.franchise || "").toLowerCase() === "tyres";
      // Keep retail/cost prices in sync with a fixed £30 delta only for Tyre/Tyres.
      if (isTyreFranchise && field === "retailPrice") {
        if (!value) {
          next.costPrice = "";
        } else {
          const retailNum = parseFloat(value);
          if (!isNaN(retailNum)) {
            next.costPrice = (retailNum - 30).toFixed(2);
          }
        }
      } else if (isTyreFranchise && field === "costPrice") {
        if (!value) {
          next.retailPrice = "";
        } else {
          const costNum = parseFloat(value);
          if (!isNaN(costNum)) {
            next.retailPrice = (costNum + 30).toFixed(2);
          }
        }
      } else if (field === "franchise" && isTyreFranchise) {
        const retailNum = parseFloat(next.retailPrice);
        const costNum = parseFloat(next.costPrice);
        if (!isNaN(retailNum) && isNaN(costNum)) {
          next.costPrice = (retailNum - 30).toFixed(2);
        } else if (!isNaN(costNum) && isNaN(retailNum)) {
          next.retailPrice = (costNum + 30).toFixed(2);
        }
      }

      return next;
    });
  };

  const handleNestedPartChange = (group, field, value) => {
    setPartError("");
    setPartForm((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
  };

  const handleSalePriceChange = (index, value) => {
    setPartError("");
    setPartForm((prev) => {
      const next = [...prev.salePrices];
      next[index] = { ...next[index], price: value };
      return { ...prev, salePrices: next };
    });
  };

  const ensureInvoiceReady = () => {
    if (!invoiceForm.supplierName.trim()) {
      const message = "Supplier name is required before adding parts";
      setToast({ type: "error", message });
      setPartError(message);
      return false;
    }
    if (!invoiceForm.invoiceNumber.trim()) {
      const message = "Invoice number is required before adding parts";
      setToast({ type: "error", message });
      setPartError(message);
      return false;
    }
    return true;
  };

  const ensureGoodsInRecord = useCallback(async () => {
    if (goodsInRecord?.id) return goodsInRecord;
    if (!ensureInvoiceReady()) return null;

    try {
      setLoadingGoodsIn(true);
      const response = await fetch("/api/parts/goods-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierAccountId: invoiceForm.supplierAccountId,
          supplierName: invoiceForm.supplierName,
          supplierAddress: invoiceForm.supplierAddress,
          supplierContact: invoiceForm.supplierContact,
          invoiceNumber: invoiceForm.invoiceNumber,
          deliveryNoteNumber: invoiceForm.deliveryNoteNumber,
          invoiceDate: invoiceForm.invoiceDate,
          priceLevel: invoiceForm.priceLevel,
          notes: invoiceForm.notes,
          scanPayload: invoiceScanPayload,
          userId: actingUserUuid,
          userNumericId: actingUserNumeric,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to create goods-in record");
      }
      setGoodsInRecord(payload.goodsIn);
      setToast({ type: "success", message: `Goods in ${payload.goodsIn.goods_in_number} started` });
      return payload.goodsIn;
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
      setPartError(error.message);
      return null;
    } finally {
      setLoadingGoodsIn(false);
    }
  }, [actingUserNumeric, actingUserUuid, goodsInRecord?.id, invoiceForm, invoiceScanPayload]);

  const buildPartPayload = () => ({
    partId: partForm.partId,
    partNumber: partForm.partNumber,
    description: partForm.description,
    binLocation: partForm.binLocation,
    franchise: partForm.franchise,
    retailPrice: partForm.retailPrice || null,
    costPrice: partForm.costPrice || null,
    discountCode: partForm.discountCode,
    surcharge: partForm.surcharge,
    claimNumber: partForm.claimNumber,
    packSize: partForm.packSize,
    vatRate:
      partForm.vatRate === "custom" && partForm.vatRateCustomValue
        ? partForm.vatRateCustomValue
        : partForm.vatRate,
    quantity: partForm.quantity,
    salePrices: partForm.salePrices
      .map((entry, index) => ({
        tier: entry.label || `Sale ${index + 1}`,
        price: entry.price,
      }))
      .filter((entry) => entry.price),
    purchaseDetails: partForm.purchaseDetails,
    dealerDetails: partForm.dealerDetails,
    stockDetails: partForm.stockDetails,
    userDefined: partForm.userDefined,
    linkMetadata: { links: partForm.linkMetadata.filter((link) => link.label || link.url) },
    salesHistory: partForm.salesHistory,
    audiMetadata: partForm.audiMetadata,
    additionalFields: partForm.additionalFields,
    onlineStore: partForm.onlineStore,
    customAttributes: partForm.customAttributes,
    notes: partForm.notes,
  });

  const handleAddPart = async () => {
    setPartError("");
    if (!partForm.partNumber.trim()) {
      setPartError("Part number is required");
      return;
    }
    if (!partForm.quantity || Number(partForm.quantity) <= 0) {
      setPartError("Quantity must be above zero");
      return;
    }

    const record = await ensureGoodsInRecord();
    if (!record?.id) {
      setPartError("Unable to start goods-in record. Check invoice details.");
      return;
    }

    try {
      setSavingPart(true);
      const response = await fetch(`/api/parts/goods-in/${record.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPartPayload(),
          userId: actingUserUuid,
          userNumericId: actingUserNumeric,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to add part");
      }
      setGoodsInItems((prev) => [...prev, payload.item]);
      setPartForm(createDefaultPartForm());
      setActiveTab("global");
      setIsAdvancedPanelOpen(false);
      setToast({ type: "success", message: "Part added to invoice" });
      setPartError("");
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
      setPartError(error.message);
    } finally {
      setSavingPart(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId) return;
    if (!goodsInRecord?.id) {
      setToast({ type: "error", message: "Start a goods-in record before removing lines" });
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("Remove this invoice line?")) {
      return;
    }
    try {
      setRemovingItemId(itemId);
      const response = await fetch(`/api/parts/goods-in/items/${itemId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to remove line");
      }
      setGoodsInItems((prev) => prev.filter((item) => item.id !== itemId));
      setToast({ type: "success", message: "Invoice line removed" });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleCompleteGoodsIn = async () => {
    if (!goodsInRecord?.id) {
      setToast({ type: "error", message: "Start a goods-in record before completing" });
      return;
    }
    if (goodsInItems.length === 0) {
      setToast({ type: "error", message: "Add at least one part before completing" });
      return;
    }

    try {
      setCompleting(true);
      const response = await fetch(`/api/parts/goods-in/${goodsInRecord.id}/complete`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to complete goods-in");
      }
      setGoodsInRecord(payload.goodsIn);
      setGoodsInItems(payload.goodsIn?.items || goodsInItems);
      setCompletionPromptOpen(true);
      setToast({ type: "success", message: `${payload.goodsIn.goods_in_number} marked complete` });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
    } finally {
      setCompleting(false);
    }
  };

  const handleScanDocClick = () => {
    if (scanBusy) return;
    fileInputRef.current?.click();
  };

  const handleScanDocChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() || "";
      const parsed = parseDocumentFields(text);
      setInvoiceForm((prev) => {
        let nextDate = prev.invoiceDate;
        if (parsed.invoiceDateGuess) {
          const normalised = parsed.invoiceDateGuess.replace(
            /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/,
            "$3-$2-$1"
          );
          const candidate = new Date(normalised);
          if (!Number.isNaN(candidate.getTime())) {
            nextDate = candidate.toISOString().slice(0, 10);
          }
        }
        return {
          ...prev,
          invoiceNumber: parsed.invoiceNumber || prev.invoiceNumber,
          deliveryNoteNumber: parsed.deliveryNoteNumber || prev.deliveryNoteNumber,
          invoiceDate: nextDate,
        };
      });
      setInvoiceScanPayload({
        fileName: file.name,
        extracted: parsed,
        preview: text.slice(0, 280),
      });
      setScanBusy(false);
      setToast({ type: "success", message: "Document scanned" });
      event.target.value = "";
    };
    reader.onerror = () => {
      setScanBusy(false);
      setToast({ type: "error", message: "Unable to read document" });
    };
    reader.readAsText(file);
  };

  const handleSupplierSelected = (supplier) => {
    setInvoiceForm((prev) => ({
      ...prev,
      supplierAccountId: supplier.account_number,
      supplierName: supplier.company_name || supplier.trading_name || supplier.account_number,
      supplierAddress: [
        supplier.billing_address_line1,
        supplier.billing_address_line2,
        supplier.billing_city,
        supplier.billing_postcode,
      ]
        .filter(Boolean)
        .join(", "),
      supplierContact: supplier.contact_phone || supplier.contact_email || "",
    }));
    setSupplierModalOpen(false);
  };

  const handlePartSelected = (part) => {
    setPartError("");
    setPartForm((prev) => ({
      ...prev,
      partId: part.id,
      partNumber: part.part_number,
      mainPartNumber: part.oem_reference || prev.mainPartNumber,
      description: part.name || part.description || prev.description,
      binLocation: part.storage_location || prev.binLocation,
      retailPrice: part.unit_price ? String(part.unit_price) : prev.retailPrice,
      costPrice: part.unit_cost ? String(part.unit_cost) : prev.costPrice,
    }));
    setPartSearchOpen(false);
  };

  const resetGoodsInState = useCallback(() => {
    setGoodsInRecord(null);
    setGoodsInItems([]);
    setInvoiceForm(createDefaultInvoiceForm(todayIso));
    setInvoiceScanPayload(null);
    setPartForm(createDefaultPartForm());
    setActiveTab("global");
    setIsAdvancedPanelOpen(false);
    setCompletionPromptOpen(false);
    setJobModalOpen(false);
    setPartError("");
  }, [todayIso]);

  const handleCompletionDismiss = useCallback(() => {
    resetGoodsInState();
    router.push("/parts/goods-in");
  }, [resetGoodsInState, router]);

  const handleJobItemsAssigned = (updatedItems) => {
    if (!updatedItems?.length) return;
    const updatedMap = new Map(updatedItems.map((item) => [item.id, item]));
    setGoodsInItems((prev) => prev.map((item) => updatedMap.get(item.id) || item));
    setToast({ type: "success", message: "Selected parts added to job" });
    setPartError("");
  };

  const handleFinishGoodsIn = () => {
    handleCompletionDismiss();
  };

  if (!hasGoodsInAccess) {
    return (
      <Layout>
        <div style={{ padding: "32px" }}>
          <h1 style={{ marginBottom: "12px" }}>Goods In</h1>
          <p>You do not have permission to access this workspace.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style jsx>{`
        .compact-dropdown :global(.dropdown-api__control) {
          min-height: 40px;
          padding: 10px 40px 10px 12px;
          border-radius: 10px;
          font-size: 0.95rem;
        }
        .compact-dropdown :global(.dropdown-api__chevron) {
          right: 12px;
        }
        .goods-in-bin-dropdown :global(.dropdown-api__control) {
          min-height: 40px !important;
          padding: 10px 32px 10px 12px !important;
          border-radius: 10px !important;
          font-size: 0.95rem !important;
          border: 1px solid var(--surface-light) !important;
          background: var(--layer-section-level-1) !important;
          box-shadow: none !important;
        }
        .goods-in-bin-dropdown :global(.dropdown-api__control:focus-visible) {
          background: var(--layer-section-level-1) !important;
          border: 1px solid var(--surface-light) !important;
          box-shadow: none !important;
        }
        .compact-calendar :global(.calendar-api__control) {
          padding: 10px 40px 10px 12px;
          border-radius: 10px;
          font-size: 0.95rem;
          min-height: 40px;
        }
        .compact-calendar :global(.calendar-api__icon) {
          right: 12px;
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "12px" }}>
        {toast && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background:
                toast.type === "error"
                  ? "var(--danger-surface)"
                  : toast.type === "success"
                  ? "var(--success-surface)"
                  : "var(--info-surface)",
              color:
                toast.type === "error"
                  ? "var(--danger)"
                  : toast.type === "success"
                  ? "var(--success-dark)"
                  : "var(--info)",
            }}
          >
            {toast.message}
          </div>
        )}

        <div
          style={{
            borderRadius: "999px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "6px",
            display: "flex",
            gap: "6px",
            width: "100%",
            overflowX: "auto",
            flexShrink: 0,
            scrollbarWidth: "thin",
            scrollbarColor: "var(--scrollbar-thumb) transparent",
            scrollBehavior: "smooth",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {ADVANCED_TABS.map((tab) => (
            <button
              key={`top-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id);
                setIsAdvancedPanelOpen(true);
              }}
              style={{
                flex: "0 0 auto",
                borderRadius: "999px",
                border: "1px solid transparent",
                padding: "10px 20px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === tab.id ? "var(--primary)" : "transparent",
                color: activeTab === tab.id ? "var(--text-inverse)" : "var(--text-primary)",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Invoice details</h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={secondaryButtonStyle} onClick={() => setSupplierModalOpen(true)}>
                Supplier search
              </button>
              <button style={secondaryButtonStyle} onClick={handleScanDocClick} disabled={scanBusy}>
                {scanBusy ? "Scanning..." : "Scan doc"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.csv,.json,.doc,.docx,.jpg,.png"
                style={{ display: "none" }}
                onChange={handleScanDocChange}
              />
            </div>
          </div>
          <div style={fieldGridStyle}>
            <div>
              <label style={labelStyle}>Supplier</label>
              <input
                style={inputStyle}
                value={invoiceForm.supplierName}
                onChange={(event) => handleInvoiceChange("supplierName", event.target.value)}
                placeholder="Supplier name"
              />
              {invoiceForm.supplierAccountId && (
                <small style={{ color: "var(--text-secondary)" }}>
                  Account #{invoiceForm.supplierAccountId}
                </small>
              )}
            </div>
            <div>
              <label style={labelStyle}>Invoice number</label>
              <input
                style={inputStyle}
                value={invoiceForm.invoiceNumber}
                onChange={(event) => handleInvoiceChange("invoiceNumber", event.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div>
              <label style={labelStyle}>Delivery note number</label>
              <input
                style={inputStyle}
                value={invoiceForm.deliveryNoteNumber}
                onChange={(event) => handleInvoiceChange("deliveryNoteNumber", event.target.value)}
                placeholder="DN-001"
              />
            </div>
            <div>
              <div className="compact-calendar">
                <CalendarField
                  label="Invoice date"
                  value={invoiceForm.invoiceDate}
                  onChange={(event) => handleInvoiceChange("invoiceDate", event.target.value)}
                  name="invoiceDate"
                  helperText=""
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Price level</label>
              <div className="compact-dropdown">
                <DropdownField
                  value={invoiceForm.priceLevel}
                  onChange={(event) => handleInvoiceChange("priceLevel", event.target.value)}
                  style={{ width: "100%" }}
                  placeholder="Select price level"
                >
                  {PRICE_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </DropdownField>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Franchise</label>
              <div className="compact-dropdown">
                <DropdownField
                  value={partForm.franchise}
                  onChange={(event) => handlePartChange("franchise", event.target.value)}
                  style={{ width: "100%" }}
                  placeholder="Select franchise"
                >
                  {FRANCHISE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </DropdownField>
              </div>
            </div>
          </div>
          {invoiceForm.supplierAddress && (
            <div>
              <label style={labelStyle}>Supplier address</label>
              <div style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }}>
                {invoiceForm.supplierAddress}
              </div>
            </div>
          )}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={textareaStyle}
              value={invoiceForm.notes}
              onChange={(event) => handleInvoiceChange("notes", event.target.value)}
              placeholder="Internal notes"
            />
          </div>
          {invoiceScanPayload && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Last scan: {invoiceScanPayload.fileName} ·
              {invoiceScanPayload.extracted.invoiceNumber && ` Invoice ${invoiceScanPayload.extracted.invoiceNumber}`}
            </div>
          )}
        </section>

        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Add part</h2>
            <button style={secondaryButtonStyle} onClick={() => setPartSearchOpen(true)}>
              Search catalogue
            </button>
          </div>
          {partError && (
            <div
              style={{
                border: "1px solid var(--danger)",
                borderRadius: "12px",
                padding: "10px 14px",
                color: "var(--danger)",
                background: "var(--danger-surface, rgba(239, 68, 68, 0.08))",
              }}
            >
              {partError}
            </div>
          )}
          <div style={fieldGridStyle}>
            <div>
              <label style={labelStyle}>Part number</label>
              <input
                style={inputStyle}
                value={partForm.partNumber}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setPartSearchOpen(true);
                  }
                }}
                onChange={(event) => handlePartChange("partNumber", event.target.value)}
                placeholder="e.g., FPAD1"
              />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                style={inputStyle}
                min="0"
                value={partForm.quantity}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  handlePartChange("quantity", nextValue === "" ? "" : Number(nextValue));
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Bin location</label>
              <DropdownField
                className="goods-in-bin-dropdown"
                value={partForm.binLocation}
                onChange={(event) => handlePartChange("binLocation", event.target.value)}
                searchable
                searchPlaceholder="Search bin"
                style={{ width: "6ch" }}
                placeholder="A1"
              >
                {BIN_LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </DropdownField>
            </div>
            <div>
              <label style={labelStyle}>Discount code</label>
              <input
                style={inputStyle}
                value={partForm.discountCode}
                onChange={(event) => handlePartChange("discountCode", event.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={autoExpandTextareaStyle}
                value={partForm.description}
                onChange={(event) => handlePartChange("description", event.target.value)}
                rows={1}
                onInput={(event) => {
                  event.target.style.height = "auto";
                  event.target.style.height = `${event.target.scrollHeight}px`;
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Retail price</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={partForm.retailPrice}
                  onChange={(event) => handlePartChange("retailPrice", event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cost price</label>
              <input
                style={inputStyle}
                value={partForm.costPrice}
                onChange={(event) => handlePartChange("costPrice", event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {isAdvancedPanelOpen && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ marginTop: "14px" }}>
                {activeTab === "global" && (
                  <div style={fieldGridStyle}>
                    <div>
                      <label style={labelStyle}>Surcharge</label>
                      <input
                        style={inputStyle}
                        value={partForm.surcharge}
                        onChange={(event) => handlePartChange("surcharge", event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>VAT rate</label>
                      <DropdownField
                        value={partForm.vatRate}
                        onChange={(event) => handlePartChange("vatRate", event.target.value)}
                        style={{ width: "100%" }}
                        placeholder="Select VAT rate"
                      >
                        {VAT_RATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </DropdownField>
                      {partForm.vatRate === "custom" && (
                        <input
                          style={{ ...inputStyle, marginTop: "6px" }}
                          value={partForm.vatRateCustomValue}
                          onChange={(event) => handlePartChange("vatRateCustomValue", event.target.value)}
                          placeholder="Enter custom rate"
                        />
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Pack size</label>
                      <input
                        style={inputStyle}
                        value={partForm.packSize}
                        onChange={(event) => handlePartChange("packSize", event.target.value)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Sales price tiers</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                        {partForm.salePrices.map((entry, index) => (
                          <input
                            key={entry.label}
                            style={inputStyle}
                            placeholder={entry.label}
                            value={entry.price}
                            onChange={(event) => handleSalePriceChange(index, event.target.value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Purchase details</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                        <input
                          style={inputStyle}
                          placeholder="Stock order"
                          value={partForm.purchaseDetails.stockOrder}
                          onChange={(event) => handleNestedPartChange("purchaseDetails", "stockOrder", event.target.value)}
                        />
                        <input
                          style={inputStyle}
                          placeholder="VOR cost"
                          value={partForm.purchaseDetails.vorCost}
                          onChange={(event) => handleNestedPartChange("purchaseDetails", "vorCost", event.target.value)}
                        />
                        <input
                          style={inputStyle}
                          placeholder="Local cost"
                          value={partForm.purchaseDetails.localCost}
                          onChange={(event) => handleNestedPartChange("purchaseDetails", "localCost", event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "dealer" && (
                  <div style={fieldGridStyle}>
                    <input
                      style={inputStyle}
                      placeholder="Dealer code"
                      value={partForm.dealerDetails.dealerCode}
                      onChange={(event) => handleNestedPartChange("dealerDetails", "dealerCode", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Tier"
                      value={partForm.dealerDetails.tier}
                      onChange={(event) => handleNestedPartChange("dealerDetails", "tier", event.target.value)}
                    />
                    <textarea
                      style={textareaStyle}
                      placeholder="Dealer notes"
                      value={partForm.dealerDetails.notes}
                      onChange={(event) => handleNestedPartChange("dealerDetails", "notes", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "stock" && (
                  <div style={fieldGridStyle}>
                    <input
                      style={inputStyle}
                      placeholder="Reorder point"
                      value={partForm.stockDetails.reorderPoint}
                      onChange={(event) => handleNestedPartChange("stockDetails", "reorderPoint", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Bin capacity"
                      value={partForm.stockDetails.binCapacity}
                      onChange={(event) => handleNestedPartChange("stockDetails", "binCapacity", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Alternate location"
                      value={partForm.stockDetails.alternateLocation}
                      onChange={(event) => handleNestedPartChange("stockDetails", "alternateLocation", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "user" && (
                  <div style={fieldGridStyle}>
                    <input
                      style={inputStyle}
                      placeholder="Field 1"
                      value={partForm.userDefined.field1}
                      onChange={(event) => handleNestedPartChange("userDefined", "field1", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Field 2"
                      value={partForm.userDefined.field2}
                      onChange={(event) => handleNestedPartChange("userDefined", "field2", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "links" && (
                  <div>
                    {partForm.linkMetadata.map((link, index) => (
                      <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                        <input
                          style={inputStyle}
                          placeholder="Label"
                          value={link.label}
                          onChange={(event) => {
                            const next = [...partForm.linkMetadata];
                            next[index] = { ...next[index], label: event.target.value };
                            setPartForm((prev) => ({ ...prev, linkMetadata: next }));
                          }}
                        />
                        <input
                          style={inputStyle}
                          placeholder="URL"
                          value={link.url}
                          onChange={(event) => {
                            const next = [...partForm.linkMetadata];
                            next[index] = { ...next[index], url: event.target.value };
                            setPartForm((prev) => ({ ...prev, linkMetadata: next }));
                          }}
                        />
                      </div>
                    ))}
                    <button
                      style={secondaryButtonStyle}
                      onClick={() =>
                        setPartForm((prev) => ({
                          ...prev,
                          linkMetadata: [...prev.linkMetadata, { label: "", url: "" }],
                        }))
                      }
                    >
                      Add link
                    </button>
                  </div>
                )}
                {activeTab === "sales" && (
                  <div style={fieldGridStyle}>
                    <input
                      type="date"
                      style={inputStyle}
                      value={partForm.salesHistory.lastSoldOn}
                      onChange={(event) => handleNestedPartChange("salesHistory", "lastSoldOn", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Last sold price"
                      value={partForm.salesHistory.lastSoldPrice}
                      onChange={(event) => handleNestedPartChange("salesHistory", "lastSoldPrice", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Quantity"
                      value={partForm.salesHistory.lastSoldQty}
                      onChange={(event) => handleNestedPartChange("salesHistory", "lastSoldQty", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "audi" && (
                  <div style={fieldGridStyle}>
                    <input
                      style={inputStyle}
                      placeholder="Programme"
                      value={partForm.audiMetadata.programme}
                      onChange={(event) => handleNestedPartChange("audiMetadata", "programme", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Reference"
                      value={partForm.audiMetadata.reference}
                      onChange={(event) => handleNestedPartChange("audiMetadata", "reference", event.target.value)}
                    />
                    <textarea
                      style={textareaStyle}
                      placeholder="Audi notes"
                      value={partForm.audiMetadata.notes}
                      onChange={(event) => handleNestedPartChange("audiMetadata", "notes", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "additional" && (
                  <div style={fieldGridStyle}>
                    <input
                      style={inputStyle}
                      placeholder="Warranty"
                      value={partForm.additionalFields.warranty}
                      onChange={(event) => handleNestedPartChange("additionalFields", "warranty", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Logistics"
                      value={partForm.additionalFields.logistics}
                      onChange={(event) => handleNestedPartChange("additionalFields", "logistics", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Internal tag"
                      value={partForm.additionalFields.internalTag}
                      onChange={(event) => handleNestedPartChange("additionalFields", "internalTag", event.target.value)}
                    />
                  </div>
                )}
                {activeTab === "online" && (
                  <div style={fieldGridStyle}>
                    <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={partForm.onlineStore.isListed}
                        onChange={(event) =>
                          handleNestedPartChange("onlineStore", "isListed", event.target.checked)
                        }
                      />
                      Visible in online store
                    </label>
                    <input
                      style={inputStyle}
                      placeholder="Web title"
                      value={partForm.onlineStore.webTitle}
                      onChange={(event) => handleNestedPartChange("onlineStore", "webTitle", event.target.value)}
                    />
                    <textarea
                      style={textareaStyle}
                      placeholder="Web description"
                      value={partForm.onlineStore.webDescription}
                      onChange={(event) => handleNestedPartChange("onlineStore", "webDescription", event.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Online SKU"
                      value={partForm.onlineStore.onlineSku}
                      onChange={(event) => handleNestedPartChange("onlineStore", "onlineSku", event.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setIsAdvancedPanelOpen((state) => !state)}
              style={{ ...secondaryButtonStyle, order: 0 }}
            >
              {isAdvancedPanelOpen ? "Hide details" : "Update details"}
            </button>
            <button
              onClick={() => setPartForm(createDefaultPartForm())}
              style={secondaryButtonStyle}
              disabled={savingPart}
            >
              Clear
            </button>
            <button style={primaryButtonStyle(savingPart)} onClick={handleAddPart} disabled={savingPart}>
              {savingPart ? "Adding..." : "Add part"}
            </button>
          </div>
        </section>

        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <h2 style={{ margin: 0 }}>Invoice lines</h2>
              {goodsInItems.length > 0 && (() => {
                const totalCost = goodsInItems.reduce((sum, item) => {
                  const cost = Number(item.cost_price || 0);
                  const qty = Number(item.quantity || 0);
                  return sum + (cost * qty);
                }, 0);
                const totalRetail = goodsInItems.reduce((sum, item) => {
                  const retail = Number(item.retail_price || 0);
                  const qty = Number(item.quantity || 0);
                  return sum + (retail * qty);
                }, 0);
                return (
                  <div style={{ display: "flex", gap: "16px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    <span>Total Cost: <strong style={{ color: "var(--text-primary)" }}>{currencyFormatter.format(totalCost)}</strong></span>
                    <span>Total Retail: <strong style={{ color: "var(--text-primary)" }}>{currencyFormatter.format(totalRetail)}</strong></span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={secondaryButtonStyle}
                onClick={() => goodsInRecord && fetchGoodsIn(goodsInRecord.id)}
                disabled={!goodsInRecord}
              >
                Refresh
              </button>
              <button
                style={primaryButtonStyle(completing)}
                onClick={handleCompleteGoodsIn}
                disabled={completing}
              >
                {completing ? "Completing..." : "Complete"}
              </button>
            </div>
          </div>
          {goodsInItems.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              No lines yet. Add a part to populate this invoice.
            </div>
          ) : (
            <ScrollArea
              maxHeight="420px"
              style={{
                borderRadius: "20px",
                border: "1px solid var(--surface-light)",
                overflowX: "hidden",
                background: "var(--layer-section-level-2)",
              }}
            >
              <table style={invoiceTableStyles}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={invoiceHeaderCellStyle}>Part number</th>
                    <th style={invoiceHeaderCellStyle}>Description</th>
                    <th style={invoiceHeaderCellStyle}>Retail</th>
                    <th style={invoiceHeaderCellStyle}>Cost</th>
                    <th style={invoiceHeaderCellStyle}>Surcharge</th>
                    <th style={invoiceHeaderCellStyle}>Qty</th>
                    <th style={invoiceHeaderCellStyle}>Cost total</th>
                    <th style={invoiceHeaderCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsInItems.map((item) => {
                    const cost = Number(item.cost_price || 0);
                    const qty = Number(item.quantity || 0);
                    return (
                      <tr key={item.id} style={invoiceRowStyle}>
                        <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}</td>
                        <td style={{ ...invoiceCellStyle, color: "var(--text-secondary)" }}>{item.description}</td>
                        <td style={invoiceCellStyle}>
                          {item.retail_price ? currencyFormatter.format(item.retail_price) : "--"}
                        </td>
                        <td style={invoiceCellStyle}>
                          {item.cost_price ? currencyFormatter.format(item.cost_price) : "--"}
                        </td>
                        <td style={invoiceCellStyle}>{item.surcharge || "--"}</td>
                        <td style={invoiceCellStyle}>{item.quantity}</td>
                        <td style={invoiceCellStyle}>{currencyFormatter.format(cost * qty || 0)}</td>
                        <td style={{ ...invoiceCellStyle, textAlign: "right" }}>
                          <button
                            style={{ ...dangerButtonStyle, opacity: removingItemId === item.id ? 0.6 : 1 }}
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={removingItemId === item.id}
                          >
                            {removingItemId === item.id ? "Removing..." : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </section>
      </div>

      {supplierModalOpen && (
        <SupplierSearchModal
          onClose={() => setSupplierModalOpen(false)}
          onSelect={handleSupplierSelected}
        />
      )}
      {partSearchOpen && (
        <GoodsInPartSearchModal
          onClose={() => setPartSearchOpen(false)}
          onSelect={handlePartSelected}
          initialQuery={partForm.partNumber}
        />
      )}
      {jobModalOpen && (
        <JobAssignmentModal
          items={goodsInItems}
          onClose={() => {
            setJobModalOpen(false);
            setCompletionPromptOpen(true);
          }}
          onAssigned={handleJobItemsAssigned}
          onFinish={handleFinishGoodsIn}
        />
      )}
      {completionPromptOpen && (
        <CompletionPrompt
          goodsInNumber={goodsInRecord?.goods_in_number}
          onClose={handleCompletionDismiss}
          onAddToJob={() => {
            setCompletionPromptOpen(false);
            setJobModalOpen(true);
          }}
        />
      )}
    </Layout>
  );
}

function SupplierSearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchSuppliers = useCallback(
    async (term = "") => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (term.trim()) {
          params.set("search", term.trim());
        }
        const response = await fetch(`/api/company-accounts?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to search suppliers");
        }
        setResults(payload.data || []);
        setError(payload.data?.length ? "" : "No suppliers found");
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    searchSuppliers();
  }, [searchSuppliers]);

  return (
    <div style={popupOverlayStyles}>
      <div style={{ ...popupCardStyles, padding: "24px", maxWidth: "720px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0 }}>Supplier accounts</h3>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Close
          </button>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <input
            style={inputStyle}
            placeholder="Search name, account number or city"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              searchSuppliers(event.target.value);
            }}
          />
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center" }}>Searching...</div>
        ) : error ? (
          <div style={{ padding: "12px", color: "var(--danger)" }}>{error}</div>
        ) : (
          <div style={{ maxHeight: "420px", overflowY: "auto" }}>
            {results.map((result) => (
              <button
                key={result.account_number}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px",
                  border: "1px solid var(--surface-light)",
                  borderRadius: "10px",
                  marginBottom: "8px",
                  cursor: "pointer",
                }}
                onClick={() => onSelect(result)}
              >
                <div style={{ fontWeight: 600 }}>{result.company_name || result.trading_name || result.account_number}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Account {result.account_number} · {result.billing_city || "Unknown city"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoodsInPartSearchModal({ onClose, onSelect, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchRequestRef = useRef(0);

  const searchParts = useCallback(async (term) => {
    const trimmed = term.trim();
    const requestId = ++searchRequestRef.current;
    try {
      setLoading(true);
      const params = new URLSearchParams({ search: trimmed, limit: "30" });
      const response = await fetch(`/api/parts/catalog?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to search parts");
      }
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setResults(payload.parts || []);
      setError(payload.parts?.length ? "" : "No parts match this search");
    } catch (err) {
      console.error(err);
      if (requestId === searchRequestRef.current) {
        setError(err.message);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    if (trimmed.length < 2) {
      setResults([]);
      setError("Enter at least 2 characters");
      setLoading(false);
      return;
    }
    setError("");
    const timeoutId = setTimeout(() => {
      searchParts(trimmed);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [query, searchParts]);

  return (
    <div style={popupOverlayStyles}>
      <div style={{ ...popupCardStyles, padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0 }}>Search parts catalogue</h3>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Close
          </button>
        </div>
        <input
          style={inputStyle}
          placeholder="Part number or description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "8px" }}>
          {loading ? "Searching..." : "Results update automatically as you type"}
        </div>
        {error && <div style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</div>}
        <div style={{ maxHeight: "420px", overflowY: "auto", marginTop: "12px" }}>
          {results.map((part) => (
            <button
              key={part.id}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "12px",
                border: "1px solid var(--surface-light)",
                borderRadius: "10px",
                marginBottom: "8px",
                cursor: "pointer",
              }}
              onClick={() => onSelect(part)}
            >
              <div style={{ fontWeight: 600 }}>
                {part.part_number} · {part.name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{part.description}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {part.storage_location || "No bin"} · {part.supplier || "No supplier"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function JobAssignmentModal({ items, onClose, onAssigned, onFinish }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobResults, setJobResults] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const availableItems = useMemo(
    () => items.filter((item) => !item.added_to_job),
    [items]
  );

  const searchJobs = useCallback(async (term, signal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ search: term, limit: "20" });
      const response = await fetch(`/api/parts/jobs/search?${params.toString()}`, { signal });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to search jobs");
      }
      setJobResults(payload.jobs || []);
      setError(payload.jobs?.length ? "" : "No jobs found");
    } catch (err) {
      if (err.name === "AbortError") return;
      setJobResults([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setJobResults([]);
      setSelectedJob(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      searchJobs(searchTerm.trim(), controller.signal);
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [searchTerm, searchJobs]);

  const handleAssign = async () => {
    if (!selectedJob) {
      setError("Select a job row first");
      return;
    }
    if (selectedItems.size === 0) {
      setError("Select at least one part row");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const itemsToAssign = availableItems.filter((item) => selectedItems.has(item.id));
      const results = await Promise.allSettled(
        itemsToAssign.map(async (item) => {
          const response = await fetch(`/api/parts/goods-in/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              addedToJob: true,
              jobNumber: selectedJob.job_number,
              jobId: selectedJob.id,
              jobAllocationPayload: {
                customer: selectedJob.customer,
                description: selectedJob.description,
                part: {
                  partNumber: item.part_number,
                  description: item.description,
                  costPrice: item.cost_price,
                  retailPrice: item.retail_price,
                  quantity: item.quantity,
                },
              },
            }),
          });
          const payload = await response.json();
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || "Unable to link part to job");
          }
          return payload.item;
        })
      );

      const successful = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      const failed = results.filter((result) => result.status === "rejected");

      if (successful.length) {
        onAssigned(successful);
        setSelectedItems(new Set());
      }

      if (failed.length) {
        setError(failed[0].reason?.message || "Some parts could not be linked to the job");
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const infoCalloutStyle = {
    background: "var(--layer-section-level-2)",
    border: "1px solid var(--surface-light)",
    borderRadius: "12px",
    padding: "10px 12px",
    color: "var(--text-secondary)",
    fontSize: "0.9rem",
    lineHeight: 1.4,
  };

  const modalSectionStyle = {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };

  const jobCardStyle = (isSelected) => ({
    width: "100%",
    textAlign: "left",
    border: "1px solid var(--surface-light)",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "8px",
    cursor: "pointer",
    background: isSelected ? "var(--layer-section-level-2)" : "var(--surface)",
    color: "var(--text-primary)",
  });

  return (
    <div style={popupOverlayStyles}>
      <div style={{ ...popupCardStyles, padding: "24px", maxWidth: "720px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>Add goods-in parts to a job</h3>
          <button onClick={onClose} style={secondaryButtonStyle} disabled={submitting}>
            Cancel
          </button>
        </div>
        <div style={infoCalloutStyle}>
          Select one job and the parts to add. Part number, description, and quantity will be sent to the job.
        </div>
        <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
          <div style={modalSectionStyle}>
            <label style={labelStyle}>Search job number or customer</label>
            <input
              style={inputStyle}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="e.g., GJ12345"
              disabled={submitting}
            />
            {loading && <div style={{ color: "var(--text-secondary)" }}>Searching...</div>}
            {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
            <div style={{ maxHeight: "260px", overflowY: "auto" }}>
              {jobResults.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    style={jobCardStyle(isSelected)}
                    onClick={() => {
                      setSelectedJob(job);
                      setError("");
                    }}
                    disabled={submitting}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {job.job_number} · {job.customer || "Unknown customer"}
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {job.description || "No description"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {job.vehicle_reg || "No reg"} · Updated{" "}
                      {job.updated_at ? formatRelativeTime(job.updated_at) : "recently"}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedJob && (
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Selected job: <strong>{selectedJob.job_number}</strong>
              </div>
            )}
          </div>
          <div style={modalSectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>Select parts to add</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={secondaryButtonStyle}
                  onClick={() => setSelectedItems(new Set(availableItems.map((item) => item.id)))}
                  disabled={availableItems.length === 0 || submitting}
                >
                  Select all
                </button>
                <button
                  style={secondaryButtonStyle}
                  onClick={() => setSelectedItems(new Set())}
                  disabled={selectedItems.size === 0 || submitting}
                >
                  Clear
                </button>
              </div>
            </div>
            {availableItems.length === 0 ? (
              <div style={{ color: "var(--text-secondary)" }}>
                All parts from this goods-in are already linked to a job.
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--surface-light)",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--layer-section-level-2)" }}>
                    <tr>
                      <th style={{ ...invoiceHeaderCellStyle, width: "44px" }}></th>
                      <th style={invoiceHeaderCellStyle}>Part number</th>
                      <th style={invoiceHeaderCellStyle}>Description</th>
                      <th style={invoiceHeaderCellStyle}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableItems.map((item) => {
                      const isSelected = selectedItems.has(item.id);
                      return (
                        <tr key={item.id} style={{ borderTop: "1px solid var(--surface-light)" }}>
                          <td style={{ ...invoiceCellStyle, width: "44px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => {
                                const next = new Set(selectedItems);
                                if (event.target.checked) {
                                  next.add(item.id);
                                } else {
                                  next.delete(item.id);
                                }
                                setSelectedItems(next);
                                setError("");
                              }}
                              disabled={submitting}
                            />
                          </td>
                          <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}</td>
                          <td style={{ ...invoiceCellStyle, color: "var(--text-secondary)" }}>{item.description}</td>
                          <td style={invoiceCellStyle}>{item.quantity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
          <button style={secondaryButtonStyle} onClick={onFinish} disabled={submitting}>
            Finish
          </button>
          <button
            style={primaryButtonStyle(submitting)}
            onClick={handleAssign}
            disabled={submitting || availableItems.length === 0}
          >
            {submitting ? "Adding..." : "Add selected to job"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletionPrompt({ goodsInNumber, onAddToJob, onClose }) {
  return (
    <div style={popupOverlayStyles}>
      <div style={{ ...popupCardStyles, padding: "24px", maxWidth: "480px" }}>
        <h3>Goods in complete</h3>
        <p>
          {goodsInNumber || "This receipt"} has been marked as complete. Would you like to attach the new
          parts to a job now?
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button style={secondaryButtonStyle} onClick={onClose}>
            Not now
          </button>
          <button style={primaryButtonStyle(false)} onClick={onAddToJob}>
            Add to job
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoodsInPage;
