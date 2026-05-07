// file location: src/features/customerPortal/components/CustomerBookingCalendar.js

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const STATUS_BADGES = {
  green: "Good availability",
  amber: "Limited slots",
  red: "Fully booked",
};

const STATUS_BG = {
  green: "var(--success-surface)",
  amber: "var(--warning-surface)",
  red: "var(--danger-surface)",
};

const STATUS_TEXT = {
  green: "var(--success-text)",
  amber: "var(--warning-text)",
  red: "var(--danger-text)",
};

const STATUS_NOTES = {
  green: "Great news — our team can accommodate this day.",
  amber: "Limited slots remain; we may need to confirm availability quickly.",
  red: "This day is filled. Please pick another date or message us.",
};

export default function CustomerBookingCalendar() {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const loadSlots = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customers/bookings/calendar");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Could not load availability");
        }

        const days = Array.isArray(payload?.days) ? payload.days : [];

        if (cancelled) return;

        setSlots(days);
        setSelectedSlot((prev) => {
          if (!days.length) return null;
          const match = prev ? days.find((day) => day.date === prev.date) : null;
          return match || days[0];
        });
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Unable to load booking calendar");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequestSlot = () => {
    if (!selectedSlot || selectedSlot.status === "red") return;
    router.push({
      pathname: "/customer/messages",
      query: {
        subject: `Booking request • ${selectedSlot.friendlyDate}`,
        requestedDate: selectedSlot.date,
      },
    });
  };

  const nextAvailable = slots.find((slot) => slot.status !== "red");

  return (
    <LayerSurface
      as="section"
      sectionKey="customer-booking-calendar"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            color: "var(--text-2)",
            opacity: 0.9,
          }}
        >
          Booking calendar
        </p>
        <h3
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          Pick a day that works for you
        </h3>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.8rem",
            color: "var(--text-2)",
            opacity: 0.85,
          }}
        >
          Green = plenty of slots, amber = limited slots, red = fully booked.
        </p>
      </header>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-surface)",
            color: "var(--danger-dark)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: "var(--space-2)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: "96px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--theme)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))
          : slots.map((slot) => {
              const isSelected = selectedSlot?.date === slot.date;
              const status = slot.status || "green";
              return (
                <button
                  key={slot.date}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    background: STATUS_BG[status] || STATUS_BG.green,
                    color: STATUS_TEXT[status] || STATUS_TEXT.green,
                    borderRadius: "var(--radius-md)",
                    padding: "12px",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "transform 0.15s ease",
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--primary)"
                      : "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600 }}>
                      {slot.displayDate}
                    </p>
                    {slot.isToday && (
                      <span
                        className="app-badge app-badge--accent-soft"
                        style={{ fontSize: "0.65rem" }}
                      >
                        Today
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
                    {slot.count} job{slot.count !== 1 ? "s" : ""}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                    }}
                  >
                    {STATUS_BADGES[status] || STATUS_BADGES.green}
                  </p>
                </button>
              );
            })}
      </div>

      {!loading && !slots.length && !error && (
        <p
          style={{
            margin: 0,
            padding: "var(--space-4)",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--text-1)",
            background: "var(--theme)",
            borderRadius: "var(--radius-md)",
          }}
        >
          We are still collecting availability. Please check back shortly.
        </p>
      )}

      {selectedSlot && (
        <LayerTheme
          radius="var(--radius-md)"
          padding="var(--space-4)"
          gap="var(--space-2)"
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--text-1)", opacity: 0.7 }}>
              Selected date
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-1)" }}>
              {selectedSlot.friendlyDate}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-1)" }}>
            {selectedSlot.count} booking{selectedSlot.count !== 1 ? "s" : ""}
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-1)" }}>
            {STATUS_NOTES[selectedSlot.status] ?? STATUS_NOTES.green}
          </p>

          <div
            style={{
              marginTop: "var(--space-2)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={handleRequestSlot}
              disabled={selectedSlot.status === "red"}
              className={
                selectedSlot.status === "red"
                  ? "app-btn app-btn--secondary"
                  : "app-btn app-btn--primary"
              }
            >
              {selectedSlot.status === "red"
                ? "Not available"
                : "Request this date"}
            </button>
            <p
              style={{
                margin: 0,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "var(--text-1)",
                opacity: 0.7,
              }}
            >
              {nextAvailable
                ? `Next open slot: ${nextAvailable.displayDate}`
                : "No open slots yet"}
            </p>
          </div>
        </LayerTheme>
      )}
    </LayerSurface>
  );
}
