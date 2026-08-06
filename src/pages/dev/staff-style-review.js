import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import StaffStyleReviewPage from "@/features/staffStyleReview/StaffStyleReviewPage";
import { DEV_PLATFORM_ROLE } from "@/lib/auth/roles";

const ALLOWED = [DEV_PLATFORM_ROLE.toUpperCase()];

export default function DevStaffStyleReviewPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Staff Global Style Review — Developer Platform</title>
      </Head>
      <StaffStyleReviewPage />
    </ProtectedRoute>
  );
}

DevStaffStyleReviewPage.getLayout = withDevPlatformLayout();
