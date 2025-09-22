//file: src/components/ProtectedRoute.js
//notes: Wrap any page with this to require login

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function ProtectedRoute({ children }) {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login"); // redirect if not logged in
    }
  }, [user, router]);

  if (!user) return null; // prevents flash

  return children;
}