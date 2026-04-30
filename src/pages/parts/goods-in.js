// file location: src/pages/parts/goods-in.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { popupCardStyles, popupOverlayStyles } from "@/styles/appTheme";
import { sanitizeNumericId } from "@/lib/utils/ids";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { ScrollArea } from "@/components/ui/scrollAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import GoodsInPageUi from "@/components/page-ui/parts/parts-goods-in-ui"; // Extracted presentation layer.

const PRICE_LEVEL_OPTIONS = [
{ value: "stock_order_rate", label: "Stock order rate" },
{ value: "retail", label: "Retail" },
{ value: "trade", label: "Trade" },
{ value: "other", label: "Other" }];


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
{ value: "custom", label: "Custom" }];


const ADVANCED_TABS = [
{ id: "global", label: "Global" },
{ id: "dealer", label: "Dealer" },
{ id: "stock", label: "Stock" },
{ id: "user", label: "User Defined" },
{ id: "links", label: "Links" },
{ id: "sales", label: "Sales History" },
{ id: "audi", label: "Audi" },
{ id: "additional", label: "Additional Fields" },
{ id: "online", label: "Online Store" }];


const sectionCardStyle = {
  gap: "18px",
  background: "var(--theme)"
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};

const splitFieldRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
  alignItems: "stretch"
};

const labelStyle = {
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "var(--text-1)"
};

// Surface (background, border, radius, padding, height) is intentionally left
// to the global input rules in src/styles/globals.css so this page matches the
// rest of the app. Only typography props are kept here.
const inputStyle = {
  fontSize: "0.95rem",
  fontFamily: "inherit",
  color: "var(--text-1)"
};

const addPartInputStyle = {
  ...inputStyle
};

const addPartFieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "160px"
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "96px"
};

// Notes textareas use the global .app-notes-input class for sizing/resize/bg —
// keep this object empty so it does not override the class via inline style.
const notesTextareaStyle = {};

const addressFieldStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--control-radius)",
  border: "none",
  background: "var(--control-bg)",
  color: "var(--text-1)",
  minHeight: "var(--control-height)",
  display: "flex",
  alignItems: "center"
};

const compactFieldWrapStyle = {
  display: "inline-flex",
  flexDirection: "column",
  justifySelf: "start",
  alignSelf: "start",
  width: "fit-content"
};

const wideCompactFieldWrapStyle = {
  ...compactFieldWrapStyle,
  width: "320px",
  minWidth: "320px"
};

const primaryButtonStyle = (disabled = false) => ({
  padding: "12px 20px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled ? "var(--surface)" : "var(--primary)",
  color: disabled ? "var(--text-1)" : "white"
});

const secondaryButtonStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--primary)",
  fontWeight: 600,
  fontSize: "0.9rem",
  background: "transparent",
  color: "var(--primary)",
  cursor: "pointer"
};

const dangerButtonStyle = {
  padding: "8px 14px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  fontWeight: 600,
  fontSize: "0.85rem",
  background: "transparent",
  color: "var(--danger)",
  cursor: "pointer"
};

const invoiceTableStyles = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
  tableLayout: "fixed"
};

const invoiceHeaderCellStyle = {
  padding: "12px 16px",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  background: "var(--surface)"
};

const invoiceCellStyle = {
  padding: "16px",
  fontSize: "0.95rem",
  color: "var(--text-1)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const invoiceRowStyle = {
  background: "var(--surface)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)"
};

const createDefaultInvoiceForm = (invoiceDate) => ({
  supplierAccountId: "",
  supplierAccountNumber: "",
  supplierName: "",
  supplierAddress: "",
  supplierContact: "",
  invoiceNumber: "",
  deliveryNoteNumber: "",
  invoiceDate,
  notes: "",
  priceLevel: "stock_order_rate"
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
  { label: "Sale 4", price: "" }],

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
  notes: ""
});

const parseDocumentFields = (text = "") => {
  if (!text) return {};
  const invoiceMatch = text.match(/invoice\s*(?:no\.|number)?[:#]?\s*([A-Za-z0-9-]+)/i);
  const deliveryMatch = text.match(/delivery\s*(?:note|number|no\.)[:#]?\s*([A-Za-z0-9-]+)/i);
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  return {
    invoiceNumber: invoiceMatch?.[1] || "",
    deliveryNoteNumber: deliveryMatch?.[1] || "",
    invoiceDateGuess: dateMatch?.[1] || ""
  };
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

function GoodsInPage() {
  const router = useRouter();
  const { user, dbUserId, authUserId } = useUser();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [invoiceForm, setInvoiceForm] = useState(() => createDefaultInvoiceForm(todayIso));
  const [invoiceScanPayload, setInvoiceScanPayload] = useState(null);
  const [goodsInRecord, setGoodsInRecord] = useState(null);
  const [goodsInItems, setGoodsInItems] = useState([]);
  const [showBinSuggestions, setShowBinSuggestions] = useState(false);
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
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [partError, setPartError] = useState("");
  const fileInputRef = useRef(null);

  const filteredBinLocations = useMemo(() => {
    const query = String(partForm.binLocation || "").trim().toLowerCase();
    if (!query) return BIN_LOCATION_OPTIONS;

    // Keep all locations visible, but rank search hits to the top of the list.
    const startsWithMatches = [];
    const containsMatches = [];
    const remaining = [];

    BIN_LOCATION_OPTIONS.forEach((location) => {
      const normalized = location.toLowerCase();
      if (normalized.startsWith(query)) {
        startsWithMatches.push(location);
      } else if (normalized.includes(query)) {
        containsMatches.push(location);
      } else {
        remaining.push(location);
      }
    });

    return [...startsWithMatches, ...containsMatches, ...remaining];
  }, [partForm.binLocation]);

  const GOODS_IN_ROLES = useMemo(
    () =>
    new Set([
    "parts",
    "parts manager",
    "service",
    "service manager",
    "workshop manager",
    "after sales manager",
    "aftersales manager"]
    ),
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

  const fetchGoodsIn = useCallback(
    async (lookupValue) => {
      try {
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
          supplierAccountNumber: prev.supplierAccountNumber || "",
          supplierName: payload.goodsIn?.supplier_name || "",
          supplierAddress: payload.goodsIn?.supplier_address || "",
          invoiceNumber: payload.goodsIn?.invoice_number || "",
          deliveryNoteNumber: payload.goodsIn?.delivery_note_number || "",
          invoiceDate: payload.goodsIn?.invoice_date || todayIso,
          notes: payload.goodsIn?.notes || "",
          priceLevel: payload.goodsIn?.price_level || "stock_order_rate"
        }));
      } catch (error) {
        console.error(error);
        setToast({ type: "error", message: error.message });
      }
    },
    [todayIso]
  );

  const preselectedGoodsIn = router.query?.goodsIn;
  useEffect(() => {
    if (!router.isReady || !preselectedGoodsIn) return;
    fetchGoodsIn(preselectedGoodsIn);
  }, [fetchGoodsIn, preselectedGoodsIn, router.isReady]);

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
      [group]: { ...prev[group], [field]: value }
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

  const ensureInvoiceReady = useCallback(() => {
    if (!invoiceForm.supplierName.trim()) {
      const message = "Supplier name is required before adding parts";
      setToast({ type: "error", message });
      setPartError(message);
      return false;
    }
    if (!invoiceForm.supplierAccountId) {
      const message = invoiceForm.supplierAccountNumber ?
      "Supplier account is missing a linked ledger account. Open the supplier and set a linked account." :
      "Supplier account is required before adding parts";
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
  }, [invoiceForm]);

  const ensureGoodsInRecord = useCallback(async () => {
    if (goodsInRecord?.id) return goodsInRecord;
    if (!ensureInvoiceReady()) return null;

    try {
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
          userNumericId: actingUserNumeric
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || payload?.error || "Unable to create goods-in record");
      }
      setGoodsInRecord(payload.goodsIn);
      setToast({ type: "success", message: `Goods in ${payload.goodsIn.goods_in_number} started` });
      return payload.goodsIn;
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: error.message });
      setPartError(error.message);
      return null;
    }
  }, [actingUserNumeric, actingUserUuid, ensureInvoiceReady, goodsInRecord, invoiceForm, invoiceScanPayload]);

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
    partForm.vatRate === "custom" && partForm.vatRateCustomValue ?
    partForm.vatRateCustomValue :
    partForm.vatRate,
    quantity: partForm.quantity,
    salePrices: partForm.salePrices.
    map((entry, index) => ({
      tier: entry.label || `Sale ${index + 1}`,
      price: entry.price
    })).
    filter((entry) => entry.price),
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
    notes: partForm.notes
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
          userNumericId: actingUserNumeric
        })
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

  const doRemoveItem = async (itemId) => {
    try {
      setRemovingItemId(itemId);
      const response = await fetch(`/api/parts/goods-in/items/${itemId}`, {
        method: "DELETE"
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

  const handleRemoveItem = (itemId) => {
    if (!itemId) return;
    if (!goodsInRecord?.id) {
      setToast({ type: "error", message: "Start a goods-in record before removing lines" });
      return;
    }
    setConfirmDialog({
      message: "Remove this invoice line?",
      onConfirm: () => {
        setConfirmDialog(null);
        doRemoveItem(itemId);
      }
    });
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
        method: "POST"
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
          invoiceDate: nextDate
        };
      });
      setInvoiceScanPayload({
        fileName: file.name,
        extracted: parsed,
        preview: text.slice(0, 280)
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
      supplierAccountId: supplier.linked_account_id || "",
      supplierAccountNumber: supplier.account_number || "",
      supplierName: supplier.company_name || supplier.trading_name || supplier.account_number,
      supplierAddress: [
      supplier.billing_address_line1,
      supplier.billing_address_line2,
      supplier.billing_city,
      supplier.billing_postcode].

      filter(Boolean).
      join(", "),
      supplierContact: supplier.contact_phone || supplier.contact_email || ""
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
      costPrice: part.unit_cost ? String(part.unit_cost) : prev.costPrice
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
    setGoodsInItems((prev) => {
      const merged = new Map(prev.map((item) => [item.id, item]));
      updatedItems.forEach((item) => {
        merged.set(item.id, item);
      });
      return Array.from(merged.values()).sort((a, b) => {
        const aLine = Number(a.line_number || 0);
        const bLine = Number(b.line_number || 0);
        return aLine - bLine;
      });
    });
    setToast({ type: "success", message: "Selected parts added to job" });
    setPartError("");
  };

  const handleFinishGoodsIn = () => {
    handleCompletionDismiss();
  };

  if (!hasGoodsInAccess) {
    return <GoodsInPageUi view="section1" />;







  }

  return <GoodsInPageUi view="section2" actingUserNumeric={actingUserNumeric} actingUserUuid={actingUserUuid} activeTab={activeTab} addPartFieldStyle={addPartFieldStyle} addPartInputStyle={addPartInputStyle} addressFieldStyle={addressFieldStyle} ADVANCED_TABS={ADVANCED_TABS} CalendarField={CalendarField} compactFieldWrapStyle={compactFieldWrapStyle} completing={completing} CompletionPrompt={CompletionPrompt} completionPromptOpen={completionPromptOpen} ConfirmationDialog={ConfirmationDialog} confirmDialog={confirmDialog} createDefaultPartForm={createDefaultPartForm} currencyFormatter={currencyFormatter} dangerButtonStyle={dangerButtonStyle} DropdownField={DropdownField} fetchGoodsIn={fetchGoodsIn} fieldGridStyle={fieldGridStyle} fileInputRef={fileInputRef} filteredBinLocations={filteredBinLocations} FRANCHISE_OPTIONS={FRANCHISE_OPTIONS} goodsInItems={goodsInItems} GoodsInPartSearchModal={GoodsInPartSearchModal} goodsInRecord={goodsInRecord} handleAddPart={handleAddPart} handleCompleteGoodsIn={handleCompleteGoodsIn} handleCompletionDismiss={handleCompletionDismiss} handleFinishGoodsIn={handleFinishGoodsIn} handleInvoiceChange={handleInvoiceChange} handleJobItemsAssigned={handleJobItemsAssigned} handleNestedPartChange={handleNestedPartChange} handlePartChange={handlePartChange} handlePartSelected={handlePartSelected} handleRemoveItem={handleRemoveItem} handleSalePriceChange={handleSalePriceChange} handleScanDocChange={handleScanDocChange} handleScanDocClick={handleScanDocClick} handleSupplierSelected={handleSupplierSelected} inputStyle={inputStyle} invoiceCellStyle={invoiceCellStyle} invoiceForm={invoiceForm} invoiceHeaderCellStyle={invoiceHeaderCellStyle} invoiceRowStyle={invoiceRowStyle} invoiceScanPayload={invoiceScanPayload} invoiceTableStyles={invoiceTableStyles} isAdvancedPanelOpen={isAdvancedPanelOpen} JobAssignmentModal={JobAssignmentModal} jobModalOpen={jobModalOpen} labelStyle={labelStyle} notesTextareaStyle={notesTextareaStyle} partError={partError} partForm={partForm} partSearchOpen={partSearchOpen} PRICE_LEVEL_OPTIONS={PRICE_LEVEL_OPTIONS} primaryButtonStyle={primaryButtonStyle} removingItemId={removingItemId} savingPart={savingPart} scanBusy={scanBusy} ScrollArea={ScrollArea} secondaryButtonStyle={secondaryButtonStyle} sectionCardStyle={sectionCardStyle} setActiveTab={setActiveTab} setCompletionPromptOpen={setCompletionPromptOpen} setConfirmDialog={setConfirmDialog} setIsAdvancedPanelOpen={setIsAdvancedPanelOpen} setJobModalOpen={setJobModalOpen} setPartForm={setPartForm} setPartSearchOpen={setPartSearchOpen} setShowBinSuggestions={setShowBinSuggestions} setSupplierModalOpen={setSupplierModalOpen} setTimeout={setTimeout} showBinSuggestions={showBinSuggestions} splitFieldRowStyle={splitFieldRowStyle} supplierModalOpen={supplierModalOpen} SupplierSearchModal={SupplierSearchModal} TabGroup={TabGroup} textareaStyle={textareaStyle} toast={toast} VAT_RATE_OPTIONS={VAT_RATE_OPTIONS} wideCompactFieldWrapStyle={wideCompactFieldWrapStyle} />;
















































































































































































































































































































































































































































































































































































































































































































































































































































































































}

function SupplierSearchModal({ onClose, onSelect, initialQuery = "" }) {
  useBodyModalLock(true);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchRequestRef = useRef(0);

  const searchSuppliers = useCallback(
    async (term = "") => {
      const requestId = ++searchRequestRef.current;
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (term.trim()) {
          params.set("q", term.trim());
        }
        params.set("limit", "30");
        const response = await fetch(`/api/parts/suppliers/search?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to search suppliers");
        }
        if (requestId !== searchRequestRef.current) {
          return;
        }
        const suppliers = payload.suppliers || [];
        setResults(suppliers);
        setError(suppliers.length ? "" : "No suppliers found");
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
    },
    []
  );

  useEffect(() => {
    const trimmed = initialQuery.trim();
    setQuery(initialQuery);
    if (!trimmed) {
      searchSuppliers("");
      return;
    }
    searchSuppliers(trimmed);
  }, [initialQuery, searchSuppliers]);

  const renderSupplierResults = () =>
  results.map((result, index) => {
    const missingLinkedAccount = !result.linked_account_id;
    const displayName = result.company_name || result.trading_name || result.account_number;
    const city = result.billing_city || "Unknown city";
    const phone = result.phone || result.telephone || result.mobile || "";
    const restingBorder = missingLinkedAccount ?
    "1px solid color-mix(in srgb, var(--danger) 30%, var(--surface))" :
    "1px solid var(--surface)";
    const restingBackground =
    "var(--surface)";

    return (
      <button
        key={result.account_number}
        style={{
          width: "100%",
          minHeight: "92px",
          textAlign: "left",
          padding: "14px",
          border: restingBorder,
          borderRadius: "var(--radius-md)",
          marginBottom: index === results.length - 1 ? 0 : "10px",
          cursor: "pointer",
          background: restingBackground,
          color: "var(--text-1)",
          boxShadow: "var(--shadow-sm)",
          transition: "background 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "var(--surface)";
          event.currentTarget.style.borderColor = missingLinkedAccount ? "var(--danger)" : "var(--primary)";
          event.currentTarget.style.transform = "translateY(-1px)";
          event.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = restingBackground;
          event.currentTarget.style.border = restingBorder;
          event.currentTarget.style.transform = "translateY(0)";
          event.currentTarget.style.zIndex = "0";
        }}
        onClick={() => {
          if (missingLinkedAccount) {
            setError(
              "Supplier account has no linked ledger account. Open the supplier and set a linked account."
            );
            return;
          }
          onSelect(result);
        }}>
        
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-1)" }}>{displayName}</div>
            <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--primary)",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 28%, var(--surface))",
              borderRadius: "var(--radius-pill)",
              padding: "3px 8px",
              whiteSpace: "nowrap"
            }}>
            
              {result.account_number}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", fontSize: "0.8rem" }}>
            <span
            style={{
              color: "var(--text-1)",
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px"
            }}>
            
              {city}
            </span>
            {phone ?
          <span
            style={{
              color: "var(--text-1)",
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px"
            }}>
            
                {phone}
              </span> :
          null}
            <span
            style={{
              color: missingLinkedAccount ? "var(--danger)" : "var(--success)",
              background: missingLinkedAccount ?
              "color-mix(in srgb, var(--danger) 10%, transparent)" :
              "color-mix(in srgb, var(--success) 10%, transparent)",
              border: missingLinkedAccount ?
              "1px solid color-mix(in srgb, var(--danger) 28%, var(--surface))" :
              "1px solid color-mix(in srgb, var(--success) 28%, var(--surface))",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px",
              fontWeight: 600
            }}>
            
              {missingLinkedAccount ? "No linked ledger" : "Linked ledger"}
            </span>
          </div>
        </button>);

  });

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles}>
      <div
        className="popup-card"
        style={{
          ...popupCardStyles,
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: "760px",
          height: "620px",
          maxHeight: "90vh",
          padding: "24px",
          border: "none",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "var(--text-1)" }}>Supplier accounts</h3>
          <button onClick={onClose} style={{ ...secondaryButtonStyle, borderRadius: "var(--radius-sm)" }}>
            Close
          </button>
        </div>
        <div>
          <input
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            placeholder="Search name, account number, phone, or city"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              if (!nextValue.trim()) {
                searchSuppliers("");
                return;
              }
              searchSuppliers(nextValue);
            }} />
          
        </div>
        <div
          style={{
            border: "none",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            padding: "10px",
            minHeight: "392px",
            maxHeight: "392px",
            overflowY: "auto"
          }}>
          
          {!query.trim() ?
          loading ?
          <div style={{ padding: "24px", textAlign: "center" }}>Loading suppliers...</div> :
          error ?
          <div style={{ padding: "12px", color: "var(--danger)" }}>{error}</div> :
          results.length ?
          renderSupplierResults() :

          <div style={{ padding: "12px", color: "var(--text-1)" }}>
                No supplier accounts available.
              </div> :

          loading ?
          <div style={{ padding: "24px", textAlign: "center" }}>Searching...</div> :
          error ?
          <div style={{ padding: "12px", color: "var(--danger)" }}>{error}</div> :

          renderSupplierResults()
          }
        </div>
      </div>
    </div>);

}

function GoodsInPartSearchModal({ onClose, onSelect, initialQuery = "" }) {
  useBodyModalLock(true);

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
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles}>
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
          onChange={(event) => setQuery(event.target.value)} />
        
        <div style={{ fontSize: "0.85rem", color: "var(--text-1)", marginTop: "8px" }}>
          {loading ? <InlineLoading width={140} label="Searching" /> : "Results update automatically as you type"}
        </div>
        {error && <div style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</div>}
        <div style={{ maxHeight: "420px", overflowY: "auto", marginTop: "12px" }}>
          {results.map((part) =>
          <button
            key={part.id}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              marginBottom: "8px",
              cursor: "pointer"
            }}
            onClick={() => onSelect(part)}>
            
              <div style={{ fontWeight: 600 }}>
                {part.part_number} · {part.name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>{part.description}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-1)" }}>
                {part.storage_location || "No bin"} · {part.supplier || "No supplier"}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>);

}

function JobAssignmentModal({ items, onClose, onAssigned, onFinish, actingUserUuid, actingUserNumeric }) {
  useBodyModalLock(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [jobResults, setJobResults] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedQuantities, setSelectedQuantities] = useState(() => new Map());
  const [pendingQuantities, setPendingQuantities] = useState(() => new Map());
  const [submitting, setSubmitting] = useState(false);

  const availableItems = useMemo(
    () => items.filter((item) => !item.added_to_job),
    [items]
  );

  useEffect(() => {
    setSelectedQuantities((prev) => {
      const next = new Map();
      availableItems.forEach((item) => {
        const currentQty = prev.get(item.id) || 0;
        const maxQty = Number(item.quantity || 0);
        const clamped = Math.min(maxQty, Math.max(0, currentQty));
        if (clamped > 0) {
          next.set(item.id, clamped);
        }
      });
      return next;
    });
    setPendingQuantities((prev) => {
      const next = new Map();
      availableItems.forEach((item) => {
        if (prev.has(item.id)) {
          next.set(item.id, prev.get(item.id));
        }
      });
      return next;
    });
  }, [availableItems]);

  const getSelectedQty = useCallback(
    (itemId) => selectedQuantities.get(itemId) || 0,
    [selectedQuantities]
  );

  const selectedRows = useMemo(
    () =>
    availableItems.
    map((item) => {
      const selectedQty = getSelectedQty(item.id);
      if (selectedQty <= 0) return null;
      return { item, selectedQty };
    }).
    filter(Boolean),
    [availableItems, getSelectedQty]
  );

  const remainingRows = useMemo(
    () =>
    availableItems.
    map((item) => {
      const totalQty = Number(item.quantity || 0);
      const selectedQty = getSelectedQty(item.id);
      const remainingQty = Math.max(0, totalQty - selectedQty);
      if (remainingQty <= 0) return null;
      return { item, remainingQty };
    }).
    filter(Boolean),
    [availableItems, getSelectedQty]
  );

  const searchJobs = useCallback(async (term, signal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ search: term, limit: "8" });
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
    if (selectedRows.length === 0) {
      setError("Select at least one part row");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const itemsToAssign = selectedRows.map(({ item, selectedQty }) => ({
        item,
        selectedQty
      }));
      const results = await Promise.allSettled(
        itemsToAssign.map(async ({ item, selectedQty }) => {
          const totalQty = Number(item.quantity || 0);
          const clampedQty = Math.max(0, Math.min(totalQty, Number(selectedQty || 0)));

          const patchItem = async (itemId, body) => {
            const response = await fetch(`/api/parts/goods-in/items/${itemId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });
            const payload = await response.json();
            if (!response.ok || !payload?.success) {
              throw new Error(payload?.message || "Unable to update goods-in item");
            }
            return payload.item;
          };

          if (clampedQty === 0) {
            return null;
          }

          if (clampedQty >= totalQty) {
            return patchItem(item.id, {
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
                  quantity: clampedQty
                }
              }
            });
          }

          const remainingQty = Math.max(0, totalQty - clampedQty);
          const updatedOriginal = await patchItem(item.id, { quantity: remainingQty });

          const createResponse = await fetch(`/api/parts/goods-in/${item.goods_in_id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partId: item.part_catalog_id,
              partNumber: item.part_number,
              mainPartNumber: item.main_part_number,
              description: item.description,
              binLocation: item.bin_location,
              franchise: item.franchise,
              retailPrice: item.retail_price,
              costPrice: item.cost_price,
              discountCode: item.discount_code,
              surcharge: item.surcharge,
              quantity: clampedQty,
              claimNumber: item.claim_number,
              packSize: item.pack_size,
              vatRate: item.vat_rate,
              salePrices: item.sales_prices,
              purchaseDetails: item.purchase_details,
              dealerDetails: item.dealer_details,
              stockDetails: item.stock_details,
              userDefined: item.user_defined,
              linkMetadata: item.link_metadata,
              salesHistory: item.sales_history,
              audiMetadata: item.audi_metadata,
              additionalFields: item.additional_fields,
              onlineStore: item.online_store,
              customAttributes: item.attributes,
              notes: item.notes,
              userId: actingUserUuid,
              userNumericId: actingUserNumeric
            })
          });
          const createdPayload = await createResponse.json();
          if (!createResponse.ok || !createdPayload?.success) {
            throw new Error(createdPayload?.message || "Unable to create split goods-in item");
          }

          const createdItem = createdPayload.item;
          const patchedCreated = await patchItem(createdItem.id, {
            addedToJob: true,
            jobNumber: selectedJob.job_number,
            jobId: selectedJob.id,
            jobAllocationPayload: {
              customer: selectedJob.customer,
              description: selectedJob.description,
              part: {
                partNumber: createdItem.part_number,
                description: createdItem.description,
                costPrice: createdItem.cost_price,
                retailPrice: createdItem.retail_price,
                quantity: clampedQty
              }
            }
          });

          return [updatedOriginal, patchedCreated];
        })
      );

      const successful = results.
      filter((result) => result.status === "fulfilled").
      flatMap((result) => {
        const value = result.value;
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
      });
      const failed = results.filter((result) => result.status === "rejected");

      if (successful.length) {
        onAssigned(successful);
        setSelectedQuantities(new Map());
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

  const handleSelectAll = () => {
    const next = new Map();
    availableItems.forEach((item) => {
      const qty = Number(item.quantity || 0);
      if (qty > 0) {
        next.set(item.id, qty);
      }
    });
    setSelectedQuantities(next);
  };

  const handleClearAll = () => {
    setSelectedQuantities(new Map());
  };

  const updateSelectedQty = (item, nextValue) => {
    const totalQty = Number(item.quantity || 0);
    const parsed = Number(nextValue);
    const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(totalQty, parsed)) : 0;
    setSelectedQuantities((prev) => {
      const next = new Map(prev);
      if (clamped <= 0) {
        next.delete(item.id);
      } else {
        next.set(item.id, clamped);
      }
      return next;
    });
  };

  const addToSelected = (item, rawValue) => {
    const totalQty = Number(item.quantity || 0);
    const parsed = Number(rawValue);
    const addQty = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    if (addQty <= 0) return;
    setSelectedQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(item.id) || 0;
      const clamped = Math.min(totalQty, current + addQty);
      next.set(item.id, clamped);
      return next;
    });
  };

  const modalSectionStyle = {
    background: "var(--surface)",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  };

  const jobCardStyle = (isSelected) => ({
    width: "100%",
    textAlign: "left",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    marginBottom: "8px",
    cursor: "pointer",
    background: isSelected ? "var(--surface)" : "var(--surface)",
    color: "var(--text-1)"
  });

  const formatJobType = (value = "") => {
    const text = String(value || "").trim();
    if (!text) return "General";
    return text.
    split(/[_\s]+/).
    filter(Boolean).
    map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()).
    join(" ");
  };

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles}>
      <div
        style={{
          ...popupCardStyles,
          padding: "24px",
          maxWidth: "980px",
          width: "min(98vw, 980px)",
          overflow: "visible"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>Add goods-in parts to a job</h3>
          <button onClick={onClose} style={secondaryButtonStyle} disabled={submitting}>
            Cancel
          </button>
        </div>
        <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
          <div style={modalSectionStyle}>
            <input
              style={inputStyle}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="e.g., GJ12345, AB12CDE, Jane Smith"
              disabled={submitting} />
            
            {loading && <InlineLoading width={120} label="Searching" />}
            {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
            <div>
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
                    disabled={submitting}>
                    
                    <div style={{ fontWeight: 700 }}>
                      {job.job_number || "No job"} · {job.vehicle_reg || "No reg"} · {job.customer || "Unknown customer"}
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--text-1)" }}>
                      Job type: {formatJobType(job.type)}
                    </div>
                  </button>);

              })}
            </div>
            {selectedJob &&
            <div style={{ fontSize: "0.9rem", color: "var(--text-1)" }}>
                Selected job: <strong>{selectedJob.job_number}</strong>
              </div>
            }
          </div>
          <div style={modalSectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>Selected for job</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={secondaryButtonStyle}
                  onClick={handleSelectAll}
                  disabled={availableItems.length === 0 || submitting}>
                  
                  Select all
                </button>
                <button
                  style={secondaryButtonStyle}
                  onClick={handleClearAll}
                  disabled={selectedRows.length === 0 || submitting}>
                  
                  Clear
                </button>
              </div>
            </div>
            {availableItems.length === 0 ?
            <div style={{ color: "var(--text-1)" }}>
                All parts from this goods-in are already linked to a job.
              </div> :
            selectedRows.length === 0 ? null :
            <div
              style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden"
              }}>
              
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--surface)" }}>
                    <tr>
                      <th style={{ ...invoiceHeaderCellStyle, width: "90px" }}>Remove</th>
                      <th style={invoiceHeaderCellStyle}>Part number</th>
                      <th style={invoiceHeaderCellStyle}>Description</th>
                      <th style={{ ...invoiceHeaderCellStyle, width: "100px" }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRows.map(({ item, selectedQty }) =>
                  <tr key={item.id} style={{ borderTop: "1px solid var(--surface)" }}>
                        <td style={{ ...invoiceCellStyle, width: "90px" }}>
                          <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => updateSelectedQty(item, 0)}
                        disabled={submitting}>
                        
                            Remove
                          </button>
                        </td>
                        <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}</td>
                        <td style={{ ...invoiceCellStyle, color: "var(--text-1)" }}>{item.description}</td>
                        <td style={{ ...invoiceCellStyle, width: "100px" }}>
                          <input
                        type="number"
                        min="0"
                        max={item.quantity || 0}
                        style={{ ...inputStyle, width: "6ch" }}
                        value={selectedQty}
                        onChange={(event) => updateSelectedQty(item, event.target.value)}
                        disabled={submitting} />
                      
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            }
            <div style={{ marginTop: "12px", fontWeight: 600 }}>Available to select</div>
            {remainingRows.length === 0 ?
            <div style={{ color: "var(--text-1)" }}>No remaining quantities to select.</div> :

            <div
              style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden"
              }}>
              
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--surface)" }}>
                    <tr>
                      <th style={{ ...invoiceHeaderCellStyle, width: "90px" }}>Add</th>
                      <th style={invoiceHeaderCellStyle}>Part number</th>
                      <th style={invoiceHeaderCellStyle}>Description</th>
                      <th style={{ ...invoiceHeaderCellStyle, width: "90px" }}>Avail</th>
                      <th style={{ ...invoiceHeaderCellStyle, width: "110px" }}>Add qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainingRows.map(({ item, remainingQty }) => {
                    const pendingValue = pendingQuantities.get(item.id) ?? "1";
                    return (
                      <tr key={item.id} style={{ borderTop: "1px solid var(--surface)" }}>
                          <td style={{ ...invoiceCellStyle, width: "90px" }}>
                            <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => {
                              addToSelected(item, pendingValue);
                              setError("");
                            }}
                            disabled={submitting}>
                            
                              Add
                            </button>
                          </td>
                          <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}</td>
                          <td style={{ ...invoiceCellStyle, color: "var(--text-1)" }}>{item.description}</td>
                          <td style={{ ...invoiceCellStyle, width: "90px" }}>{remainingQty}</td>
                          <td style={{ ...invoiceCellStyle, width: "110px" }}>
                            <input
                            type="number"
                            min="1"
                            max={remainingQty}
                            style={{ ...inputStyle, width: "7ch" }}
                            value={pendingValue}
                            onChange={(event) => {
                              setPendingQuantities((prev) => {
                                const next = new Map(prev);
                                next.set(item.id, event.target.value);
                                return next;
                              });
                            }}
                            disabled={submitting} />
                          
                          </td>
                        </tr>);

                  })}
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
          <button style={secondaryButtonStyle} onClick={onFinish} disabled={submitting}>
            Finish
          </button>
          <button
            style={primaryButtonStyle(submitting)}
            onClick={handleAssign}
            disabled={submitting || selectedRows.length === 0}>
            
            {submitting ? "Adding..." : "Add selected to job"}
          </button>
        </div>
      </div>
    </div>);

}

function CompletionPrompt({ goodsInNumber, onAddToJob, onClose }) {
  useBodyModalLock(true);

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles}>
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
    </div>);

}

export default GoodsInPage;
