"use client";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();

  if (!user) return <p>Please log in</p>;
  if (role && user.role !== role) return <p>Access Denied</p>;

  return children;
}