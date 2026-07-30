import { describe, expect, it } from "vitest";
import {
  extractSafeMutationMetadata,
  sanitiseAuditData,
  sanitiseRoute,
} from "@/lib/audit/privacy";

describe("audit privacy helpers", () => {
  it("redacts credentials and omits free text", () => {
    expect(
      sanitiseAuditData({
        password: "secret",
        session_token: "token",
        notes: "Customer supplied a long private note",
        status: "booked",
      })
    ).toEqual({
      password: "[REDACTED]",
      session_token: "[REDACTED]",
      notes: "[OMITTED:37]",
      status: "booked",
    });
  });

  it("keeps only safe mutation identifiers and field names", () => {
    expect(
      extractSafeMutationMetadata({
        jobId: 42,
        action: "clock-in",
        password: "never-log",
        content: "private message",
      })
    ).toEqual({
      field_names: ["jobId", "action"],
      identifiers: { jobId: 42, action: "clock-in" },
    });
  });

  it("drops query strings and fragments from routes", () => {
    expect(sanitiseRoute("/job-cards/42?token=secret#section")).toBe("/job-cards/42");
  });
});
