//file: src/app/page.js
//notes: Homepage (accessible after login)

"use client";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login"); // redirect to login if not logged in
    }
  }, [user, router]);

  if (!user) return null; // avoid flash before redirect

  return (
    <main style={{ padding: 20 }}>
      <h1>Welcome, {user.username}!</h1>
      <p>You are logged in as: <b>{user.role}</b></p>
    </main>
  );
}