"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const STATUS_BADGES = {
  green: "Good availability",
  amber: "Limited slots",
  red: "Fully booked",
};

const STATUS_CLASSES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-rose-200 bg-rose-50 text-rose-900",
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
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">
          Booking calendar
        </p>
        <h3 className="text-xl font-semibold text-slate-900">
          Pick a day that works for you
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Green = plenty of slots, amber = limited slots, red = fully booked.
        </p>
      </header>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl bg-slate-100"
              />
            ))
          : slots.map((slot) => {
              const isSelected = selectedSlot?.date === slot.date;
              return (
                <button
                  key={slot.date}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    STATUS_CLASSES[slot.status] ?? STATUS_CLASSES.green
                  } ${isSelected ? "ring-2 ring-[#d10000]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">
                      {slot.displayDate}
                    </p>
                    {slot.isToday && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {slot.count} job{slot.count !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em]">
                    {STATUS_BADGES[slot.status] || STATUS_BADGES.green}
                  </p>

                  {slot.status === "amber" && (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Limited slots — book soon
                    </p>
                  )}

                  {slot.status === "red" && (
                    <p className="mt-2 text-sm font-medium text-rose-800">
                      Fully booked — choose another day
                    </p>
                  )}
                </button>
              );
            })}
      </div>

      {!loading && !slots.length && !error && (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          We are still collecting availability. Please check back shortly.
        </p>
      )}

      {selectedSlot && (
        <div className="mt-6 rounded-2xl border border-[#ffe0e0] bg-[#fff5f5] p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm text-slate-600">Selected date</p>
            <p className="text-lg font-semibold text-slate-900">
              {selectedSlot.friendlyDate}
            </p>
          </div>
          <p className="mt-1 text-lg text-slate-900">
            {selectedSlot.count} booking
            {selectedSlot.count !== 1 ? "s" : ""}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {STATUS_NOTES[selectedSlot.status] ?? STATUS_NOTES.green}
          </p>

          {selectedSlot.status === "red" && (
            <p className="mt-2 text-sm text-rose-800">
              Red days prevent new bookings. Please pick a different date or
              message us if it&apos;s urgent.
            </p>
          )}

          {selectedSlot.status === "amber" && (
            <p className="mt-2 text-sm text-amber-900">
              Amber days show limited slots — we&apos;ll confirm availability
              while they last.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRequestSlot}
              disabled={selectedSlot.status === "red"}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedSlot.status === "red"
                  ? "cursor-not-allowed bg-slate-300 text-slate-600"
                  : "bg-[#d10000] text-white hover:bg-[#a00000]"
              }`}
            >
              {selectedSlot.status === "red"
                ? "Not available"
                : "Request this date"}
            </button>

            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {nextAvailable
                ? `Next open slot: ${nextAvailable.displayDate}`
                : "No open slots yet"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
