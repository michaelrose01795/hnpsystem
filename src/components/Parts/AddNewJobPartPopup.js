// file location: src/components/Parts/AddNewJobPartPopup.js
// Job-card popup for receiving a new part through the existing Goods In APIs
// and linking the received line directly to the active job.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";

const PRICE_LEVEL_OPTIONS = [
  { value: "stock_order_rate", label: "Stock order rate" },
  { value: "retail", label: "Retail" },
  { value: "trade", label: "Trade" },
  { value: "other", label: "Other" },
];

const FRANCHISE_OPTIONS = ["Mitsubishi", "Suzuki", "Stock", "Tyre", "Consumables"];

const VAT_RATE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "reduced", label: "Reduced" },
  { value: "zero", label: "Zero" },
  { value: "custom", label: "Custom" },
];

const ADVANCED_TABS = [
  { value: "global", label: "Global" },
  { value: "dealer", label: "Dealer" },
  { value: "stock", label: "Stock" },
  { value: "user", label: "User Defined" },
  { value: "links", label: "Links" },
  { value: "sales", label: "Sales History" },
  { value: "audi", label: "Audi" },
  { value: "additional", label: "Additional Fields" },
  { value: "online", label: "Online Store" },
];

const createInvoiceForm = () => ({
  supplierAccountId: "",
  supplierAccountNumber: "",
  supplierName: "",
  supplierAddress: "",
  supplierContact: "",
  invoiceNumber: "",
  deliveryNoteNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  priceLevel: "stock_order_rate",
  notes: "",
});

const createPartForm = () => ({
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
  customAttributes: { receivingDiscrepancy: "" },
  notes: "",
});

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
  gap: "var(--layout-card-gap)",
};

const labelStyle = {
  display: "block",
  marginBottom: "var(--space-2)",
  fontSize: "var(--text-label)",
  fontWeight: 600,
};

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function AddNewJobPartPopup({
  isOpen,
  jobId,
  jobNumber,
  actingUserId,
  actingUserNumericId,
  onClose,
  onAdded,
}) {
  const [invoiceForm, setInvoiceForm] = useState(createInvoiceForm);
  const [partForm, setPartForm] = useState(createPartForm);
  const [activeTab, setActiveTab] = useState("global");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingGoodsInId, setPendingGoodsInId] = useState(null);
  const [pendingItemCreated, setPendingItemCreated] = useState(false);
  const [pendingJobItemCreated, setPendingJobItemCreated] = useState(false);

  const reset = useCallback(() => {
    setInvoiceForm(createInvoiceForm());
    setPartForm(createPartForm());
    setActiveTab("global");
    setSupplierQuery("");
    setSupplierResults([]);
    setError("");
    setPendingGoodsInId(null);
    setPendingItemCreated(false);
    setPendingJobItemCreated(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    const query = supplierQuery.trim();
    if (!isOpen || query.length < 2 || invoiceForm.supplierAccountId) {
      setSupplierResults([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSupplierLoading(true);
      try {
        const response = await fetch(`/api/parts/suppliers/search?q=${encodeURIComponent(query)}&limit=8`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to search suppliers");
        }
        setSupplierResults(payload.suppliers || []);
      } catch (searchError) {
        if (searchError.name !== "AbortError") setError(searchError.message);
      } finally {
        if (!controller.signal.aborted) setSupplierLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [invoiceForm.supplierAccountId, isOpen, supplierQuery]);

  const setInvoiceField = (field, value) => {
    setInvoiceForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const setPartField = (field, value) => {
    setPartForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const setNestedPartField = (group, field, value) => {
    setPartForm((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value },
    }));
    setError("");
  };

  const selectSupplier = (supplier) => {
    if (!supplier?.linked_account_id) {
      setError("This supplier does not have a linked ledger account.");
      return;
    }
    const supplierName = supplier.company_name || supplier.trading_name || supplier.account_number;
    setInvoiceForm((current) => ({
      ...current,
      supplierAccountId: supplier.linked_account_id,
      supplierAccountNumber: supplier.account_number || "",
      supplierName,
      supplierAddress: [
        supplier.billing_address_line1,
        supplier.billing_address_line2,
        supplier.billing_city,
        supplier.billing_postcode,
      ].filter(Boolean).join(", "),
      supplierContact: supplier.contact_phone || supplier.contact_email || "",
    }));
    setSupplierQuery(supplierName);
    setSupplierResults([]);
    setError("");
  };

  const partPayload = useMemo(() => ({
    partNumber: partForm.partNumber.trim(),
    mainPartNumber: partForm.mainPartNumber.trim(),
    description: partForm.description.trim(),
    binLocation: partForm.binLocation.trim(),
    franchise: partForm.franchise,
    retailPrice: partForm.retailPrice || null,
    costPrice: partForm.costPrice || null,
    discountCode: partForm.discountCode.trim(),
    surcharge: partForm.surcharge || null,
    quantity: Number(partForm.quantity),
    claimNumber: partForm.claimNumber.trim(),
    packSize: partForm.packSize.trim(),
    vatRate: partForm.vatRate === "custom" ? partForm.vatRateCustomValue : partForm.vatRate,
    salePrices: partForm.salePrices
      .filter((entry) => entry.price !== "")
      .map((entry) => ({ tier: entry.label, price: entry.price })),
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
    notes: partForm.notes.trim(),
    addedToJob: true,
    jobId,
    jobNumber,
    jobAllocationPayload: {
      source: "job_card_goods_in_popup",
      part: {
        partNumber: partForm.partNumber.trim(),
        description: partForm.description.trim(),
        costPrice: partForm.costPrice || null,
        retailPrice: partForm.retailPrice || null,
        quantity: Number(partForm.quantity),
      },
    },
    userId: actingUserId,
    userNumericId: actingUserNumericId,
  }), [actingUserId, actingUserNumericId, jobId, jobNumber, partForm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!jobId || !jobNumber) {
      setError("The job card must be loaded before adding a part.");
      return;
    }
    if (!invoiceForm.supplierAccountId || !invoiceForm.supplierName) {
      setError("Select a supplier with a linked ledger account.");
      return;
    }
    if (!invoiceForm.invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }
    if (!partForm.partNumber.trim()) {
      setError("Part number is required.");
      return;
    }
    if (!Number.isFinite(Number(partForm.quantity)) || Number(partForm.quantity) <= 0) {
      setError("Quantity must be above zero.");
      return;
    }

    setSaving(true);
    try {
      let goodsInId = pendingGoodsInId;
      if (!goodsInId) {
        const createResponse = await fetch("/api/parts/goods-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...invoiceForm,
            userId: actingUserId,
            userNumericId: actingUserNumericId,
          }),
        });
        const createPayload = await createResponse.json();
        if (!createResponse.ok || !createPayload?.success) {
          throw new Error(createPayload?.message || "Unable to create the goods-in record");
        }
        goodsInId = createPayload.goodsIn.id;
        setPendingGoodsInId(goodsInId);
      }

      if (!pendingItemCreated) {
        const itemResponse = await fetch(`/api/parts/goods-in/${goodsInId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partPayload),
        });
        const itemResult = await itemResponse.json();
        if (!itemResponse.ok || !itemResult?.success) {
          throw new Error(itemResult?.message || "Unable to add the part to goods in");
        }
        setPendingItemCreated(true);
      }

      const completeResponse = await fetch(`/api/parts/goods-in/${goodsInId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: actingUserId, userNumericId: actingUserNumericId }),
      });
      const completePayload = await completeResponse.json();
      if (!completeResponse.ok || !completePayload?.success) {
        throw new Error(completePayload?.message || "Unable to complete goods in");
      }
      if (completePayload.catalogUpdates?.failed?.length) {
        throw new Error(completePayload.catalogUpdates.failed[0]?.error || "The part could not be added to the catalogue");
      }

      if (!pendingJobItemCreated) {
        const completedPart = (completePayload.catalogUpdates?.successful || []).find(
          (entry) => String(entry.partNumber || "").trim().toLowerCase() === partForm.partNumber.trim().toLowerCase()
        );
        if (!completedPart?.catalogId) {
          throw new Error("Goods in completed, but the new catalogue part could not be identified.");
        }

        const jobPartResponse = await fetch("/api/parts/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            partId: completedPart.catalogId,
            quantityRequested: Number(partForm.quantity),
            allocateFromStock: false,
            status: "stock",
            storageLocation: partForm.binLocation.trim() || null,
            unitCost: partForm.costPrice || null,
            unitPrice: partForm.retailPrice || null,
            requestNotes: `Received via Goods In and added from job card ${jobNumber}`,
            origin: "goods-in",
            userId: actingUserId,
            userNumericId: actingUserNumericId,
          }),
        });
        const jobPartPayload = await jobPartResponse.json();
        if (!jobPartResponse.ok || !jobPartPayload?.success) {
          throw new Error(jobPartPayload?.message || "The part was received but could not be added to the job");
        }
        setPendingJobItemCreated(true);
      }

      try {
        await onAdded?.({ partNumber: partForm.partNumber.trim(), goodsInId });
      } catch (refreshError) {
        console.warn("[AddNewJobPartPopup] Part saved but job refresh failed", refreshError);
      }
      reset();
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || "Unable to add the new part to this job");
    } finally {
      setSaving(false);
    }
  };

  const renderAdvancedFields = () => {
    if (activeTab === "global") {
      return (
        <div style={fieldGridStyle}>
          <Field label="Surcharge"><input className="app-input" inputMode="decimal" value={partForm.surcharge} onChange={(event) => setPartField("surcharge", event.target.value)} /></Field>
          <Field label="VAT rate">
            <DropdownField value={partForm.vatRate} onChange={(event) => setPartField("vatRate", event.target.value)} style={{ width: "100%" }}>
              {VAT_RATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </DropdownField>
          </Field>
          {partForm.vatRate === "custom" && <Field label="Custom VAT rate"><input className="app-input" value={partForm.vatRateCustomValue} onChange={(event) => setPartField("vatRateCustomValue", event.target.value)} /></Field>}
          <Field label="Claim number"><input className="app-input" value={partForm.claimNumber} onChange={(event) => setPartField("claimNumber", event.target.value)} /></Field>
          <Field label="Pack size"><input className="app-input" value={partForm.packSize} onChange={(event) => setPartField("packSize", event.target.value)} /></Field>
          <Field label="Stock order"><input className="app-input" value={partForm.purchaseDetails.stockOrder} onChange={(event) => setNestedPartField("purchaseDetails", "stockOrder", event.target.value)} /></Field>
          <Field label="VOR cost"><input className="app-input" value={partForm.purchaseDetails.vorCost} onChange={(event) => setNestedPartField("purchaseDetails", "vorCost", event.target.value)} /></Field>
          <Field label="Local cost"><input className="app-input" value={partForm.purchaseDetails.localCost} onChange={(event) => setNestedPartField("purchaseDetails", "localCost", event.target.value)} /></Field>
          <Field label="Receiving discrepancy">
            <DropdownField value={partForm.customAttributes.receivingDiscrepancy} onChange={(event) => setNestedPartField("customAttributes", "receivingDiscrepancy", event.target.value)} style={{ width: "100%" }}>
              <option value="">No discrepancy</option><option value="short_supplied">Short supplied</option><option value="over_supplied">Over supplied</option><option value="damaged">Damaged</option><option value="wrong_item">Wrong item</option>
            </DropdownField>
          </Field>
          {partForm.salePrices.map((entry, index) => (
            <Field key={entry.label} label={entry.label}>
              <input className="app-input" inputMode="decimal" value={entry.price} onChange={(event) => setPartForm((current) => ({ ...current, salePrices: current.salePrices.map((price, priceIndex) => priceIndex === index ? { ...price, price: event.target.value } : price) }))} />
            </Field>
          ))}
          <Field label="Line notes"><textarea className="app-input" rows={3} value={partForm.notes} onChange={(event) => setPartField("notes", event.target.value)} /></Field>
        </div>
      );
    }

    const groupFields = {
      dealer: [["dealerDetails", "dealerCode", "Dealer code"], ["dealerDetails", "tier", "Tier"], ["dealerDetails", "notes", "Dealer notes"]],
      stock: [["stockDetails", "reorderPoint", "Reorder point"], ["stockDetails", "binCapacity", "Bin capacity"], ["stockDetails", "alternateLocation", "Alternate location"]],
      user: [["userDefined", "field1", "Field 1"], ["userDefined", "field2", "Field 2"]],
      sales: [["salesHistory", "lastSoldOn", "Last sold on", "date"], ["salesHistory", "lastSoldPrice", "Last sold price"], ["salesHistory", "lastSoldQty", "Last sold quantity"]],
      audi: [["audiMetadata", "programme", "Programme"], ["audiMetadata", "reference", "Reference"], ["audiMetadata", "notes", "Audi notes"]],
      additional: [["additionalFields", "warranty", "Warranty"], ["additionalFields", "logistics", "Logistics"], ["additionalFields", "internalTag", "Internal tag"]],
    };

    if (groupFields[activeTab]) {
      return <div style={fieldGridStyle}>{groupFields[activeTab].map(([group, field, label, type = "text"]) => <Field key={`${group}-${field}`} label={label}><input type={type} className="app-input" value={partForm[group][field]} onChange={(event) => setNestedPartField(group, field, event.target.value)} /></Field>)}</div>;
    }

    if (activeTab === "links") {
      return <div style={{ display: "grid", gap: "var(--layout-card-gap)" }}>{partForm.linkMetadata.map((link, index) => <div key={`${link.label}-${index}`} style={fieldGridStyle}><Field label="Link label"><input className="app-input" value={link.label} onChange={(event) => setPartForm((current) => ({ ...current, linkMetadata: current.linkMetadata.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></Field><Field label="URL"><input className="app-input" type="url" value={link.url} onChange={(event) => setPartForm((current) => ({ ...current, linkMetadata: current.linkMetadata.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} /></Field></div>)}<Button type="button" variant="secondary" size="sm" onClick={() => setPartForm((current) => ({ ...current, linkMetadata: [...current.linkMetadata, { label: "", url: "" }] }))}>Add link</Button></div>;
    }

    return <div style={fieldGridStyle}><Field label="Visible in online store"><input className="app-toggle app-toggle--checkbox" type="checkbox" checked={partForm.onlineStore.isListed} onChange={(event) => setNestedPartField("onlineStore", "isListed", event.target.checked)} /></Field><Field label="Web title"><input className="app-input" value={partForm.onlineStore.webTitle} onChange={(event) => setNestedPartField("onlineStore", "webTitle", event.target.value)} /></Field><Field label="Web description"><textarea className="app-input" rows={3} value={partForm.onlineStore.webDescription} onChange={(event) => setNestedPartField("onlineStore", "webDescription", event.target.value)} /></Field><Field label="Online SKU"><input className="app-input" value={partForm.onlineStore.onlineSku} onChange={(event) => setNestedPartField("onlineStore", "onlineSku", event.target.value)} /></Field></div>;
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      closeOnBackdrop={!saving}
      ariaLabel={`Add a new part to job ${jobNumber || ""}`.trim()}
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(1120px, 100%)", padding: "var(--page-card-padding)", overflow: "hidden" }}
    >
      <form className="app-settings-popup" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", overflow: "hidden" }}>
        <header className="app-popup-compact-header">
          <div><h2 style={{ margin: 0 }}>Add new part</h2><p style={{ margin: "var(--space-1) 0 0", opacity: 0.72 }}>Receive and add directly to job {jobNumber}.</p></div>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm" busy={saving} disabled={saving}>Add part to job</Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>Close</Button>
          </div>
        </header>

        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>
          {error && <div className="app-status-message app-status-message--warning" role="alert">{error}</div>}

          <LayerTheme as="section" sectionKey="jobcard-parts-new-part-invoice" parentKey="shared-popup-card" gap="var(--layout-card-gap)">
            <h3 style={{ margin: 0 }}>Invoice details</h3>
            <div style={fieldGridStyle}>
              <Field label="Supplier">
                <input className="app-input" value={supplierQuery} onChange={(event) => { setSupplierQuery(event.target.value); setInvoiceForm((current) => ({ ...current, supplierAccountId: "", supplierAccountNumber: "", supplierName: "" })); }} placeholder="Search supplier accounts" autoComplete="off" />
                {supplierLoading && <small>Searching suppliers...</small>}
                {supplierResults.length > 0 && <LayerSurface radius="var(--radius-sm)" padding="var(--space-2)" gap="var(--space-1)" style={{ marginTop: "var(--space-2)", maxHeight: "180px", overflowY: "auto" }}>{supplierResults.map((supplier) => <Button key={supplier.account_number} type="button" variant="secondary" size="sm" disabled={!supplier.linked_account_id} onClick={() => selectSupplier(supplier)} style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}>{supplier.company_name || supplier.trading_name || supplier.account_number}{supplier.linked_account_id ? "" : " (ledger link required)"}</Button>)}</LayerSurface>}
                {invoiceForm.supplierAccountNumber && <small>Account #{invoiceForm.supplierAccountNumber}</small>}
              </Field>
              <Field label="Invoice number"><input className="app-input" required value={invoiceForm.invoiceNumber} onChange={(event) => setInvoiceField("invoiceNumber", event.target.value)} /></Field>
              <Field label="Delivery note number"><input className="app-input" value={invoiceForm.deliveryNoteNumber} onChange={(event) => setInvoiceField("deliveryNoteNumber", event.target.value)} /></Field>
              <Field label="Invoice date"><input className="app-input" type="date" required value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceField("invoiceDate", event.target.value)} /></Field>
              <Field label="Price level"><DropdownField value={invoiceForm.priceLevel} onChange={(event) => setInvoiceField("priceLevel", event.target.value)} style={{ width: "100%" }}>{PRICE_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownField></Field>
              <Field label="Supplier contact"><input className="app-input" value={invoiceForm.supplierContact} onChange={(event) => setInvoiceField("supplierContact", event.target.value)} /></Field>
              <Field label="Supplier address"><textarea className="app-input" rows={3} value={invoiceForm.supplierAddress} onChange={(event) => setInvoiceField("supplierAddress", event.target.value)} /></Field>
              <Field label="Invoice notes"><textarea className="app-input" rows={3} value={invoiceForm.notes} onChange={(event) => setInvoiceField("notes", event.target.value)} /></Field>
            </div>
          </LayerTheme>

          <LayerTheme as="section" sectionKey="jobcard-parts-new-part-details" parentKey="shared-popup-card" gap="var(--layout-card-gap)">
            <h3 style={{ margin: 0 }}>Part details</h3>
            <div style={fieldGridStyle}>
              <Field label="Part number"><input className="app-input" required autoComplete="off" value={partForm.partNumber} onChange={(event) => setPartField("partNumber", event.target.value)} /></Field>
              <Field label="Main part number"><input className="app-input" value={partForm.mainPartNumber} onChange={(event) => setPartField("mainPartNumber", event.target.value)} /></Field>
              <Field label="Description"><input className="app-input" value={partForm.description} onChange={(event) => setPartField("description", event.target.value)} /></Field>
              <Field label="Quantity"><input className="app-input" type="number" min="1" step="1" required value={partForm.quantity} onChange={(event) => setPartField("quantity", event.target.value)} /></Field>
              <Field label="Retail price"><input className="app-input" inputMode="decimal" value={partForm.retailPrice} onChange={(event) => setPartField("retailPrice", event.target.value)} /></Field>
              <Field label="Cost price"><input className="app-input" inputMode="decimal" value={partForm.costPrice} onChange={(event) => setPartField("costPrice", event.target.value)} /></Field>
              <Field label="Bin location"><input className="app-input" value={partForm.binLocation} onChange={(event) => setPartField("binLocation", event.target.value)} /></Field>
              <Field label="Discount code"><input className="app-input" value={partForm.discountCode} onChange={(event) => setPartField("discountCode", event.target.value)} /></Field>
              <Field label="Franchise"><DropdownField value={partForm.franchise} onChange={(event) => setPartField("franchise", event.target.value)} style={{ width: "100%" }}>{FRANCHISE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</DropdownField></Field>
            </div>
          </LayerTheme>

          <LayerTheme as="section" sectionKey="jobcard-parts-new-part-advanced" parentKey="shared-popup-card" gap="var(--layout-card-gap)">
            <h3 style={{ margin: 0 }}>Additional part information</h3>
            <TabGroup className="tab-api--wrap" devSectionKey="jobcard-parts-new-part-tabs" devSectionParent="jobcard-parts-new-part-advanced" items={ADVANCED_TABS} value={activeTab} onChange={setActiveTab} ariaLabel="Additional part information" />
            <LayerSurface radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">{renderAdvancedFields()}</LayerSurface>
          </LayerTheme>
        </div>
      </form>
    </PopupModal>
  );
}
