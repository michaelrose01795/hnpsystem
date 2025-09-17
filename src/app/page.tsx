"use client";

import React from "react";
import "./home/Home.css";

export default function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to Humphries & Parks System</h1>

      <div className="dashboard-grid">
        {/* Dashboard Overview */}
        <div className="card">
          <h2>Dashboard Overview</h2>
          <ul>
            <li>Active Users: 40</li>
            <li>Active Jobs: 12</li>
            <li>Pending Parts Requests: 3</li>
          </ul>
        </div>

        {/* Workshop / Technician Pages */}
        <div className="card">
          <h2>Workshop</h2>
          <ul>
            <li><a href="/workshop/job-cards">Job Cards</a></li>
            <li><a href="/workshop/mot-checklist">MOT / Service Checklists</a></li>
            <li><a href="/workshop/parts-requests">Parts Requests</a></li>
            <li><a href="/workshop/clocking">Clocking / Time</a></li>
          </ul>
        </div>

        {/* Car Sales / Buying Pages */}
        <div className="card">
          <h2>Car Sales / Buying</h2>
          <ul>
            <li><a href="/sales/inventory">Car Inventory</a></li>
            <li><a href="/sales/progress">Sales Progress</a></li>
            <li><a href="/buying/requests">Buying Requests</a></li>
          </ul>
        </div>

        {/* Accounts / Finance */}
        <div className="card">
          <h2>Accounts</h2>
          <ul>
            <li><a href="/accounts/invoices">Invoices & Payments</a></li>
            <li><a href="/accounts/reports">Reports</a></li>
            <li><a href="/accounts/expenses">Expenses</a></li>
          </ul>
        </div>

        {/* Admin / Management */}
        <div className="card">
          <h2>Admin</h2>
          <ul>
            <li><a href="/admin/users">User Management</a></li>
            <li><a href="/admin/logs">Audit Logs</a></li>
            <li><a href="/admin/settings">Settings</a></li>
          </ul>
        </div>

        {/* Parts Department */}
        <div className="card">
          <h2>Parts</h2>
          <ul>
            <li><a href="/parts/inventory">Inventory Management</a></li>
            <li><a href="/parts/sales">Sales Tracking</a></li>
            <li><a href="/parts/approval">Approval Dashboard</a></li>
          </ul>
        </div>

        {/* Messaging / Notifications */}
        <div className="card">
          <h2>Messaging / Notifications</h2>
          <ul>
            <li><a href="/messages/inbox">Inbox</a></li>
            <li><a href="/messages/alerts">Alerts</a></li>
          </ul>
        </div>

        {/* Help / Training */}
        <div className="card">
          <h2>Help / Training</h2>
          <ul>
            <li><a href="/help/manuals">Manuals</a></li>
            <li><a href="/help/tutorials">Tutorials</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
