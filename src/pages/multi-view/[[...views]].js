// file location: src/pages/multi-view/[[...views]].js
//
// The address the multi-workspace shell shows while the page-card area is split
// into cards, e.g. /multi-view/messages-job-cards.12345 (see multiViewHref in
// src/features/workspaces/workspaceModel.js). It is not a page of its own:
// WorkspaceHost (mounted by StaffLayout) renders the cards in its place and, on
// a fresh load, opens the cards the URL names or falls back to one page.
//
// This body only shows in the moment before that happens, or if the shell
// cannot start (signed out, window too narrow), so it offers a way out.

import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

export default function MultiViewPage() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Multi view</title>
      </Head>
      <EmptyState
        variant="page"
        title="Opening multi view…"
        description="Your page cards will appear here in a moment."
        action={
          <Button variant="secondary" symbol={false} onClick={() => router.replace("/newsfeed")}>
            Go to News Feed
          </Button>
        }
      />
    </>
  );
}
