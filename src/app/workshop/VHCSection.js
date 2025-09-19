"use client";
import { useState } from "react";

export default function VHCSection({ sectionName, onAddIssue }) {
  const [issues, setIssues] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [measurement, setMeasurement] = useState("");

  const handleAdd = () => {
    if (!title) return alert("Please enter a problem title");
    const newIssue = { title, description, measurement };
    setIssues((prev) => [...prev, newIssue]);
    if (onAddIssue) onAddIssue(sectionName, newIssue);
    setTitle(""); setDescription(""); setMeasurement("");
  };

  return (
    <div className="p-4 border rounded bg-white shadow-md mb-4">
      <h3 className="text-lg font-semibold mb-2">{sectionName}</h3>

      <div className="mb-2">
        <input
          type="text"
          placeholder="Problem Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-2 py-1 rounded mb-1"
        />
        <input
          type="text"
          placeholder="Description / Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border px-2 py-1 rounded mb-1"
        />
        <input
          type="text"
          placeholder="Measurement / Size (optional)"
          value={measurement}
          onChange={(e) => setMeasurement(e.target.value)}
          className="w-full border px-2 py-1 rounded mb-1"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mt-1"
        >
          Add Issue
        </button>
      </div>

      <div>
        {issues.length > 0 && (
          <ul className="list-disc pl-5 mt-2">
            {issues.map((issue, idx) => (
              <li key={idx}>
                <strong>{issue.title}</strong> {issue.description && `- ${issue.description}`} {issue.measurement && `(Measurement: ${issue.measurement})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}