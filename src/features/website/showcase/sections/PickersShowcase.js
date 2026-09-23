// file location: src/features/website/showcase/sections/PickersShowcase.js
//
// /website/dev — @family pickers: WebsiteNativeDateTimeInput (live), the calendar
// and time-picker surfaces (rendered open) and the Calendar API opt-outs.

import { useState } from "react";
import WebsiteNativeDateTimeInput from "@/features/website/components/WebsiteNativeDateTimeInput";
import { Row, ShowcaseSection } from "../ShowcasePrimitives";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00"];

export default function PickersShowcase({ section }) {
  const [date, setDate] = useState("2026-05-21");
  const [time, setTime] = useState("09:30");
  const [emptyDate, setEmptyDate] = useState("");

  return (
    <ShowcaseSection id="pickers" section={section}>
      <Row label="Triggers" hint="WebsiteNativeDateTimeInput">
        <div className="website-dev-field">
          <WebsiteNativeDateTimeInput type="date" value={date} onChange={setDate} />
          <WebsiteNativeDateTimeInput type="date" value={emptyDate} onChange={setEmptyDate} placeholder="Pick a date" />
          <WebsiteNativeDateTimeInput type="time" value={time} onChange={setTime} />
          <WebsiteNativeDateTimeInput type="date" value="" onChange={() => {}} placeholder="Disabled" disabled />
        </div>
      </Row>

      <Row label="Calendar" hint="today · selected · disabled">
        <div className="website-dev-menu-frame">
          <div className="website-calendar website-dev-calendar-static" role="dialog" aria-label="Calendar preview">
            <div className="website-calendar__header">
              <button type="button" className="website-calendar__nav" aria-label="Previous month">
                ‹
              </button>
              <div className="website-calendar__title">May 2026</div>
              <button type="button" className="website-calendar__nav" aria-label="Next month">
                ›
              </button>
            </div>
            <div className="website-calendar__weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="website-calendar__grid">
              {Array.from({ length: 35 }, (_, index) => {
                const day = index - 3;
                const inMonth = day >= 1 && day <= 31;
                const classes = [
                  "website-calendar__day",
                  !inMonth && "website-calendar__day--muted",
                  day === 15 && "website-calendar__day--today",
                  day === 21 && "website-calendar__day--selected",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={index} type="button" className={classes} disabled={index % 7 >= 5}>
                    {inMonth ? day : day < 1 ? 30 + day : day - 31}
                  </button>
                );
              })}
            </div>
            <div className="website-calendar__footer">
              <button type="button">Clear</button>
              <button type="button">Today</button>
            </div>
          </div>
        </div>
      </Row>

      <Row label="Time picker">
        <div className="website-dev-menu-frame">
          <div className="website-calendar website-time-picker website-dev-calendar-static" role="dialog" aria-label="Time preview">
            <div className="website-calendar__header">
              <div className="website-calendar__title">Preferred time</div>
            </div>
            <div className="website-time-picker__grid">
              {TIMES.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`website-time-picker__option${slot === "09:30" ? " website-time-picker__option--selected" : ""}`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="website-calendar__footer">
              <button type="button">Clear</button>
              <button type="button">09:00</button>
            </div>
          </div>
        </div>
      </Row>

      <Row label="Calendar API cells" hint="staff Calendar under the customer scope">
        <div className="website-dev-cluster">
          <button type="button" className="calendar-api__nav-button" aria-label="Previous">
            ‹
          </button>
          <button type="button" className="calendar-api__month-year">
            May 2026
          </button>
          <button type="button" className="calendar-api__today-button">
            Today
          </button>
          <button type="button" className="calendar-api__picker-cell">
            Jun
          </button>
          <div className="website-dev-day-cell">
            <button type="button" className="calendar-api__day">
              14
            </button>
          </div>
        </div>
      </Row>
    </ShowcaseSection>
  );
}
