// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

import React from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import WriteUpForm from "@/components/JobCards/WriteUpForm";

export default function WriteUpPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  return (
    <Layout>
      <WriteUpForm jobNumber={jobNumber} showHeader={true} />
    </Layout>
  );
}
