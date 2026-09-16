// file location: src/lib/typingAssist/spellEngine.test.js
// Runs the spell engine against the REAL en-GB dictionary the browser loads.

import fs from "node:fs";
import path from "node:path";
import nspell from "nspell";
import { beforeAll, describe, expect, it } from "vitest";
import { createSpellEngine, editDistance } from "./spellEngine";
import { createSpellHost } from "./spellLoader";

let engine;

beforeAll(() => {
  const dir = path.resolve(__dirname, "../../../public/dictionaries/en-GB");
  const dictionary = nspell(fs.readFileSync(path.join(dir, "en-GB.aff"), "utf8"), fs.readFileSync(path.join(dir, "en-GB.dic"), "utf8"));
  engine = createSpellEngine(dictionary, { words: Object.keys(dictionary.data) });
}, 60000);

describe("editDistance", () => {
  it("counts a transposition as one edit", () => {
    expect(editDistance("hwole", "whole")).toBe(1);
    expect(editDistance("recieve", "receive")).toBe(1);
    expect(editDistance("car", "car")).toBe(0);
  });
});

describe("spell engine — checking", () => {
  it("accepts UK spellings", () => {
    for (const word of ["colour", "organise", "realise", "tyre", "centre", "catalogue", "licence", "Brakes", "BRAKES", "don't", "don’t"]) {
      expect(engine.check(word).ok, word).toBe(true);
    }
  });

  it("flags American spellings as us-spelling", () => {
    expect(engine.check("color")).toEqual({ ok: false, reason: "us-spelling" });
    expect(engine.check("organize")).toEqual({ ok: false, reason: "us-spelling" });
    expect(engine.check("Center")).toEqual({ ok: false, reason: "us-spelling" });
  });

  it("accepts American spellings when UK checking is off", () => {
    expect(engine.check("color", { ukSpelling: false }).ok).toBe(true);
    expect(engine.check("organize", { ukSpelling: false }).ok).toBe(true);
  });

  it("flags misspellings", () => {
    for (const word of ["recieve", "hwole", "teh", "mechanc", "seperate"]) {
      expect(engine.check(word), word).toEqual({ ok: false, reason: "misspelt" });
    }
  });

  it("treats dealership vocabulary and the personal dictionary as correct", () => {
    expect(engine.check("valeting").ok).toBe(true);
    expect(engine.check("vauxhall").ok).toBe(true);
    expect(engine.check("snorkelgasket").ok).toBe(false);
    expect(engine.check("snorkelgasket", { personal: new Set(["snorkelgasket"]) }).ok).toBe(true);
  });
});

describe("spell engine — suggestions", () => {
  it("puts the UK form of an American spelling first", () => {
    expect(engine.suggest("color")[0]).toBe("colour");
    expect(engine.suggest("analyzed")[0]).toBe("analysed");
  });

  it("puts the intended word first for common typos", () => {
    expect(engine.suggest("recieve")[0]).toBe("receive");
    expect(engine.suggest("hwole")[0]).toBe("whole");
    expect(engine.suggest("mechanc")[0]).toBe("mechanic");
    expect(engine.suggest("techncian")[0]).toBe("technician");
  });

  it("keeps the case of a capitalised word", () => {
    expect(engine.suggest("Recieve")[0]).toBe("Receive");
    expect(engine.suggest("COLOR")[0]).toBe("COLOUR");
  });

  it("completes a prefix from the dictionary", () => {
    expect(engine.complete("technici")).toContain("technician");
    expect(engine.complete("ab")).toEqual([]);
  });
});

describe("spell host", () => {
  it("answers check requests with only the wrong words", () => {
    const handle = createSpellHost(engine);
    expect(handle("check", { words: ["colour", "color", "recieve"] })).toEqual([
      ["color", "us-spelling"],
      ["recieve", "misspelt"],
    ]);
    handle("personal", { words: ["Recieve"] });
    expect(handle("check", { words: ["recieve"] })).toEqual([]);
  });
});
