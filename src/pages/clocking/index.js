// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/clocking/index.js
import React from "react";
import Layout from "@/components/Layout";
import ClockingCard from "@/components/Clocking/ClockingCard";
import { ClockingProvider } from "@/context/ClockingContext";

export default function ClockingPage() {
  return (
    <ClockingProvider>
      <Layout>
        <div className="p-6">
          <ClockingCard />
        </div>
      </Layout>
    </ClockingProvider>
  );
}
