"use client";
import React from "react";
import Link from "next/link";

export default function Messaging() {
  const chats = [
    { id: 1, name: "Workshop Group" },
    { id: 2, name: "Service Reception" },
    { id: 3, name: "Parts Department" },
    { id: 4, name: "Sales Team" },
  ];

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Messaging Hub</h1>
      <p>Chat with teams and departments.</p>

      <ul style={{ marginTop: "1rem" }}>
        {chats.map((chat) => (
          <li key={chat.id} style={{ marginBottom: "0.5rem" }}>
            <Link href={`/features/todos/MessagingChat/${chat.id}`}>
              {chat.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}