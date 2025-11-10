// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/VhcPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import VHCSummaryList from "@/customers/components/VHCSummaryList";
import MessagingHub from "@/customers/components/MessagingHub";
import { vhcSummaries, messageContacts } from "@/customers/data/placeholders";

export default function CustomerVhcPage() {
  return (
    <CustomerLayout pageTitle="Vehicle health checks">
      <div className="grid gap-6 lg:grid-cols-2">
        <VHCSummaryList summaries={vhcSummaries} />
        <MessagingHub contacts={messageContacts} />
      </div>
    </CustomerLayout>
  );
}
