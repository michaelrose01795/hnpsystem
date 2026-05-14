// file location: src/pages/vision/_components/VisionAreaPage.js
// Shared mock-only renderer for explicit /vision/* pages.

import React from "react";
import Layout from "@/components/Layout";
import VisionLayout from "./VisionLayout";
import {
  CommunicationLayerView,
  FuturePlatformView,
  GenericFeatureView,
  OperationalArchitectureView,
  RoadmapView,
  SystemMapView,
  WorkflowCoordinationView,
} from "./VisionViews";
import { featureGroups, visionNav } from "../_data/visionMockData";

const pageDescriptions = {
  "system-map": "A layered mock system map showing the future dealership as a connected operating system.",
  "workflow-coordination": "Interactive mock workflow events, dependency checks, generated tasks, message drafts, and status changes.",
  "operational-intelligence": "A mock architecture diagram for shared analysis, recommendations, summaries, trends, notifications, and memory.",
  "communication-layer": "A mock communication workspace for suggested drafts, internal replies, recipient suggestions, and linked job or customer context.",
  "future-platform": "A future architecture vision board for dealership-wide coordination, pressure modelling, scoring, and persistent operational memory.",
  roadmap: "A staged, mock-only roadmap from this isolated Vision section to a future coordination layer.",
};

function renderView(slug) {
  if (slug === "system-map") return <SystemMapView />;
  if (slug === "workflow-coordination") return <WorkflowCoordinationView />;
  if (slug === "operational-intelligence") return <OperationalArchitectureView />;
  if (slug === "communication-layer") return <CommunicationLayerView />;
  if (slug === "future-platform") return <FuturePlatformView />;
  if (slug === "roadmap") return <RoadmapView />;
  return <GenericFeatureView slug={slug} />;
}

export function createVisionAreaPage(slug) {
  function VisionAreaPage() {
    const navItem = visionNav.find((item) => item.slug === slug);
    const group = featureGroups[slug];

    return (
      <VisionLayout
        title={group?.title || navItem?.title || "Vision area"}
        description={pageDescriptions[slug] || group?.intro || "Mock-only Vision page isolated from the live DMS."}
        slug={slug}
      >
        {renderView(slug)}
      </VisionLayout>
    );
  }

  VisionAreaPage.getLayout = (page) => <Layout publicRoute>{page}</Layout>;

  return VisionAreaPage;
}
