// file location: src/pages/vhc/details/[jobNumber].js
"use client";

import React from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import VhcDetailsPanel from "@/components/VHC/VhcDetailsPanel";

export default function VhcDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  return (
    <Layout>
      <VhcDetailsPanel jobNumber={jobNumber} />
    </Layout>
  );
}
