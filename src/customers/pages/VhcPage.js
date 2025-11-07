// file location: src/customers/pages/VhcPage.js
import React from "react";
import CustomerLayout from "../components/CustomerLayout";
import VHCSummaryList from "../components/VHCSummaryList";
import MessagingHub from "../components/MessagingHub";
import { vhcSummaries, messageContacts } from "../data/placeholders";

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
