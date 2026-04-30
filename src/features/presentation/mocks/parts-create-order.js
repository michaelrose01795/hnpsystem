import PartsJobCardPageUi from "@/components/page-ui/parts/create-order/parts-create-order-ui";
import { demoParts } from "../demoData/demoParts";
import { MockPage } from "./_helpers";

const partLines = demoParts.slice(0, 3).map((p, i) => ({
  id: `line-${i + 1}`,
  part_number: p.part_number,
  description: p.description,
  qty: p.qty,
  price: p.unit_price,
  line_total: p.qty * p.unit_price,
  supplier: p.supplier,
}));

export default function PartsCreateMock() {
  return (
    <MockPage
      Ui={PartsJobCardPageUi}
      overrides={{
        view: "section2",
        form: {
          first_name: "Alex",
          last_name: "Morgan",
          email: "alex.morgan@example.com",
          phone: "07700 900042",
          delivery_address: "12 High Street, Birmingham B1 1AA",
        },
        partLines,
        partSearchOpen: false,
        partSearchQuery: "",
        partSearchResults: [],
        partSearchLoading: false,
        deliverySameAsBilling: true,
        hasCustomerSelected: true,
        customerRecord: { id: "demo-cust-001", first_name: "Alex", last_name: "Morgan" },
        showExistingCustomer: false,
        showNewCustomer: false,
        isCustomerEditing: false,
        isDarkMode: false,
        loadingVehicle: false,
        saving: false,
        savingCustomerDetails: false,
        errorMessage: "",
        cardStyle: {},
        fieldStyle: {},
        inputStyle: {},
        sectionCardStyle: {},
        sectionHeaderStyle: {},
        twoColumnGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
        partLookupContentStyle: {},
        partLookupOverlayStyle: {},
      }}
    />
  );
}
