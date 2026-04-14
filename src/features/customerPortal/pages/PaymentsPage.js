// file location: src/features/customerPortal/pages/PaymentsPage.js
import React from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import PaymentMethodsCard from "@/features/customerPortal/components/PaymentMethodsCard";
import PaymentPlansCard from "@/features/customerPortal/components/PaymentPlansCard";
import OutstandingInvoicesCard from "@/features/customerPortal/components/OutstandingInvoicesCard";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

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
