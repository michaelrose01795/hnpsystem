//file: src/app/login/LoginForm.js
//notes: Login form with role dropdown (temporary until auto-role mapping)

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function LoginForm() {
  const { login } = useUser();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("WORKSHOP"); // default

  const handleSubmit = (e) => {
    e.preventDefault();
    login(username, role); // save in context
    router.push("/"); // redirect to home
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "300px" }}>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      {/* Temporary role dropdown */}
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">Admin</option>
        <option value="SALES">Sales</option>
        <option value="WORKSHOP">Workshop</option>
        <option value="PARTS">Parts</option>
        <option value="MANAGER">Manager</option>
      </select>

      <button type="submit">Login</button>
    </form>
  );
}