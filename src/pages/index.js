// file location: src/pages/index.js
import React from "react"; // import React
import Link from "next/link"; // import Next.js Link

// Default export must be a React component
export default function HomePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Welcome to H&P DMS</h1>
      <p>This is the home page. Please log in to continue.</p>
      <Link href="/login">
        <button style={{ marginTop: "1rem" }}>Go to Login</button>
      </Link>
    </div>
  );
}