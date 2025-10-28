// src/pages/vhc/dashboard.js
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Layout from "../../components/Layout";
import VHCDetailsModal from "@/components/VHC/VHCDetailsModal";

// ✅ Reusable card component
const SectionCard = ({ title, subtitle, onClick }) => (
  <div
    className={`border p-4 rounded ${onClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
    onClick={onClick}
  >
    <h2 className="font-semibold">{title}</h2>
    <p className="text-gray-600">{subtitle}</p>
  </div>
);

const STATUS_TABS = [
  "All",
  "Outstanding",
  "Accepted",
  "In Progress",
  "Awaiting Authorization",
  "Authorized",
  "Ready",
  "Carry Over",
  "Complete",
];

export default function VHCDashboard() {
  const [vhcJobs, setVhcJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState({ reg: "", job_number: "", customer_name: "" });
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("vhc_checks").select("*");

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setVhcJobs(data || []);
      setLoading(false);
    };

    fetchVhcJobs();
  }, []);

  const filteredJobs = vhcJobs
    .filter((job) => filter === "All" || job.status === filter)
    .filter(
      (job) =>
        job.reg?.toLowerCase().includes(search.reg.toLowerCase()) &&
        job.job_number?.toString().includes(search.job_number) &&
        job.customer_name?.toLowerCase().includes(search.customer_name.toLowerCase())
    );

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-red-600">VHC Dashboard</h1>

        {/* Search section */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Search Reg"
            value={search.reg}
            onChange={(e) => setSearch({ ...search, reg: e.target.value })}
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            type="text"
            placeholder="Search Job Number"
            value={search.job_number}
            onChange={(e) => setSearch({ ...search, job_number: e.target.value })}
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            type="text"
            placeholder="Search Customer"
            value={search.customer_name}
            onChange={(e) => setSearch({ ...search, customer_name: e.target.value })}
            className="border rounded px-3 py-2 flex-1"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded font-bold whitespace-nowrap ${
                filter === status ? "bg-red-600 text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* VHC List as SectionCards */}
        {loading ? (
          <p className="text-gray-600">Loading VHC reports...</p>
        ) : filteredJobs.length === 0 ? (
          <p className="text-gray-600">No VHC reports found for this filter/search.</p>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <SectionCard
                key={job.job_number + job.id}
                title={`${job.reg || "N/A"} - ${job.customer_name || "N/A"} (${job.vehicle_make || "N/A"})`}
                subtitle={`Job #${job.job_number || "N/A"} | Status: ${job.status || "N/A"} | Tech: ${
                  job.technician_name || "N/A"
                } | Last Visit: ${job.last_visit || "First visit"} | MOT: ${job.mot_expiry || "N/A"} | Red: £${
                  job.red_work || "0.00"
                } | Amber: £${job.amber_work || "0.00"} | Authorized: £${job.authorized || "0.00"}`}
                onClick={() => setSelectedJob(job)}
              />
            ))}
          </div>
        )}

        {/* VHC Details Modal */}
        {selectedJob && (
          <VHCDetailsModal
            isOpen={!!selectedJob}
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    </Layout>
  );
}
