// file location: src/pages/vision/index.js
// Standalone mock-only Vision home. No live DMS data, APIs, auth, or Supabase.

import React from "react";
import Layout from "@/components/Layout";
import VisionLayout from "@/features/vision/components/VisionLayout";
import { VisionHome } from "@/features/vision/components/VisionViews";

function VisionIndexPage() {
  return (
    <VisionLayout
      title="H&P DMS Vision"
      description="A mock-only future vision area showing how an intelligent dealership operating system could coordinate departments, workflows, messages, summaries, and management insight. This section is isolated and does not affect live DMS data."
      slug=""
    >
      <VisionHome />
    </VisionLayout>
  );
}

VisionIndexPage.getLayout = (page) => <Layout publicRoute>{page}</Layout>;

export default VisionIndexPage;
