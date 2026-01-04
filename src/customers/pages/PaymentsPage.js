// file location: src/customers/pages/PaymentsPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import PaymentMethodsCard from "@/customers/components/PaymentMethodsCard";
import PaymentPlansCard from "@/customers/components/PaymentPlansCard";
import OutstandingInvoicesCard from "@/customers/components/OutstandingInvoicesCard";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

export default function CustomerPaymentsPage() {
  const {
    paymentMethods,
    paymentPlans,
    outstandingInvoices,
    customer,
    isLoading,
    error,
    refreshPortalData,
  } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading your payment information…
        </div>
      ) : null}

      <div className="grid gap-6">
        <OutstandingInvoicesCard invoices={outstandingInvoices} />
        <PaymentPlansCard paymentPlans={paymentPlans} />
        <PaymentMethodsCard
          paymentMethods={paymentMethods}
          customerId={customer?.id}
          onPaymentMethodSaved={refreshPortalData}
        />
      </div>
    </CustomerLayout>
  );
}
