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
    <CustomerLayout pageTitle="Payments & Billing">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[#ffe0e0] bg-white p-5 text-sm text-slate-500 shadow">
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
