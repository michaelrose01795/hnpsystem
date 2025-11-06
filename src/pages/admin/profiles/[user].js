// file location: src/pages/admin/profiles/[user].js
import React from "react";
import { useRouter } from "next/router";
import { ProfilePage } from "../../profile";

export default function AdminProfilePreview() {
  const router = useRouter();
  const username = typeof router.query.user === "string" ? router.query.user : null;

  if (!router.isReady || !username) {
    return (
      <div style={{ padding: "16px", fontWeight: 600, color: "#6B7280" }}>
        Loading profile…
      </div>
    );
  }

  return (
    <ProfilePage
      forcedUserName={username}
      embeddedOverride
      adminPreviewOverride
    />
  );
}
