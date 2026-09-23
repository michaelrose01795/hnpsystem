// file location: src/lib/messages/conversationModel.test.js
import { describe, expect, it } from "vitest";
import {
  deriveConversationType,
  extractMentionIds,
  jobNumberFromHash,
  matchSlashCommands,
  getAvailableSlashCommands,
  parseDraft,
  parseReminderWhen,
  sanitizeLinks,
} from "./conversationModel";
import { tokenizeMessage } from "./messageTokens";

const NOW = new Date(2026, 8, 23, 10, 0); // Wed 23 Sep 2026, 10:00 local
const members = [
  { userId: 7, role: "member", profile: { name: "Sam Parker" } },
  { userId: 9, role: "leader", profile: { name: "Alex Jones" } },
];

describe("parseDraft", () => {
  it("keeps plain text and collects record references anywhere in it", () => {
    const result = parseDraft("Pads for /job 24019 and /reg AB12 CDE please, part /part BP-123", { members, now: NOW });
    expect(result.content).toBe("Pads for /job 24019 and /reg AB12 CDE please, part /part BP-123");
    expect(result.references).toEqual([
      { recordType: "job_card", query: "24019", token: "/job 24019" },
      { recordType: "vehicle", query: "AB12 CDE", token: "/reg AB12 CDE" },
      { recordType: "part", query: "BP-123", token: "/part BP-123" },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("treats the legacy /12345 and /job12345 shorthands as job links", () => {
    expect(parseDraft("see /12345").references[0]).toMatchObject({ recordType: "job_card", query: "12345" });
    expect(parseDraft("see /job12345").references[0]).toMatchObject({ recordType: "job_card", query: "12345" });
  });

  it("does not swallow the next word after a job number", () => {
    const refs = parseDraft("/job 123 and more").references;
    expect(refs).toHaveLength(1);
    expect(refs[0].query).toBe("123");
  });

  it("reads a customer name up to the end of the line", () => {
    const refs = parseDraft("Call /cust Jane Smith\nthanks").references;
    expect(refs).toEqual([{ recordType: "customer", query: "Jane Smith", token: "/cust Jane Smith" }]);
  });

  it("consumes action lines and leaves the rest as the message", () => {
    const result = parseDraft("Brakes done\n/status resolved\n/priority high\n/assign @[Sam Parker](u:7)", {
      members,
      now: NOW,
    });
    expect(result.content).toBe("Brakes done");
    expect(result.status).toBe("resolved");
    expect(result.priority).toBe("high");
    expect(result.assign).toEqual({ userId: 7, name: "Sam Parker" });
  });

  it("matches /assign by plain name prefix too", () => {
    expect(parseDraft("/assign alex", { members }).assign).toEqual({ userId: 9, name: "Alex Jones" });
  });

  it("builds tasks and reminders", () => {
    const result = parseDraft("/task Order front pads\n/remind tomorrow 08:30 Chase supplier", { members, now: NOW });
    expect(result.task).toEqual({ text: "Order front pads" });
    expect(result.reminder.text).toBe("Chase supplier");
    expect(new Date(result.reminder.dueAt)).toEqual(new Date(2026, 8, 24, 8, 30));
    expect(result.content).toBe("");
  });

  it("reports commands it cannot understand", () => {
    const result = parseDraft("/status maybe\n/assign @Nobody\n/remind soon", { members, now: NOW });
    expect(result.errors).toHaveLength(3);
    expect(result.status).toBeNull();
  });

  it("maps waiting to the pending status", () => {
    expect(parseDraft("/status waiting").status).toBe("pending");
  });
});

describe("parseReminderWhen", () => {
  it("understands relative, named and dated forms", () => {
    expect(new Date(parseReminderWhen("2h call", NOW).dueAt)).toEqual(new Date(2026, 8, 23, 12, 0));
    expect(parseReminderWhen("2h call", NOW).rest).toBe("call");
    expect(new Date(parseReminderWhen("today x", NOW).dueAt)).toEqual(new Date(2026, 8, 23, 17, 0));
    expect(new Date(parseReminderWhen("friday x", NOW).dueAt)).toEqual(new Date(2026, 8, 25, 9, 0));
    expect(new Date(parseReminderWhen("2026-10-01 14:15 x", NOW).dueAt)).toEqual(new Date(2026, 9, 1, 14, 15));
    expect(new Date(parseReminderWhen("1/10 x", NOW).dueAt)).toEqual(new Date(2026, 9, 1, 9, 0));
    expect(parseReminderWhen("whenever x", NOW)).toBeNull();
  });
});

describe("conversation types", () => {
  it("derives legacy thread types from members and hashes", () => {
    expect(deriveConversationType({ members: [{ role: "customer" }] })).toBe("customer");
    expect(deriveConversationType({ uniqueHash: "jobteam:123" })).toBe("job");
    expect(deriveConversationType({ uniqueHash: "department:parts" })).toBe("department");
    expect(deriveConversationType({ uniqueHash: "announcement:1:2" })).toBe("announcement");
    expect(deriveConversationType({ uniqueHash: "demo-aa:jobteam:7" })).toBe("job");
    expect(jobNumberFromHash("demo-aa:jobteam:7")).toBe("7");
    expect(deriveConversationType({ conversationType: "department", uniqueHash: "department:parts" })).toBe("department");
    expect(deriveConversationType({ conversationType: "job", members: [{ role: "customer" }] })).toBe("customer");
    expect(jobNumberFromHash("job:555")).toBe("555");
    expect(jobNumberFromHash("jobteam:556")).toBe("556");
    expect(jobNumberFromHash("direct:1:2")).toBeNull();
  });
});

describe("links, mentions and commands", () => {
  it("drops unknown or empty links and de-duplicates", () => {
    const links = sanitizeLinks([
      { recordType: "job_card", recordId: "1" },
      { recordType: "job_card", recordId: "1", label: "dupe" },
      { recordType: "nope", recordId: "2" },
      { recordType: "vehicle", recordId: "" },
    ]);
    expect(links).toEqual([{ recordType: "job_card", recordId: "1", label: "1", href: "/job-cards/1" }]);
  });

  it("extracts mention ids", () => {
    expect(extractMentionIds("hi @[A B](u:3) and @[C](u:4) and @[A B](u:3)")).toEqual([3, 4]);
  });

  it("filters commands by role", () => {
    const tech = getAvailableSlashCommands(["Technician"]).map((cmd) => cmd.name);
    expect(tech).toContain("vhc");
    expect(tech).toContain("myjobs");
    expect(tech).not.toContain("invoice");
    expect(matchSlashCommands("rem", getAvailableSlashCommands([])).map((cmd) => cmd.name)).toEqual(["remind"]);
  });
});

describe("tokenizeMessage", () => {
  it("turns references, mentions and urls into tokens", () => {
    const tokens = tokenizeMessage("Job /job 24019 for @[Sam](u:7) see https://x.test/a. Also /reg AB12 CDE and /12345", ["Service Advisor"]);
    const kinds = tokens.filter((t) => t.type !== "text").map((t) => [t.type, t.label || t.value, t.href]);
    expect(kinds).toEqual([
      ["ref", "Job 24019", "/job-cards/24019"],
      ["mention", "Sam", undefined],
      ["url", "https://x.test/a", undefined],
      ["ref", "AB12 CDE", "/job-cards?search=AB12%20CDE"],
      ["ref", "Job 12345", "/job-cards/12345"],
    ]);
  });

  it("sends technicians to their own job view", () => {
    const [token] = tokenizeMessage("/job 42", ["Technician"]).filter((t) => t.type === "ref");
    expect(token.href).toBe("/tech/42");
  });
});
