// file location: src/pages/dashboard.js
import React from "react";
import Layout from "../components/Layout";
import NewsFeed from "./newsfeed";

export default function Dashboard() {
  return (
    <Layout>
      <NewsFeed />
    </Layout>
  );
}
