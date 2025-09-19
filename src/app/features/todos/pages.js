"use client";
import React from "react";
import Link from "next/link";

export default function TodosPage() {
  return (
    <div style={{ padding: "1rem" }}>
      <h1>Todos Dashboard</h1>
      <p>Manage system-wide tasks and controls.</p>

      <ul>
        <li><Link href="/features/todos/UserManagement">User Management</Link></li>
        <li><Link href="/features/todos/RBAC">Role-Based Access Control (RBAC)</Link></li>
        <li><Link href="/features/todos/AuditLogs">Audit Logs</Link></li>
        <li><Link href="/features/todos/Notifications">Notification Center</Link></li>
        <li><Link href="/features/todos/Dashboard">Dashboard (KPIs)</Link></li>
        <li><Link href="/features/todos/Parts">Parts Module</Link></li>
        <li><Link href="/features/todos/Messaging">Messaging System</Link></li>
      </ul>
    </div>
  );
}