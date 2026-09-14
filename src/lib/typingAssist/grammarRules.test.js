// file location: src/lib/typingAssist/grammarRules.test.js

import { describe, expect, it } from "vitest";
import { checkGrammar, wantsAn } from "./grammarRules";

const fixes = (text, options) =>
  checkGrammar(text, options).map((issue) => [text.slice(issue.start, issue.end), issue.suggestions[0], issue.rule]);

describe("a / an", () => {
  it("knows vowel sounds, silent h and spoken letter names", () => {
    expect(wantsAn("apple")).toBe(true);
    expect(wantsAn("hour")).toBe(true);
    expect(wantsAn("unit")).toBe(false);
    expect(wantsAn("urgent")).toBe(true);
    expect(wantsAn("MOT")).toBe(true);
    expect(wantsAn("VHC")).toBe(false);
    expect(wantsAn("car")).toBe(false);
  });

  it("corrects the article only", () => {
    expect(fixes("Book a MOT today")).toEqual([["a", "an", "a-an"]]);
    expect(fixes("It needs an service")).toEqual([["an", "a", "a-an"]]);
    expect(fixes("A hour later")).toEqual([["A", "An", "a-an"]]);
    expect(fixes("It is a unit")).toEqual([]);
  });
});

describe("common grammar mistakes", () => {
  it.each([
    ["We should of called", "should of", "should have"],
    ["That is alot", "alot", "a lot"],
    ["Their is a leak", "Their is", "There is"],
    ["Its been booked in", "Its been", "It's been"],
    ["It runs better then before", "better then", "better than"],
    ["Please advice the customer", "Please advice", "Please advise"],
    ["Check the break pads", "break pads", "brake pads"],
    ["Both front tires worn", "front tires", "front tyres"],
    ["Hold a valid driving license", "driving license", "driving licence"],
  ])("%s", (text, wrong, right) => {
    const found = fixes(text).find(([span]) => span === wrong);
    expect(found?.[1]).toBe(right);
  });

  it("flags a repeated word", () => {
    expect(fixes("Replace the the pads")).toEqual([["the the", "the", "repeated-word"]]);
    expect(fixes("He had had enough")).toEqual([]);
  });

  it("capitalises i", () => {
    expect(fixes("Yes i think so")).toEqual([["i", "I", "capital-i"]]);
    expect(fixes("Yes i'm sure")).toEqual([["i", "I", "capital-i"]]);
    expect(fixes("Fluids, i.e. oil")).toEqual([]);
  });
});

describe("sentences and punctuation", () => {
  it("capitalises the start of a sentence but not after abbreviations", () => {
    expect(fixes("Pads worn. rear discs fine.")).toEqual([["rear", "Rear", "sentence-case"]]);
    expect(fixes("Parts, e.g. filters, are due")).toEqual([]);
    expect(fixes("Speak to Mr. smith")).toEqual([]);
    expect(fixes("Mileage 12.5 thousand")).toEqual([]);
  });

  it("capitalises the first word of a multi-line note only", () => {
    expect(fixes("customer called about brakes")).toEqual([["customer", "Customer", "sentence-case"]]);
    expect(fixes("customer called about brakes", { multiline: false })).toEqual([]);
  });

  it("fixes spacing around punctuation", () => {
    expect(fixes("Pads worn , discs fine")).toEqual([[" ", "", "space-before-punctuation"]]);
    expect(fixes("Pads worn,discs fine")).toEqual([[",", ", ", "space-after-punctuation"]]);
    expect(fixes("Pads worn.Discs fine")).toEqual([[".", ". ", "space-after-punctuation"]]);
    expect(fixes("Pads worn  now")).toEqual([["  ", " ", "double-space"]]);
  });

  it("leaves URLs, e-mail addresses and part numbers alone", () => {
    expect(fixes("See www.example.com for info")).toEqual([]);
    expect(fixes("Email a@b.co.uk today")).toEqual([]);
    expect(fixes("Part AB12,CD34 ordered")).toEqual([]);
  });

  it("stays quiet on clean text", () => {
    expect(fixes("Front brake pads worn to 2mm. Recommend replacing both discs and pads.")).toEqual([]);
  });
});
