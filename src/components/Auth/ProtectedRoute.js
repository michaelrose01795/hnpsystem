"use client";
import { useUser } from "@/context/UserContext";

export default function ProtectedRoute({ allowedRoles, children }) {
  const { hasAccess } = useUser();

  if (!hasAccess(allowedRoles)) {
    return (
      <div className="p-6 text-center text-red-600 font-bold">
        Access Denied. You do not have permission to view this page.
      </div>
    );
  }

  return children;
}