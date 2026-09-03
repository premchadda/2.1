import { describe, it, expect } from "vitest";
import {
  getLanguageDisplayName,
  parseLanguageList,
  formatLanguagesDisplay,
  LANGUAGE_DISPLAY_NAMES,
  hasDevanagari,
  hasLatin,
  detectScript,
} from "../shared/lib/language";

describe("Language utilities", () => {
  describe("getLanguageDisplayName", () => {
    it("maps 2-letter ISO codes to proper full names", () => {
      expect(getLanguageDisplayName("en")).toBe("English");
      expect(getLanguageDisplayName("hi")).toBe("Hindi");
      expect(getLanguageDisplayName("bn")).toBe("Bengali");
      expect(getLanguageDisplayName("ta")).toBe("Tamil");
      expect(getLanguageDisplayName("te")).toBe("Telugu");
      expect(getLanguageDisplayName("mr")).toBe("Marathi");
      expect(getLanguageDisplayName("gu")).toBe("Gujarati");
      expect(getLanguageDisplayName("kn")).toBe("Kannada");
      expect(getLanguageDisplayName("ml")).toBe("Malayalam");
      expect(getLanguageDisplayName("pa")).toBe("Punjabi");
      expect(getLanguageDisplayName("or")).toBe("Odia");
      expect(getLanguageDisplayName("ur")).toBe("Urdu");
      expect(getLanguageDisplayName("as")).toBe("Assamese");
      expect(getLanguageDisplayName("sa")).toBe("Sanskrit");
    });

    it("maps 3-letter codes and common abbreviations to proper full names", () => {
      expect(getLanguageDisplayName("eng")).toBe("English");
      expect(getLanguageDisplayName("hin")).toBe("Hindi");
      expect(getLanguageDisplayName("ben")).toBe("Bengali");
      expect(getLanguageDisplayName("tam")).toBe("Tamil");
      expect(getLanguageDisplayName("tel")).toBe("Telugu");
      expect(getLanguageDisplayName("mar")).toBe("Marathi");
      expect(getLanguageDisplayName("guj")).toBe("Gujarati");
      expect(getLanguageDisplayName("kan")).toBe("Kannada");
      expect(getLanguageDisplayName("mal")).toBe("Malayalam");
      expect(getLanguageDisplayName("pun")).toBe("Punjabi");
      expect(getLanguageDisplayName("odi")).toBe("Odia");
      expect(getLanguageDisplayName("urd")).toBe("Urdu");
      expect(getLanguageDisplayName("san")).toBe("Sanskrit");
    });

    it("is case-insensitive and trims whitespace", () => {
      expect(getLanguageDisplayName("  EN  ")).toBe("English");
      expect(getLanguageDisplayName("HI")).toBe("Hindi");
      expect(getLanguageDisplayName("English")).toBe("English");
      expect(getLanguageDisplayName("hindi")).toBe("Hindi");
    });

    it("handles unknown languages gracefully by title-casing", () => {
      expect(getLanguageDisplayName("spanish")).toBe("Spanish");
      expect(getLanguageDisplayName("customlang")).toBe("Customlang");
      expect(getLanguageDisplayName("Already Proper")).toBe("Already Proper");
      expect(getLanguageDisplayName("")).toBe("");
      expect(getLanguageDisplayName(null)).toBe("");
    });
  });

  describe("parseLanguageList", () => {
    it("converts ['en', 'hi'] to ['English', 'Hindi']", () => {
      expect(parseLanguageList(["en", "hi"])).toEqual(["English", "Hindi"]);
    });

    it("converts ['Eng', 'Hin'] to ['English', 'Hindi']", () => {
      expect(parseLanguageList(["Eng", "Hin"])).toEqual(["English", "Hindi"]);
    });

    it("parses comma-separated string 'en, hi'", () => {
      expect(parseLanguageList("en, hi")).toEqual(["English", "Hindi"]);
      expect(parseLanguageList("en,hi")).toEqual(["English", "Hindi"]);
    });

    it("parses slash-separated string 'en/hi'", () => {
      expect(parseLanguageList("en/hi")).toEqual(["English", "Hindi"]);
    });

    it('parses JSON-stringified arrays like \'["en", "hi"]\'', () => {
      expect(parseLanguageList('["en", "hi"]')).toEqual(["English", "Hindi"]);
      expect(parseLanguageList("['en', 'hi']")).toEqual(["English", "Hindi"]);
    });

    it("handles single language strings", () => {
      expect(parseLanguageList("en")).toEqual(["English"]);
      expect(parseLanguageList("hi")).toEqual(["Hindi"]);
      expect(parseLanguageList(["en"])).toEqual(["English"]);
    });

    it("deduplicates languages while maintaining order", () => {
      expect(
        parseLanguageList(["en", "English", "eng", "hi", "Hindi"]),
      ).toEqual(["English", "Hindi"]);
    });

    it("falls back to default languages when empty or null", () => {
      expect(parseLanguageList(null)).toEqual(["English", "Hindi"]);
      expect(parseLanguageList(undefined)).toEqual(["English", "Hindi"]);
      expect(parseLanguageList([])).toEqual(["English", "Hindi"]);
      expect(parseLanguageList("", [])).toEqual([]);
      expect(parseLanguageList(null, [])).toEqual([]);
    });
  });

  describe("formatLanguagesDisplay", () => {
    it("formats 2 languages without overflow badge", () => {
      expect(formatLanguagesDisplay(["en", "hi"])).toBe("English, Hindi");
    });

    it("formats 1 language", () => {
      expect(formatLanguagesDisplay(["en"])).toBe("English");
    });

    it("formats 3+ languages with overflow indicator", () => {
      expect(formatLanguagesDisplay(["en", "hi", "bn"])).toBe(
        "English, Hindi +1",
      );
      expect(formatLanguagesDisplay(["en", "hi", "bn", "te"])).toBe(
        "English, Hindi +2",
      );
    });

    it("respects custom extraCountOverride", () => {
      expect(formatLanguagesDisplay(["en", "hi"], 2, 4)).toBe(
        "English, Hindi +4",
      );
    });
  });
});
