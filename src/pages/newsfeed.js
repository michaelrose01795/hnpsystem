// file location: src/pages/newsfeed.js
import React from "react";
import Layout from "../components/Layout";

export default function NewsFeed() {
  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Global News Feed</h1>
      <div className="space-y-4">
        <p>Welcome to the company-wide news feed! All updates, announcements, and posts visible to all users will appear here.</p>
        {/* You can replace this with dynamic news feed items later */}
        <div className="p-4 bg-white shadow rounded">News item 1</div>
        <div className="p-4 bg-white shadow rounded">News item 2</div>
        <div className="p-4 bg-white shadow rounded">News item 3</div>
      </div>
    </Layout>
  );
}
