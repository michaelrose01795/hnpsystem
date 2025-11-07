// file location: src/customers/pages/MessagesPage.js
import React from "react";
import CustomerLayout from "../components/CustomerLayout";
import MessagingHub from "../components/MessagingHub";
import AppointmentTimeline from "../components/AppointmentTimeline";
import { messageContacts, appointmentTimeline } from "../data/placeholders";

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
