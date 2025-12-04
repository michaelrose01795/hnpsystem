"use client";

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

// file location: src/components/Timeline/JobTimeline.js
// Component: JobTimeline
// Description: Displays the ordered job status history as a vertical timeline tree.

export default function JobTimeline({ jobNumber }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobNumber) return;

    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobNumber}/timeline`);
        if (!res.ok) throw new Error("Failed to load timeline");
        const data = await res.json();
        setTimeline(data.timeline || []);
      } catch (err) {
        console.error("Timeline fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [jobNumber]);

  if (loading) {
    return <p style={{ color: "var(--border)", padding: "10px" }}>Loading job timeline...</p>;
  }

  if (error) {
    return <p style={{ color: "red", padding: "10px" }}>Error: {error}</p>;
  }

  if (!timeline.length) {
    return <p style={{ color: "var(--grey-accent-light)", padding: "10px" }}>No timeline data available.</p>;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Job Status Timeline</h3>
      <ul style={styles.timeline}>
        {timeline.map((event, index) => (
          <li key={index} style={styles.event}>
            <div style={styles.dot} />
            <div style={styles.content}>
              <p style={styles.status}>
                <strong>{event.status.replace(/-/g, " ").toUpperCase()}</strong>
              </p>
              <p style={styles.note}>{event.notes}</p>
              <p style={styles.meta}>
                Updated by {event.updated_by_firstname} {event.updated_by_lastname} at{" "}
                {new Date(event.status_time).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  container: {
    padding: "16px",
    borderLeft: "3px solid var(--danger)",
    backgroundColor: "var(--text-primary)",
    color: "var(--surface)",
    borderRadius: "6px",
    marginTop: "10px",
  },
  header: {
    marginBottom: "12px",
    borderBottom: "1px solid var(--danger)",
    paddingBottom: "4px",
  },
  timeline: { listStyle: "none", padding: 0, margin: 0 },
  event: { position: "relative", marginBottom: "18px", paddingLeft: "20px" },
  dot: {
    width: "10px",
    height: "10px",
    backgroundColor: "var(--danger)",
    borderRadius: "50%",
    position: "absolute",
    left: 0,
    top: "5px",
  },
  content: { marginLeft: "10px" },
  status: { margin: "0 0 2px", color: "var(--surface)" },
  note: { margin: "0 0 2px", fontSize: "0.9rem", color: "var(--background)" },
  meta: { fontSize: "0.8rem", color: "var(--grey-accent-light)" },
};

JobTimeline.propTypes = {
  jobNumber: PropTypes.string.isRequired,
};
