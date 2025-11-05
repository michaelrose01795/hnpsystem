"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";

const SAMPLE_THREADS = [
  {
    id: "t1",
    customer: "John Smith",
    subject: "Brake noise after service",
    jobNumber: "JOB-24015",
    lastMessage: "Could you confirm when the brake parts arrive?",
    updatedAt: "Today • 14:20",
    messages: [
      {
        id: "m1",
        sender: "customer",
        author: "John Smith",
        timestamp: "09:12",
        content: "Morning! Any update on my brake issue? The noise is getting louder.",
      },
      {
        id: "m2",
        sender: "staff",
        author: "H&P Workshop",
        timestamp: "10:05",
        content: "Hi John, parts are on order and due to arrive this afternoon.",
      },
      {
        id: "m3",
        sender: "customer",
        author: "John Smith",
        timestamp: "12:47",
        content: "Great, could you confirm once fitted? I need the car back by Friday.",
      },
    ],
  },
  {
    id: "t2",
    customer: "Sarah Patel",
    subject: "Collection time confirmation",
    jobNumber: "JOB-23988",
    lastMessage: "Thanks for confirming the MOT pass!",
    updatedAt: "Today • 11:45",
    messages: [
      {
        id: "m4",
        sender: "customer",
        author: "Sarah Patel",
        timestamp: "08:05",
        content: "Hello, what time can I collect the Fiesta today?",
      },
      {
        id: "m5",
        sender: "staff",
        author: "Service Desk",
        timestamp: "09:02",
        content: "Hi Sarah, MOT is complete and the car will be ready for 3pm collection.",
      },
      {
        id: "m6",
        sender: "customer",
        author: "Sarah Patel",
        timestamp: "09:20",
        content: "Perfect, thanks for confirming the MOT pass!",
      },
    ],
  },
  {
    id: "t3",
    customer: "Fleet Manager",
    subject: "Authorisation needed",
    jobNumber: "JOB-23941",
    lastMessage: "Approved the additional tyre work.",
    updatedAt: "Yesterday • 16:10",
    messages: [
      {
        id: "m7",
        sender: "staff",
        author: "Service Desk",
        timestamp: "14:55",
        content:
          "Hi there, we identified two front tyres below legal limit. Estimate attached for approval.",
      },
      {
        id: "m8",
        sender: "customer",
        author: "Fleet Manager",
        timestamp: "15:22",
        content: "Thanks, please proceed with front tyres and wheel alignment.",
      },
      {
        id: "m9",
        sender: "staff",
        author: "Service Desk",
        timestamp: "15:58",
        content: "Noted. Work added to job card and techs scheduled for tomorrow morning.",
      },
    ],
  },
];

const getBubbleStyles = (sender) => {
  if (sender === "staff") {
    return {
      alignSelf: "flex-end",
      backgroundColor: "#FF4040",
      color: "white",
      borderTopRightRadius: "6px",
      borderTopLeftRadius: "16px",
      borderBottomLeftRadius: "16px",
      borderBottomRightRadius: "16px",
    };
  }

  return {
    alignSelf: "flex-start",
    backgroundColor: "white",
    color: "#1a1a1a",
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "16px",
    borderBottomLeftRadius: "16px",
    borderBottomRightRadius: "16px",
    border: "1px solid #ffe0e0",
  };
};

export default function MessagesPage() {
  const [threads] = useState(SAMPLE_THREADS);
  const [activeThreadId, setActiveThreadId] = useState(
    SAMPLE_THREADS[0]?.id ?? null
  );

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  return (
    <Layout>
      <div
        style={{
          background: "linear-gradient(135deg, #fff7f7 0%, #ffe5e5 100%)",
          borderRadius: "16px",
          boxShadow: "0 24px 48px rgba(255,64,64,0.08)",
          border: "1px solid #ffd6d6",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          minHeight: "620px",
          overflow: "hidden",
        }}
      >
        <aside
          style={{
            backgroundColor: "rgba(255,255,255,0.82)",
            borderRight: "1px solid #ffd6d6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "20px 20px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#d10000",
              }}
            >
              Messages
            </h2>
            <button
              type="button"
              style={{
                border: "none",
                backgroundColor: "#FF4040",
                color: "white",
                borderRadius: "999px",
                padding: "8px 16px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 8px 16px rgba(255,64,64,0.24)",
              }}
            >
              ＋ New Chat
            </button>
          </div>

          <div
            style={{
              padding: "0 12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflowY: "auto",
            }}
          >
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{
                    border: "none",
                    background: isActive ? "#ffefef" : "#ffffff",
                    borderRadius: "14px",
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: isActive
                      ? "0 12px 24px rgba(255,64,64,0.18)"
                      : "0 3px 12px rgba(0,0,0,0.06)",
                    borderLeft: isActive ? "4px solid #FF4040" : "4px solid transparent",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#c00000",
                        fontSize: "0.95rem",
                      }}
                    >
                      {thread.customer}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#9a6a6a",
                      }}
                    >
                      {thread.updatedAt}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "6px 0",
                      fontSize: "0.85rem",
                      color: "#555",
                      fontWeight: 600,
                    }}
                  >
                    {thread.subject}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "#8c5c5c",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {thread.lastMessage}
                  </p>
                  <div
                    style={{
                      marginTop: "10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "rgba(255,64,64,0.08)",
                      color: "#c00000",
                      borderRadius: "999px",
                      padding: "4px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    <span>Job</span>
                    <span>{thread.jobNumber}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section
          style={{
            backgroundColor: "rgba(255,250,250,0.9)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeThread ? (
            <>
              <header
                style={{
                  padding: "24px 32px 20px",
                  borderBottom: "1px solid #ffd6d6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#d10000",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                    }}
                  >
                    {activeThread.customer}
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#8c5c5c",
                      fontSize: "0.95rem",
                    }}
                  >
                    {activeThread.subject}
                  </p>
                </div>

                <Link href={`/job-cards/${activeThread.jobNumber}`}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 18px",
                      borderRadius: "999px",
                      backgroundColor: "#FF4040",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "none",
                      boxShadow: "0 10px 22px rgba(255,64,64,0.25)",
                    }}
                  >
                    View Job Card
                  </span>
                </Link>
              </header>

              <div
                style={{
                  flex: 1,
                  padding: "28px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  overflowY: "auto",
                }}
              >
                {activeThread.messages.map((message) => {
                  const bubbleStyles = getBubbleStyles(message.sender);

                  return (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        alignItems:
                          message.sender === "staff" ? "flex-end" : "flex-start",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#9a6a6a",
                          fontWeight: 600,
                        }}
                      >
                        {message.author} • {message.timestamp}
                      </span>
                      <div
                        style={{
                          ...bubbleStyles,
                          padding: "14px 18px",
                          maxWidth: "65%",
                          boxShadow:
                            message.sender === "staff"
                              ? "0 14px 30px rgba(255,64,64,0.25)"
                              : "0 6px 18px rgba(0,0,0,0.08)",
                          lineHeight: 1.45,
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer
                style={{
                  padding: "20px 24px",
                  borderTop: "1px solid #ffd6d6",
                  backgroundColor: "rgba(255,255,255,0.9)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <textarea
                    placeholder="Type a reply…"
                    rows={3}
                    disabled
                    style={{
                      flex: 1,
                      borderRadius: "12px",
                      border: "1px solid #ffc6c6",
                      padding: "12px 16px",
                      backgroundColor: "#fff7f7",
                      color: "#8c5c5c",
                      resize: "none",
                      fontSize: "0.95rem",
                    }}
                  />
                  <button
                    type="button"
                    disabled
                    style={{
                      border: "none",
                      backgroundColor: "#f3b6b6",
                      color: "white",
                      borderRadius: "12px",
                      padding: "12px 20px",
                      fontWeight: 600,
                      cursor: "not-allowed",
                    }}
                  >
                    Send
                  </button>
                </div>
                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "0.75rem",
                    color: "#b58080",
                  }}
                >
                  This is a preview inbox. Hook this panel to your messaging service
                  to enable live conversations.
                </p>
              </footer>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#b58080",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Select a conversation to start messaging.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
