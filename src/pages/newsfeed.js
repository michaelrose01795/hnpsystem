// file location: src/pages/newsfeed.js
"use client";

import React, { useState } from "react"; // Import React and useState hook
import Layout from "../components/Layout"; // Import layout wrapper

export default function NewsFeed() {
  // Predefined updates — will later be fetched from database
  const [updates, setUpdates] = useState([
    {
      id: 1,
      title: "Workshop Clean-up & Tool Audit",
      author: "Tom — Service Manager",
      date: "October 21, 2025",
      department: "Workshop",
      content:
        "Reminder: full workshop clean-up and tool audit on Friday at 3 PM. Please ensure all shared tools are returned and bays are left clear by Thursday evening.",
    },
    {
      id: 2,
      title: "Record Sales Week — Thank You Team!",
      author: "Sarah — Sales Manager",
      date: "October 20, 2025",
      department: "Sales",
      content:
        "We’ve achieved a new milestone with 27 cars sold last week! Huge thanks to everyone, especially valeting and prep teams for their fast turnarounds.",
    },
    {
      id: 3,
      title: "Parts Stocktake Reminder",
      author: "Jamie — Parts Manager",
      date: "October 19, 2025",
      department: "Parts",
      content:
        "End-of-month stocktake will take place Tuesday morning. Please ensure all deliveries are logged before Monday afternoon.",
    },
  ]);

  const userIsManager = true; // Placeholder until Keycloak role-based permissions added

  // Group updates dynamically by department
  const groupedUpdates = updates.reduce((groups, update) => {
    if (!groups[update.department]) groups[update.department] = [];
    groups[update.department].push(update);
    return groups;
  }, {});

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#d10000" }}
          >
            Company News Feed
          </h1>

          {userIsManager && (
            <button
              onClick={() => alert("Manager post creation coming soon")}
              className="px-5 py-2 font-semibold text-white rounded-xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#d10000" }}
            >
              + Add Update
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-10 text-lg">
          Stay informed on the latest updates, events, and achievements from all departments.
        </p>

        {/* Department Sections */}
        <div className="space-y-10">
          {Object.keys(groupedUpdates).map((dept) => (
            <section
              key={dept}
              className="rounded-3xl shadow-lg p-8 border border-[#ffe5e5] transition-all duration-300 bg-gradient-to-br from-white via-[#fff9f9] to-[#ffecec] hover:shadow-2xl"
            >
              <h2
                className="text-2xl font-semibold mb-6 pb-2 border-b border-[#ffd6d6]"
                style={{ color: "#d10000" }}
              >
                {dept} Department
              </h2>

              <div className="flex flex-col gap-6">
                {groupedUpdates[dept].map((post) => (
                  <div
                    key={post.id}
                    className="rounded-2xl bg-white shadow-md p-6 border border-[#ffe5e5] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[#ffb3b3]"
                  >
                    {/* Title and Department Tag */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {post.title}
                      </h3>
                      <span
                        className="text-xs font-medium px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: "#fff0f0",
                          color: "#d10000",
                        }}
                      >
                        {post.department}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {post.content}
                    </p>

                    {/* Footer */}
                    <div className="flex justify-between text-sm text-gray-500 border-t border-gray-100 pt-3">
                      <span>{post.author}</span>
                      <span>{post.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
}
