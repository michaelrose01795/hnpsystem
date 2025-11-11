// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/VhcPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import VHCSummaryList from "@/customers/components/VHCSummaryList";
import MessagingHub from "@/customers/components/MessagingHub";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

export default function CustomerVhcPage() {
  const { vhcSummaries, contacts, vehicles, isLoading, error } = useCustomerPortalData();

  return (
    <CustomerLayout pageTitle="Vehicle health checks">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[#ffe0e0] bg-white p-5 text-sm text-slate-500 shadow mb-4">
          Loading VHC updates…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
        <MessagingHub contacts={contacts} />
      </div>
    </CustomerLayout>
  );
}
