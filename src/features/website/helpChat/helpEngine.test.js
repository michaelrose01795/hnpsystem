import { describe, expect, it } from "vitest";
import { answerQuestion, getGreeting, getPageGuide } from "./helpEngine";
import { PAGE_GUIDES } from "./helpKnowledge";

const SAMPLE_PATHS = {
  "stock-detail": "/website/stock/AB12CDE",
  stock: "/website/available-stock",
  shop: "/website/shop/cart",
  parts: "/website/parts-catalog",
  valuation: "/website/valuation",
  appointment: "/website/request-appointment",
  login: "/website/login",
  profile: "/website/profile",
  legal: "/website/privacy",
  home: "/website",
};

describe("website help chat engine", () => {
  it("offers exactly five opening questions on every page", () => {
    for (const guide of PAGE_GUIDES) {
      expect(guide.questions).toHaveLength(5);
      expect(getGreeting(SAMPLE_PATHS[guide.id]).suggestions).toHaveLength(5);
    }
  });

  it("resolves the page guide from the route", () => {
    for (const [id, path] of Object.entries(SAMPLE_PATHS)) {
      expect(getPageGuide(path).id).toBe(id);
    }
    expect(getPageGuide("/website/something-else").id).toBe("home");
  });

  it("answers every opening question from the knowledge base", () => {
    for (const guide of PAGE_GUIDES) {
      for (const question of guide.questions) {
        const result = answerQuestion(question, { pagePath: SAMPLE_PATHS[guide.id] });
        expect(result.entryId, `${guide.id}: "${question}"`).not.toBeNull();
        expect(result.answer.length).toBeGreaterThan(20);
      }
    }
  });

  it("routes common questions to the right entry", () => {
    expect(answerQuestion("what time do you close on saturday").entryId).toBe("opening-hours");
    expect(answerQuestion("what's your phone number").entryId).toBe("contact-phone");
    expect(answerQuestion("Where are you located?").entryId).toBe("location");
    expect(answerQuestion("Do you offer Motability cars?").entryId).toBe("motability");
  });

  it("quotes the matching paragraph of a help article", () => {
    const result = answerQuestion("How much does an MOT cost?", { pagePath: "/website/request-appointment" });
    expect(result.answer).toMatch(/£54\.85/);
  });

  it("offers the staff queue when a person is requested", () => {
    const result = answerQuestion("can I speak to a real person please");
    expect(result.offerHandoff).toBe(true);
  });

  it("falls back and offers the team when nothing matches", () => {
    const result = answerQuestion("zxqv blorp");
    expect(result.entryId).toBeNull();
    expect(result.offerHandoff).toBe(true);
  });

  it("does not repeat questions the visitor already asked", () => {
    const history = [{ author: "customer", content: "What are your opening hours?" }];
    const result = answerQuestion("Where are you located?", { pagePath: "/website", history });
    expect(result.suggestions).not.toContain("What are your opening hours?");
  });
});
