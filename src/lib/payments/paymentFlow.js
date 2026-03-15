export const PAYMENT_FLOW_METHODS = [
  {
    id: "card",
    label: "Card",
    category: "Point of sale",
    description: "Take payment in person using the card terminal.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "failed", "cancelled", "provider_declined", "timed_out"],
  },
  {
    id: "cash",
    label: "Cash",
    category: "Point of sale",
    description: "Capture cash received at the service desk and confirm change due.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "failed", "cancelled", "requires_follow_up"],
  },
  {
    id: "klarna",
    label: "Klarna",
    category: "Finance",
    description: "Initiate a Klarna payment journey and wait for provider approval.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "provider_declined", "cancelled", "timed_out"],
  },
  {
    id: "bumper",
    label: "Bumper",
    category: "Finance",
    description: "Start a Bumper application for split-pay or finance approval.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "provider_declined", "cancelled", "timed_out"],
  },
  {
    id: "phone",
    label: "Over-the-phone card payment",
    category: "Remote",
    description: "Log the operational steps needed to take payment securely over the phone.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "failed", "cancelled", "requires_follow_up"],
    backendTodo: "TODO: Replace simulated phone payment capture with a PCI-compliant MOTO gateway integration.",
  },
  {
    id: "balance",
    label: "Balance payment (Customer portal)",
    category: "Remote",
    description: "Publish the balance to the customer portal and wait for settlement.",
    settlesInvoice: true,
    defaultAmountMode: "invoice",
    allowedOutcomes: ["success", "awaiting_confirmation", "timed_out", "requires_follow_up"],
    backendTodo: "TODO: Replace simulated portal settlement with a real customer portal balance capture webhook.",
  },
  {
    id: "email",
    label: "Send invoice to customer email",
    category: "Communication",
    description: "Mark the invoice as sent to the customer's email address.",
    settlesInvoice: false,
    defaultAmountMode: "none",
    allowedOutcomes: ["success", "failed", "timed_out"],
  },
  {
    id: "portal_publish",
    label: "Publish invoice to customer portal balance",
    category: "Communication",
    description: "Publish the outstanding balance to the customer portal for later payment.",
    settlesInvoice: false,
    defaultAmountMode: "none",
    allowedOutcomes: ["success", "failed", "timed_out"],
  },
];

export const PAYMENT_FLOW_OUTCOMES = {
  connecting: { label: "Connecting", tone: "info" },
  awaiting_confirmation: { label: "Awaiting confirmation", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  success: { label: "Success", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "warning" },
  provider_declined: { label: "Provider declined", tone: "danger" },
  timed_out: { label: "Timed out", tone: "warning" },
  requires_follow_up: { label: "Requires follow-up", tone: "warning" },
};

export const PAYMENT_FLOW_STEPS = {
  card: ["connecting", "awaiting_confirmation", "processing"],
  cash: ["awaiting_confirmation", "processing"],
  klarna: ["connecting", "awaiting_confirmation", "processing"],
  bumper: ["connecting", "awaiting_confirmation", "processing"],
  phone: ["awaiting_confirmation", "processing"],
  balance: ["connecting", "awaiting_confirmation", "processing"],
  email: ["processing"],
  portal_publish: ["processing"],
};

export const findPaymentFlowMethod = (methodId) =>
  PAYMENT_FLOW_METHODS.find((method) => method.id === methodId) || PAYMENT_FLOW_METHODS[0];

