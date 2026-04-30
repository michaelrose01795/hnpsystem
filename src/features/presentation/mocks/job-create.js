import CreateJobCardPageUi from "@/components/page-ui/job-cards/create/job-cards-create-ui";
import { MockPage } from "./_helpers";

export default function JobCreateMock() {
  return (
    <MockPage
      Ui={CreateJobCardPageUi}
      overrides={{
        view: "section1",
        activeTabIndex: 0,
        jobTabs: [{ id: "tab-1", label: "Job 1" }],
        customer: { first_name: "Alex", last_name: "Morgan", phone_mobile: "07700 900042", email: "alex.morgan@example.com" },
        customerForm: { first_name: "Alex", last_name: "Morgan", phone_mobile: "07700 900042", email: "alex.morgan@example.com" },
        customerFieldDefinitions: [],
        customerNotification: null,
        vehicle: { reg: "DE24 XYZ", make: "Volkswagen", model: "Golf", year: 2024, mileage: 41280 },
        vehicleNotification: null,
        requests: [{ id: "r-1", label: "Major service" }, { id: "r-2", label: "Investigate front-end knock" }],
        populatedRequests: [{ id: "r-1", label: "Major service" }, { id: "r-2", label: "Investigate front-end knock" }],
        jobCategories: ["Service"],
        jobDetections: [],
        visibleJobDetections: [],
        questionPromptsIndex: {},
        jobCardSelectorOptions: [],
        jobSource: "walk-in",
        PAYMENT_TYPE_OPTIONS: [{ value: "card", label: "Card" }, { value: "cash", label: "Cash" }],
        cosmeticDamagePresent: false,
        cosmeticNotes: "",
        hasLinkedJobCards: false,
        isCustomerEditing: false,
        isLoadingVehicle: false,
        isMobileMechanic: false,
        isSavingCustomer: false,
        isSubJobMode: false,
        showDetectedRequestsPopup: false,
        showDocumentsPopup: false,
        showExistingCustomer: false,
        showNewCustomer: false,
        uploadedFiles: [],
        vhcRequired: true,
        waitingStatus: "waiting",
        washRequired: false,
        newCustomerPrefill: null,
        binaryToggleGroupStyle: { display: "inline-flex", gap: 8 },
        sectionCardStyle: {},
        jobInfoOptionGroupStyle: {},
      }}
    />
  );
}
