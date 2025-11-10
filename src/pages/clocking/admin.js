// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/clocking/admin.js
import React from "react";
import Layout from "@/components/Layout";
import ClockingList from "@/components/Clocking/ClockingList";

export default function AdminClockingPage() {
  return (
    <Layout>
      <div className="p-6">
        <ClockingList />
      </div>
    </Layout>
  );
}
