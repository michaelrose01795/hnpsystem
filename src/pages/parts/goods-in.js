import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { popupCardStyles, popupOverlayStyles } from "@/styles/appTheme";
import { sanitizeNumericId } from "@/lib/utils/ids";
import { format } from "date-fns";

const PRICE_LEVEL_OPTIONS = [
  { value: "stock_order_rate", label: "Stock order rate" },
  { value: "retail", label: "Retail" },
  { value: "trade", label: "Trade" },
  { value: "other", label: "Other" },
];

const FRANCHISE_OPTIONS = ["Mitsubishi", "Suzuki", "Other", "Tyre", "Stock", "Consumables"];

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
  manufacturerPartNumber: "",
  description: "",
  quantity: 1,
  binLocationPrimary: "",
  binLocationSecondary: "",
  franchise: FRANCHISE_OPTIONS[0],
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
  const [jobModalItem, setJobModalItem] = useState(null);
  const [completionPromptOpen, setCompletionPromptOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
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
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePartChange = (field, value) => {
    setPartForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNestedPartChange = (group, field, value) => {
    setPartForm((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
  };

  const handleSalePriceChange = (index, value) => {
    setPartForm((prev) => {
      const next = [...prev.salePrices];
      next[index] = { ...next[index], price: value };
      return { ...prev, salePrices: next };
    });
  };

  const ensureInvoiceReady = () => {
    if (!invoiceForm.supplierName.trim()) {
      setToast({ type: "error", message: "Supplier name is required" });
      return false;
    }
    if (!invoiceForm.invoiceNumber.trim()) {
      setToast({ type: "error", message: "Invoice number is required" });
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
      return null;
    } finally {
      setLoadingGoodsIn(false);
    }
  }, [actingUserNumeric, actingUserUuid, goodsInRecord?.id, invoiceForm, invoiceScanPayload]);

  const buildPartPayload = () => ({
    partId: partForm.partId,
    partNumber: partForm.partNumber,
    manufacturerPartNumber: partForm.manufacturerPartNumber,
    description: partForm.description,
    binLocationPrimary: partForm.binLocationPrimary,
    binLocationSecondary: partForm.binLocationSecondary,
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
    if (!partForm.partNumber.trim()) {
      setToast({ type: "error", message: "Part number is required" });
      return;
    }
    if (!partForm.quantity || Number(partForm.quantity) <= 0) {
      setToast({ type: "error", message: "Quantity must be above zero" });
      return;
    }

    const record = await ensureGoodsInRecord();
    if (!record?.id) return;

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
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
    } finally {
      setSavingPart(false);
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
      supplierAccountId: supplier.account_id,
      supplierName: supplier.billing_name || supplier.account_id,
      supplierAddress: [
        supplier.billing_address_line1,
        supplier.billing_address_line2,
        supplier.billing_city,
        supplier.billing_postcode,
      ]
        .filter(Boolean)
        .join(", "),
      supplierContact: supplier.billing_phone || supplier.billing_email || "",
    }));
    setSupplierModalOpen(false);
  };

  const handlePartSelected = (part) => {
    setPartForm((prev) => ({
      ...prev,
      partId: part.id,
      partNumber: part.part_number,
      manufacturerPartNumber: part.oem_reference || prev.manufacturerPartNumber,
      description: part.name || part.description || prev.description,
      binLocationPrimary: part.storage_location || prev.binLocationPrimary,
      retailPrice: part.unit_price ? String(part.unit_price) : prev.retailPrice,
      costPrice: part.unit_cost ? String(part.unit_cost) : prev.costPrice,
    }));
    setPartSearchOpen(false);
  };

  const handleJobAssigned = (updatedItem) => {
    setGoodsInItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    setJobModalItem(null);
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
              <label style={labelStyle}>Invoice date</label>
              <input
                type="date"
                style={inputStyle}
                value={invoiceForm.invoiceDate}
                onChange={(event) => handleInvoiceChange("invoiceDate", event.target.value)}
              />
              <small style={{ color: "var(--text-secondary)" }}>
                {formatInvoiceDate(invoiceForm.invoiceDate)}
              </small>
            </div>
            <div>
              <label style={labelStyle}>Price level</label>
              <select
                style={inputStyle}
                value={invoiceForm.priceLevel}
                onChange={(event) => handleInvoiceChange("priceLevel", event.target.value)}
              >
                {PRICE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              <label style={labelStyle}>Manufacturer part number</label>
              <input
                style={inputStyle}
                value={partForm.manufacturerPartNumber}
                onChange={(event) => handlePartChange("manufacturerPartNumber", event.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                style={inputStyle}
                min="0"
                value={partForm.quantity}
                onChange={(event) => handlePartChange("quantity", Number(event.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Bin location</label>
              <input
                style={inputStyle}
                value={partForm.binLocationPrimary}
                onChange={(event) => handlePartChange("binLocationPrimary", event.target.value)}
                placeholder="A1"
              />
            </div>
            <div>
              <label style={labelStyle}>Bin location 2</label>
              <input
                style={inputStyle}
                value={partForm.binLocationSecondary}
                onChange={(event) => handlePartChange("binLocationSecondary", event.target.value)}
                placeholder="B3"
              />
            </div>
            <div>
              <label style={labelStyle}>Franchise</label>
              <select
                style={inputStyle}
                value={partForm.franchise}
                onChange={(event) => handlePartChange("franchise", event.target.value)}
              >
                {FRANCHISE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={textareaStyle}
                value={partForm.description}
                onChange={(event) => handlePartChange("description", event.target.value)}
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
                <button
                  style={{ ...secondaryButtonStyle, whiteSpace: "nowrap" }}
                  onClick={() => setIsAdvancedPanelOpen((state) => !state)}
                >
                  {isAdvancedPanelOpen ? "Hide" : "Update"}
                </button>
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
            <div>
              <label style={labelStyle}>Discount code</label>
              <input
                style={inputStyle}
                value={partForm.discountCode}
                onChange={(event) => handlePartChange("discountCode", event.target.value)}
              />
            </div>
          </div>

          {isAdvancedPanelOpen && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  borderBottom: "1px solid var(--surface-light)",
                  paddingBottom: "8px",
                }}
              >
                {ADVANCED_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      ...secondaryButtonStyle,
                      borderColor: activeTab === tab.id ? "var(--primary)" : "transparent",
                      color: activeTab === tab.id ? "var(--primary)" : "var(--text-secondary)",
                      background: activeTab === tab.id ? "var(--surface-light)" : "transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: "14px" }}>
                {activeTab === "global" && (
                  <div style={fieldGridStyle}>
                    <div>
                      <label style={labelStyle}>Franchise</label>
                      <select
                        style={inputStyle}
                        value={partForm.franchise}
                        onChange={(event) => handlePartChange("franchise", event.target.value)}
                      >
                        {FRANCHISE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
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
                      <select
                        style={inputStyle}
                        value={partForm.vatRate}
                        onChange={(event) => handlePartChange("vatRate", event.target.value)}
                      >
                        {VAT_RATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
            <h2 style={{ margin: 0 }}>Invoice lines</h2>
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--surface-light)" }}>
                    <th>Part number</th>
                    <th>Man part number</th>
                    <th>Description</th>
                    <th>Bin</th>
                    <th>Bin 2</th>
                    <th>Retail</th>
                    <th>Cost</th>
                    <th>Surcharge</th>
                    <th>Qty</th>
                    <th>Cost total</th>
                    <th>Claim</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsInItems.map((item) => {
                    const cost = Number(item.cost_price || 0);
                    const qty = Number(item.quantity || 0);
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--surface-light)" }}>
                        <td>{item.part_number}</td>
                        <td>{item.manufacturer_part_number}</td>
                        <td>{item.description}</td>
                        <td>{item.bin_location_primary}</td>
                        <td>{item.bin_location_secondary}</td>
                        <td>{item.retail_price ? currencyFormatter.format(item.retail_price) : "--"}</td>
                        <td>{item.cost_price ? currencyFormatter.format(item.cost_price) : "--"}</td>
                        <td>{item.surcharge || "--"}</td>
                        <td>{item.quantity}</td>
                        <td>{currencyFormatter.format(cost * qty || 0)}</td>
                        <td>{item.claim_number || "--"}</td>
                        <td>
                          {item.added_to_job ? (
                            <span style={{ color: "var(--success)" }}>Added to job {item.job_number}</span>
                          ) : (
                            <button
                              style={{ ...secondaryButtonStyle, fontSize: "0.8rem" }}
                              onClick={() => setJobModalItem(item)}
                            >
                              Add to job
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
      {jobModalItem && (
        <JobAssignmentModal
          item={jobModalItem}
          onClose={() => setJobModalItem(null)}
          onAssigned={handleJobAssigned}
        />
      )}
      {completionPromptOpen && (
        <CompletionPrompt
          goodsInNumber={goodsInRecord?.goods_in_number}
          onClose={() => setCompletionPromptOpen(false)}
          onAddToJob={() => {
            setCompletionPromptOpen(false);
            const firstUnassigned = goodsInItems.find((item) => !item.added_to_job);
            if (firstUnassigned) {
              setJobModalItem(firstUnassigned);
            }
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
          params.set("q", term.trim());
        }
        const response = await fetch(`/api/parts/suppliers/search?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to search suppliers");
        }
        setResults(payload.suppliers || []);
        setError(payload.suppliers?.length ? "" : "No suppliers found");
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
                key={result.account_id}
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
                <div style={{ fontWeight: 600 }}>{result.billing_name || result.account_id}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Account {result.account_id} · {result.billing_city || "Unknown city"}
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

  const searchParts = useCallback(
    async (term) => {
      if (!term || term.trim().length < 2) {
        setResults([]);
        setError("Enter at least 2 characters");
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams({ search: term.trim(), limit: "30" });
        const response = await fetch(`/api/parts/catalog?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to search parts");
        }
        setResults(payload.parts || []);
        setError(payload.parts?.length ? "" : "No parts match this search");
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
          onKeyDown={(event) => event.key === "Enter" && searchParts(query)}
        />
        <button style={{ ...primaryButtonStyle(loading), marginTop: "10px" }} onClick={() => searchParts(query)} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
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

function JobAssignmentModal({ item, onClose, onAssigned }) {
  const [jobNumber, setJobNumber] = useState("");
  const [jobRecord, setJobRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobNumber.trim()) {
      setJobRecord(null);
      setError("");
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const fetchJob = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ jobNumber: jobNumber.trim() });
        const response = await fetch(`/api/parts/jobs/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to load job");
        }
        if (isMounted) {
          setJobRecord(payload.job);
          setError("");
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setJobRecord(null);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [jobNumber]);

  const handleAssign = async () => {
    if (!jobRecord) {
      setError("Enter a job number first");
      return;
    }
    try {
      const response = await fetch(`/api/parts/goods-in/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedToJob: true,
          jobNumber: jobRecord.job_number,
          jobId: jobRecord.id,
          jobAllocationPayload: {
            customer: jobRecord.customer,
            description: jobRecord.description,
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
      onAssigned(payload.item);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div style={popupOverlayStyles}>
      <div style={{ ...popupCardStyles, padding: "24px", maxWidth: "520px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>Add {item.part_number} to a job</h3>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Close
          </button>
        </div>
        <p style={{ marginTop: 0, color: "var(--text-secondary)" }}>{item.description}</p>
        <label style={labelStyle}>Job number</label>
        <input
          style={inputStyle}
          value={jobNumber}
          onChange={(event) => setJobNumber(event.target.value)}
          placeholder="Enter job number"
        />
        {loading && <div style={{ marginTop: "8px" }}>Looking up job...</div>}
        {error && <div style={{ marginTop: "8px", color: "var(--danger)" }}>{error}</div>}
        {jobRecord && (
          <div style={{ marginTop: "12px", border: "1px solid var(--surface-light)", borderRadius: "10px", padding: "12px" }}>
            <div style={{ fontWeight: 600 }}>Job {jobRecord.job_number}</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{jobRecord.description}</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {jobRecord.vehicle_reg} · {jobRecord.customer}
            </div>
          </div>
        )}
        <button style={{ ...primaryButtonStyle(false), marginTop: "16px", width: "100%" }} onClick={handleAssign}>
          Link part to job
        </button>
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
