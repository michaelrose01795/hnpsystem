// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/MessagesPage.js
import React from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import MessagingHub from "@/customers/components/MessagingHub";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { messageContacts, appointmentTimeline } from "@/customers/data/placeholders";

export default function CustomerMessagesPage() {
  return (
    <CustomerLayout pageTitle="Messages">
      <div className="grid gap-6 lg:grid-cols-2">
        <MessagingHub contacts={messageContacts} />
        <AppointmentTimeline events={appointmentTimeline} />
      </div>
    </CustomerLayout>
  );
}
