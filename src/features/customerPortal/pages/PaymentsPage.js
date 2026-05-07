// file location: src/features/customerPortal/pages/PaymentsPage.js
import React from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import PaymentMethodsCard from "@/features/customerPortal/components/PaymentMethodsCard";
import PaymentPlansCard from "@/features/customerPortal/components/PaymentPlansCard";
import OutstandingInvoicesCard from "@/features/customerPortal/components/OutstandingInvoicesCard";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";

export default function CustomerPaymentsPage() {
  const {
    paymentMethods,
    paymentPlans,
    outstandingInvoices,
    customer,
    error,
    refreshPortalData,
  } = useCustomerPortalData();

  return (
    <CustomerLayout>
      {error && (
        <div className="rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      <DevLayoutSection
        sectionKey="customer-payments-row"
        parentKey="customer-portal-page-stack"
        sectionType="section-shell"
        backgroundToken="customer-payments-row"
        style={{
          display: "grid",
          gap: "var(--page-stack-gap)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          width: "100%",
        }}
      >
        <OutstandingInvoicesCard invoices={outstandingInvoices} />
        <PaymentPlansCard paymentPlans={paymentPlans} />
      </DevLayoutSection>
      <PaymentMethodsCard
        paymentMethods={paymentMethods}
        customerId={customer?.id}
        onPaymentMethodSaved={refreshPortalData}
      />
    </CustomerLayout>
  );
}
