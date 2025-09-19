"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function MessagingChat() {
  const { id } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // Placeholder chat data
  const chatHistory = {
    1: [
      { sender: "Technician A", text: "Car #4521 is waiting for parts." },
      { sender: "Parts Dept", text: "Parts will be here at 2pm." },
    ],
    2: [
      { sender: "Reception", text: "Customer Smith has arrived." },
      { sender: "Workshop", text: "Assigning MOT test now." },
    ],
    3: [
      { sender: "Parts Dept", text: "Inventory updated." },
      { sender: "Service", text: "Thanks, noted." },
    ],
    4: [
      { sender: "Sales A", text: "Car ABC123 reserved for customer." },
      { sender: "Manager", text: "Approve finance today." },
    ],
  };

  useEffect(() => {
    if (id && chatHistory[id]) {
      setMessages(chatHistory[id]);
    }
  }, [id]);

  const handleSend = () => {
    if (input.trim() === "") return;
    setMessages([...messages, { sender: "You", text: input }]);
    setInput("");
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Chat #{id}</h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "1rem",
          height: "300px",
          overflowY: "auto",
          marginBottom: "1rem",
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: "0.5rem" }}>
            <strong>{msg.sender}: </strong>
            {msg.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button onClick={handleSend} style={{ padding: "0.5rem 1rem" }}>
          Send
        </button>
      </div>
    </div>
  );
}