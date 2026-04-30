import GoodsInPageUi from "@/components/page-ui/parts/parts-goods-in-ui";
import { demoParts } from "../demoData/demoParts";
import { MockPage } from "./_helpers";

const goodsInItems = demoParts.slice(0, 4).map((p, i) => ({
  id: `gi-${i + 1}`,
  part_number: p.part_number,
  description: p.description,
  qty: p.qty,
  unit_price: p.unit_price,
  supplier: p.supplier,
  bin_location: p.bin_location || "A12-3",
  job_number: p.job_number || null,
}));

export default function PartsGoodsInMock() {
  return (
    <MockPage
      Ui={GoodsInPageUi}
      overrides={{
        view: "section2",
        goodsInItems,
        goodsInRecord: { id: "gi-record-1", supplier: "AutoDirect", invoice_number: "INV-AD-1042", invoice_date: "2026-04-23", total: 482.5 },
        invoiceForm: { supplier: "AutoDirect", invoice_number: "INV-AD-1042", invoice_date: "2026-04-23", total: 482.5 },
        invoiceScanPayload: null,
        partForm: { part_number: "", description: "", qty: 1, unit_price: 0 },
        activeTab: "lines",
        ADVANCED_TABS: [],
        FRANCHISE_OPTIONS: [{ value: "vw", label: "Volkswagen" }],
        PRICE_LEVEL_OPTIONS: [{ value: "trade", label: "Trade" }, { value: "retail", label: "Retail" }],
        VAT_RATE_OPTIONS: [{ value: 0.2, label: "20%" }, { value: 0, label: "0%" }],
        completing: false,
        completionPromptOpen: false,
        confirmDialog: null,
        filteredBinLocations: [],
        isAdvancedPanelOpen: false,
        jobModalOpen: false,
        partError: "",
        partSearchOpen: false,
        savingPart: false,
        scanBusy: false,
        showBinSuggestions: false,
        supplierModalOpen: false,
        toast: null,
        removingItemId: null,
        currencyFormatter: (n) => `£${Number(n).toFixed(2)}`,
        createDefaultPartForm: () => ({ part_number: "", description: "", qty: 1, unit_price: 0 }),
        addPartFieldStyle: {},
        addPartInputStyle: {},
        addressFieldStyle: {},
        compactFieldWrapStyle: {},
        wideCompactFieldWrapStyle: {},
        dangerButtonStyle: {},
        primaryButtonStyle: {},
        secondaryButtonStyle: {},
        fieldGridStyle: {},
        labelStyle: {},
        inputStyle: {},
        notesTextareaStyle: {},
        textareaStyle: {},
        sectionCardStyle: {},
        splitFieldRowStyle: {},
        invoiceCellStyle: {},
        invoiceHeaderCellStyle: {},
        invoiceRowStyle: {},
        invoiceTableStyles: {},
      }}
    />
  );
}
