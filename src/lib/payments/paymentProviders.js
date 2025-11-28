export const PAYMENT_PROVIDERS = [
  {
    id: "klarna",
    label: "Klarna",
    baseUrl: "https://checkout.klarna.com/pay"
  },
  {
    id: "bumper",
    label: "Bumper",
    baseUrl: "https://pay.bumper.co/checkout"
  },
  {
    id: "phone",
    label: "Over-the-phone card payment",
    baseUrl: "https://payments.ourshop.com/voice"
  },
  {
    id: "balance",
    label: "Balance payment (Customer portal)",
    baseUrl: "https://portal.ourbrand.com/pay"
  }
];

export const buildPaymentUrl = (provider, payload = {}) => {
  const amount = Number(payload.amount ?? 0).toFixed(2);
  const token = `${provider.id}-${payload.invoiceId}-${Date.now()}`;
  const params = new URLSearchParams({
    invoice: payload.invoiceId || "",
    job: payload.jobNumber || "",
    amount,
    token
  });

  return `${provider.baseUrl}?${params.toString()}`;
};
