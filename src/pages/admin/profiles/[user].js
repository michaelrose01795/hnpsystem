// file location: src/pages/admin/profiles/[user].js
// ✅ Imports converted to use absolute alias "@/"
import React from "react";
import { useRouter } from "next/router";
import { ProfilePage } from "@/pages/profile";
import AdminProfilePreviewUi from "@/components/page-ui/admin/profiles/admin-profiles-user-ui"; // Extracted presentation layer.

export default function AdminProfilePreview() {
  const router = useRouter();
  const username = typeof router.query.user === "string" ? router.query.user : null;

  if (!router.isReady || !username) {
    return <AdminProfilePreviewUi view="section1" />;




  }

  return <AdminProfilePreviewUi view="section2" ProfilePage={ProfilePage} username={username} />;






}
