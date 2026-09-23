// file location: src/lib/loanCars/bookingInput.js
//
// Which booking keys each loan car API action may accept from the browser.
// Anything not listed is dropped before it reaches the column allow-list in
// src/lib/database/loanCars.js, so an edit can never quietly flip a status or
// forge a return.

import { customerSurname, formatBookingWindow } from "@/features/loanCars/loanCarModel";

// New loan booking / Quick add / Edit.
export const EDITABLE_BOOKING_KEYS = [
  "loanCarId",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "externalReference",
  "jobId",
  "jobNumber",
  "customerId",
  "customerName",
  "customerEmail",
  "customerPhone",
  "customerAddress",
  "customerPostcode",
  "vehicleReg",
  "vehicleMakeModel",
  "mileage",
  "insuranceProvider",
  "insurancePolicyNumber",
  "licenceNumber",
  "dateOfBirth",
  "notes",
];

// Dragging a booking's edge on the calendar.
export const ADJUST_BOOKING_KEYS = ["startDate", "endDate"];

// Keys that change when and where the car is booked, and so need a fresh
// conflict check.
export const WINDOW_KEYS = ["loanCarId", "startDate", "endDate", "startTime", "endTime"];

export const pickKeys = (source = {}, keys = []) =>
  keys.reduce((picked, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) picked[key] = source[key];
    return picked;
  }, {});

export const touchesWindow = (input = {}) => WINDOW_KEYS.some((key) => Object.prototype.hasOwnProperty.call(input, key));

/** "AB12 CDE for Smith #12345 · Mon 22 Sep 09:00 → Wed 24 Sep 17:00" */
export const describeBooking = (booking, car) =>
  [
    [car?.reg || "Loan car", booking.customerName ? `for ${customerSurname(booking.customerName)}` : ""]
      .filter(Boolean)
      .join(" "),
    booking.jobNumber ? `#${booking.jobNumber}` : "",
  ]
    .filter(Boolean)
    .join(" ") + (booking.startDate ? ` · ${formatBookingWindow(booking)}` : "");
