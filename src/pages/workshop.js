// file location: /src/pages/workshop.js
import React from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { useUser } from "../context/UserContext";

export default function WorkshopPage() {
  const { user } = useUser(); // get user from context

  return (
    <ProtectedRoute allowedRoles={["WORKSHOP"]}>
      <div style={{ padding: 20 }}>
        <h1>Workshop Dashboard</h1>
        <p>
          Welcome, {(user && user.username) || "technician"} — you have Workshop
          access.
        </p>
      </div>
    </ProtectedRoute>
  );
}
