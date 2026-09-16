// file location: src/lib/typingAssist/wordPredictor.test.js

import { describe, expect, it } from "vitest";
import { createWordPredictor } from "./wordPredictor";
import { tokenizeWords, wordsBeforeCaret } from "./textTokens";

describe("word predictor", () => {
  it("completes a word using the previous word", () => {
    const predictor = createWordPredictor();
    expect(predictor.completeWord("rega", "kind")).toEqual({ word: "regards", remainder: "rds" });
    expect(predictor.completeWord("ca", "courtesy")?.word).toBe("car");
  });

  it("keeps the typed capital", () => {
    expect(createWordPredictor().completeWord("Rega", "kind")?.word).toBe("Regards");
  });

  it("does not extend a word that is already complete", () => {
    expect(createWordPredictor().completeWord("car", "")).toBeNull();
  });

  it("predicts the next word of a common phrase", () => {
    const predictor = createWordPredictor();
    expect(predictor.predictNext("kind")).toBe("regards");
    expect(predictor.predictNext("zebra")).toBeNull();
  });

  it("learns the words a person types, but never a misspelling", () => {
    const predictor = createWordPredictor();
    expect(predictor.completeWord("alt", "the")?.word).not.toBe("alternator");
    for (let i = 0; i < 3; i += 1) predictor.learn("Replaced the alternator and the altenator belt", (w) => w !== "altenator");
    expect(predictor.completeWord("alt", "the")?.word).toBe("alternator");
    expect(predictor.predictNext("alternator")).toBe("and");
  });

  it("round-trips its learned state", () => {
    const first = createWordPredictor();
    first.learn("dashboard dashboard dashboard");
    const second = createWordPredictor({ state: JSON.parse(JSON.stringify(first.exportState())) });
    expect(second.completeWord("dashb", "")?.word).toBe("dashboard");
  });
});

describe("text tokens", () => {
  it("skips non-prose chunks and acronyms", () => {
    const words = tokenizeWords("Recieve www.x.com AB12CDE VHC iPhone parts, don't").map((t) => t.word);
    expect(words).toEqual(["Recieve", "parts", "don't"]);
  });

  it("treats short pieces beside a code as part of the code", () => {
    expect(tokenizeWords("ab12 cde").map((t) => t.word)).toEqual([]);
    expect(tokenizeWords("postcode b7 4ab please").map((t) => t.word)).toEqual(["postcode", "please"]);
    expect(tokenizeWords("fit 2 new tyres").map((t) => t.word)).toEqual(["fit", "new", "tyres"]);
  });

  it("reads the partial and previous word at the caret", () => {
    const text = "kind rega";
    expect(wordsBeforeCaret(text, text.length)).toMatchObject({ partial: "rega", previous: "kind" });
    expect(wordsBeforeCaret("kind ", 5)).toMatchObject({ partial: "", previous: "kind" });
  });
});
