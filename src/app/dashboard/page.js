//file: src/app/dashboard/page.js
//notes: Example of protecting dashboard with ProtectedRoute

"use client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/context/UserContext";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <ProtectedRoute>
      <main style={{ padding: 20 }}>
        <h1>Dashboard</h1>
        <p>Welcome {user.username}, your role is <b>{user.role}</b></p>
      </main>
    </ProtectedRoute>
  );
}