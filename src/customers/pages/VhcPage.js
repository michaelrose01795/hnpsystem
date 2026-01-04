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
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
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
