// file location: src/lib/news/format.test.js
//
// Covers the sidebar badge's sentence, which is user-facing copy: the singular
// / plural opening and the due-date suffix have to read as sentences.
import { describe, expect, it } from "vitest";
import { formatOutstandingAckLabel } from "./format";

const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

describe("formatOutstandingAckLabel", () => {
  it("is empty with nothing outstanding", () => {
    expect(formatOutstandingAckLabel({ count: 0, dueAt: null })).toBe("");
    expect(formatOutstandingAckLabel()).toBe("");
  });
  it("reads as one update, overdue", () => {
    expect(formatOutstandingAckLabel({ count: 1, dueAt: daysFromNow(-6) })).toBe(
      "This update needs your acknowledgement. 6 days overdue."
    );
  });
  it("pluralises and keeps the due wording", () => {
    expect(formatOutstandingAckLabel({ count: 3, dueAt: daysFromNow(2) })).toBe(
      "3 updates need your acknowledgement. Due in 2 days."
    );
  });
  it("drops the due sentence when no due date is set", () => {
    expect(formatOutstandingAckLabel({ count: 2, dueAt: null })).toBe(
      "2 updates need your acknowledgement."
    );
  });
});
